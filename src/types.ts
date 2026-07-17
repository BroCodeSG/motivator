// Two page types:
//  - 'note'          a rich-text note. Turn on `notifyEnabled` + set `onceAt`
//                    and it becomes a one-off reminder that fires with the body.
//  - 'reminderList'  a recurring checklist; each item has its own rich-text note
//                    block, and the list reminds you on a daily/weekly/monthly schedule.
export type PageType = 'note' | 'reminderList';
export type IntervalType = 'daily' | 'weekly' | 'monthly';

export interface Item {
  id: string;
  text: string;
  checked: boolean;
  note: string; // per-item rich-text block (markdown)
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
  tags: string[];
  archived: boolean;

  // note
  body: string;
  checklist: boolean; // note shows a tick-box list (items) instead of a text body
  notifyEnabled: boolean; // note becomes a one-off reminder when true
  onceAt: string | null; // local "yyyy-MM-ddTHH:mm"

  archivedAt: string | null; // ISO time a page was archived (for auto-cleanup)

  // reminderList
  items: Item[];
  reminder: ReminderConfig | null;
  lastResetPeriodKey: string;

  // shared reminder channels (note-with-notify + reminderList)
  sendPush: boolean;
  sendEmail: boolean;
}

export function newItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  note: 'Note',
  reminderList: 'Reminder list',
};
