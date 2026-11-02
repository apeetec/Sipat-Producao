import { describe, expect, it } from 'vitest';
import { buildQuestionPayload } from '../../src/services/repositories/question-payload';

const persistedId = '550e8400-e29b-41d4-a716-446655440000';

const question = {
  eventDayId: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Qual é a alternativa correta?',
  type: 'single_choice' as const,
  required: true,
  scored: true,
  active: true,
  sortOrder: 1,
  alternatives: [
    { id: 'alt-temporary-1', text: 'Temporária', isCorrect: true },
    { id: persistedId, text: 'Persistida', isCorrect: false },
  ],
};

describe('buildQuestionPayload', () => {
  it('omite todos os IDs de alternativas ao criar uma pergunta', () => {
    const payload = buildQuestionPayload(question, false);

    expect(payload.alternatives).toEqual([
      { text: 'Temporária', isCorrect: true },
      { text: 'Persistida', isCorrect: false },
    ]);
  });

  it('preserva somente UUIDs persistidos ao atualizar uma pergunta', () => {
    const payload = buildQuestionPayload(question, true);

    expect(payload.alternatives).toEqual([
      { text: 'Temporária', isCorrect: true },
      { id: persistedId, text: 'Persistida', isCorrect: false },
    ]);
  });
});
