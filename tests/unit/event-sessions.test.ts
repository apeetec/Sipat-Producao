import { describe, expect, it } from 'vitest';
import {
  groupSessionsByDate,
  makeUniqueSessionSlug,
  slugifySessionName,
  toDateTimeLocalValue,
} from '../../src/utils/event-sessions';
import type { EventDay } from '../../src/types';

const createSession = (overrides: Partial<EventDay>): EventDay => ({
  id: crypto.randomUUID(),
  name: 'Sessão',
  slug: 'sessao',
  dateLabel: '4 de novembro de 2026',
  timezone: 'America/Sao_Paulo',
  opensAt: '2026-11-04T12:00:00.000Z',
  closesAt: '2026-11-04T13:00:00.000Z',
  attendanceCodeLength: 7,
  speakers: [],
  active: true,
  countsForFullWeek: true,
  sortOrder: 1,
  createdAt: '2026-11-02T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  ...overrides,
});

describe('agrupamento de sessões por data', () => {
  it('agrupa várias sessões em qualquer data e preserva IDs independentes', () => {
    const morning = createSession({ id: 'quarta-manha', slug: 'quarta-manha' });
    const afternoon = createSession({
      id: 'quarta-tarde',
      slug: 'quarta-tarde',
      opensAt: '2026-11-04T17:00:00.000Z',
      closesAt: '2026-11-04T18:00:00.000Z',
      sortOrder: 2,
    });
    const thursday = createSession({
      id: 'quinta',
      slug: 'quinta',
      dateLabel: '5 de novembro de 2026',
      opensAt: '2026-11-05T12:00:00.000Z',
      closesAt: '2026-11-05T13:00:00.000Z',
      sortOrder: 3,
    });

    const groups = groupSessionsByDate([thursday, afternoon, morning]);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('2026-11-04');
    expect(groups[0].weekdayLabel).toBe('Quarta-feira');
    expect(groups[0].sessions.map(session => session.id)).toEqual(['quarta-manha', 'quarta-tarde']);
    expect(groups[1].sessions.map(session => session.id)).toEqual(['quinta']);
  });

  it('usa a categoria persistida mesmo quando os horários caem em dias diferentes', () => {
    const category = {
      id: 'categoria-seguranca',
      name: 'Categoria Segurança',
      eventDate: '2026-11-06',
      dateLabel: '6 de novembro de 2026',
      active: true,
      sortOrder: 1,
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    };
    const first = createSession({
      id: 'first',
      eventDateId: category.id,
      eventDate: category,
      opensAt: '2026-11-06T12:00:00.000Z',
    });
    const second = createSession({
      id: 'second',
      eventDateId: category.id,
      eventDate: category,
      opensAt: '2026-11-07T12:00:00.000Z',
      sortOrder: 2,
    });

    const groups = groupSessionsByDate([second, first]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: category.id,
      weekdayLabel: category.name,
      dateLabel: category.dateLabel,
    });
    expect(groups[0].sessions.map(session => session.id)).toEqual(['first', 'second']);
  });
});

describe('slug de sessões', () => {
  it('normaliza acentos e cria uma rota única para nomes repetidos', () => {
    const existing = createSession({ id: 'existing', slug: 'sessao-de-abertura' });

    expect(slugifySessionName(' Sessão de Abertura ')).toBe('sessao-de-abertura');
    expect(
      makeUniqueSessionSlug(
        'Sessão de Abertura',
        [existing],
        '2026-11-04T17:30:00.000Z',
      ),
    ).toMatch(/^sessao-de-abertura-\d{4}$/);
  });
});

describe('horário administrativo', () => {
  it('sempre apresenta o instante no fuso de São Paulo', () => {
    expect(toDateTimeLocalValue('2026-11-04T15:30:00.000Z')).toBe('2026-11-04T12:30');
  });
});
