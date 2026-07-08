import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { applyReset } from '@/lib/pages';
import { currentPeriodKey, nextPeriodOccurrences } from '@/lib/periods';
import type { Page, ReminderTime } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function repeatingTrigger(interval: 'daily' | 'weekly' | 'monthly', t: ReminderTime): Notifications.SchedulableNotificationTriggerInput {
  switch (interval) {
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute };
    case 'weekly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: t.weekday ?? 1,
        hour: t.hour,
        minute: t.minute,
      };
    case 'monthly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: Math.min(t.day ?? 1, 28),
        hour: t.hour,
        minute: t.minute,
      };
  }
}

function content(page: Page, body: string) {
  return {
    title: page.title,
    body,
    data: { pageId: page.id },
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  };
}

// Stateless reconciler: local scheduled notifications can't evaluate "are all
// items ticked?" at fire time, so every relevant event (app start, foreground,
// snapshot, mutation) rebuilds the full schedule from current data.
//  - page has unchecked items -> repeating daily/weekly/monthly triggers
//  - page fully ticked -> only one-shot triggers for the NEXT period, so
//    reminders resume on schedule even if the app stays closed
let chain: Promise<void> = Promise.resolve();

export function reconcileAll(pages: Page[]): Promise<void> {
  chain = chain.then(() => doReconcile(pages)).catch((e) => console.warn('reconcile failed', e));
  return chain;
}

async function doReconcile(pages: Page[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  for (const page of pages) {
    if (page.type !== 'reminder' || !page.reminder || page.reminder.times.length === 0) continue;

    let items = page.items;
    const periodKey = currentPeriodKey(page.reminder.interval, now);
    if (page.lastResetPeriodKey !== periodKey) {
      items = items.map((i) => ({ ...i, checked: false }));
      applyReset(page, periodKey).catch(() => {});
    }
    if (items.length === 0) continue;

    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length > 0) {
      const body = unchecked.map((i) => i.text).join(' • ');
      for (const t of page.reminder.times) {
        await Notifications.scheduleNotificationAsync({
          content: content(page, body),
          trigger: repeatingTrigger(page.reminder.interval, t),
        });
      }
    } else {
      const body = items.map((i) => i.text).join(' • ');
      for (const date of nextPeriodOccurrences(page.reminder, now)) {
        if (date.getTime() <= now.getTime()) continue;
        await Notifications.scheduleNotificationAsync({
          content: content(page, body),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        });
      }
    }
  }
}

export async function scheduledCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}
