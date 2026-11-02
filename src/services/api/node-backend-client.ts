/**
 * =========================================================================================
 * CLIENTE HTTP DE INTEGRAÇÃO COM O BACKEND NODE.JS + SQL (HOSTINGER)
 * =========================================================================================
 * 
 * Este arquivo contém o cliente de API oficial que conecta o frontend React ao servidor
 * Node.js (Express / Fastify) hospedado na Hostinger com banco de dados MySQL / MariaDB.
 * 
 * COMO FUNCIONA A INTEGRAÇÃO:
 * 1. Se a variável de ambiente `VITE_API_URL` estiver configurada no `.env` (ex: `https://meudominio.com/api`),
 *    o sistema direcionará automaticamente as requisições para o backend Node.js na Hostinger.
 * 2. Se `VITE_API_URL` não for informada ou estiver vazia, o sistema utiliza o `local-adapter`
 *    (armazenamento persistente reativo em localStorage) para visualização e testes imediatos.
 * 3. Todas as chamadas para rotas protegidas injetam automaticamente o header:
 *    `Authorization: Bearer <token_jwt>`.
 * 
 * =========================================================================================
 */

import {
  AppUser,
  EventDay,
  Question,
  Participation,
  Draw,
  AppSettings,
  Regulation,
  AuditLog,
  AccessLog,
  DrawWinner,
} from '../../types';

// URL base da API Node.js (configurável no arquivo .env via VITE_API_URL)
const configuredUrl = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
// O contrato existente já inclui /api em cada endpoint. Aceitamos tanto a
// origem (https://api.exemplo.com) quanto uma URL terminada em /api.
const API_BASE_URL = configuredUrl.endsWith('/api') ? configuredUrl.slice(0, -4) : configuredUrl;
export const isNodeBackendEnabled = configuredUrl.length > 0;
let memoryToken: string | null = null;

/**
 * Função utilitária para recuperar o token JWT armazenado na sessão do navegador
 */
function getAuthToken(): string | null { return memoryToken; }
export function setNodeAuthToken(token: string | null): void { memoryToken = token; }

/**
 * Utilitário central para executar chamadas HTTP com tratamento de erros padronizado
 */
export async function request<T>(endpoint: string, options: RequestInit = {}, canRefresh = true): Promise<T> {
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // O refresh token nunca fica disponível ao JavaScript: o navegador o envia
  // como cookie HttpOnly e a API o rotaciona antes de repetir a requisição.
  if (response.status === 401 && canRefresh && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/refresh') {
    const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      setNodeAuthToken(refreshed.token);
      return request<T>(endpoint, options, false);
    }
  }

  if (!response.ok) {
    let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson?.error?.message || errorJson?.message || errorMessage;
      const validationDetails = errorJson?.error?.details;
      if (Array.isArray(validationDetails) && validationDetails.length > 0) {
        const fields = validationDetails
          .map((detail: { field?: string; message?: string }) =>
            [detail.field, detail.message].filter(Boolean).join(': '),
          )
          .filter(Boolean)
          .join('; ');
        if (fields) errorMessage = `${errorMessage} ${fields}`;
      }
    } catch {
      // Falha ao parsear JSON de erro
    }
    const requestError = new Error(errorMessage) as Error & { status?: number };
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * -----------------------------------------------------------------------------------------
 * 1. MÓDULO DE AUTENTICAÇÃO E PRIMEIRO ACESSO
 * -----------------------------------------------------------------------------------------
 */
