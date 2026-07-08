export type PageType = 'reminder' | 'list';
export type IntervalType = 'daily' | 'weekly' | 'monthly';

export interface Item {
  id: string;
  text: string;
  checked: boolean;
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
  reminder: ReminderConfig | null;
  lastResetPeriodKey: string;
}

export function newItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
