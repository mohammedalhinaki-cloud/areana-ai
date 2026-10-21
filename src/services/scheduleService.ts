export type ScheduleEntry = {
  id: string;
  subject: string;
  days: string[];
  start: string;
  end: string;
  room: string;
  instructor?: string;
  color: string;
};

function minutesOf(value: string): number {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = minutesOf(startA);
  const aEnd = minutesOf(endA);
  const bStart = minutesOf(startB);
  const bEnd = minutesOf(endB);
  if ([aStart, aEnd, bStart, bEnd].some((value) => !Number.isFinite(value))) return false;
  return aStart < bEnd && aEnd > bStart;
}

export function findScheduleConflicts(
  candidate: ScheduleEntry,
  existing: ScheduleEntry[],
  excludeId?: string,
): ScheduleEntry[] {
  return existing.filter((entry) =>
    entry.id !== excludeId
    && entry.days.some((day) => candidate.days.includes(day))
    && intervalsOverlap(candidate.start, candidate.end, entry.start, entry.end),
  );
}
