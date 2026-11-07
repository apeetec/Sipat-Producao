import request from "supertest";
import type { RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";

const integration =
  process.env.RUN_DB_INTEGRATION === "true" ? describe : describe.skip;

integration("API integrada com MariaDB", () => {
  it(
    "executa autenticação, CRUD administrativo, participação, sorteio e auditoria",
    async () => {
      process.env.PUBLIC_BASE_URL = "https://backend.example.test";
      const [{ createApp }, { pool, rows }] = await Promise.all([
        import("../src/app.js"),
        import("../src/database/pool.js"),
      ]);

      const app = createApp();
      const adminAgent = request.agent(app);
      const participantAgent = request.agent(app);
      const suffix = `${Date.now()}`;
      const participantEmployee = `it-user-${suffix}`;
      const participantTemporaryPassword = "Temporary2026";
      const participantNewPassword = "Participant2026";

      try {
        const readiness = await request(app).get("/api/health/ready");
        expect(readiness.status).toBe(200);
        expect(readiness.body).toEqual({ status: "ready" });

        const adminLogin = await adminAgent.post("/api/auth/login").send({
          employeeNumber: process.env.BOOTSTRAP_ADMIN_EMPLOYEE,
          password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
        });
        expect(adminLogin.status).toBe(200);
        expect(adminLogin.body.user.role).toBe("admin");
        expect(adminLogin.headers["set-cookie"]?.[0]).toContain("HttpOnly");
        expect(adminLogin.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");

        const refresh = await adminAgent.post("/api/auth/refresh").send({});
        expect(refresh.status).toBe(200);
        expect(refresh.body.token).toEqual(expect.any(String));
        const adminToken = refresh.body.token as string;
        const asAdmin = (call: request.Test) =>
          call.set("Authorization", `Bearer ${adminToken}`);

        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        );
        const upload = await asAdmin(
          request(app)
            .post("/api/admin/uploads")
            .field("kind", "image")
            .attach("file", png, { filename: "pixel.png", contentType: "image/png" }),
        );
        expect(upload.status).toBe(201);
        expect(upload.body.mimeType).toBe("image/png");
        expect(upload.body.url).toMatch(
          /^https:\/\/backend\.example\.test\/api\/uploads\/image\//,
        );
        const uploadedAsset = await request(app).get(new URL(upload.body.url).pathname);
        expect(uploadedAsset.status).toBe(200);
        expect(uploadedAsset.headers["content-type"]).toContain("image/png");

        const emailReport = await asAdmin(
          request(app)
            .post("/api/admin/reports/email")
            .field("recipients", JSON.stringify(["qa@example.test"]))
            .field("subject", "Relatório integrado")
            .field("message", "Teste automático do outbox local.")
            .attach("attachment", Buffer.from("PK\u0003\u0004integration"), {
              filename: "relatorio.xlsx",
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
        );
        expect(emailReport.status).toBe(202);
        expect(emailReport.body).toMatchObject({ accepted: true, mode: "outbox" });

        const clientAudit = await asAdmin(
          request(app).post("/api/admin/audit/client-events"),
        ).send({
          action: "BATCH_USER_IMPORT",
          entityId: `integration-${suffix}`,
          afterData: { totalProcessed: 0 },
        });
        expect(clientAudit.status).toBe(201);
        expect(clientAudit.body.actorUserId).toBe(adminLogin.body.user.id);

        const unitResponse = await asAdmin(
          request(app).post("/api/admin/units"),
        ).send({
          name: `Unidade integração ${suffix}`,
          slug: `unidade-it-${suffix}`,
          active: true,
          sortOrder: 1,
        });
        expect(unitResponse.status).toBe(201);
        const unitId = unitResponse.body.id as string;

        const participantResponse = await asAdmin(
          request(app).post("/api/admin/users"),
        ).send({
          employeeNumber: participantEmployee,
          email: `${participantEmployee}@example.test`,
          firstName: "Pessoa",
          lastName: "Integração",
          displayName: `Pessoa Integração ${suffix}`,
          role: "collaborator",
          unitId,
          company: "Empresa de teste",
          mustChangePassword: true,
          active: true,
          temporaryPassword: participantTemporaryPassword,
        });
        expect(participantResponse.status).toBe(201);
        const participantId = participantResponse.body.id as string;

        const regulationVersion = `it-${suffix}`;
        const regulationResponse = await asAdmin(
          request(app).put("/api/admin/regulations"),
        ).send({
          version: regulationVersion,
          title: "Regulamento do teste integrado",
          contentHtml:
            '<p onclick="alert(1)">Conteúdo seguro</p><script>alert(1)</script>',
          published: true,
          effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        });
        expect(regulationResponse.status).toBe(200);
        expect(regulationResponse.body.contentHtml).toBe(
          "<p>Conteúdo seguro</p>",
        );

        const integrationDate = new Date(Date.UTC(2050, 0, 1 + (Number(suffix) % 10000)))
          .toISOString()
          .slice(0, 10);
        const eventDateResponse = await asAdmin(
          request(app).post("/api/admin/event-dates"),
        ).send({
          name: "Data de integração",
          eventDate: integrationDate,
          dateLabel: `Data ${integrationDate}`,
          description: "Categoria usada pelo teste integrado",
          active: true,
          sortOrder: 1,
        });
        expect(eventDateResponse.status).toBe(201);
        const eventDateId = eventDateResponse.body.id as string;

        const opensAt = new Date(Date.now() - 3_600_000).toISOString();
        const closesAt = new Date(Date.now() + 86_400_000).toISOString();
        const attendanceCode = "IT2026";
        const eventResponse = await asAdmin(
          request(app).post("/api/admin/events"),
        ).send({
          eventDateId,
          name: `Evento integração ${suffix}`,
          slug: `evento-it-${suffix}`,
          dateLabel: "Teste integrado",
          opensAt,
          closesAt,
          attendanceCode,
          speakers: [],
          unitVideoOverrides: {},
          active: true,
          countsForFullWeek: true,
          sortOrder: 1,
        });
        expect(eventResponse.status).toBe(201);
        const eventId = eventResponse.body.id as string;

        const duplicateEvent = await asAdmin(
          request(app).post("/api/admin/events"),
        ).send({
          eventDateId,
          name: `Evento integração ${suffix}`,
          slug: `evento-it-${suffix}`,
          dateLabel: "Teste integrado",
          opensAt,
          closesAt,
          attendanceCode,
          speakers: [],
          unitVideoOverrides: {},
          active: true,
          countsForFullWeek: true,
          sortOrder: 1,
        });
        expect(duplicateEvent.status).toBe(409);

        const secondEventResponse = await asAdmin(
          request(app).post("/api/admin/events"),
        ).send({
          eventDateId,
          name: `Segundo evento integração ${suffix}`,
          slug: `segundo-evento-it-${suffix}`,
          dateLabel: "Teste integrado",
          opensAt,
          closesAt,
          attendanceCode,
          speakers: [],
          unitVideoOverrides: {},
          active: true,
          countsForFullWeek: false,
          sortOrder: 2,
        });
        expect(secondEventResponse.status).toBe(201);
        const secondEventId = secondEventResponse.body.id as string;

        const questionResponse = await asAdmin(
          request(app).post("/api/admin/questions"),
        ).send({
          eventDayId: eventId,
          title: "Qual alternativa está correta?",
          type: "single_choice",
          required: true,
          scored: true,
          sortOrder: 1,
          active: true,
          alternatives: [
            { text: "Correta", isCorrect: true },
            { text: "Incorreta", isCorrect: false },
          ],
        });
        expect(questionResponse.status).toBe(201);
        const questionId = questionResponse.body.id as string;
        const correctOptionId = questionResponse.body.alternatives.find(
          (option: { isCorrect: boolean }) => option.isCorrect,
        )?.id as string;
        expect(correctOptionId).toEqual(expect.any(String));

        const ratingQuestionResponse = await asAdmin(
          request(app).post("/api/admin/questions"),
        ).send({
          eventDayId: eventId,
          title: "Como você avalia o evento?",
          type: "rating",
          required: true,
          scored: false,
          sortOrder: 2,
          active: true,
          alternatives: [
            { text: "Ruim", ratingValue: 1 },
            { text: "Excelente", ratingValue: 5 },
          ],
        });
        expect(ratingQuestionResponse.status).toBe(201);
        const ratingQuestionId = ratingQuestionResponse.body.id as string;
        const excellentOptionId = ratingQuestionResponse.body.alternatives.find(
          (option: { ratingValue?: number }) => option.ratingValue === 5,
        )?.id as string;
        expect(excellentOptionId).toEqual(expect.any(String));

        const participantLogin = await participantAgent
          .post("/api/auth/login")
          .send({
            employeeNumber: participantEmployee,
            password: participantTemporaryPassword,
          });
        expect(participantLogin.status).toBe(200);
        const participantToken = participantLogin.body.token as string;
        const asParticipant = (call: request.Test) =>
          call.set("Authorization", `Bearer ${participantToken}`);

        const firstAccess = await asParticipant(
          request(app).post("/api/auth/first-access"),
        ).send({ newPassword: participantNewPassword });
        expect(firstAccess.status).toBe(200);
        expect(firstAccess.body.user.mustChangePassword).toBe(false);

        const acceptance = await asParticipant(
          request(app).post("/api/auth/accept-regulation"),
        ).send({ version: regulationVersion });
        expect(acceptance.status).toBe(200);
        expect(acceptance.body.user.regulationAcceptedVersion).toBe(
          regulationVersion,
        );

        const attendance = await asParticipant(
          request(app).post(`/api/events/${eventId}/attendance`),
        ).send({ attendanceCode, modality: "in_person" });
        expect(attendance.status).toBe(200);
        expect(attendance.body.valid).toBe(true);

        const quizIdempotencyKey = `integration-quiz-${suffix}`;
        const quizPayload = {
          answers: {
            [questionId]: { alternativeId: correctOptionId },
            [ratingQuestionId]: {
              alternativeId: excellentOptionId,
              rating: 5,
            },
          },
          suggestions: {},
        };
        const quiz = await asParticipant(
          request(app)
            .post(`/api/events/${eventId}/quiz`)
            .set("Idempotency-Key", quizIdempotencyKey),
        ).send(quizPayload);
        expect(quiz.status).toBe(201);
        expect(quiz.body).toMatchObject({
          correctCount: 1,
          scoredQuestionCount: 1,
          percentage: 100,
          perfectScore: true,
        });

        const replayedQuiz = await asParticipant(
          request(app)
            .post(`/api/events/${eventId}/quiz`)
            .set("Idempotency-Key", quizIdempotencyKey),
        ).send(quizPayload);
        expect(replayedQuiz.status).toBe(200);
        expect(replayedQuiz.headers["idempotency-replayed"]).toBe("true");
        expect(replayedQuiz.body).toEqual(quiz.body);

        const persistedAnswers = await rows<
          Array<RowDataPacket & {
            question_id: string;
            selected_option_id: string | null;
          }>
        >(
          `SELECT pa.question_id,pa.selected_option_id
           FROM participation_answers pa
           JOIN participations p ON p.id=pa.participation_id
           WHERE p.user_id=? AND p.event_day_id=? AND pa.deleted_at IS NULL`,
          [participantId, eventId],
        );
        expect(persistedAnswers).toHaveLength(2);
        expect(persistedAnswers).toEqual(expect.arrayContaining([
          expect.objectContaining({
            question_id: questionId,
            selected_option_id: correctOptionId,
          }),
          expect.objectContaining({
            question_id: ratingQuestionId,
            selected_option_id: excellentOptionId,
          }),
        ]));

        const listedParticipations = await asAdmin(
          request(app)
            .get("/api/admin/participations")
            .query({ userId: participantId, eventDayId: eventId }),
        );
        expect(listedParticipations.status).toBe(200);
        expect(listedParticipations.body[0].answers[questionId]).toEqual({
          alternativeId: correctOptionId,
        });
        expect(listedParticipations.body[0].answers[ratingQuestionId]).toEqual({
          alternativeId: excellentOptionId,
          rating: 5,
        });

        const reset = await asAdmin(
          request(app).post("/api/admin/users/reset-participations"),
        ).send({ userIds: [participantId], eventDayId: eventId });
        expect(reset.status).toBe(200);
        expect(reset.body).toMatchObject({
          affectedUsers: 1,
          resetParticipations: 1,
        });

        const afterReset = await asAdmin(
          request(app)
            .get("/api/admin/participations")
            .query({ userId: participantId, eventDayId: eventId }),
        );
        expect(afterReset.status).toBe(200);
        expect(afterReset.body[0]).toMatchObject({
          status: "in_progress",
          answers: {},
          perfectScore: false,
        });

        const resubmittedQuiz = await asParticipant(
          request(app).post(`/api/events/${eventId}/quiz`),
        ).send({
          answers: {
            [questionId]: { alternativeId: correctOptionId },
            [ratingQuestionId]: {
              alternativeId: excellentOptionId,
              rating: 5,
            },
          },
          suggestions: {},
        });
        expect(resubmittedQuiz.status).toBe(200);
        expect(resubmittedQuiz.body.perfectScore).toBe(true);

        const drawCriteria = {
          scope: { type: "day", eventDayId: eventId },
          unitIds: [unitId],
          excludePreviousWinners: true,
        };
        const preview = await asAdmin(
          request(app).post("/api/admin/draws/preview"),
        ).send(drawCriteria);
        expect(preview.status).toBe(200);
        expect(preview.body.map((user: { id: string }) => user.id)).toContain(
          participantId,
        );

        const draw = await asAdmin(
          request(app).post("/api/admin/draws/execute"),
        ).send({
          ...drawCriteria,
          prizeName: "Prêmio integrado",
          groupName: "Grupo de integração",
          requestedWinnerCount: 1,
        });
        expect(draw.status).toBe(201);
        expect(draw.body.actualWinnerCount).toBe(1);
        expect(draw.body.winners[0].userId).toBe(participantId);

        const publicWinners = await request(app)
          .get("/api/winners")
          .query({ dayId: eventId });
        expect(publicWinners.status).toBe(200);
        expect(publicWinners.body[0].winners[0].employeeNumber).toContain("*");
        expect(publicWinners.body[0].winners[0].employeeNumber).not.toBe(
          participantEmployee,
        );

        const audit = await asAdmin(
          request(app).get("/api/admin/audit").query({ limit: 100 }),
        );
        expect(audit.status).toBe(200);
        expect(
          audit.body.some(
            (entry: { action: string }) => entry.action === "EXECUTE_DRAW",
          ),
        ).toBe(true);

        const persisted = await rows<
          Array<RowDataPacket & {
            status: string;
            perfect_score: number;
            attendance_validated_at: Date | null;
          }>
        >(
          "SELECT status, perfect_score, attendance_validated_at FROM participations WHERE user_id=? AND event_day_id=?",
          [participantId, eventId],
        );
        expect(persisted[0]?.status).toBe("submitted");
        expect(Boolean(persisted[0]?.perfect_score)).toBe(true);
        expect(persisted[0]?.attendance_validated_at).toBeInstanceOf(Date);

        const deactivatedParticipant = await asAdmin(
          request(app).patch(`/api/admin/users/${participantId}`),
        ).send({ active: false });
        expect(deactivatedParticipant.status).toBe(200);

        const listedUnits = await asAdmin(request(app).get("/api/admin/units"));
        expect(listedUnits.status).toBe(200);
        expect(
          listedUnits.body.find((unit: { id: string }) => unit.id === unitId),
        ).toMatchObject({ id: unitId, userCount: 1 });

        const deletedUsers = await asAdmin(
          request(app).post("/api/admin/users/bulk-delete"),
        ).send({ userIds: [participantId] });
        expect(deletedUsers.status).toBe(200);
        expect(deletedUsers.body).toEqual({ affectedUsers: 1 });

        const deletedUser = await asAdmin(
          request(app).get(`/api/admin/users/${participantId}`),
        );
        expect(deletedUser.status).toBe(404);

        const deletedEvents = await asAdmin(
          request(app).post("/api/admin/events/bulk-delete"),
        ).send({ eventIds: [eventId, secondEventId] });
        expect(deletedEvents.status).toBe(200);
        expect(deletedEvents.body).toEqual({ affectedEvents: 2 });

        const deletedEvent = await asAdmin(
          request(app).get(`/api/admin/events/${eventId}`),
        );
        expect(deletedEvent.status).toBe(404);

        const repeatedDelete = await asAdmin(
          request(app).delete(`/api/admin/events/${eventId}`),
        );
        expect(repeatedDelete.status).toBe(404);

        const finalAudit = await asAdmin(
          request(app).get("/api/admin/audit").query({ limit: 100 }),
        );
        expect(finalAudit.status).toBe(200);
        expect(
          finalAudit.body.some(
            (entry: { action: string }) =>
              entry.action === "BULK_DELETE_EVENTS",
          ),
        ).toBe(true);
      } finally {
        await pool.end();
      }
    },
    60_000,
  );
});
