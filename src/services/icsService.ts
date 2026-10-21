export type IcsEvent = {
  id: string;
  title: string;
  startAt: number;
  endAt?: number;
  description?: string;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toUtcIcsDate(timestamp: number): string {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) throw new Error('تاريخ التقويم غير صالح.');
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function generateIcs(events: IcsEvent[], generatedAt = Date.now()): string {
  if (events.length === 0) throw new Error('لا توجد مناسبات لتصديرها.');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Study Tools//Arabic Study Calendar//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    if (!event.title.trim()) throw new Error('لا يمكن تصدير مناسبة بلا اسم.');
    const endAt = event.endAt && event.endAt > event.startAt ? event.endAt : event.startAt + 60 * 60 * 1000;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.id)}@study-tools.local`,
      `DTSTAMP:${toUtcIcsDate(generatedAt)}`,
      `DTSTART:${toUtcIcsDate(event.startAt)}`,
      `DTEND:${toUtcIcsDate(endAt)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description ?? '')}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
