import { describe, expect, it } from 'vitest';
import { indexParticipations, participationKey } from '../../src/features/admin/results/participation-map';
import type { Participation } from '../../src/types';

describe('índice de participações da matriz de resultados', () => {
  it('indexa por usuário e evento, não pelo UUID interno da participação', () => {
    const participation = {
      id: 'participation-uuid',
      userId: 'user-uuid',
      eventDayId: 'event-uuid',
      videoProgressPercent: 100,
      status: 'submitted',
      answers: { question: { alternativeId: 'option' } },
      suggestions: {},
      perfectScore: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Participation;

    const indexed = indexParticipations([participation]);

    expect(indexed.get(participationKey('user-uuid', 'event-uuid'))).toBe(participation);
    expect(indexed.has('participation-uuid')).toBe(false);
  });
});
