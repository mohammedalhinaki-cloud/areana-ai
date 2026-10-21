import { describe, expect, it } from 'vitest';
import { generateIcs } from '../icsService';

describe('ICS calendar export', () => {
  it('generates a valid VCALENDAR event and escapes text fields', () => {
    const ics = generateIcs([
      { id: 'exam-1', title: 'اختبار, نهائي; مهم', startAt: Date.UTC(2027, 1, 8, 9, 30), description: 'قاعة أ\\ب\nالمبنى 2' },
    ], Date.UTC(2026, 9, 20));
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART:20270208T093000Z');
    expect(ics).toContain('SUMMARY:اختبار\\, نهائي\\; مهم');
    expect(ics).toContain('DESCRIPTION:قاعة أ\\\\ب\\nالمبنى 2');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('rejects an empty calendar', () => {
    expect(() => generateIcs([])).toThrow('لا توجد مناسبات');
  });
});
