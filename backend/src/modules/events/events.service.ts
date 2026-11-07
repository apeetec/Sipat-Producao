import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { execute, rows, transaction } from "../../database/pool.js";
import { AppError, notFound } from "../../shared/errors.js";
import { hashIp } from "../../shared/security.js";
import { canonicalPublicUrl } from "../../shared/public-url.js";
import type { AuthUser } from "../auth/auth.types.js";
import { adminRepository } from "../admin/admin.repository.js";
import { auditRepository } from "../audit/audit.repository.js";

function mapParticipation(row: RowDataPacket, answers: RowDataPacket[] = []) {
  return {
    id: row.id,
    userId: row.user_id,
    eventDayId: row.event_day_id,
    firstAccessAt: row.first_access_at?.toISOString(),
    lastAccessAt: row.last_access_at?.toISOString(),
    modality: row.modality ?? undefined,
    attendanceValidatedAt: row.attendance_validated_at?.toISOString(),
    videoProgressPercent: Number(row.video_progress_percent),
    videoCompletedAt: row.video_completed_at?.toISOString(),
    status: row.status,
    answers: Object.fromEntries(
      answers.map((a) => [
        a.question_id,
        {
          alternativeId: a.selected_option_id ?? undefined,
          text: a.text_answer ?? undefined,
          rating: a.rating_value ?? undefined,
        },
      ]),
    ),
    suggestions: Object.fromEntries(
      answers
        .filter((a) => a.suggestion_text)
        .map((a) => [a.question_id, a.suggestion_text]),
    ),
    submittedAt: row.submitted_at?.toISOString(),
    correctCount: row.correct_count ?? undefined,
    scoredQuestionCount: row.scored_question_count ?? undefined,
    percentage: row.percentage == null ? undefined : Number(row.percentage),
    perfectScore: Boolean(row.perfect_score),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getParticipation(
  userId: string,
  eventDayId: string,
  db?: PoolConnection,
) {
  const p = await rows<RowDataPacket[]>(
    "SELECT * FROM participations WHERE user_id=? AND event_day_id=? AND deleted_at IS NULL LIMIT 1",
    [userId, eventDayId],
    db,
  );
  if (!p[0]) return null;
  const a = await rows<RowDataPacket[]>(
    "SELECT * FROM participation_answers WHERE participation_id=? AND deleted_at IS NULL",
    [p[0].id],
    db,
  );
  return mapParticipation(p[0], a);
}

async function getDay(
  eventDayId: string,
  campaignId: string,
  db?: PoolConnection,
) {
  const d = await rows<RowDataPacket[]>(
    `SELECT e.*,c.timezone,s.video_completion_threshold_percent,s.show_correct_answers_after_submit FROM event_days e JOIN campaigns c ON c.id=e.campaign_id JOIN campaign_settings s ON s.campaign_id=c.id WHERE e.id=? AND e.campaign_id=? AND e.deleted_at IS NULL LIMIT 1`,
    [eventDayId, campaignId],
    db,
  );
  if (!d[0]) throw notFound("Evento");
  return d[0];
}

async function ensureParticipation(
  userId: string,
  eventDayId: string,
  db: PoolConnection,
) {
  const found = await rows<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM participations WHERE user_id=? AND event_day_id=? AND deleted_at IS NULL FOR UPDATE",
    [userId, eventDayId],
    db,
  );
  if (found[0]) return found[0].id;
  const id = randomUUID();
  await execute(
    `INSERT INTO participations(id,user_id,event_day_id,first_access_at,last_access_at,status) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'in_progress')`,
    [id, userId, eventDayId],
    db,
  );
  return id;
}

function assertWindow(day: RowDataPacket) {
  const now = Date.now();
  if (
    !day.active ||
    now < new Date(day.opens_at).getTime() ||
    now > new Date(day.closes_at).getTime()
  )
    throw new AppError(
      403,
      "WINDOW_CLOSED",
      "Esta sessão não está disponível neste horário.",
    );
}

function quizRequestHash(
  eventDayId: string,
  payload: {
    answers: Record<string, any>;
    suggestions: Record<string, string>;
  },
) {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    return value;
  };
  return createHash("sha256")
    .update(
      JSON.stringify({
        eventDayId,
        answers: canonicalize(payload.answers),
        suggestions: canonicalize(payload.suggestions),
      }),
    )
    .digest("hex");
}

