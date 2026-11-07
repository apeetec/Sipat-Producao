import { beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

beforeAll(() => {
  process.env.DATABASE_HOST = "127.0.0.1";
  process.env.DATABASE_NAME = "test";
  process.env.DATABASE_USER = "test";
  process.env.DATABASE_PASSWORD = "test";
  process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  process.env.IP_HASH_SECRET = "b".repeat(32);
  process.env.CORS_ORIGINS = "http://localhost:3000";
});

describe("rate limit autenticado em rede NAT", () => {
  it("isola o limite por usuÃ¡rio e evento mesmo quando o IP Ã© compartilhado", async () => {
    const [{ requireAuth }, { attendanceLimiter }] = await Promise.all([
      import("../src/middlewares/auth.js"),
      import("../src/middlewares/security.js"),
    ]);
    const app = express();
    app.set("trust proxy", 1);
    app.post("/events/:id/attendance", requireAuth, attendanceLimiter, (_req, res) =>
      res.sendStatus(204),
    );
    const token = (id: string) =>
      jwt.sign(
        {
          id,
          organizationId: "10000000-0000-4000-8000-000000000001",
          campaignId: "10000000-0000-4000-8000-000000000002",
          role: "collaborator",
          employeeNumber: id,
          displayName: id,
        },
        "a".repeat(32),
        { issuer: "sipat-api", audience: "sipat-web", expiresIn: "5m" },
      );
    const eventId = "10000000-0000-4000-8000-000000000003";
    for (const userId of ["usuario-a", "usuario-b"]) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await request(app)
          .post(`/events/${eventId}/attendance`)
          .set("Authorization", `Bearer ${token(userId)}`)
          .set("X-Forwarded-For", "203.0.113.10");
        expect(response.status).toBe(204);
      }
    }
    const blocked = await request(app)
      .post(`/events/${eventId}/attendance`)
      .set("Authorization", `Bearer ${token("usuario-a")}`)
      .set("X-Forwarded-For", "203.0.113.10");
    expect(blocked.status).toBe(429);
  });
});

describe("controles de saída e comparação", () => {
  it("remove scripts e manipuladores do HTML de regulamento", async () => {
    const { sanitizeRichHtml } = await import("../src/shared/security.js");
    const result = sanitizeRichHtml(
      '<p onclick="x()">Seguro</p><script>alert(1)</script>',
    );
    expect(result).toBe("<p>Seguro</p>");
  });

  it("mascara matrícula pública", async () => {
    const { maskEmployeeNumber } = await import("../src/shared/security.js");
    expect(maskEmployeeNumber("101010")).toBe("10**10");
  });

  it("compara valores sem aceitar tamanhos diferentes", async () => {
    const { safeEqual } = await import("../src/shared/security.js");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
