// Three page types:
//  - 'list'          plain list, no reminders
//  - 'reminderList'  recurring checklist (daily/weekly/monthly reminders)
//  - 'reminder'      once-off reminder at a single date/time; auto-archives once past
export type PageType = 'list' | 'reminderList' | 'reminder';
export type IntervalType = 'daily' | 'weekly' | 'monthly';

export interface Item {
  id: string;
  text: string;
  checked: boolean;
  note: string;
}

// weekday follows the expo-notifications convention: 1 = Sunday .. 7 = Saturday
export interface ReminderTime {
  hour: number;
  minute: number;
  weekday?: number; // weekly only
  day?: number; // monthly only, 1-28
}

export interface ReminderConfig {
  interval: IntervalType;
  times: ReminderTime[];
}

export interface Page {
  id: string;
  title: string;
  type: PageType;
  color: string;
  position: number;
  items: Item[];
  tags: string[];
  reminder: ReminderConfig | null; // reminderList only
  onceAt: string | null; // reminder (once-off) only, local "yyyy-MM-ddTHH:mm"
  sendPush: boolean; // reminder & reminderList
  sendEmail: boolean; // reminder & reminderList
  archived: boolean;
  lastResetPeriodKey: string; // reminderList only
}

export function newItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  list: 'List',
  reminderList: 'Reminder list',
  reminder: 'Reminder',
};
