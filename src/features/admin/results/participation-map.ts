import type { Participation } from '../../../types';

export const participationKey = (userId: string, eventDayId: string) =>
  `${userId}_${eventDayId}`;

export function indexParticipations(participations: Participation[]) {
  return new Map(
    participations.map(participation => [
      participationKey(participation.userId, participation.eventDayId),
      participation,
    ]),
  );
}
