import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { applyReset } from '@/lib/pages';
import { currentPeriodKey, nextPeriodOccurrences } from '@/lib/periods';
import type { Page, ReminderTime } from '@/types';

// expo-notifications crashes on import inside Expo Go on Android (removed
// since SDK 53), so the module is loaded lazily and everything here no-ops in
// Expo Go. Reminders work in the real (EAS-built) app.
export const notificationsAvailable = !(
  Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient'
);

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
function getNotifications(): NotificationsModule | null {
  if (!notificationsAvailable) return null;
  if (!cached) {
    cached = require('expo-notifications') as NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return cached;
}

export async function setupNotifications(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
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

// Tapping a notification deep-links to its page.
export function addResponseListener(onPageId: (pageId: string) => void): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const pageId = resp.notification.request.content.data?.pageId;
    if (typeof pageId === 'string') onPageId(pageId);
  });
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    const pageId = resp?.notification.request.content.data?.pageId;
    if (typeof pageId === 'string') onPageId(pageId);
  });
  return () => sub.remove();
}

export async function cancelAllNotifications(): Promise<void> {
  await getNotifications()?.cancelAllScheduledNotificationsAsync();
}

function repeatingTrigger(N: NotificationsModule, interval: 'daily' | 'weekly' | 'monthly', t: ReminderTime) {
  switch (interval) {
    case 'daily':
      return { type: N.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute } as const;
    case 'weekly':
      return {
        type: N.SchedulableTriggerInputTypes.WEEKLY,
        weekday: t.weekday ?? 1,
        hour: t.hour,
        minute: t.minute,
      } as const;
    case 'monthly':
      return {
        type: N.SchedulableTriggerInputTypes.MONTHLY,
        day: Math.min(t.day ?? 1, 28),
        hour: t.hour,
        minute: t.minute,
      } as const;
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
  const Notifications = getNotifications();
  const now = new Date();

  // The period reset must happen even where notifications can't be scheduled.
  for (const page of pages) {
    if (page.type !== 'reminder' || !page.reminder) continue;
    const periodKey = currentPeriodKey(page.reminder.interval, now);
    if (page.lastResetPeriodKey !== periodKey) {
      applyReset(page, periodKey).catch(() => {});
    }
  }
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const page of pages) {
    if (page.type !== 'reminder' || !page.reminder || page.reminder.times.length === 0) continue;

    const periodKey = currentPeriodKey(page.reminder.interval, now);
    const items =
      page.lastResetPeriodKey !== periodKey
        ? page.items.map((i) => ({ ...i, checked: false }))
        : page.items;
    if (items.length === 0) continue;

    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length > 0) {
      const body = unchecked.map((i) => i.text).join(' • ');
      for (const t of page.reminder.times) {
        await Notifications.scheduleNotificationAsync({
          content: content(page, body),
          trigger: repeatingTrigger(Notifications, page.reminder.interval, t),
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
  const Notifications = getNotifications();
  if (!Notifications) return 0;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}