export class EventsService {
  async list(auth: AuthUser) {
    const events = await adminRepository.listEvents(auth.campaignId);
    return auth.role === "admin"
      ? events
      : events.filter((event: any) => event.active && event.eventDate?.active !== false);
  }
  async bySlug(auth: AuthUser, slug: string) {
    const ids = await rows<(RowDataPacket & { id: string })[]>(
      "SELECT id FROM event_days WHERE campaign_id=? AND slug=? AND active=1 AND deleted_at IS NULL LIMIT 1",
      [auth.campaignId, slug],
    );
    if (!ids[0]) throw notFound("Evento");
    return this.participant(auth, ids[0].id);
  }
  async participant(auth: AuthUser, eventDayId: string) {
    const dayRow = await getDay(eventDayId, auth.campaignId);
    const day = await adminRepository.getEvent(eventDayId, auth.campaignId);
    delete (day as any).attendanceCodeHash;
    const override = auth.id
      ? await rows<RowDataPacket[]>(
          `SELECT ev.video_url FROM users u JOIN event_unit_videos ev ON ev.unit_id=u.unit_id AND ev.event_day_id=? AND ev.deleted_at IS NULL WHERE u.id=? LIMIT 1`,
          [eventDayId, auth.id],
        )
      : [];
    if (override[0]) day.videoUrl = canonicalPublicUrl(override[0].video_url);
    const participation = await getParticipation(auth.id, eventDayId);
    const includeAnswers =
      Boolean(dayRow.show_correct_answers_after_submit) &&
      participation?.status === "submitted";
    const questions = (
      await adminRepository.listQuestions(eventDayId, includeAnswers)
    ).filter((q: any) => q.active);
    const unlocked =
      participation?.modality === "in_person" ||
      Number(participation?.videoProgressPercent ?? 0) >=
        Number(dayRow.video_completion_threshold_percent);
    return {
      day,
      eventDay: day,
      questions,
      participation,
      isUnlocked: unlocked,
    };
  }
  async attendance(
    auth: AuthUser,
    eventDayId: string,
    code: string,
    ip?: string,
  ) {
    const day = await getDay(eventDayId, auth.campaignId);
    assertWindow(day);
    // A tabela é a fonte do limite, portanto reiniciar a API não libera novas tentativas.
    const recent = await rows<(RowDataPacket & { count: number })[]>(
      "SELECT COUNT(*) count FROM attendance_attempts WHERE user_id=? AND event_day_id=? AND attempted_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE)",
      [auth.id, eventDayId],
    );
    if ((recent[0]?.count ?? 0) >= 5) {
      await this.logAttendance(auth.id, eventDayId, "rate_limited", ip);
      throw new AppError(
        429,
        "ATTENDANCE_RATE_LIMITED",
        "Limite de tentativas excedido. Aguarde um minuto.",
      );
    }
    const valid = day.attendance_code_hash
      ? await bcrypt.compare(
          code.trim().toUpperCase(),
          day.attendance_code_hash,
        )
      : false;
    await this.logAttendance(
      auth.id,
      eventDayId,
      valid ? "success" : "failure",
      ip,
    );
    if (!valid)
      throw new AppError(
        422,
        "INVALID_ATTENDANCE_CODE",
        "Código de presença inválido.",
      );
    const participation = await transaction(async (db) => {
      const id = await ensureParticipation(auth.id, eventDayId, db);
      await execute(
        `UPDATE participations SET modality='in_person',attendance_validated_at=COALESCE(attendance_validated_at,UTC_TIMESTAMP(3)),last_access_at=UTC_TIMESTAMP(3),status=IF(status='not_started','in_progress',status) WHERE id=?`,
        [id],
        db,
      );
      return getParticipation(auth.id, eventDayId, db);
    });
    await auditRepository.write(
      auth,
      "ATTENDANCE_CODE_SUCCESS",
      "participations",
      participation!.id,
      undefined,
      undefined,
      ip,
    );
    return {
      success: true,
      valid: true,
      questionnaireUnlocked: true,
      message: "Presença confirmada com sucesso!",
      participation,
    };
  }
  private async logAttendance(
    userId: string,
    eventDayId: string,
    result: string,
    ip?: string,
  ) {
    await execute(
      "INSERT INTO attendance_attempts(id,user_id,event_day_id,result,ip_hash)VALUES(?,?,?,?,?)",
      [randomUUID(), userId, eventDayId, result, hashIp(ip)],
    );
  }
  async progress(
    auth: AuthUser,
    eventDayId: string,
    data: {
      currentSeconds: number;
      durationSeconds: number;
      clientEventId?: string;
    },
  ) {
    const day = await getDay(eventDayId, auth.campaignId);
    assertWindow(day);
    return transaction(async (db) => {
      const id = await ensureParticipation(auth.id, eventDayId, db);
      if (data.clientEventId) {
        const duplicate = await rows<RowDataPacket[]>(
          "SELECT id FROM video_progress_events WHERE participation_id=? AND client_event_id=? LIMIT 1 FOR UPDATE",
          [id, data.clientEventId],
          db,
        );
        if (duplicate[0]) {
          const current = await getParticipation(auth.id, eventDayId, db);
          const unlocked =
            current?.modality === "in_person" ||
            Number(current?.videoProgressPercent ?? 0) >=
              Number(day.video_completion_threshold_percent);
          return {
            videoProgressPercent: Number(current?.videoProgressPercent ?? 0),
            questionnaireUnlocked: unlocked,
            participation: current,
          };
        }
      }
      // O lock serializa eventos concorrentes e impede dois saltos artificiais simultâneos.
      const previous = await rows<RowDataPacket[]>(
        "SELECT current_seconds,reported_at FROM video_progress_events WHERE participation_id=? ORDER BY reported_at DESC LIMIT 1 FOR UPDATE",
        [id],
        db,
      );
      if (previous[0]) {
        const elapsed = Math.max(
          0,
          (Date.now() - new Date(previous[0].reported_at).getTime()) / 1000,
        );
        const allowed =
          Number(previous[0].current_seconds) + elapsed * 1.75 + 20;
        if (data.currentSeconds > allowed)
          throw new AppError(
            422,
            "INVALID_VIDEO_PROGRESS",
            "Salto de progresso incompatível com o tempo transcorrido.",
          );
      } else if (data.currentSeconds > 30)
        throw new AppError(
          422,
          "INVALID_VIDEO_PROGRESS",
          "O primeiro evento de progresso deve começar no início do vídeo.",
        );
      const percent = Math.min(
        100,
        (data.currentSeconds / data.durationSeconds) * 100,
      );
      await execute(
        `INSERT INTO video_progress_events(id,participation_id,client_event_id,current_seconds,duration_seconds)VALUES(?,?,?,?,?)`,
        [
          randomUUID(),
          id,
          data.clientEventId ?? randomUUID(),
          data.currentSeconds,
          data.durationSeconds,
        ],
        db,
      );
      await execute(
        `UPDATE participations SET modality=COALESCE(modality,'remote'),last_access_at=UTC_TIMESTAMP(3),video_progress_percent=GREATEST(video_progress_percent,?),video_completed_at=IF(GREATEST(video_progress_percent,?)>=?,COALESCE(video_completed_at,UTC_TIMESTAMP(3)),video_completed_at),status=IF(status='not_started','in_progress',status) WHERE id=?`,
        [percent, percent, day.video_completion_threshold_percent, id],
        db,
      );
      const current = await getParticipation(auth.id, eventDayId, db);
      const unlocked =
        current?.modality === "in_person" ||
        Number(current?.videoProgressPercent ?? 0) >=
          Number(day.video_completion_threshold_percent);
      return {
        videoProgressPercent: Number(current?.videoProgressPercent ?? 0),
        questionnaireUnlocked: unlocked,
        participation: current,
      };
    });
  }
  async submit(
    auth: AuthUser,
    eventDayId: string,
    payload: {
      answers: Record<string, any>;
      suggestions: Record<string, string>;
    },
    idempotencyKey?: string,
    ip?: string,
  ) {
    return transaction(async (db) => {
      const day = await getDay(eventDayId, auth.campaignId, db);
      assertWindow(day);
      const operation = `quiz:${eventDayId}`;
      const requestHash = quizRequestHash(eventDayId, payload);
      if (idempotencyKey) {
        await execute(
          `DELETE FROM idempotency_keys WHERE user_id=? AND operation=? AND idempotency_key=? AND expires_at<=UTC_TIMESTAMP(3)`,
          [auth.id, operation, idempotencyKey],
          db,
        );
        await execute(
          `INSERT IGNORE INTO idempotency_keys(id,user_id,operation,idempotency_key,request_hash,expires_at) VALUES(?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR))`,
          [randomUUID(), auth.id, operation, idempotencyKey, requestHash],
          db,
        );
        const stored = await rows<RowDataPacket[]>(
          `SELECT request_hash,response_status,response_body FROM idempotency_keys WHERE user_id=? AND operation=? AND idempotency_key=? AND deleted_at IS NULL FOR UPDATE`,
          [auth.id, operation, idempotencyKey],
          db,
        );
        if (!stored[0] || stored[0].request_hash !== requestHash)
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Esta chave de envio já foi usada com respostas diferentes.",
          );
        if (stored[0].response_status && stored[0].response_body) {
          const body =
            typeof stored[0].response_body === "string"
              ? JSON.parse(stored[0].response_body)
              : stored[0].response_body;
          return { body, replayed: true, status: 200 };
        }
      }
      const id = await ensureParticipation(auth.id, eventDayId, db);
      // FOR UPDATE garante a regra de submissão única mesmo com duplo clique/retry.
      const p = await rows<RowDataPacket[]>(
        "SELECT * FROM participations WHERE id=? FOR UPDATE",
        [id],
        db,
      );
      if (p[0]?.status === "submitted")
        throw new AppError(
          409,
          "ALREADY_SUBMITTED",
          "As respostas desta sessão já foram enviadas.",
        );
      const unlocked =
        p[0]?.modality === "in_person" ||
        Number(p[0]?.video_progress_percent) >=
          Number(day.video_completion_threshold_percent);
      if (!unlocked)
        throw new AppError(
          403,
          "QUESTIONNAIRE_LOCKED",
          "Conclua a presença ou o vídeo antes de responder.",
        );
      const questions = await rows<RowDataPacket[]>(
        "SELECT * FROM questions WHERE event_day_id=? AND active=1 AND deleted_at IS NULL ORDER BY sort_order",
        [eventDayId],
        db,
      );
      const options = await rows<RowDataPacket[]>(
        `SELECT o.* FROM question_options o JOIN questions q ON q.id=o.question_id WHERE q.event_day_id=? AND o.deleted_at IS NULL`,
        [eventDayId],
        db,
      );
      let correct = 0,
        scored = 0;
      for (const q of questions) {
        const answer = payload.answers[q.id];
        const missingRequiredAnswer =
          !answer ||
          ((q.type === "single_choice" || q.type === "rating") &&
            !answer.alternativeId) ||
          (q.type === "free_text" && !answer.text?.trim());
        if (q.required && missingRequiredAnswer)
          throw new AppError(
            422,
            "VALIDATION_ERROR",
            `A pergunta "${q.title}" é obrigatória.`,
          );
        let isCorrect: null | number = null;
        let ratingValue: number | null = answer?.rating ?? null;
        if (q.type === "single_choice" && answer?.alternativeId) {
          const selected = options.find(
            (o) => o.id === answer.alternativeId && o.question_id === q.id,
          );
          if (!selected)
            throw new AppError(
              422,
              "INVALID_OPTION",
              "Alternativa inválida para a pergunta.",
            );
          if (q.scored) {
            scored++;
            isCorrect = selected.is_correct ? 1 : 0;
            if (isCorrect) correct++;
          }
        } else if (q.type === "rating" && answer?.alternativeId) {
          const selected = options.find(
            (o) => o.id === answer.alternativeId && o.question_id === q.id,
          );
          if (!selected)
            throw new AppError(
              422,
              "INVALID_OPTION",
              "Alternativa inválida para a pergunta.",
            );
          ratingValue =
            ratingValue ??
            Number(selected.rating_value ?? Number(selected.sort_order) + 1);
        } else if (q.scored) scored++;
        await execute(
          `INSERT INTO participation_answers(id,participation_id,question_id,selected_option_id,text_answer,rating_value,suggestion_text,is_correct)VALUES(?,?,?,?,?,?,?,?)`,
          [
            randomUUID(),
            id,
            q.id,
            answer?.alternativeId ?? null,
            answer?.text ?? null,
            ratingValue,
            payload.suggestions[q.id] ?? null,
            isCorrect,
          ],
          db,
        );
      }
      const percentage = scored
        ? Math.round((correct / scored) * 10000) / 100
        : 100;
      const perfect = scored > 0 && correct === scored;
      await execute(
        `UPDATE participations SET status='submitted',submitted_at=UTC_TIMESTAMP(3),last_access_at=UTC_TIMESTAMP(3),correct_count=?,scored_question_count=?,percentage=?,perfect_score=? WHERE id=?`,
        [correct, scored, percentage, perfect ? 1 : 0, id],
        db,
      );
      await auditRepository.write(
        auth,
        "SUBMIT_QUIZ",
        "participations",
        id,
        undefined,
        {
          correctCount: correct,
          scoredQuestionCount: scored,
          percentage,
          perfectScore: perfect,
        },
        ip,
        db,
      );
      const body = {
        correctCount: correct,
        scoredQuestionCount: scored,
        percentage,
        perfectScore: perfect,
        submittedAt: new Date().toISOString(),
      };
      if (idempotencyKey)
        await execute(
          `UPDATE idempotency_keys SET response_status=201,response_body=? WHERE user_id=? AND operation=? AND idempotency_key=?`,
          [JSON.stringify(body), auth.id, operation, idempotencyKey],
          db,
        );
      return { body, replayed: false, status: idempotencyKey ? 201 : 200 };
    });
  }
  async listParticipations(
    auth: AuthUser,
    filters: { userId?: string; eventDayId?: string },
  ) {
    const where = ["u.organization_id=?", "p.deleted_at IS NULL"];
    const values: any[] = [auth.organizationId];
    if (filters.userId) {
      where.push("p.user_id=?");
      values.push(filters.userId);
    }
    if (filters.eventDayId) {
      where.push("p.event_day_id=?");
      values.push(filters.eventDayId);
    }
    const ps = await rows<RowDataPacket[]>(
      `SELECT p.* FROM participations p JOIN users u ON u.id=p.user_id WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC`,
      values,
    );
    if (!ps.length) return [];
    const ids = ps.map((p) => p.id),
      marks = ids.map(() => "?").join(",");
    const answers = await rows<RowDataPacket[]>(
      `SELECT * FROM participation_answers WHERE participation_id IN (${marks}) AND deleted_at IS NULL`,
      ids,
    );
    return ps.map((p) =>
      mapParticipation(
        p,
        answers.filter((a) => a.participation_id === p.id),
      ),
    );
  }
}
export const eventsService = new EventsService();