export const NodeAuthApi = {
  /**
   * Realiza login no servidor Node.js
   * @route POST /api/auth/login
   * @param employeeNumber Matrícula funcional informada pelo colaborador
   * @param password Senha em texto puro (o servidor compara o hash bcrypt no MySQL)
   */
  async login(employeeNumber: string, password: string): Promise<{ token: string; user: AppUser }> {
    const result = await request<{ token: string; user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeNumber, password }),
    });
    setNodeAuthToken(result.token);
    return result;
  },

  async restore(): Promise<AppUser> {
    const refreshed = await request<{ token: string; user: AppUser }>('/api/auth/refresh', { method: 'POST' }, false);
    setNodeAuthToken(refreshed.token);
    return refreshed.user;
  },

  async me(): Promise<AppUser> { return request<AppUser>('/api/auth/me'); },

  async logout(): Promise<void> {
    await request<void>('/api/auth/logout', { method: 'POST' }, false);
    setNodeAuthToken(null);
  },

  /**
   * Conclui o fluxo obrigatório de primeiro acesso e definição de nova senha
   * @route POST /api/auth/first-access
   * @param currentPassword Senha padrão (ex: data de nascimento)
   * @param newPassword Nova senha com pelo menos 8 dígitos, letra e número
   */
  async completeFirstAccess(currentPassword: string, newPassword: string): Promise<{ success: boolean; user: AppUser }> {
    return request<{ success: boolean; user: AppUser }>('/api/auth/first-access', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /**
   * Registra o aceite formal do regulamento da campanha pelo colaborador
   * @route POST /api/auth/accept-regulation
   * @param version Versão aceita (ex: '2026.1')
   */
  async acceptRegulation(version: string): Promise<{ success: boolean; user: AppUser }> {
    return request<{ success: boolean; user: AppUser }>('/api/auth/accept-regulation', {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  },
};

/**
 * -----------------------------------------------------------------------------------------
 * 2. MÓDULO DE EVENTOS, VÍDEOS E QUESTIONÁRIOS
 * -----------------------------------------------------------------------------------------
 */
export const NodeEventsApi = {
  /**
   * Lista todos os dias da campanha ativos
   * @route GET /api/events
   */
  async listEventDays(): Promise<EventDay[]> {
    return request<EventDay[]>('/api/events');
  },

  /**
   * Retorna os detalhes de um dia específico pelo slug amigável
   * @route GET /api/events/:slug
   */
  async getEventDayBySlug(slug: string): Promise<{ day: EventDay; questions: Question[] }> {
    return request<{ day: EventDay; questions: Question[] }>(`/api/events/${slug}`);
  },

  async getParticipantEvent(dayId: string): Promise<{ eventDay: EventDay; questions: Question[]; participation: Participation | null; isUnlocked: boolean }> {
    return request(`/api/events/by-id/${dayId}`);
  },

  /**
   * Valida o código de presença inserido pelo colaborador em palestra presencial
   * @route POST /api/events/:dayId/attendance
   * @param dayId ID do dia no MySQL
   * @param attendanceCode Código de presença (o Node calcula SHA-256 e compara)
   */
  async validateAttendanceCode(dayId: string, attendanceCode: string): Promise<{ success: boolean; participation: Participation }> {
    return request<{ success: boolean; participation: Participation }>(`/api/events/${dayId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ attendanceCode, modality: 'in_person' }),
    });
  },

  /**
   * Registra o avanço do vídeo oficial da palestra (anti-fraude no servidor)
   * @route POST /api/events/:dayId/video-progress
   * @param currentSeconds Segundos já reproduzidos
   * @param durationSeconds Duração total do vídeo
   */
  async reportVideoProgress(dayId: string, currentSeconds: number, durationSeconds: number): Promise<{ videoProgressPercent: number; questionnaireUnlocked: boolean }> {
    return request<{ videoProgressPercent: number; questionnaireUnlocked: boolean }>(`/api/events/${dayId}/video-progress`, {
      method: 'POST',
      body: JSON.stringify({ currentSeconds, durationSeconds }),
    });
  },

  /**
   * Envia as respostas do questionário para avaliação server-side e gravação no MySQL
   * @route POST /api/events/:dayId/quiz
   */
  async submitQuiz(
    dayId: string,
    answers: Record<string, { alternativeId?: string; text?: string; rating?: number }>,
    suggestions?: Record<string, string>
  ): Promise<{ correctCount: number; scoredQuestionCount: number; percentage: number; perfectScore: boolean }> {
    return request<{ correctCount: number; scoredQuestionCount: number; percentage: number; perfectScore: boolean }>(`/api/events/${dayId}/quiz`, {
      method: 'POST',
      body: JSON.stringify({ answers, suggestions }),
    });
  },
};

/**
 * -----------------------------------------------------------------------------------------
 * 3. MÓDULO DE SORTEIOS OFICIAIS & GANHADORES
 * -----------------------------------------------------------------------------------------
 */
export const NodeDrawsApi = {
  /**
   * Retorna os sorteios publicados e ganhadores contemplados para a galeria pública
   * @route GET /api/winners
   */
  async listPublishedDraws(dayId?: string): Promise<Draw[]> {
    const query = dayId ? `?dayId=${dayId}` : '';
    return request<Draw[]>(`/api/winners${query}`);
  },

  /**
   * Pré-visualiza os colaboradores elegíveis com 100% de acertos para um sorteio
   * @route POST /api/admin/draws/preview
   */
  async previewEligibleUsers(scope: { type: 'day'; eventDayId: string } | { type: 'full_week' }, unitIds: string[] | ['all'] = ['all'], excludePreviousWinners = true): Promise<AppUser[]> {
    return request<AppUser[]>('/api/admin/draws/preview', {
      method: 'POST',
      body: JSON.stringify({ scope, unitIds, excludePreviousWinners }),
    });
  },

  /**
   * Executa o sorteio oficial utilizando randomização criptográfica segura no Node.js
   * @route POST /api/admin/draws/execute
   */
  async executeDraw(params: {
    prizeName: string;
    prizeImageUrl?: string;
    groupName: string;
    scope: { type: 'day'; eventDayId: string } | { type: 'full_week' };
    unitIds: string[] | ['all'];
    requestedWinnerCount: number;
    excludePreviousWinners: boolean;
  }): Promise<Draw> {
    return request<Draw>('/api/admin/draws/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Anula formalmente um sorteio com justificativa auditada
   * @route POST /api/admin/draws/:id/void
   */
  async voidDraw(id: string, reason: string): Promise<Draw> {
    return request<Draw>(`/api/admin/draws/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

/**
 * -----------------------------------------------------------------------------------------
 * 4. MÓDULO DE CONFIGURAÇÕES, IDENTIDADE VISUAL E AUDITORIA
 * -----------------------------------------------------------------------------------------
 */
export const NodeSettingsApi = {
  /**
   * Recupera as configurações visuais, paleta de cores e textos do site
   * @route GET /api/settings
   */
  async getSettings(): Promise<AppSettings> {
    return request<AppSettings>('/api/settings');
  },

  /**
   * Atualiza as configurações da campanha, logotipo e cores (White-Label)
   * @route PUT /api/admin/settings
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return request<AppSettings>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Consulta os registros da trilha de auditoria para compliance e LGPD
   * @route GET /api/admin/audit
   */
  async listAuditLogs(limit = 100): Promise<AuditLog[]> {
    return request<AuditLog[]>(`/api/admin/audit?limit=${limit}`);
  },

  /**
   * Consulta o histórico de acessos e logins
   * @route GET /api/admin/audit/access-logs
   */
  async listAccessLogs(limit = 100): Promise<AccessLog[]> {
    return request<AccessLog[]>(`/api/admin/audit/access-logs?limit=${limit}`);
  },
};

export interface UploadedAsset {
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

/** Upload autenticado e validado por assinatura binária no servidor. */
export const NodeUploadsApi = {
  async upload(file: File, kind: 'image' | 'video'): Promise<UploadedAsset> {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file, file.name);
    return request<UploadedAsset>('/api/admin/uploads', {
      method: 'POST',
      body: form,
    });
  },
};

export interface EmailReportDelivery {
  accepted: boolean;
  mode: 'outbox' | 'smtp';
  messageId: string;
  previewFile?: string;
  message: string;
}

/** Envia o relatório pelo SMTP em produção ou gera um .eml no outbox local. */
export const NodeReportsApi = {
  async sendResultsEmail(input: {
    recipients: string[];
    subject: string;
    message: string;
    attachment: Blob;
    filename: string;
  }): Promise<EmailReportDelivery> {
    const form = new FormData();
    form.append('recipients', JSON.stringify(input.recipients));
    form.append('subject', input.subject);
    form.append('message', input.message);
    form.append('attachment', input.attachment, input.filename);
    return request<EmailReportDelivery>('/api/admin/reports/email', {
      method: 'POST',
      body: form,
    });
  },
};
