export type PageType = 'reminder' | 'list';
export type IntervalType = 'daily' | 'weekly' | 'monthly' | 'once';

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
  // 'once' interval only: local datetime "yyyy-MM-ddTHH:mm" the single reminder fires at
  onceAt?: string | null;
}

export interface Page {
  id: string;
  title: string;
  type: PageType;
  color: string;
  position: number;
  items: Item[];
  notes: string;
  tags: string[];
  reminder: ReminderConfig | null;
  lastResetPeriodKey: string;
}

export function newItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
