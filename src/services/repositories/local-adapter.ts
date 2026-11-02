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
import {
  IUserRepository,
  IUnitRepository,
  IEventRepository,
  IQuestionRepository,
  IParticipationRepository,
  IDrawRepository,
  IAuditRepository,
  ISettingsRepository,
} from './interfaces';
import {
  INITIAL_UNITS_DATA,
  INITIAL_REGULATION,
  INITIAL_SETTINGS,
  INITIAL_EVENT_DAYS,
  INITIAL_QUESTIONS,
  INITIAL_USERS,
  INITIAL_DRAWS,
} from '../../seed/initial-data';

const STORAGE_KEYS = {
  USERS: 'sipat_users_v1',
  UNITS: 'sipat_units_v1',
  EVENTS: 'sipat_events_v1',
  QUESTIONS: 'sipat_questions_v1',
  PARTICIPATIONS: 'sipat_participations_v1',
  DRAWS: 'sipat_draws_v1',
  AUDIT: 'sipat_audit_v1',
  ACCESS_LOGS: 'sipat_access_logs_v1',
  SETTINGS: 'sipat_settings_v1',
  REGULATIONS: 'sipat_regulations_v1',
  INITIALIZED: 'sipat_initialized_v1',
};

function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to read from localStorage key ${key}:`, err);
    return fallback;
  }
}

function setItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error(`Failed to write to localStorage key ${key}:`, err);
  }
}

export function initializeLocalDatabase(): void {
  const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!isInit) {
    console.info('[Local Database] Seeding initial data for SIPAT Honda...');

    // Units
    const units: Unit[] = INITIAL_UNITS_DATA.map((u, idx) => ({
      ...u,
      id: `unit-${idx + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setItem(STORAGE_KEYS.UNITS, units);

    // Events
    setItem(STORAGE_KEYS.EVENTS, INITIAL_EVENT_DAYS);

    // Questions
    setItem(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS);

    // Users
    setItem(STORAGE_KEYS.USERS, INITIAL_USERS);

    // Settings
    setItem(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);

    // Regulations
    setItem(STORAGE_KEYS.REGULATIONS, [INITIAL_REGULATION]);

    // Sample Draws
    setItem(STORAGE_KEYS.DRAWS, INITIAL_DRAWS);

    // Sample Participations for demonstration
    const sampleParticipations: Participation[] = [
      {
        id: 'user-colab-perfect_day-1',
        userId: 'user-colab-perfect',
        eventDayId: 'day-1',
        firstAccessAt: '2026-11-10T09:00:00.000Z',
        lastAccessAt: '2026-11-10T09:45:00.000Z',
        modality: 'remote',
        videoProgressPercent: 100,
        videoCompletedAt: '2026-11-10T09:35:00.000Z',
        status: 'submitted',
        answers: {
          'q-d1-1': { alternativeId: 'alt-2' },
          'q-d1-2': { alternativeId: 'alt-5' },
          'q-d1-3': { alternativeId: 'alt-7' },
        },
        suggestions: {},
        submittedAt: '2026-11-10T09:45:00.000Z',
        correctCount: 3,
        scoredQuestionCount: 3,
        percentage: 100,
        perfectScore: true,
        createdAt: '2026-11-10T09:00:00.000Z',
        updatedAt: '2026-11-10T09:45:00.000Z',
      },
      {
        id: 'user-colab-3_day-1',
        userId: 'user-colab-3',
        eventDayId: 'day-1',
        firstAccessAt: '2026-11-10T10:00:00.000Z',
        lastAccessAt: '2026-11-10T10:30:00.000Z',
        modality: 'in_person',
        attendanceValidatedAt: '2026-11-10T10:05:00.000Z',
        videoProgressPercent: 0,
        status: 'submitted',
        answers: {
          'q-d1-1': { alternativeId: 'alt-2' },
          'q-d1-2': { alternativeId: 'alt-5' },
          'q-d1-3': { alternativeId: 'alt-7' },
        },
        suggestions: {},
        submittedAt: '2026-11-10T10:30:00.000Z',
        correctCount: 3,
        scoredQuestionCount: 3,
        percentage: 100,
        perfectScore: true,
        createdAt: '2026-11-10T10:00:00.000Z',
        updatedAt: '2026-11-10T10:30:00.000Z',
      },
      {
        id: 'user-colab-4_day-1',
        userId: 'user-colab-4',
        eventDayId: 'day-1',
        firstAccessAt: '2026-11-10T11:00:00.000Z',
        lastAccessAt: '2026-11-10T11:40:00.000Z',
        modality: 'remote',
        videoProgressPercent: 100,
        videoCompletedAt: '2026-11-10T11:35:00.000Z',
        status: 'submitted',
        answers: {
          'q-d1-1': { alternativeId: 'alt-2' },
          'q-d1-2': { alternativeId: 'alt-5' },
          'q-d1-3': { alternativeId: 'alt-7' },
        },
        suggestions: {},
        submittedAt: '2026-11-10T11:40:00.000Z',
        correctCount: 3,
        scoredQuestionCount: 3,
        percentage: 100,
        perfectScore: true,
        createdAt: '2026-11-10T11:00:00.000Z',
        updatedAt: '2026-11-10T11:40:00.000Z',
      },
      {
        id: 'user-colab-5_day-1',
        userId: 'user-colab-5',
        eventDayId: 'day-1',
        firstAccessAt: '2026-11-10T13:00:00.000Z',
        lastAccessAt: '2026-11-10T13:30:00.000Z',
        modality: 'remote',
        videoProgressPercent: 100,
        videoCompletedAt: '2026-11-10T13:25:00.000Z',
        status: 'submitted',
        answers: {
          'q-d1-1': { alternativeId: 'alt-2' },
          'q-d1-2': { alternativeId: 'alt-4' }, // Errou uma questão propositalmente
          'q-d1-3': { alternativeId: 'alt-7' },
        },
        suggestions: {},
        submittedAt: '2026-11-10T13:30:00.000Z',
        correctCount: 2,
        scoredQuestionCount: 3,
        percentage: 67,
        perfectScore: false,
        createdAt: '2026-11-10T13:00:00.000Z',
        updatedAt: '2026-11-10T13:30:00.000Z',
      },
    ];
    setItem(STORAGE_KEYS.PARTICIPATIONS, sampleParticipations);

    // Audit logs
    const initialAudit: AuditLog[] = [
      {
        id: 'audit-init',
        actorUserId: 'system',
        actorName: 'Sistema SIPAT',
        action: 'SEED_INITIALIZATION',
        entity: 'system',
        entityId: 'global',
        timestamp: new Date().toISOString(),
      },
    ];
    setItem(STORAGE_KEYS.AUDIT, initialAudit);

    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

// Evita carregar dados demonstrativos (inclusive gabaritos) quando a API real
// está configurada. O adaptador local existe apenas para homologação offline.
if (!((import.meta as any).env?.VITE_API_URL || '').trim()) initializeLocalDatabase();

export class LocalUserRepository implements IUserRepository {
  async getById(id: string): Promise<AppUser | null> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    return users.find(u => u.id === id) || null;
  }

  async getByEmployeeNumber(emp: string): Promise<AppUser | null> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    return users.find(u => u.employeeNumber.toLowerCase() === emp.toLowerCase()) || null;
  }

  async getByEmail(email: string): Promise<AppUser | null> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async list(filters?: { search?: string; unitId?: string; role?: string; active?: boolean }): Promise<AppUser[]> {
    let users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      users = users.filter(
        u =>
          u.displayName.toLowerCase().includes(q) ||
          u.employeeNumber.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (filters?.unitId) {
      users = users.filter(u => u.unitId === filters.unitId);
    }
    if (filters?.role) {
      users = users.filter(u => u.role === filters.role);
    }
    if (filters?.active !== undefined) {
      users = users.filter(u => u.active === filters.active);
    }
    return users;
  }

  async create(userData: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>, customId?: string): Promise<AppUser> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    const id = customId || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newUser: AppUser = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    users.push(newUser);
    setItem(STORAGE_KEYS.USERS, users);
    return newUser;
  }

  async update(id: string, updates: Partial<AppUser>): Promise<AppUser> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error(`Usuário não encontrado: ${id}`);
    const updated: AppUser = {
      ...users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    users[idx] = updated;
    setItem(STORAGE_KEYS.USERS, users);
    return updated;
  }

  async deactivate(id: string): Promise<void> {
    await this.update(id, { active: false });
  }

  async resetParticipations(userIds: string[], eventDayId?: string): Promise<{ affectedUsers: number; resetParticipations: number }> {
    const selected = new Set(userIds);
    const participations = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    let resetParticipations = 0;
    const updated = participations.map(participation => {
      if (!selected.has(participation.userId) || (eventDayId && participation.eventDayId !== eventDayId)) return participation;
      resetParticipations++;
      return {
        ...participation,
        status: 'in_progress' as const,
        answers: {},
        suggestions: {},
        submittedAt: undefined,
        correctCount: undefined,
        scoredQuestionCount: undefined,
        percentage: undefined,
        perfectScore: false,
        updatedAt: new Date().toISOString(),
      };
    });
    setItem(STORAGE_KEYS.PARTICIPATIONS, updated);
    return { affectedUsers: userIds.length, resetParticipations };
  }

  async deleteMany(userIds: string[]): Promise<{ affectedUsers: number }> {
    const selected = new Set(userIds);
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    const updated = users.filter(user => !selected.has(user.id));
    setItem(STORAGE_KEYS.USERS, updated);
    return { affectedUsers: users.length - updated.length };
  }

  async count(): Promise<number> {
    const users = getItem<AppUser[]>(STORAGE_KEYS.USERS, []);
    return users.length;
  }
}

