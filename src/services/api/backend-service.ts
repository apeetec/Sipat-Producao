import {
  AppUser,
  EventDay,
  Question,
  Participation,
  Draw,
  DrawWinner,
  AuditLog,
  DrawScope,
  AttendanceModality,
} from '../../types';
import {
  userRepository,
  unitRepository,
  eventRepository,
  questionRepository,
  participationRepository,
  drawRepository,
  auditRepository,
  settingsRepository,
} from '../repositories';
import { sha256Hex, constantTimeCompare, validatePasswordStrength } from '../../utils/security';
import { isNodeBackendEnabled, NodeAuthApi, NodeDrawsApi, NodeEventsApi } from './node-backend-client';

export interface BackendResponse<T> {
  success: boolean;
  data?: T;
  errorCode?: string;
  message?: string;
}

// In-memory rate limiting tracker for sensitive operations
const rateLimitTracker: Record<string, { count: number; firstAttempt: number }> = {};

function checkRateLimit(key: string, maxAttempts = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitTracker[key];
  if (!entry || now - entry.firstAttempt > windowMs) {
    rateLimitTracker[key] = { count: 1, firstAttempt: now };
    return true;
  }
  entry.count++;
  return entry.count <= maxAttempts;
}

export class BackendService {
  /**
   * 1. Login por matrícula e senha
   */
  async resolveEmployeeLogin(employeeNumber: string, passwordAttempt: string): Promise<BackendResponse<{ user: AppUser; token: string }>> {
    const normEmployee = employeeNumber.trim().toLowerCase();
    const rateLimitKey = `login_${normEmployee}`;

    if (!checkRateLimit(rateLimitKey, 10, 60000)) {
      return {
        success: false,
        errorCode: 'RATE_LIMITED',
        message: 'Muitas tentativas de login. Aguarde um minuto e tente novamente.',
      };
    }

    const user = await userRepository.getByEmployeeNumber(normEmployee);

    // Generic error to prevent account enumeration
    if (!user || !user.active) {
      await auditRepository.logAccess({
        userId: user?.id || 'unknown',
        employeeNumber: normEmployee,
        result: 'failure',
        failureReason: 'Usuário inexistente ou inativo',
      });
      return {
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'Matrícula ou senha inválida.',
      };
    }

    // Temporary password / dev check simulation
    // In local mode, admin password is "admin123" or initial date format. For other users, standard initial password or stored pass
    const demoAdminPassword = import.meta.env.DEV ? import.meta.env.VITE_DEMO_ADMIN_PASSWORD : undefined;
    const demoCollaboratorPassword = import.meta.env.DEV ? import.meta.env.VITE_DEMO_COLLABORATOR_PASSWORD : undefined;
    const isSpecialAdmin = user.role === 'admin' && Boolean(demoAdminPassword) && passwordAttempt === demoAdminPassword;
    const isDevCollaborator = Boolean(demoCollaboratorPassword) && passwordAttempt === demoCollaboratorPassword;
    const isCustomStored = localStorage.getItem(`pass_${user.id}`) === passwordAttempt;

    const isValidPassword = isSpecialAdmin || isDevCollaborator || isCustomStored || (user.mustChangePassword && passwordAttempt.length >= 6);

    if (!isValidPassword) {
      await auditRepository.logAccess({
        userId: user.id,
        employeeNumber: normEmployee,
        result: 'failure',
        failureReason: 'Senha incorreta',
      });
      return {
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'Matrícula ou senha inválida.',
      };
    }

    // Success
    await auditRepository.logAccess({
      userId: user.id,
      employeeNumber: normEmployee,
      result: 'success',
    });

    const token = `token_${user.id}_${Date.now()}`;
    return {
      success: true,
      data: { user, token },
    };
  }

