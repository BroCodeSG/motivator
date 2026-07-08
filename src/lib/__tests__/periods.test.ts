import { describe, expect, test } from '@jest/globals';

import { currentPeriodKey, needsReset, nextPeriodOccurrences } from '../periods';

describe('currentPeriodKey', () => {
  test('daily', () => {
    expect(currentPeriodKey('daily', new Date(2026, 6, 8, 15, 30))).toBe('2026-07-08');
    expect(currentPeriodKey('daily', new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  test('monthly', () => {
    expect(currentPeriodKey('monthly', new Date(2026, 0, 1, 0, 0))).toBe('2026-01');
    expect(currentPeriodKey('monthly', new Date(2026, 11, 31))).toBe('2026-12');
  });

  test('weekly uses ISO weeks starting Monday', () => {
    // 2026-07-06 is a Monday, 2026-07-12 a Sunday -> same ISO week
    expect(currentPeriodKey('weekly', new Date(2026, 6, 6))).toBe('2026-W28');
    expect(currentPeriodKey('weekly', new Date(2026, 6, 12))).toBe('2026-W28');
    expect(currentPeriodKey('weekly', new Date(2026, 6, 13))).toBe('2026-W29');
  });

  test('weekly year rollover uses ISO week-numbering year', () => {
    // 2027-01-01 is a Friday, part of ISO week 2026-W53
    expect(currentPeriodKey('weekly', new Date(2027, 0, 1))).toBe('2026-W53');
    // 2026-01-01 is a Thursday, part of ISO week 2026-W01
    expect(currentPeriodKey('weekly', new Date(2026, 0, 1))).toBe('2026-W01');
    // 2028-01-01 is a Saturday, part of ISO week 2027-W52
    expect(currentPeriodKey('weekly', new Date(2028, 0, 1))).toBe('2027-W52');
  });
});

describe('needsReset', () => {
  test('same period -> no reset', () => {
    expect(needsReset('daily', '2026-07-08', new Date(2026, 6, 8, 23, 0))).toBe(false);
  });
  test('new period -> reset', () => {
    expect(needsReset('daily', '2026-07-08', new Date(2026, 6, 9, 0, 1))).toBe(true);
    expect(needsReset('weekly', '2026-W28', new Date(2026, 6, 13))).toBe(true);
    expect(needsReset('monthly', '2026-07', new Date(2026, 7, 1))).toBe(true);
  });
});

describe('nextPeriodOccurrences', () => {
  test('daily -> each time tomorrow', () => {
    const now = new Date(2026, 6, 8, 20, 0);
    const dates = nextPeriodOccurrences(
      { interval: 'daily', times: [{ hour: 8, minute: 0 }, { hour: 18, minute: 30 }] },
      now
    );
    expect(dates).toEqual([new Date(2026, 6, 9, 8, 0), new Date(2026, 6, 9, 18, 30)]);
  });

  test('daily across month boundary', () => {
    const dates = nextPeriodOccurrences(
      { interval: 'daily', times: [{ hour: 9, minute: 0 }] },
      new Date(2026, 6, 31, 10, 0)
    );
    expect(dates).toEqual([new Date(2026, 7, 1, 9, 0)]);
  });

  test('daily across year boundary', () => {
    const dates = nextPeriodOccurrences(
      { interval: 'daily', times: [{ hour: 9, minute: 0 }] },
      new Date(2026, 11, 31, 10, 0)
    );
    expect(dates).toEqual([new Date(2027, 0, 1, 9, 0)]);
  });

  test('weekly -> times land in next ISO week on the right weekdays', () => {
    // now: Wednesday 2026-07-08 (week 28). Next week starts Monday 2026-07-13.
    const now = new Date(2026, 6, 8);
    const dates = nextPeriodOccurrences(
      {
        interval: 'weekly',
        times: [
          { weekday: 2, hour: 8, minute: 0 }, // Monday (expo: 1=Sun)
          { weekday: 1, hour: 20, minute: 0 }, // Sunday
        ],
      },
      now
    );
    expect(dates).toEqual([
      new Date(2026, 6, 13, 8, 0), // Monday 13th
      new Date(2026, 6, 19, 20, 0), // Sunday 19th (end of next ISO week)
    ]);
  });

  test('monthly -> day in next month, incl. year rollover', () => {
    const dates = nextPeriodOccurrences(
      { interval: 'monthly', times: [{ day: 15, hour: 7, minute: 45 }] },
      new Date(2026, 11, 20)
    );
    expect(dates).toEqual([new Date(2027, 0, 15, 7, 45)]);
  });

  test('monthly day is clamped to 28', () => {
    const dates = nextPeriodOccurrences(
      { interval: 'monthly', times: [{ day: 31 as number, hour: 9, minute: 0 }] },
      new Date(2026, 0, 10) // next month is February
    );
    expect(dates).toEqual([new Date(2026, 1, 28, 9, 0)]);
  });
});
