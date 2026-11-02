import type { Question } from '../../types';

type QuestionWriteInput = Partial<
  Omit<Question, 'id' | 'createdAt' | 'updatedAt'>
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QUESTION_WRITE_FIELDS = [
  'eventDayId',
  'title',
  'type',
  'required',
  'scored',
  'suggestionPrompt',
  'sortOrder',
  'active',
] as const;

/**
 * Produz somente o contrato aceito pela API. IDs `alt-*` são chaves temporárias
 * da interface e não podem atravessar a fronteira HTTP, pois o servidor exige
 * UUID e gera um novo identificador quando o campo é omitido.
 */
export function buildQuestionPayload(
  question: QuestionWriteInput,
  preservePersistedAlternativeIds: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = Object.fromEntries(
    QUESTION_WRITE_FIELDS.filter((field) => field in question).map((field) => [
      field,
      question[field],
    ]),
  );

  if ('alternatives' in question) {
    payload.alternatives = (question.alternatives ?? []).map((alternative) => ({
      ...(preservePersistedAlternativeIds && UUID_PATTERN.test(alternative.id)
        ? { id: alternative.id }
        : {}),
      text: alternative.text,
      ...(alternative.isCorrect === undefined
        ? {}
        : { isCorrect: alternative.isCorrect }),
    }));
  }

  return payload;
}