export class LocalUnitRepository implements IUnitRepository {
  async getById(id: string): Promise<Unit | null> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    return units.find(u => u.id === id) || null;
  }

  async getBySlug(slug: string): Promise<Unit | null> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    return units.find(u => u.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  async list(): Promise<Unit[]> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    return units.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async create(unitData: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Unit> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    const id = `unit-${Date.now()}`;
    const now = new Date().toISOString();
    const newUnit: Unit = {
      ...unitData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    units.push(newUnit);
    setItem(STORAGE_KEYS.UNITS, units);
    return newUnit;
  }

  async update(id: string, updates: Partial<Unit>): Promise<Unit> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    const idx = units.findIndex(u => u.id === id);
    if (idx === -1) throw new Error(`Unidade não encontrada: ${id}`);
    const updated: Unit = {
      ...units[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    units[idx] = updated;
    setItem(STORAGE_KEYS.UNITS, units);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const units = getItem<Unit[]>(STORAGE_KEYS.UNITS, []);
    setItem(STORAGE_KEYS.UNITS, units.filter(u => u.id !== id));
  }
}

export class LocalEventRepository implements IEventRepository {
  async getById(id: string): Promise<EventDay | null> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    return days.find(d => d.id === id) || null;
  }

  async getBySlug(slug: string): Promise<EventDay | null> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    return days.find(d => d.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  async list(): Promise<EventDay[]> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    return days.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async create(data: Omit<EventDay, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventDay> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    const id = `day-${Date.now()}`;
    const now = new Date().toISOString();
    const newDay: EventDay = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    days.push(newDay);
    setItem(STORAGE_KEYS.EVENTS, days);
    return newDay;
  }

  async update(id: string, updates: Partial<EventDay>): Promise<EventDay> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    const idx = days.findIndex(d => d.id === id);
    if (idx === -1) throw new Error(`Dia não encontrado: ${id}`);
    const updated: EventDay = {
      ...days[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    days[idx] = updated;
    setItem(STORAGE_KEYS.EVENTS, days);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const days = getItem<EventDay[]>(STORAGE_KEYS.EVENTS, []);
    setItem(STORAGE_KEYS.EVENTS, days.filter(d => d.id !== id));
  }
}

export class LocalQuestionRepository implements IQuestionRepository {
  async getById(id: string): Promise<Question | null> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    return qList.find(q => q.id === id) || null;
  }

  async listByDay(eventDayId: string): Promise<Question[]> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    return qList
      .filter(q => q.eventDayId === eventDayId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listAll(): Promise<Question[]> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    return qList.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async create(data: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>): Promise<Question> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const newQuestion: Question = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    qList.push(newQuestion);
    setItem(STORAGE_KEYS.QUESTIONS, qList);
    return newQuestion;
  }

  async update(id: string, updates: Partial<Question>): Promise<Question> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    const idx = qList.findIndex(q => q.id === id);
    if (idx === -1) throw new Error(`Pergunta não encontrada: ${id}`);
    const updated: Question = {
      ...qList[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    qList[idx] = updated;
    setItem(STORAGE_KEYS.QUESTIONS, qList);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const qList = getItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    setItem(STORAGE_KEYS.QUESTIONS, qList.filter(q => q.id !== id));
  }
}

export class LocalParticipationRepository implements IParticipationRepository {
  async get(userId: string, eventDayId: string): Promise<Participation | null> {
    const parts = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    const id = `${userId}_${eventDayId}`;
    return parts.find(p => p.id === id) || null;
  }

  async listByUser(userId: string): Promise<Participation[]> {
    const parts = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    return parts.filter(p => p.userId === userId);
  }

  async listByDay(eventDayId: string): Promise<Participation[]> {
    const parts = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    return parts.filter(p => p.eventDayId === eventDayId);
  }

  async listAll(): Promise<Participation[]> {
    return getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
  }

  async save(participation: Participation): Promise<Participation> {
    const parts = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    const idx = parts.findIndex(p => p.id === participation.id);
    const now = new Date().toISOString();
    const toSave: Participation = {
      ...participation,
      updatedAt: now,
    };
    if (idx >= 0) {
      parts[idx] = toSave;
    } else {
      parts.push({
        ...toSave,
        createdAt: toSave.createdAt || now,
      });
    }
    setItem(STORAGE_KEYS.PARTICIPATIONS, parts);
    return toSave;
  }

  async countPerfectScoresByDay(eventDayId: string): Promise<number> {
    const parts = getItem<Participation[]>(STORAGE_KEYS.PARTICIPATIONS, []);
    return parts.filter(p => p.eventDayId === eventDayId && p.status === 'submitted' && p.perfectScore).length;
  }
}

export class LocalDrawRepository implements IDrawRepository {
  async getById(id: string): Promise<Draw | null> {
    const draws = getItem<Draw[]>(STORAGE_KEYS.DRAWS, []);
    return draws.find(d => d.id === id) || null;
  }

  async listPublished(eventDayId?: string): Promise<Draw[]> {
    const draws = getItem<Draw[]>(STORAGE_KEYS.DRAWS, []);
    return draws
      .filter(d => d.status === 'published')
      .filter(d => {
        if (!eventDayId) return true;
        if (d.scope.type === 'day') return d.scope.eventDayId === eventDayId;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listAll(): Promise<Draw[]> {
    const draws = getItem<Draw[]>(STORAGE_KEYS.DRAWS, []);
    return draws.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async create(drawData: Omit<Draw, 'id' | 'createdAt'>): Promise<Draw> {
    const draws = getItem<Draw[]>(STORAGE_KEYS.DRAWS, []);
    const id = `draw-${Date.now()}`;
    const newDraw: Draw = {
      ...drawData,
      id,
      createdAt: new Date().toISOString(),
    };
    draws.unshift(newDraw);
    setItem(STORAGE_KEYS.DRAWS, draws);
    return newDraw;
  }

  async voidDraw(id: string, voidedBy: string, voidReason: string): Promise<Draw> {
    const draws = getItem<Draw[]>(STORAGE_KEYS.DRAWS, []);
    const idx = draws.findIndex(d => d.id === id);
    if (idx === -1) throw new Error(`Sorteio não encontrado: ${id}`);
    const updated: Draw = {
      ...draws[idx],
      status: 'voided',
      voidReason,
      voidedBy,
      voidedAt: new Date().toISOString(),
    };
    draws[idx] = updated;
    setItem(STORAGE_KEYS.DRAWS, draws);
    return updated;
  }
}

export class LocalAuditRepository implements IAuditRepository {
  async logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    const newEntry: AuditLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    setItem(STORAGE_KEYS.AUDIT, logs.slice(0, 1000)); // Keep up to 1000 entries
    return newEntry;
  }

  async listAuditLogs(limitCount = 100): Promise<AuditLog[]> {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    return logs.slice(0, limitCount);
  }

  async logAccess(entry: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog> {
    const logs = getItem<AccessLog[]>(STORAGE_KEYS.ACCESS_LOGS, []);
    const newEntry: AccessLog = {
      ...entry,
      id: `access-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    setItem(STORAGE_KEYS.ACCESS_LOGS, logs.slice(0, 500));
    return newEntry;
  }

  async listAccessLogs(limitCount = 100): Promise<AccessLog[]> {
    const logs = getItem<AccessLog[]>(STORAGE_KEYS.ACCESS_LOGS, []);
    return logs.slice(0, limitCount);
  }
}

export class LocalSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<AppSettings> {
    return getItem<AppSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    setItem(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  async getRegulation(version?: string): Promise<Regulation | null> {
    const regs = getItem<Regulation[]>(STORAGE_KEYS.REGULATIONS, [INITIAL_REGULATION]);
    if (version) {
      return regs.find(r => r.version === version) || null;
    }
    return regs.find(r => r.published) || regs[0] || null;
  }

  async saveRegulation(reg: Regulation): Promise<Regulation> {
    const regs = getItem<Regulation[]>(STORAGE_KEYS.REGULATIONS, [INITIAL_REGULATION]);
    const idx = regs.findIndex(r => r.version === reg.version);
    if (idx >= 0) {
      regs[idx] = reg;
    } else {
      regs.unshift(reg);
    }
    setItem(STORAGE_KEYS.REGULATIONS, regs);
    return reg;
  }
}
