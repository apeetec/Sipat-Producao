import { describe, expect, it } from "vitest";
import { eventCreate, eventDateCreate } from "../src/modules/admin/admin.schemas.js";

describe("contratos de datas da programação", () => {
  it("aceita uma categoria de data válida", () => {
    expect(eventDateCreate.parse({
      name: "Segunda-feira",
      eventDate: "2026-11-09",
      dateLabel: "9 de novembro de 2026",
      active: true,
      sortOrder: 1,
    })).toMatchObject({ eventDate: "2026-11-09", active: true });
  });

  it("exige a categoria ao criar uma sessão", () => {
    const session = {
      name: "Abertura",
      slug: "abertura",
      opensAt: "2026-11-09T12:00:00.000Z",
      closesAt: "2026-11-09T13:00:00.000Z",
      speakers: [],
      unitVideoOverrides: {},
      active: true,
      countsForFullWeek: true,
      sortOrder: 1,
    };

    expect(eventCreate.safeParse(session).success).toBe(false);
    expect(eventCreate.safeParse({
      ...session,
      eventDateId: "64ee03a3-3988-4db0-b122-190874cfec49",
    }).success).toBe(true);
  });
});
