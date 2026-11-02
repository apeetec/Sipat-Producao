import type { AppSettings, AppUser, AuditLog, AccessLog, Draw, EventDate, EventDay, Participation, Question, Regulation, Unit } from '../../types';
import type { IAuditRepository, IDrawRepository, IEventDateRepository, IEventRepository, IParticipationRepository, IQuestionRepository, ISettingsRepository, IUnitRepository, IUserRepository } from './interfaces';
import { request } from '../api/node-backend-client';
import { buildQuestionPayload } from './question-payload';

const query = (values: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

export class HttpUserRepository implements IUserRepository {
  getById(id: string) { return request<AppUser>(`/api/admin/users/${id}`).catch(() => null); }
  async getByEmployeeNumber(employeeNumber: string) { return (await this.list({ search: employeeNumber })).find(u => u.employeeNumber.toLowerCase() === employeeNumber.toLowerCase()) ?? null; }
  async getByEmail(email: string) { return (await this.list({ search: email })).find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null; }
  list(filters: { search?: string; unitId?: string; role?: string; active?: boolean } = {}) { return request<AppUser[]>(`/api/admin/users${query(filters)}`); }
  create(user: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'> & { temporaryPassword?: string }) {
    if (!user.temporaryPassword) throw new Error('Informe uma senha temporária para criar o usuário.');
    const payload = { employeeNumber: user.employeeNumber, email: user.email, firstName: user.firstName, lastName: user.lastName,
      displayName: user.displayName, description: user.description, role: user.role, unitId: user.unitId, company: user.company,
      adminComment: user.adminComment, mustChangePassword: user.mustChangePassword, active: user.active, temporaryPassword: user.temporaryPassword };
    return request<AppUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
  }
  update(id: string, updates: Partial<AppUser> & { temporaryPassword?: string }) {
    const allowed = ['employeeNumber','email','firstName','lastName','displayName','description','role','unitId','company','adminComment','mustChangePassword','active','temporaryPassword'] as const;
    const payload = Object.fromEntries(allowed.filter(key => key in updates).map(key => [key, updates[key]]));
    return request<AppUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async deactivate(id: string) { await request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }); }
  resetParticipations(userIds: string[], eventDayId?: string) {
    return request<{ affectedUsers: number; resetParticipations: number }>('/api/admin/users/reset-participations', {
      method: 'POST',
      body: JSON.stringify({ userIds, ...(eventDayId ? { eventDayId } : {}) }),
    });
  }
  deleteMany(userIds: string[]) {
    return request<{ affectedUsers: number }>('/api/admin/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  }
  async count() { return (await this.list()).length; }
}

export class HttpUnitRepository implements IUnitRepository {
  getById(id: string) { return request<Unit>(`/api/admin/units/${id}`).catch(() => null); }
  async getBySlug(slug: string) { return (await this.list()).find(u => u.slug === slug) ?? null; }
  list() { return request<Unit[]>('/api/admin/units'); }
  create(unit: Omit<Unit, 'id' | 'createdAt' | 'updatedAt' | 'userCount'>) { return request<Unit>('/api/admin/units', { method: 'POST', body: JSON.stringify(unit) }); }
  update(id: string, updates: Partial<Unit>) { return request<Unit>(`/api/admin/units/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }); }
  async delete(id: string) { await request<void>(`/api/admin/units/${id}`, { method: 'DELETE' }); }
}

export class HttpEventRepository implements IEventRepository {
  async getById(id: string) { const result = await request<{ eventDay: EventDay }>(`/api/events/by-id/${id}`).catch(() => null); return result?.eventDay ?? null; }
  async getBySlug(slug: string) { const result = await request<{ day: EventDay }>(`/api/events/${slug}`).catch(() => null); return result?.day ?? null; }
  list() { return request<EventDay[]>('/api/events'); }
  private payload(day: Partial<EventDay> & { attendanceCode?: string }) {
    const allowed = ['eventDateId','name','slug','dateLabel','parentId','attraction','theme','opensAt','closesAt','videoUrl','videoStoragePath','videoEmbedUrl','videoType','videoAttachmentName','cardCoverImageUrl','bannerImageUrl','attendanceCode','speakers','unitVideoOverrides','active','countsForFullWeek','sortOrder'] as const;
    return Object.fromEntries(allowed.filter(key => key in day).map(key => [key, day[key]]));
  }
  create(day: Omit<EventDay, 'id' | 'createdAt' | 'updatedAt'> & { attendanceCode?: string }) { return request<EventDay>('/api/admin/events', { method: 'POST', body: JSON.stringify(this.payload(day)) }); }
  update(id: string, updates: Partial<EventDay> & { attendanceCode?: string }) { return request<EventDay>(`/api/admin/events/${id}`, { method: 'PATCH', body: JSON.stringify(this.payload(updates)) }); }
  async delete(id: string) { await request<void>(`/api/admin/events/${id}`, { method: 'DELETE' }); }
  deleteMany(eventIds: string[]) {
    return request<{ affectedEvents: number }>('/api/admin/events/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ eventIds }),
    });
  }
}

export class HttpEventDateRepository implements IEventDateRepository {
  getById(id: string) { return request<EventDate>(`/api/admin/event-dates/${id}`).catch(() => null); }
  list() { return request<EventDate[]>('/api/admin/event-dates'); }
  create(date: Omit<EventDate, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<EventDate>('/api/admin/event-dates', { method: 'POST', body: JSON.stringify(date) });
  }
  update(id: string, updates: Partial<EventDate>) {
    const allowed = ['name', 'eventDate', 'dateLabel', 'description', 'active', 'sortOrder'] as const;
    const payload = Object.fromEntries(allowed.filter(key => key in updates).map(key => [key, updates[key]]));
    return request<EventDate>(`/api/admin/event-dates/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async delete(id: string) { await request<void>(`/api/admin/event-dates/${id}`, { method: 'DELETE' }); }
}

export class HttpQuestionRepository implements IQuestionRepository {
  getById(id: string) { return request<Question>(`/api/admin/questions/${id}`).catch(() => null); }
  listByDay(eventDayId: string) { return request<Question[]>(`/api/admin/questions?eventDayId=${encodeURIComponent(eventDayId)}`); }
  listAll() { return request<Question[]>('/api/admin/questions'); }
  create(question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<Question>('/api/admin/questions', {
      method: 'POST',
      body: JSON.stringify(buildQuestionPayload(question, false)),
    });
  }
  update(id: string, updates: Partial<Question>) {
    return request<Question>(`/api/admin/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(buildQuestionPayload(updates, true)),
    });
  }
  async delete(id: string) { await request<void>(`/api/admin/questions/${id}`, { method: 'DELETE' }); }
}

export class HttpParticipationRepository implements IParticipationRepository {
  async get(_userId: string, eventDayId: string) { const result = await request<{ participation: Participation | null }>(`/api/events/by-id/${eventDayId}`); return result.participation; }
  listByUser(_userId: string) { return request<Participation[]>('/api/events/participations/me'); }
  listByDay(eventDayId: string) { return request<Participation[]>(`/api/admin/participations${query({ eventDayId })}`); }
  listAll() { return request<Participation[]>('/api/admin/participations'); }
  async save(_participation: Participation): Promise<Participation> { throw new Error('Participações só podem ser alteradas pelos casos de uso da API.'); }
  async countPerfectScoresByDay(eventDayId: string) { return (await this.listByDay(eventDayId)).filter(p => p.status === 'submitted' && p.perfectScore).length; }
}

export class HttpDrawRepository implements IDrawRepository {
  async getById(id: string) { return (await this.listAll()).find(d => d.id === id) ?? null; }
  listPublished(eventDayId?: string) { return request<Draw[]>(`/api/winners${query({ dayId: eventDayId })}`); }
  listAll() { return request<Draw[]>('/api/admin/draws'); }
  create(): Promise<Draw> { throw new Error('Use o caso de uso executeDraw para criar sorteios.'); }
  voidDraw(id: string, _voidedBy: string, voidReason: string) { return request<Draw>(`/api/admin/draws/${id}/void`, { method: 'POST', body: JSON.stringify({ reason: voidReason }) }); }
}

export class HttpAuditRepository implements IAuditRepository {
  async logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const allowedActions = ['BATCH_USER_IMPORT', 'BULK_DEACTIVATE_USERS'];
    if (!allowedActions.includes(entry.action)) {
      throw new Error('Este evento de auditoria deve ser gerado diretamente pelo servidor.');
    }
    return request<AuditLog>('/api/admin/audit/client-events', {
      method: 'POST',
      body: JSON.stringify({
        action: entry.action,
        entityId: entry.entityId,
        afterData: entry.afterData,
      }),
    });
  }
  listAuditLogs(limit = 100) { return request<AuditLog[]>(`/api/admin/audit?limit=${limit}`); }
  async logAccess(_entry: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog> {
    throw new Error('Logs de acesso são registrados exclusivamente pelo servidor.');
  }
  listAccessLogs(limit = 100) { return request<AccessLog[]>(`/api/admin/audit/access-logs?limit=${limit}`); }
}

export class HttpSettingsRepository implements ISettingsRepository {
  getSettings() { return request<AppSettings>('/api/settings'); }
  updateSettings(settings: Partial<AppSettings>) {
    const { activeRegulationVersion: _ignored, ...payload } = settings;
    return request<AppSettings>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
  }
  getRegulation(version?: string) { return request<Regulation | null>(version ? `/api/admin/regulations?version=${encodeURIComponent(version)}` : '/api/regulations/current'); }
  saveRegulation(regulation: Regulation) {
    const { createdAt: _ignored, ...payload } = regulation;
    return request<Regulation>('/api/admin/regulations', { method: 'PUT', body: JSON.stringify(payload) });
  }
}
