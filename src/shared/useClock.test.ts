import { describe, expect, it } from 'vitest';
import { formatClock, formatDayLabel } from './useClock';

describe('formatClock', () => {
  it('formats in Asia/Dushanbe regardless of the input\'s own offset', () => {
    // 2026-08-31T05:00:00Z is 10:00:00 in Asia/Dushanbe (UTC+5, no DST).
    expect(formatClock(new Date('2026-08-31T05:00:00.000Z'))).toBe('10:00:00');
  });
});

describe('formatDayLabel', () => {
  it('formats weekday, day, and month in Russian for the Asia/Dushanbe date', () => {
    // Same instant as above — still 2026-08-31 (Monday) once shifted to +5.
    expect(formatDayLabel(new Date('2026-08-31T05:00:00.000Z'))).toBe('понедельник, 31 августа');
  });

  it('rolls over to the next Dushanbe day for a late-UTC instant', () => {
    // 23:30 UTC on the 30th is 04:30 on the 31st in Asia/Dushanbe.
    expect(formatDayLabel(new Date('2026-08-30T23:30:00.000Z'))).toBe('понедельник, 31 августа');
  });
});