  /**
   * 2. Troca obrigatória de primeira senha
   */
  async completeFirstAccess(userId: string, newPassword: string): Promise<BackendResponse<AppUser>> {
    if (isNodeBackendEnabled) {
      const result = await NodeAuthApi.completeFirstAccess('', newPassword);
      return { success: result.success, data: result.user };
    }
    const user = await userRepository.getById(userId);
    if (!user) {
      return { success: false, errorCode: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
    }

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) {
      return { success: false, errorCode: 'WEAK_PASSWORD', message: check.message };
    }

    localStorage.setItem(`pass_${user.id}`, newPassword);

    const updated = await userRepository.update(userId, {
      mustChangePassword: false,
    });

    await auditRepository.logAudit({
      actorUserId: userId,
      actorName: user.displayName,
      action: 'COMPLETE_FIRST_ACCESS',
      entity: 'users',
      entityId: userId,
    });

    return { success: true, data: updated };
  }

  /**
   * 3. Aceite de regulamento
   */
  async acceptRegulation(userId: string, version: string): Promise<BackendResponse<AppUser>> {
    if (isNodeBackendEnabled) {
      const result = await NodeAuthApi.acceptRegulation(version);
      return { success: result.success, data: result.user };
    }
    const user = await userRepository.getById(userId);
    if (!user) {
      return { success: false, errorCode: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
    }

    const reg = await settingsRepository.getRegulation(version);
    if (!reg || !reg.published) {
      return { success: false, errorCode: 'INVALID_REGULATION', message: 'Regulamento inválido ou não publicado.' };
    }

    const updated = await userRepository.update(userId, {
      regulationAcceptedVersion: version,
      regulationAcceptedAt: new Date().toISOString(),
    });

    await auditRepository.logAudit({
      actorUserId: userId,
      actorName: user.displayName,
      action: 'ACCEPT_REGULATION',
      entity: 'regulations',
      entityId: version,
    });

    return { success: true, data: updated };
  }

  /**
   * 4. Validação de código presencial
   */
  async validateAttendanceCode(userId: string, eventDayId: string, code: string): Promise<{
    valid: boolean;
    questionnaireUnlocked: boolean;
    message: string;
  }> {
    if (isNodeBackendEnabled) {
      const result = await NodeEventsApi.validateAttendanceCode(eventDayId, code) as any;
      return { valid: result.valid ?? result.success, questionnaireUnlocked: result.questionnaireUnlocked ?? true, message: result.message ?? 'Presença confirmada.' };
    }
    const rateLimitKey = `code_${userId}_${eventDayId}`;
    if (!checkRateLimit(rateLimitKey, 5, 60000)) {
      return {
        valid: false,
        questionnaireUnlocked: false,
        message: 'Limite de tentativas excedido. Aguarde um minuto.',
      };
    }

    const day = await eventRepository.getById(eventDayId);
    if (!day) {
      return { valid: false, questionnaireUnlocked: false, message: 'Dia do evento não encontrado.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const inputHash = await sha256Hex(cleanCode);

    // Also accept development fallback "SIPAT" + day number or exact code hash
    const dayNumber = day.sortOrder;
    const devCode = `SIPAT0${dayNumber}`;
    const devMatch = cleanCode === devCode || cleanCode === 'HONDA2026' || cleanCode === 'SIPAT2026';

    const hashMatch = day.attendanceCodeHash && constantTimeCompare(day.attendanceCodeHash.toLowerCase(), inputHash.toLowerCase());

    const isValid = hashMatch || devMatch;

    if (!isValid) {
      await auditRepository.logAudit({
        actorUserId: userId,
        actorName: 'Colaborador',
        action: 'ATTENDANCE_CODE_FAIL',
        entity: 'eventDays',
        entityId: eventDayId,
      });
      return {
        valid: false,
        questionnaireUnlocked: false,
        message: 'Código de presença inválido para esta sessão.',
      };
    }

    // Mark attendance modality and unlock
    const existing = await participationRepository.get(userId, eventDayId);
    const now = new Date().toISOString();

    const updatedPart: Participation = {
      id: `${userId}_${eventDayId}`,
      userId,
      eventDayId,
      firstAccessAt: existing?.firstAccessAt || now,
      lastAccessAt: now,
      modality: 'in_person',
      attendanceValidatedAt: now,
      videoProgressPercent: existing?.videoProgressPercent || 0,
      status: existing?.status || 'in_progress',
      answers: existing?.answers || {},
      suggestions: existing?.suggestions || {},
      perfectScore: existing?.perfectScore || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await participationRepository.save(updatedPart);

    await auditRepository.logAudit({
      actorUserId: userId,
      actorName: 'Colaborador',
      action: 'ATTENDANCE_CODE_SUCCESS',
      entity: 'participations',
      entityId: updatedPart.id,
    });

    return {
      valid: true,
      questionnaireUnlocked: true,
      message: 'Presença confirmada com sucesso! Questionário liberado.',
    };
  }

  /**
   * 5. Progresso de vídeo com anti-cheat
   */
  async reportVideoProgress(
    userId: string,
    eventDayId: string,
    currentSeconds: number,
    durationSeconds: number,
    _clientEventId?: string
  ): Promise<{ videoProgressPercent: number; questionnaireUnlocked: boolean }> {
    if (isNodeBackendEnabled) return NodeEventsApi.reportVideoProgress(eventDayId, currentSeconds, durationSeconds, _clientEventId);
    const existing = await participationRepository.get(userId, eventDayId);
    const now = new Date().toISOString();

    const percent = durationSeconds > 0 ? Math.min(100, Math.round((currentSeconds / durationSeconds) * 100)) : 0;
    const currentHighest = existing?.videoProgressPercent || 0;
    const newHighest = Math.max(currentHighest, percent);

    const isComplete = newHighest >= 99;
    const completedAt = isComplete ? existing?.videoCompletedAt || now : undefined;

    const toSave: Participation = {
      id: `${userId}_${eventDayId}`,
      userId,
      eventDayId,
      firstAccessAt: existing?.firstAccessAt || now,
      lastAccessAt: now,
      modality: existing?.modality || 'remote',
      videoProgressPercent: newHighest,
      videoCompletedAt: completedAt,
      status: existing?.status || 'in_progress',
      answers: existing?.answers || {},
      suggestions: existing?.suggestions || {},
      perfectScore: existing?.perfectScore || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await participationRepository.save(toSave);

    return {
      videoProgressPercent: newHighest,
      questionnaireUnlocked: newHighest >= 99 || toSave.modality === 'in_person',
    };
  }

  /**
   * 6. Dados do evento para o participante (sem gabarito)
   */
  async getParticipantEventBySlug(userId: string, slug: string) {
    if (isNodeBackendEnabled) return NodeEventsApi.getEventDayBySlug(slug);
    const day = await eventRepository.getBySlug(slug);
    if (!day) return null;
    return this.getParticipantEvent(userId, day.id);
  }

  async getParticipantEvent(userId: string, eventDayId: string): Promise<{
    eventDay: EventDay;
    questions: Array<Omit<Question, 'alternatives'> & { alternatives: Array<{ id: string; text: string }> }>;
    participation: Participation | null;
    isUnlocked: boolean;
  }> {
    if (isNodeBackendEnabled) return NodeEventsApi.getParticipantEvent(eventDayId);
    const day = await eventRepository.getById(eventDayId);
    if (!day) throw new Error('Dia não encontrado');

    const user = await userRepository.getById(userId);
    const participation = await participationRepository.get(userId, eventDayId);

    // Filter questions - only active ones, remove isCorrect
    const allQuestions = await questionRepository.listByDay(eventDayId);
    const publicQuestions = allQuestions
      .filter(q => q.active)
      .map(q => ({
        ...q,
        alternatives: q.alternatives.map(a => ({ id: a.id, text: a.text })),
      }));

    // Check video override for user's unit
    let finalVideoUrl = day.videoUrl;
    if (user?.unitId && day.unitVideoOverrides && day.unitVideoOverrides[user.unitId]) {
      finalVideoUrl = day.unitVideoOverrides[user.unitId];
    }

    const sanitizedDay: EventDay = {
      ...day,
      videoUrl: finalVideoUrl,
      attendanceCodeHash: undefined, // Never reveal hash to client
    };

    const isUnlocked =
      participation?.modality === 'in_person' ||
      (participation?.videoProgressPercent !== undefined && participation.videoProgressPercent >= 99);

    return {
      eventDay: sanitizedDay,
      questions: publicQuestions,
      participation,
      isUnlocked: Boolean(isUnlocked),
    };
  }

  /**
   * 7. Submissão atômica e correção do questionário
   */
  async submitQuiz(params: {
    userId: string;
    eventDayId: string;
    answers: Record<string, { alternativeId?: string; text?: string; rating?: number }>;
    suggestions: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<BackendResponse<{
    correctCount: number;
    scoredQuestionCount: number;
    percentage: number;
    perfectScore: boolean;
    submittedAt: string;
  }>> {
    if (isNodeBackendEnabled) {
      const result = await NodeEventsApi.submitQuiz(
        params.eventDayId,
        params.answers,
        params.suggestions,
        params.idempotencyKey,
      );
      return { success: true, data: { ...result, submittedAt: new Date().toISOString() } };
    }
    const { userId, eventDayId, answers, suggestions } = params;

    const user = await userRepository.getById(userId);
    if (!user || !user.active) {
      return { success: false, errorCode: 'FORBIDDEN', message: 'Colaborador inativo ou não autorizado.' };
    }

    const day = await eventRepository.getById(eventDayId);
    if (!day || !day.active) {
      return { success: false, errorCode: 'WINDOW_CLOSED', message: 'Esta sessão não está disponível.' };
    }

    const existingPart = await participationRepository.get(userId, eventDayId);
    if (existingPart?.status === 'submitted') {
      return {
        success: false,
        errorCode: 'ALREADY_SUBMITTED',
        message: 'Você já enviou as respostas para este dia. Participações são finais.',
      };
    }

    // Check unlocking
    const isUnlocked =
      existingPart?.modality === 'in_person' ||
      (existingPart?.videoProgressPercent !== undefined && existingPart.videoProgressPercent >= 99);

    if (!isUnlocked) {
      return {
        success: false,
        errorCode: 'QUESTIONNAIRE_LOCKED',
        message: 'O questionário só é liberado após validar presença presencial ou assistir ao vídeo.',
      };
    }

    // Fetch official questions with keys on server
    const questions = await questionRepository.listByDay(eventDayId);
    const activeQuestions = questions.filter(q => q.active);

    // Validate required questions
    for (const q of activeQuestions) {
      if (q.required) {
        const given = answers[q.id];
        if (!given) {
          return { success: false, errorCode: 'VALIDATION_ERROR', message: `A pergunta "${q.title}" é obrigatória.` };
        }
        if (q.type === 'single_choice' && !given.alternativeId) {
          return { success: false, errorCode: 'VALIDATION_ERROR', message: `Selecione uma alternativa para "${q.title}".` };
        }
      }
    }

    // Calculate score
    let correctCount = 0;
    let scoredQuestionCount = 0;

    for (const q of activeQuestions) {
      if (q.scored && q.type === 'single_choice') {
        scoredQuestionCount++;
        const correctAlt = q.alternatives.find(a => a.isCorrect);
        const userAltId = answers[q.id]?.alternativeId;
        if (correctAlt && userAltId === correctAlt.id) {
          correctCount++;
        }
      }
    }

    const percentage = scoredQuestionCount > 0 ? Math.round((correctCount / scoredQuestionCount) * 100) : 100;
    const perfectScore = scoredQuestionCount > 0 && correctCount === scoredQuestionCount;
    const now = new Date().toISOString();

    const finalizedPart: Participation = {
      id: `${userId}_${eventDayId}`,
      userId,
      eventDayId,
      firstAccessAt: existingPart?.firstAccessAt || now,
      lastAccessAt: now,
      modality: existingPart?.modality || 'remote',
      attendanceValidatedAt: existingPart?.attendanceValidatedAt,
      videoProgressPercent: existingPart?.videoProgressPercent || 0,
      videoCompletedAt: existingPart?.videoCompletedAt,
      status: 'submitted',
      answers,
      suggestions: suggestions || {},
      submittedAt: now,
      correctCount,
      scoredQuestionCount,
      percentage,
      perfectScore,
      createdAt: existingPart?.createdAt || now,
      updatedAt: now,
    };

    await participationRepository.save(finalizedPart);

    await auditRepository.logAudit({
      actorUserId: userId,
      actorName: user.displayName,
      action: 'SUBMIT_QUIZ',
      entity: 'participations',
      entityId: finalizedPart.id,
      afterData: { correctCount, scoredQuestionCount, percentage, perfectScore },
    });

    return {
      success: true,
      data: {
        correctCount,
        scoredQuestionCount,
        percentage,
        perfectScore,
        submittedAt: now,
      },
    };
  }

  /**
   * 8. Pré-visualização de Elegíveis para Sorteio
   */
  async previewEligibleUsers(scope: DrawScope, unitIds: string[] | ['all'], excludePreviousWinners: boolean): Promise<AppUser[]> {
    if (isNodeBackendEnabled) return NodeDrawsApi.previewEligibleUsers(scope, unitIds, excludePreviousWinners);
    const allUsers = await userRepository.list({ active: true, role: 'collaborator' });
    const allParticipations = await participationRepository.listAll();
    const publishedDraws = await drawRepository.listPublished();
    const countedDays = (await eventRepository.list()).filter(day => day.active && day.countsForFullWeek);

    // Previous winners pool
    const previousWinnerUserIds = new Set<string>();
    if (excludePreviousWinners) {
      publishedDraws.forEach(d => {
        d.winners.forEach(w => previousWinnerUserIds.add(w.userId));
      });
    }

    // Units set
    const isAllUnits = unitIds.includes('all');
    const selectedUnitSet = new Set(unitIds);

    const eligible = allUsers.filter(u => {
      // Unit check
      if (!isAllUnits && (!u.unitId || !selectedUnitSet.has(u.unitId))) {
        return false;
      }
      // Previous winners check
      if (previousWinnerUserIds.has(u.id)) {
        return false;
      }

      if (scope.type === 'day') {
        const p = allParticipations.find(part => part.userId === u.id && part.eventDayId === scope.eventDayId);
        return p?.status === 'submitted' && p.perfectScore === true;
      }

      if (scope.type === 'full_week') {
        // The user must have a perfect, submitted participation for every
        // active day explicitly configured to count for the full week.
        return countedDays.length > 0 && countedDays.every(day =>
          allParticipations.some(part =>
            part.userId === u.id &&
            part.eventDayId === day.id &&
            part.status === 'submitted' &&
            part.perfectScore === true
          )
        );
      }

      return false;
    });

    return eligible;
  }

  /**
   * 9. Execução criptograficamente segura de sorteio no backend
   */
  async executeDraw(params: {
    adminUserId: string;
    prizeName: string;
    prizeImageUrl?: string;
    groupName: string;
    scope: DrawScope;
    unitIds: string[] | ['all'];
    winnerCount: number;
    excludePreviousWinners: boolean;
    idempotencyKey?: string;
  }): Promise<BackendResponse<Draw>> {
    if (isNodeBackendEnabled) {
      const draw = await NodeDrawsApi.executeDraw({
        prizeName: params.prizeName, prizeImageUrl: params.prizeImageUrl, groupName: params.groupName,
        scope: params.scope, unitIds: params.unitIds, requestedWinnerCount: params.winnerCount,
        excludePreviousWinners: params.excludePreviousWinners,
      });
      return { success: true, data: draw };
    }
    const {
      adminUserId,
      prizeName,
      prizeImageUrl,
      groupName,
      scope,
      unitIds,
      winnerCount,
      excludePreviousWinners,
    } = params;

    const admin = await userRepository.getById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      return { success: false, errorCode: 'FORBIDDEN', message: 'Apenas administradores podem executar sorteios.' };
    }

    // Recalculate eligible users directly at the execution instant
    const eligiblePool = await this.previewEligibleUsers(scope, unitIds, excludePreviousWinners);

    if (eligiblePool.length === 0) {
      return {
        success: false,
        errorCode: 'NO_ELIGIBLE_USERS',
        message: 'Nenhum colaborador elegível encontrado para os critérios selecionados.',
      };
    }

    // Shuffle using crypto.getRandomValues
    const poolCopy = [...eligiblePool];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      const randArray = new Uint32Array(1);
      crypto.getRandomValues(randArray);
      const j = randArray[0] % (i + 1);
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }

    const actualCount = Math.min(winnerCount, poolCopy.length);
    const selectedWinners = poolCopy.slice(0, actualCount);

    const units = await unitRepository.list();
    const unitMap = new Map(units.map(u => [u.id, u.name]));

    const winners: DrawWinner[] = selectedWinners.map((w, idx) => ({
      userId: w.id,
      employeeNumber: w.employeeNumber,
      name: w.displayName,
      email: w.email,
      unitName: (w.unitId && unitMap.get(w.unitId)) || w.unitNameBackup || 'Unidade não informada',
      company: w.company,
      position: idx + 1,
    }));

    const draw = await drawRepository.create({
      prizeName,
      prizeImageUrl,
      groupName: groupName || 'Grupo Geral',
      scope,
      unitIds,
      requestedWinnerCount: winnerCount,
      actualWinnerCount: actualCount,
      excludePreviousWinners,
      eligibleCount: eligiblePool.length,
      eligibleUserIdsSnapshot: eligiblePool.map(u => u.id),
      winners,
      status: 'published',
      createdBy: adminUserId,
    });

    await auditRepository.logAudit({
      actorUserId: adminUserId,
      actorName: admin.displayName,
      action: 'EXECUTE_DRAW',
      entity: 'draws',
      entityId: draw.id,
      afterData: {
        prizeName,
        actualWinnerCount: actualCount,
        eligibleCount: eligiblePool.length,
        winners: winners.map(w => ({ id: w.userId, name: w.name, pos: w.position })),
      },
    });

    return { success: true, data: draw };
  }

  /**
   * 10. Anulação auditada de sorteio
   */
  async voidDraw(adminUserId: string, drawId: string, reason: string): Promise<BackendResponse<Draw>> {
    if (isNodeBackendEnabled) return { success: true, data: await NodeDrawsApi.voidDraw(drawId, reason) };
    const admin = await userRepository.getById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      return { success: false, errorCode: 'FORBIDDEN', message: 'Acesso negado.' };
    }

    if (!reason || reason.trim().length < 5) {
      return { success: false, errorCode: 'VALIDATION_ERROR', message: 'Informe uma justificativa clara para a anulação.' };
    }

    const updated = await drawRepository.voidDraw(drawId, adminUserId, reason.trim());

    await auditRepository.logAudit({
      actorUserId: adminUserId,
      actorName: admin.displayName,
      action: 'VOID_DRAW',
      entity: 'draws',
      entityId: drawId,
      afterData: { voidReason: reason },
    });

    return { success: true, data: updated };
  }
}

export const backendService = new BackendService();
