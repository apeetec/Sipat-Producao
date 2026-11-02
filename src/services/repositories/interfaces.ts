import {
  AppUser,
  Unit,
  EventDay,
  Question,
  Participation,
  Draw,
  Regulation,
  AccessLog,
  AuditLog,
  AppSettings,
} from '../../types';

export interface IUserRepository {
  getById(id: string): Promise<AppUser | null>;
  getByEmployeeNumber(employeeNumber: string): Promise<AppUser | null>;
  getByEmail(email: string): Promise<AppUser | null>;
  list(filters?: { search?: string; unitId?: string; role?: string; active?: boolean }): Promise<AppUser[]>;
  create(user: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'> & { temporaryPassword?: string }, id?: string): Promise<AppUser>;
  update(id: string, updates: Partial<AppUser> & { temporaryPassword?: string }): Promise<AppUser>;
  deactivate(id: string): Promise<void>;
  resetParticipations(userIds: string[], eventDayId?: string): Promise<{ affectedUsers: number; resetParticipations: number }>;
  deleteMany(userIds: string[]): Promise<{ affectedUsers: number }>;
  count(): Promise<number>;
}

export interface IUnitRepository {
  getById(id: string): Promise<Unit | null>;
  getBySlug(slug: string): Promise<Unit | null>;
  list(): Promise<Unit[]>;
  create(unit: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Unit>;
  update(id: string, updates: Partial<Unit>): Promise<Unit>;
  delete(id: string): Promise<void>;
}

export interface IEventRepository {
  getById(id: string): Promise<EventDay | null>;
  getBySlug(slug: string): Promise<EventDay | null>;
  list(): Promise<EventDay[]>;
  create(day: Omit<EventDay, 'id' | 'createdAt' | 'updatedAt'> & { attendanceCode?: string }): Promise<EventDay>;
  update(id: string, updates: Partial<EventDay> & { attendanceCode?: string }): Promise<EventDay>;
  delete(id: string): Promise<void>;
}

export interface IQuestionRepository {
  getById(id: string): Promise<Question | null>;
  listByDay(eventDayId: string): Promise<Question[]>;
  listAll(): Promise<Question[]>;
  create(question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>): Promise<Question>;
  update(id: string, updates: Partial<Question>): Promise<Question>;
  delete(id: string): Promise<void>;
}

export interface IParticipationRepository {
  get(userId: string, eventDayId: string): Promise<Participation | null>;
  listByUser(userId: string): Promise<Participation[]>;
  listByDay(eventDayId: string): Promise<Participation[]>;
  listAll(): Promise<Participation[]>;
  save(participation: Participation): Promise<Participation>;
  countPerfectScoresByDay(eventDayId: string): Promise<number>;
}

export interface IDrawRepository {
  getById(id: string): Promise<Draw | null>;
  listPublished(eventDayId?: string): Promise<Draw[]>;
  listAll(): Promise<Draw[]>;
  create(draw: Omit<Draw, 'id' | 'createdAt'>): Promise<Draw>;
  voidDraw(id: string, voidedBy: string, voidReason: string): Promise<Draw>;
}

export interface IAuditRepository {
  logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  listAuditLogs(limit?: number): Promise<AuditLog[]>;
  logAccess(entry: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog>;
  listAccessLogs(limit?: number): Promise<AccessLog[]>;
}

export interface ISettingsRepository {
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  getRegulation(version?: string): Promise<Regulation | null>;
  saveRegulation(reg: Regulation): Promise<Regulation>;
}
