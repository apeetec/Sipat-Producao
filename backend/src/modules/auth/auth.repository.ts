import type { RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { execute, rows, type DbConnection } from "../../database/pool.js";
import { env } from "../../config/env.js";

export interface UserRow extends RowDataPacket {
  id: string;
  organization_id: string;
  unit_id: string | null;
  employee_number: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string;
  description: string | null;
  role: "admin" | "collaborator";
  company_name: string | null;
  admin_comment: string | null;
  must_change_password: number;
  active: number;
  created_at: Date;
  updated_at: Date;
  unit_slug: string | null;
  unit_name: string | null;
  regulation_version: string | null;
  regulation_accepted_at: Date | null;
  campaign_id: string;
}

const userSelect = `
  SELECT u.*, un.slug AS unit_slug, un.name AS unit_name, c.id AS campaign_id,
    ra.accepted_at AS regulation_accepted_at, r.version AS regulation_version
  FROM users u
  JOIN organizations o ON o.id = u.organization_id AND o.deleted_at IS NULL
  JOIN campaigns c ON c.organization_id = o.id AND c.slug = ? AND c.active = 1 AND c.deleted_at IS NULL
  LEFT JOIN units un ON un.id = u.unit_id AND un.deleted_at IS NULL
  LEFT JOIN regulation_acceptances ra ON ra.user_id = u.id AND ra.deleted_at IS NULL
  LEFT JOIN regulations r ON r.id = ra.regulation_id AND r.campaign_id = c.id
    AND r.published = 1 AND r.deleted_at IS NULL AND r.effective_from <= UTC_TIMESTAMP(3)`;

export class AuthRepository {
  async findByEmployeeNumber(employeeNumber: string): Promise<UserRow | null> {
    const result = await rows<UserRow[]>(
      `${userSelect}
      WHERE o.slug = ? AND u.employee_number = ? AND u.deleted_at IS NULL
      ORDER BY ra.accepted_at DESC LIMIT 1`,
      [
        env.DEFAULT_CAMPAIGN_SLUG,
        env.DEFAULT_ORGANIZATION_SLUG,
        employeeNumber,
      ],
    );
    return result[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const result = await rows<UserRow[]>(
      `${userSelect}
      WHERE u.id = ? AND u.deleted_at IS NULL
      ORDER BY ra.accepted_at DESC LIMIT 1`,
      [env.DEFAULT_CAMPAIGN_SLUG, id],
    );
    return result[0] ?? null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await execute(
      "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND deleted_at IS NULL",
      [passwordHash, userId],
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await execute(
      "UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [userId],
    );
  }

  async currentRegulation(
    campaignId: string,
    version?: string,
  ): Promise<(RowDataPacket & { id: string; version: string }) | null> {
    const params: unknown[] = [campaignId];
    let versionSql = "";
    if (version) {
      versionSql = " AND version = ?";
      params.push(version);
    }
    const result = await rows<
      (RowDataPacket & { id: string; version: string })[]
    >(
      `SELECT id, version FROM regulations WHERE campaign_id = ? AND published = 1 AND effective_from <= UTC_TIMESTAMP(3)
       AND deleted_at IS NULL${versionSql} ORDER BY effective_from DESC LIMIT 1`,
      params,
    );
    return result[0] ?? null;
  }

  async acceptRegulation(
    regulationId: string,
    userId: string,
    ipHash: string | null,
    userAgent: string,
  ): Promise<void> {
    await execute(
      `INSERT INTO regulation_acceptances
      (id, regulation_id, user_id, ip_hash, user_agent_summary) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE accepted_at = accepted_at`,
      [randomUUID(), regulationId, userId, ipHash, userAgent.slice(0, 500)],
    );
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    db?: DbConnection,
  ): Promise<void> {
    await execute(
      "INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [randomUUID(), userId, tokenHash, expiresAt],
      db,
    );
  }

  async rotateRefreshToken(
    oldHash: string,
    newHash: string,
    expiresAt: Date,
  ): Promise<UserRow | null> {
    const tokenRows = await rows<
      (RowDataPacket & { id: string; user_id: string })[]
    >(
      `SELECT id, user_id FROM auth_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL
       AND expires_at > UTC_TIMESTAMP(3) AND deleted_at IS NULL LIMIT 1`,
      [oldHash],
    );
    const token = tokenRows[0];
    if (!token) return null;
    await execute(
      "UPDATE auth_refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [token.id],
    );
    await this.createRefreshToken(token.user_id, newHash, expiresAt);
    return this.findById(token.user_id);
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await execute(
      "UPDATE auth_refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE token_hash = ?",
      [tokenHash],
    );
  }

  async logAccess(
    user: UserRow | null,
    employeeNumber: string,
    result: "success" | "failure" | "rate_limited",
    reason: string | null,
    ipHash: string | null,
    userAgent: string,
  ): Promise<void> {
    let organizationId = user?.organization_id;
    if (!organizationId) {
      const org = await rows<(RowDataPacket & { id: string })[]>(
        "SELECT id FROM organizations WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
        [env.DEFAULT_ORGANIZATION_SLUG],
      );
      organizationId = org[0]?.id;
    }
    if (!organizationId) return;
    await execute(
      `INSERT INTO access_logs
      (id, organization_id, user_id, employee_number_attempted, result, failure_reason, ip_hash, user_agent_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        organizationId,
        user?.id ?? null,
        employeeNumber,
        result,
        reason,
        ipHash,
        userAgent.slice(0, 500),
      ],
    );
  }
}

export const authRepository = new AuthRepository();
