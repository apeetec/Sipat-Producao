import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env.js";
import { execute, rows, transaction } from "../../database/pool.js";
import { notFound, conflict } from "../../shared/errors.js";
import { sanitizeRichHtml } from "../../shared/security.js";
import { canonicalPublicUrl } from "../../shared/public-url.js";
import { toPublicUser } from "../auth/auth.service.js";
import type { UserRow } from "../auth/auth.repository.js";

const bool = (value: unknown) => (value ? 1 : 0);
const iso = (value: Date | string | null) =>
  value ? new Date(value).toISOString() : undefined;

type UnitRow = RowDataPacket & {
  user_count?: number | string;
};

export type AdminUnit = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sortOrder: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

function mapUnit(row: UnitRow): AdminUnit {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    userCount: Number(row.user_count ?? 0),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function mapEventDate(row: RowDataPacket) {
  const eventDate = row.event_date instanceof Date
    ? row.event_date.toISOString().slice(0, 10)
    : String(row.event_date).slice(0, 10);
  return {
    id: row.id,
    name: row.name,
    eventDate,
    dateLabel: row.date_label,
    description: row.description ?? undefined,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function mapEvent(row: RowDataPacket) {
  return {
    id: row.id,
    eventDateId: row.event_date_id,
    eventDate: row.event_date_id
      ? {
          id: row.event_date_id,
          name: row.event_date_name,
          eventDate: String(row.event_date_value).slice(0, 10),
          dateLabel: row.event_date_label,
          description: row.event_date_description ?? undefined,
          active: Boolean(row.event_date_active),
          sortOrder: row.event_date_sort_order,
        }
      : undefined,
    name: row.name,
    slug: row.slug,
    dateLabel: row.date_label,
    parentId: row.parent_id ?? undefined,
    attraction: row.attraction ?? undefined,
    theme: row.theme ?? undefined,
    timezone: row.timezone ?? "America/Sao_Paulo",
    opensAt: iso(row.opens_at)!,
    closesAt: iso(row.closes_at)!,
    videoUrl: canonicalPublicUrl(row.video_url),
    videoStoragePath: row.video_storage_path ?? undefined,
    videoEmbedUrl: row.video_embed_url ?? undefined,
    videoType: row.video_type ?? undefined,
    videoAttachmentName: row.video_attachment_name ?? undefined,
    cardCoverImageUrl: canonicalPublicUrl(row.card_cover_image_url),
    bannerImageUrl: canonicalPublicUrl(row.banner_image_url),
    attendanceCodeLength: row.attendance_code_length,
    active: Boolean(row.active),
    countsForFullWeek: Boolean(row.counts_for_full_week),
    sortOrder: row.sort_order,
    speakers: [],
    unitVideoOverrides: {},
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function mapQuestion(row: RowDataPacket): any {
  return {
    id: row.id,
    eventDayId: row.event_day_id,
    title: row.title,
    type: row.type,
    required: Boolean(row.required),
    scored: Boolean(row.scored),
    suggestionPrompt: row.suggestion_prompt ?? undefined,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    alternatives: [],
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export class AdminRepository {
  async listUsers(organizationId: string, filters: Record<string, unknown>) {
    const where = ["u.organization_id = ?", "u.deleted_at IS NULL"];
    const params: unknown[] = [organizationId];
    if (filters.search) {
      where.push(
        "(u.display_name LIKE ? OR u.employee_number LIKE ? OR u.email LIKE ?)",
      );
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }
    if (filters.unitId) {
      where.push("u.unit_id = ?");
      params.push(filters.unitId);
    }
    if (filters.role) {
      where.push("u.role = ?");
      params.push(filters.role);
    }
    if (filters.active !== undefined) {
      where.push("u.active = ?");
      params.push(filters.active === "true" || filters.active === true ? 1 : 0);
    }
    const result = await rows<UserRow[]>(
      `SELECT u.*, un.slug unit_slug, un.name unit_name, ? campaign_id, NULL regulation_version, NULL regulation_accepted_at
      FROM users u LEFT JOIN units un ON un.id = u.unit_id WHERE ${where.join(" AND ")} ORDER BY u.display_name`,
      [filters.campaignId, ...params],
    );
    return result.map(toPublicUser);
  }

  async getUser(id: string, campaignId: string) {
    const result = await rows<UserRow[]>(
      `SELECT u.*, un.slug unit_slug, un.name unit_name, ? campaign_id, NULL regulation_version, NULL regulation_accepted_at
      FROM users u LEFT JOIN units un ON un.id=u.unit_id WHERE u.id=? AND u.deleted_at IS NULL LIMIT 1`,
      [campaignId, id],
    );
    if (!result[0]) throw notFound("Usuário");
    return toPublicUser(result[0]);
  }

  async createUser(
    organizationId: string,
    campaignId: string,
    data: Record<string, any>,
  ) {
    const id = randomUUID();
    const hash = await bcrypt.hash(
      data.temporaryPassword,
      env.PASSWORD_BCRYPT_ROUNDS,
    );
    await execute(
      `INSERT INTO users (id, organization_id, unit_id, employee_number, email, password_hash, first_name, last_name, display_name,
      description, role, company_name, admin_comment, must_change_password, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        data.unitId ?? null,
        data.employeeNumber,
        data.email,
        hash,
        data.firstName,
        data.lastName,
        data.displayName,
        data.description ?? null,
        data.role,
        data.company ?? null,
        data.adminComment ?? null,
        bool(data.mustChangePassword),
        bool(data.active),
      ],
    );
    return this.getUser(id, campaignId);
  }

  async updateUser(id: string, campaignId: string, data: Record<string, any>) {
    const columns: Record<string, string> = {
      employeeNumber: "employee_number",
      email: "email",
      firstName: "first_name",
      lastName: "last_name",
      displayName: "display_name",
      description: "description",
      role: "role",
      unitId: "unit_id",
      company: "company_name",
      adminComment: "admin_comment",
      mustChangePassword: "must_change_password",
      active: "active",
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns))
      if (key in data) {
        sets.push(`${column} = ?`);
        values.push(
          ["active", "mustChangePassword"].includes(key)
            ? bool(data[key])
            : data[key],
        );
      }
    if (data.temporaryPassword) {
      sets.push("password_hash = ?", "must_change_password = 1");
      values.push(
        await bcrypt.hash(data.temporaryPassword, env.PASSWORD_BCRYPT_ROUNDS),
      );
    }
    if (!sets.length) return this.getUser(id, campaignId);
    values.push(id);
    const result = await execute(
      `UPDATE users SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );
    if (!result.affectedRows) throw notFound("Usuário");
    return this.getUser(id, campaignId);
  }

  async deactivateUser(id: string, organizationId: string) {
    const current = await rows<
      (RowDataPacket & { role: string; active: number })[]
    >(
      "SELECT role, active FROM users WHERE id=? AND organization_id=? AND deleted_at IS NULL",
      [id, organizationId],
    );
    if (!current[0]) throw notFound("Usuário");
    if (current[0].role === "admin" && current[0].active) {
      const count = await rows<(RowDataPacket & { count: number })[]>(
        'SELECT COUNT(*) count FROM users WHERE organization_id=? AND role="admin" AND active=1 AND deleted_at IS NULL',
        [organizationId],
      );
      if ((count[0]?.count ?? 0) <= 1)
        throw conflict("O último administrador ativo não pode ser desativado.");
    }
    await execute(
      "UPDATE users SET active=0, deleted_at=UTC_TIMESTAMP(3) WHERE id=?",
      [id],
    );
  }

  async deactivateUsers(
    userIds: string[],
    organizationId: string,
    actorUserId: string,
  ) {
    const ids = [...new Set(userIds)];
    if (ids.includes(actorUserId))
      throw conflict("Você não pode excluir seu próprio usuário em sessão.");

    return transaction(async (db) => {
      const marks = ids.map(() => "?").join(",");
      const selected = await rows<RowDataPacket[]>(
        `SELECT id,role,active FROM users WHERE organization_id=? AND id IN (${marks}) AND deleted_at IS NULL FOR UPDATE`,
        [organizationId, ...ids],
        db,
      );
      if (selected.length !== ids.length)
        throw notFound("Um ou mais usuários");

      const selectedActiveAdmins = selected.filter(
        (user) => user.role === "admin" && user.active,
      ).length;
      if (selectedActiveAdmins > 0) {
        const activeAdmins = await rows<(RowDataPacket & { count: number })[]>(
          'SELECT COUNT(*) count FROM users WHERE organization_id=? AND role="admin" AND active=1 AND deleted_at IS NULL FOR UPDATE',
          [organizationId],
          db,
        );
        if ((activeAdmins[0]?.count ?? 0) - selectedActiveAdmins < 1)
          throw conflict("O último administrador ativo não pode ser excluído.");
      }

      await execute(
        `UPDATE users SET active=0,deleted_at=UTC_TIMESTAMP(3) WHERE organization_id=? AND id IN (${marks}) AND deleted_at IS NULL`,
        [organizationId, ...ids],
        db,
      );
      await execute(
        `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE user_id IN (${marks})`,
        ids,
        db,
      );
      return { affectedUsers: selected.length };
    });
  }

  async resetUserParticipations(
    userIds: string[],
    organizationId: string,
    campaignId: string,
    eventDayId?: string,
  ) {
    const ids = [...new Set(userIds)];
    return transaction(async (db) => {
      const userMarks = ids.map(() => "?").join(",");
      const scopedUsers = await rows<RowDataPacket[]>(
        `SELECT id FROM users WHERE organization_id=? AND id IN (${userMarks}) AND deleted_at IS NULL`,
        [organizationId, ...ids],
        db,
      );
      if (scopedUsers.length !== ids.length)
        throw notFound("Um ou mais usuários");

      const values: unknown[] = [campaignId, ...ids];
      let eventFilter = "";
      if (eventDayId) {
        eventFilter = " AND p.event_day_id=?";
        values.push(eventDayId);
      }
      const participations = await rows<RowDataPacket[]>(
        `SELECT p.id FROM participations p
         JOIN event_days e ON e.id=p.event_day_id
         WHERE e.campaign_id=? AND p.user_id IN (${userMarks})
           AND p.deleted_at IS NULL${eventFilter} FOR UPDATE`,
        values,
        db,
      );
      if (!participations.length)
        return { affectedUsers: 0, resetParticipations: 0 };

      const participationIds = participations.map((item) => item.id);
      const participationMarks = participationIds.map(() => "?").join(",");
      await execute(
        `DELETE FROM participation_answers WHERE participation_id IN (${participationMarks})`,
        participationIds,
        db,
      );
      // O desbloqueio por presença/vídeo é preservado. Apenas a submissão e a
      // pontuação são zeradas, permitindo que o colaborador responda novamente.
      await execute(
        `UPDATE participations SET status='in_progress',submitted_at=NULL,
         correct_count=NULL,scored_question_count=NULL,percentage=NULL,
         perfect_score=0,updated_at=UTC_TIMESTAMP(3)
         WHERE id IN (${participationMarks})`,
        participationIds,
        db,
      );
      const idempotencyValues: unknown[] = [campaignId, ...ids];
      let idempotencyEventFilter = "";
      if (eventDayId) {
        idempotencyEventFilter = " AND e.id=?";
        idempotencyValues.push(eventDayId);
      }
      // Um reset administrativo inicia uma nova tentativa lógica; confirmações
      // idempotentes da tentativa anterior não podem ser reapresentadas.
      await execute(
        `DELETE i FROM idempotency_keys i
         JOIN event_days e ON i.operation=CONCAT('quiz:',e.id)
         WHERE e.campaign_id=? AND i.user_id IN (${userMarks})${idempotencyEventFilter}`,
        idempotencyValues,
        db,
      );
      return {
        affectedUsers: ids.length,
        resetParticipations: participationIds.length,
      };
    });
  }

  async listUnits(organizationId: string) {
    return (
      await rows<UnitRow[]>(
        `SELECT un.*,
          (SELECT COUNT(*) FROM users u
           WHERE u.unit_id=un.id AND u.organization_id=un.organization_id
             AND u.deleted_at IS NULL) AS user_count
         FROM units un
         WHERE un.organization_id=? AND un.deleted_at IS NULL
         ORDER BY un.sort_order,un.name`,
        [organizationId],
      )
    ).map(mapUnit);
  }
  async getUnit(id: string, organizationId: string) {
    const r = await rows<UnitRow[]>(
      `SELECT un.*,
        (SELECT COUNT(*) FROM users u
         WHERE u.unit_id=un.id AND u.organization_id=un.organization_id
           AND u.deleted_at IS NULL) AS user_count
       FROM units un
       WHERE un.id=? AND un.organization_id=? AND un.deleted_at IS NULL`,
      [id, organizationId],
    );
    if (!r[0]) throw notFound("Unidade");
    return mapUnit(r[0]);
  }
  async createUnit(organizationId: string, d: any) {
    const id = randomUUID();
    await execute(
      "INSERT INTO units(id,organization_id,name,slug,active,sort_order) VALUES(?,?,?,?,?,?)",
      [id, organizationId, d.name, d.slug, bool(d.active), d.sortOrder],
    );
    return this.getUnit(id, organizationId);
  }
  async updateUnit(id: string, organizationId: string, d: any) {
    const map: any = {
      name: "name",
      slug: "slug",
      active: "active",
      sortOrder: "sort_order",
    };
    const s: string[] = [];
    const v: any[] = [];
    for (const [k, c] of Object.entries(map))
      if (k in d) {
        s.push(`${c}=?`);
        v.push(k === "active" ? bool(d[k]) : d[k]);
      }
    if (s.length) {
      v.push(id, organizationId);
      const r = await execute(
        `UPDATE units SET ${s.join(",")} WHERE id=? AND organization_id=? AND deleted_at IS NULL`,
        v,
      );
      if (!r.affectedRows) throw notFound("Unidade");
    }
    return this.getUnit(id, organizationId);
  }
  async deleteUnit(id: string, organizationId: string) {
    const users = await rows<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) count FROM users
       WHERE unit_id=? AND organization_id=? AND deleted_at IS NULL`,
      [id, organizationId],
    );
    if ((users[0]?.count ?? 0) > 0)
      throw conflict("A unidade possui usuários vinculados.");
    const result = await execute(
      `UPDATE units SET active=0,deleted_at=UTC_TIMESTAMP(3)
       WHERE id=? AND organization_id=? AND deleted_at IS NULL`,
      [id, organizationId],
    );
    if (!result.affectedRows) throw notFound("Unidade");
  }

  async listEventDates(campaignId: string) {
    const result = await rows<RowDataPacket[]>(
      `SELECT *,DATE_FORMAT(event_date,'%Y-%m-%d') event_date FROM event_dates
       WHERE campaign_id=? AND deleted_at IS NULL ORDER BY sort_order,event_date,name`,
      [campaignId],
    );
    return result.map(mapEventDate);
  }

  async getEventDate(id: string, campaignId: string) {
    const result = await rows<RowDataPacket[]>(
      `SELECT *,DATE_FORMAT(event_date,'%Y-%m-%d') event_date FROM event_dates
       WHERE id=? AND campaign_id=? AND deleted_at IS NULL LIMIT 1`,
      [id, campaignId],
    );
    if (!result[0]) throw notFound("Data da programação");
    return mapEventDate(result[0]);
  }

  async saveEventDate(campaignId: string, id: string | undefined, data: any) {
    const eventDateId = id ?? randomUUID();
    if (!id) {
      await execute(
        `INSERT INTO event_dates(id,campaign_id,name,event_date,date_label,description,active,sort_order)
         VALUES(?,?,?,?,?,?,?,?)`,
        [
          eventDateId,
          campaignId,
          data.name,
          data.eventDate,
          data.dateLabel,
          data.description ?? null,
          bool(data.active),
          data.sortOrder,
        ],
      );
    } else {
      const columns: Record<string, string> = {
        name: "name",
        eventDate: "event_date",
        dateLabel: "date_label",
        description: "description",
        active: "active",
        sortOrder: "sort_order",
      };
      const assignments: string[] = [];
      const values: any[] = [];
      for (const [key, column] of Object.entries(columns)) {
        if (key in data) {
          assignments.push(`${column}=?`);
          values.push(key === "active" ? bool(data[key]) : data[key] ?? null);
        }
      }
      if (assignments.length) {
        values.push(eventDateId, campaignId);
        const result = await execute(
          `UPDATE event_dates SET ${assignments.join(",")} WHERE id=? AND campaign_id=? AND deleted_at IS NULL`,
          values,
        );
        if (!result.affectedRows) throw notFound("Data da programação");
      }
      if (data.dateLabel !== undefined) {
        await execute(
          `UPDATE event_days SET date_label=? WHERE event_date_id=? AND campaign_id=? AND deleted_at IS NULL`,
          [data.dateLabel, eventDateId, campaignId],
        );
      }
    }
    return this.getEventDate(eventDateId, campaignId);
  }

  async deleteEventDate(id: string, campaignId: string) {
    const events = await rows<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) count FROM event_days
       WHERE event_date_id=? AND campaign_id=? AND deleted_at IS NULL`,
      [id, campaignId],
    );
    if ((events[0]?.count ?? 0) > 0)
      throw conflict("Esta data possui sessões. Reassocie todas elas a outra data antes de excluí-la.");
    const result = await execute(
      `UPDATE event_dates SET active=0,deleted_at=UTC_TIMESTAMP(3)
       WHERE id=? AND campaign_id=? AND deleted_at IS NULL`,
      [id, campaignId],
    );
    if (!result.affectedRows) throw notFound("Data da programação");
  }

  async listEvents(campaignId: string) {
    const base = (
      await rows<RowDataPacket[]>(
        `SELECT e.*,c.timezone,d.name event_date_name,DATE_FORMAT(d.event_date,'%Y-%m-%d') event_date_value,
                d.date_label event_date_label,d.description event_date_description,d.active event_date_active,
                d.sort_order event_date_sort_order
         FROM event_days e JOIN campaigns c ON c.id=e.campaign_id
         JOIN event_dates d ON d.id=e.event_date_id AND d.deleted_at IS NULL
         WHERE e.campaign_id=? AND e.deleted_at IS NULL
         ORDER BY d.sort_order,d.event_date,e.sort_order,e.opens_at`,
        [campaignId],
      )
    ).map(mapEvent);
    await this.hydrateEvents(base);
    return base;
  }
  async getEvent(id: string, campaignId: string) {
    const r = await rows<RowDataPacket[]>(
      `SELECT e.*,c.timezone,d.name event_date_name,DATE_FORMAT(d.event_date,'%Y-%m-%d') event_date_value,
              d.date_label event_date_label,d.description event_date_description,d.active event_date_active,
              d.sort_order event_date_sort_order
       FROM event_days e JOIN campaigns c ON c.id=e.campaign_id
       JOIN event_dates d ON d.id=e.event_date_id AND d.deleted_at IS NULL
       WHERE e.id=? AND e.campaign_id=? AND e.deleted_at IS NULL`,
      [id, campaignId],
    );
    if (!r[0]) throw notFound("Evento");
    const event = mapEvent(r[0]);
    await this.hydrateEvents([event]);
    return event;
  }
  private async hydrateEvents(events: any[]) {
    if (!events.length) return;
    const ids = events.map((e) => e.id);
    const marks = ids.map(() => "?").join(",");
    const speakers = await rows<RowDataPacket[]>(
      `SELECT eds.event_day_id,s.id,s.name,s.role_title,s.image_url FROM event_day_speakers eds JOIN speakers s ON s.id=eds.speaker_id WHERE eds.event_day_id IN (${marks}) AND eds.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY eds.sort_order`,
      ids,
    );
    const videos = await rows<RowDataPacket[]>(
      `SELECT event_day_id,unit_id,video_url FROM event_unit_videos WHERE event_day_id IN (${marks}) AND deleted_at IS NULL`,
      ids,
    );
    for (const e of events) {
      e.speakers = speakers
        .filter((s) => s.event_day_id === e.id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role_title ?? undefined,
          imageUrl: canonicalPublicUrl(s.image_url),
        }));
      e.unitVideoOverrides = Object.fromEntries(
        videos
          .filter((v) => v.event_day_id === e.id)
          .map((v) => [v.unit_id, canonicalPublicUrl(v.video_url)]),
      );
    }
  }
  async saveEvent(
    campaignId: string,
    organizationId: string,
    id: string | undefined,
    d: any,
  ) {
    return transaction(async (db) => {
      const eventId = id ?? randomUUID();
      let eventDate: any;
      if (d.eventDateId) {
        const dates = await rows<RowDataPacket[]>(
          `SELECT id,date_label,active FROM event_dates
           WHERE id=? AND campaign_id=? AND deleted_at IS NULL LIMIT 1`,
          [d.eventDateId, campaignId],
          db,
        );
        eventDate = dates[0];
        if (!eventDate) throw notFound("Data da programação");
        if (!eventDate.active) {
          const current = id
            ? await rows<RowDataPacket[]>(
                "SELECT event_date_id FROM event_days WHERE id=? AND campaign_id=? AND deleted_at IS NULL",
                [id, campaignId],
                db,
              )
            : [];
          if (!id || current[0]?.event_date_id !== eventDate.id)
            throw conflict("Não é possível associar uma sessão a uma data inativa.");
        }
      }
      const codeHash = d.attendanceCode
        ? await bcrypt.hash(
            d.attendanceCode.toUpperCase(),
            env.PASSWORD_BCRYPT_ROUNDS,
          )
        : undefined;
      if (!id) {
        await execute(
          `INSERT INTO event_days(id,campaign_id,event_date_id,parent_id,name,slug,date_label,attraction,theme,opens_at,closes_at,video_url,video_storage_path,video_embed_url,video_type,video_attachment_name,card_cover_image_url,banner_image_url,attendance_code_hash,attendance_code_length,active,counts_for_full_week,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            eventId,
            campaignId,
            d.eventDateId,
            d.parentId ?? null,
            d.name,
            d.slug,
            eventDate.date_label,
            d.attraction ?? null,
            d.theme ?? null,
            new Date(d.opensAt),
            new Date(d.closesAt),
            d.videoUrl || null,
            d.videoStoragePath ?? null,
            d.videoEmbedUrl || null,
            d.videoType ?? null,
            d.videoAttachmentName ?? null,
            d.cardCoverImageUrl || null,
            d.bannerImageUrl || null,
            codeHash ?? null,
            d.attendanceCode?.length ?? 0,
            bool(d.active),
            bool(d.countsForFullWeek),
            d.sortOrder,
          ],
          db,
        );
      } else {
        const map: any = {
          eventDateId: "event_date_id",
          parentId: "parent_id",
          name: "name",
          slug: "slug",
          attraction: "attraction",
          theme: "theme",
          opensAt: "opens_at",
          closesAt: "closes_at",
          videoUrl: "video_url",
          videoStoragePath: "video_storage_path",
          videoEmbedUrl: "video_embed_url",
          videoType: "video_type",
          videoAttachmentName: "video_attachment_name",
          cardCoverImageUrl: "card_cover_image_url",
          bannerImageUrl: "banner_image_url",
          active: "active",
          countsForFullWeek: "counts_for_full_week",
          sortOrder: "sort_order",
        };
        const s: string[] = [];
        const v: any[] = [];
        for (const [k, c] of Object.entries(map))
          if (k in d) {
            s.push(`${c}=?`);
            v.push(
              ["active", "countsForFullWeek"].includes(k)
                ? bool(d[k])
                : ["opensAt", "closesAt"].includes(k)
                  ? new Date(d[k])
                  : d[k] || null,
            );
          }
        if (codeHash) {
          s.push("attendance_code_hash=?", "attendance_code_length=?");
          v.push(codeHash, d.attendanceCode.length);
        }
        if (eventDate) {
          s.push("date_label=?");
          v.push(eventDate.date_label);
        }
        if (s.length) {
          v.push(eventId, campaignId);
          await execute(
            `UPDATE event_days SET ${s.join(",")} WHERE id=? AND campaign_id=?`,
            v,
            db,
          );
        }
      }
      if (d.speakers) {
        await execute(
          "UPDATE event_day_speakers SET deleted_at=UTC_TIMESTAMP(3) WHERE event_day_id=?",
          [eventId],
          db,
        );
        let order = 0;
        for (const s of d.speakers) {
          const speakerId = s.id ?? randomUUID();
          if (!s.id)
            await execute(
              "INSERT INTO speakers(id,organization_id,name,role_title,image_url)VALUES(?,?,?,?,?)",
              [
                speakerId,
                organizationId,
                s.name,
                s.role ?? null,
                s.imageUrl || null,
              ],
              db,
            );
          await execute(
            `INSERT INTO event_day_speakers(event_day_id,speaker_id,sort_order,deleted_at)VALUES(?,?,?,NULL) ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order),deleted_at=NULL`,
            [eventId, speakerId, order++],
            db,
          );
        }
      }
      if (d.unitVideoOverrides) {
        await execute(
          "UPDATE event_unit_videos SET deleted_at=UTC_TIMESTAMP(3) WHERE event_day_id=?",
          [eventId],
          db,
        );
        for (const [unitId, url] of Object.entries(d.unitVideoOverrides))
          await execute(
            `INSERT INTO event_unit_videos(event_day_id,unit_id,video_url,deleted_at)VALUES(?,?,?,NULL) ON DUPLICATE KEY UPDATE video_url=VALUES(video_url),deleted_at=NULL`,
            [eventId, unitId, url],
            db,
          );
      }
      return eventId;
    });
  }
  async deleteEvent(id: string, campaignId: string) {
    const result = await execute(
      `UPDATE event_days SET active=0,deleted_at=UTC_TIMESTAMP(3)
       WHERE id=? AND campaign_id=? AND deleted_at IS NULL`,
      [id, campaignId],
    );
    if (!result.affectedRows) throw notFound("Evento");
  }

  async deleteEvents(eventIds: string[], campaignId: string) {
    const ids = [...new Set(eventIds)];
    return transaction(async (db) => {
      const marks = ids.map(() => "?").join(",");
      const selected = await rows<RowDataPacket[]>(
        `SELECT id FROM event_days
         WHERE campaign_id=? AND id IN (${marks}) AND deleted_at IS NULL
         FOR UPDATE`,
        [campaignId, ...ids],
        db,
      );
      if (selected.length !== ids.length)
        throw notFound("Um ou mais eventos");

      const result = await execute(
        `UPDATE event_days SET active=0,deleted_at=UTC_TIMESTAMP(3)
         WHERE campaign_id=? AND id IN (${marks}) AND deleted_at IS NULL`,
        [campaignId, ...ids],
        db,
      );
      return { affectedEvents: result.affectedRows };
    });
  }

  async listQuestions(eventDayId?: string, includeAnswers = true) {
    const where = eventDayId
      ? "WHERE q.event_day_id=? AND q.deleted_at IS NULL"
      : "WHERE q.deleted_at IS NULL";
    const qs = (
      await rows<RowDataPacket[]>(
        `SELECT q.* FROM questions q ${where} ORDER BY q.event_day_id,q.sort_order`,
        eventDayId ? [eventDayId] : [],
      )
    ).map(mapQuestion);
    if (qs.length) {
      const ids = qs.map((q) => q.id),
        marks = ids.map(() => "?").join(",");
      const opts = await rows<RowDataPacket[]>(
        `SELECT * FROM question_options WHERE question_id IN (${marks}) AND deleted_at IS NULL ORDER BY sort_order`,
        ids,
      );
      for (const q of qs)
        q.alternatives = opts
          .filter((o) => o.question_id === q.id)
          .map((o) => ({
            id: o.id,
            text: o.text,
            ...(includeAnswers ? { isCorrect: Boolean(o.is_correct) } : {}),
            ratingValue: o.rating_value ?? undefined,
          }));
    }
    return qs;
  }
  async getQuestion(id: string) {
    const all = await this.listQuestions();
    const q = all.find((x) => x.id === id);
    if (!q) throw notFound("Pergunta");
    return q;
  }
  async saveQuestion(id: string | undefined, d: any) {
    return transaction(async (db) => {
      const qid = id ?? randomUUID();
      if (!id)
        await execute(
          "INSERT INTO questions(id,event_day_id,title,type,required,scored,suggestion_prompt,sort_order,active)VALUES(?,?,?,?,?,?,?,?,?)",
          [
            qid,
            d.eventDayId,
            d.title,
            d.type,
            bool(d.required),
            bool(d.scored),
            d.suggestionPrompt ?? null,
            d.sortOrder,
            bool(d.active),
          ],
          db,
        );
      else {
        const map: any = {
          eventDayId: "event_day_id",
          title: "title",
          type: "type",
          required: "required",
          scored: "scored",
          suggestionPrompt: "suggestion_prompt",
          sortOrder: "sort_order",
          active: "active",
        };
        const s: string[] = [];
        const v: any[] = [];
        for (const [k, c] of Object.entries(map))
          if (k in d) {
            s.push(`${c}=?`);
            v.push(
              ["required", "scored", "active"].includes(k) ? bool(d[k]) : d[k],
            );
          }
        if (s.length) {
          v.push(qid);
          await execute(
            `UPDATE questions SET ${s.join(",")} WHERE id=?`,
            v,
            db,
          );
        }
      }
      if (d.alternatives) {
        await execute(
          "UPDATE question_options SET deleted_at=UTC_TIMESTAMP(3) WHERE question_id=?",
          [qid],
          db,
        );
        let order = 0;
        for (const a of d.alternatives) {
          const aid = a.id ?? randomUUID();
          const optionOrder = order++;
          await execute(
            `INSERT INTO question_options(id,question_id,text,is_correct,rating_value,sort_order,deleted_at) VALUES(?,?,?,?,?,?,NULL) ON DUPLICATE KEY UPDATE text=VALUES(text),is_correct=VALUES(is_correct),rating_value=VALUES(rating_value),sort_order=VALUES(sort_order),deleted_at=NULL`,
            [
              aid,
              qid,
              a.text,
              bool(a.isCorrect),
              a.ratingValue ?? (d.type === "rating" ? optionOrder + 1 : null),
              optionOrder,
            ],
            db,
          );
        }
      }
      return qid;
    });
  }
  async deleteQuestion(id: string) {
    await execute(
      "UPDATE questions SET active=0,deleted_at=UTC_TIMESTAMP(3) WHERE id=?",
      [id],
    );
    await execute(
      "UPDATE question_options SET deleted_at=UTC_TIMESTAMP(3) WHERE question_id=?",
      [id],
    );
  }

  async getSettings(campaignId: string) {
    const r = await rows<RowDataPacket[]>(
      `SELECT c.*,s.* FROM campaigns c JOIN campaign_settings s ON s.campaign_id=c.id WHERE c.id=? AND c.deleted_at IS NULL`,
      [campaignId],
    );
    if (!r[0]) throw notFound("Configurações");
    const x = r[0];
    const links = await rows<RowDataPacket[]>(
      "SELECT label,url,open_in_new_tab FROM campaign_links WHERE campaign_id=? AND deleted_at IS NULL ORDER BY sort_order",
      [campaignId],
    );
    const reg = await this.getRegulation(campaignId);
    return {
      eventName: x.name,
      eventYear: x.year,
      primaryLogoUrl: x.primary_logo_url ?? undefined,
      desktopBannerUrl: x.desktop_banner_url ?? undefined,
      mobileBannerUrl: x.mobile_banner_url ?? undefined,
      customLinks: links.map((l) => ({
        label: l.label,
        url: l.url,
        openInNewTab: Boolean(l.open_in_new_tab),
      })),
      videoCompletionThresholdPercent: Number(
        x.video_completion_threshold_percent,
      ),
      showCorrectAnswersAfterSubmit: Boolean(
        x.show_correct_answers_after_submit,
      ),
      maskEmployeeNumberInWinners: Boolean(x.mask_employee_number_in_winners),
      initialPasswordHelpText: x.initial_password_help_text ?? "",
      activeRegulationVersion: reg?.version ?? "",
      privacyPolicyUrl: x.privacy_policy_url ?? undefined,
      brandName: x.brand_name ?? undefined,
      brandSubtitle: x.brand_subtitle ?? undefined,
      primaryColor: x.primary_color ?? undefined,
      primaryDarkColor: x.primary_dark_color ?? undefined,
      actionColor: x.action_color ?? undefined,
      backgroundColor: x.background_color ?? undefined,
      loginTitle: x.login_title ?? undefined,
      loginSubtitle: x.login_subtitle ?? undefined,
      loginBadgeText: x.login_badge_text ?? undefined,
      homeHeadline: x.home_headline ?? undefined,
      homeDescription: x.home_description ?? undefined,
      regulationTitle: x.regulation_title ?? undefined,
      supportContact: x.support_contact ?? undefined,
    };
  }
  async updateSettings(campaignId: string, d: any) {
    const campaign: any = { eventName: "name", eventYear: "year" };
    const settings: any = {
      primaryLogoUrl: "primary_logo_url",
      desktopBannerUrl: "desktop_banner_url",
      mobileBannerUrl: "mobile_banner_url",
      videoCompletionThresholdPercent: "video_completion_threshold_percent",
      showCorrectAnswersAfterSubmit: "show_correct_answers_after_submit",
      maskEmployeeNumberInWinners: "mask_employee_number_in_winners",
      initialPasswordHelpText: "initial_password_help_text",
      privacyPolicyUrl: "privacy_policy_url",
      brandName: "brand_name",
      brandSubtitle: "brand_subtitle",
      primaryColor: "primary_color",
      primaryDarkColor: "primary_dark_color",
      actionColor: "action_color",
      backgroundColor: "background_color",
      loginTitle: "login_title",
      loginSubtitle: "login_subtitle",
      loginBadgeText: "login_badge_text",
      homeHeadline: "home_headline",
      homeDescription: "home_description",
      regulationTitle: "regulation_title",
      supportContact: "support_contact",
    };
    return transaction(async (db) => {
      for (const [map, table, key] of [
        [campaign, "campaigns", "id"],
        [settings, "campaign_settings", "campaign_id"],
      ] as const) {
        const s: string[] = [];
        const v: any[] = [];
        for (const [k, c] of Object.entries(map))
          if (k in d) {
            s.push(`${c}=?`);
            v.push(
              [
                "showCorrectAnswersAfterSubmit",
                "maskEmployeeNumberInWinners",
              ].includes(k)
                ? bool(d[k])
                : d[k] || null,
            );
          }
        if (s.length) {
          v.push(campaignId);
          await execute(
            `UPDATE ${table} SET ${s.join(",")} WHERE ${key}=?`,
            v,
            db,
          );
        }
      }
      if (d.customLinks) {
        await execute(
          "UPDATE campaign_links SET deleted_at=UTC_TIMESTAMP(3) WHERE campaign_id=?",
          [campaignId],
          db,
        );
        let order = 0;
        for (const l of d.customLinks)
          await execute(
            "INSERT INTO campaign_links(id,campaign_id,label,url,open_in_new_tab,sort_order)VALUES(?,?,?,?,?,?)",
            [
              randomUUID(),
              campaignId,
              l.label,
              l.url,
              bool(l.openInNewTab),
              order++,
            ],
            db,
          );
      }
      return this.getSettings(campaignId);
    });
  }
  async getRegulation(campaignId: string, version?: string) {
    const p: any[] = [campaignId];
    let v = "";
    if (version) {
      v = " AND version=?";
      p.push(version);
    }
    const r = await rows<RowDataPacket[]>(
      `SELECT * FROM regulations WHERE campaign_id=? AND deleted_at IS NULL${v} ORDER BY published DESC,effective_from DESC LIMIT 1`,
      p,
    );
    const x = r[0];
    return x
      ? {
          version: x.version,
          title: x.title,
          contentHtml: x.content_html,
          pdfUrl: x.pdf_url ?? undefined,
          published: Boolean(x.published),
          effectiveFrom: iso(x.effective_from)!,
          createdAt: iso(x.created_at)!,
        }
      : null;
  }
  async saveRegulation(campaignId: string, userId: string, d: any) {
    const existing = await rows<RowDataPacket[]>(
      "SELECT id FROM regulations WHERE campaign_id=? AND version=?",
      [campaignId, d.version],
    );
    const html = sanitizeRichHtml(d.contentHtml);
    if (existing[0])
      await execute(
        "UPDATE regulations SET title=?,content_html=?,pdf_url=?,published=?,effective_from=? WHERE id=?",
        [
          d.title,
          html,
          d.pdfUrl || null,
          bool(d.published),
          new Date(d.effectiveFrom),
          existing[0].id,
        ],
      );
    else
      await execute(
        "INSERT INTO regulations(id,campaign_id,version,title,content_html,pdf_url,published,effective_from,created_by)VALUES(?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          campaignId,
          d.version,
          d.title,
          html,
          d.pdfUrl || null,
          bool(d.published),
          new Date(d.effectiveFrom),
          userId,
        ],
      );
    return this.getRegulation(campaignId, d.version);
  }
}

export const adminRepository = new AdminRepository();
