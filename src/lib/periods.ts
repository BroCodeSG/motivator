import { addMonths, addWeeks, format, setDate, startOfISOWeek, startOfMonth } from 'date-fns';

import type { IntervalType, ReminderConfig } from '@/types';

// Period keys are local-time based. Daily periods roll over at midnight,
// weekly at Monday 00:00 (ISO weeks), monthly at the 1st 00:00.
export function currentPeriodKey(interval: IntervalType, now: Date): string {
  switch (interval) {
    case 'daily':
      return format(now, 'yyyy-MM-dd');
    case 'weekly':
      return format(now, "RRRR-'W'II");
    case 'monthly':
      return format(now, 'yyyy-MM');
    case 'once':
      return ''; // once-off reminders have no period and never reset
  }
}

export function needsReset(interval: IntervalType, lastResetPeriodKey: string, now: Date): boolean {
  return currentPeriodKey(interval, now) !== lastResetPeriodKey;
}

// All concrete occurrences of the reminder's times within the period AFTER the
// one containing `now`. Used to schedule one-shot notifications for a page that
// is fully ticked, so reminders resume when the new period starts even if the
// app is never opened in between.
export function nextPeriodOccurrences(reminder: ReminderConfig, now: Date): Date[] {
  const dates: Date[] = [];
  if (reminder.interval === 'once') return dates;
  for (const t of reminder.times) {
    switch (reminder.interval) {
      case 'daily': {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, t.hour, t.minute, 0, 0);
        dates.push(d);
        break;
      }
      case 'weekly': {
        // expo weekday 1=Sunday..7=Saturday -> offset from Monday (ISO week start)
        const jsDay = (t.weekday ?? 1) - 1; // 0=Sunday..6=Saturday
        const offsetFromMonday = (jsDay + 6) % 7;
        const weekStart = startOfISOWeek(addWeeks(now, 1));
        const d = new Date(weekStart);
        d.setDate(d.getDate() + offsetFromMonday);
        d.setHours(t.hour, t.minute, 0, 0);
        dates.push(d);
        break;
      }
      case 'monthly': {
        const monthStart = startOfMonth(addMonths(now, 1));
        const d = setDate(monthStart, Math.min(t.day ?? 1, 28));
        d.setHours(t.hour, t.minute, 0, 0);
        dates.push(d);
        break;
      }
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}
