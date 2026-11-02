import { EventDay } from '../types';
import { formatInTimeZone } from 'date-fns-tz';

export interface EventDateGroup {
  key: string;
  dateLabel: string;
  weekdayLabel: string;
  sessions: EventDay[];
}

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Returns the event calendar date in its configured timezone (YYYY-MM-DD). */
export const getEventDateKey = (event: Pick<EventDay, 'opensAt' | 'timezone'>): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: event.timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(event.opensAt));

  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

/** Groups independent sessions under any calendar date, in chronological order. */
export const groupSessionsByDate = (events: EventDay[]): EventDateGroup[] => {
  const groups = new Map<string, EventDay[]>();

  events.forEach(event => {
    // A categoria persistida é a fonte de verdade. O cálculo pelo calendário
    // permanece somente como fallback para registros legados ainda não migrados.
    const key = event.eventDateId || getEventDateKey(event);
    groups.set(key, [...(groups.get(key) || []), event]);
  });

  return [...groups.entries()]
    .map(([key, sessions]) => {
      const orderedSessions = [...sessions].sort((first, second) => {
        const timeDifference = new Date(first.opensAt).getTime() - new Date(second.opensAt).getTime();
        return timeDifference || first.sortOrder - second.sortOrder;
      });
      const reference = orderedSessions[0];
      const legacyWeekday = new Intl.DateTimeFormat('pt-BR', {
        timeZone: reference.timezone || DEFAULT_TIMEZONE,
        weekday: 'long',
      }).format(new Date(reference.opensAt));

      return {
        key,
        dateLabel: reference.eventDate?.dateLabel || reference.dateLabel,
        weekdayLabel: reference.eventDate?.name || capitalize(legacyWeekday),
        sessions: orderedSessions,
      };
    })
    .sort((first, second) => {
      const firstReference = first.sessions[0];
      const secondReference = second.sessions[0];
      const orderDifference = (firstReference.eventDate?.sortOrder ?? firstReference.sortOrder)
        - (secondReference.eventDate?.sortOrder ?? secondReference.sortOrder);
      return orderDifference || (firstReference.eventDate?.eventDate || getEventDateKey(firstReference))
        .localeCompare(secondReference.eventDate?.eventDate || getEventDateKey(secondReference));
    });
};

export const slugifySessionName = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

/** Keeps every route unique when two sessions have the same display name. */
export const makeUniqueSessionSlug = (
  requestedSlug: string,
  events: EventDay[],
  opensAt: string,
  editingId?: string,
): string => {
  const base = slugifySessionName(requestedSlug) || 'sessao';
  const usedSlugs = new Set(
    events.filter(event => event.id !== editingId).map(event => event.slug.toLowerCase()),
  );
  if (!usedSlugs.has(base)) return base;

  const opening = new Date(opensAt);
  const hours = String(opening.getHours()).padStart(2, '0');
  const minutes = String(opening.getMinutes()).padStart(2, '0');
  const timedBase = `${base}-${hours}${minutes}`;
  if (!usedSlugs.has(timedBase)) return timedBase;

  let suffix = 2;
  while (usedSlugs.has(`${timedBase}-${suffix}`)) suffix += 1;
  return `${timedBase}-${suffix}`;
};

/** Converts an ISO timestamp into the value expected by datetime-local. */
export const toDateTimeLocalValue = (isoValue: string): string => {
  return formatInTimeZone(new Date(isoValue), DEFAULT_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
};
