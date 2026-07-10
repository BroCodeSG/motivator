import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/firebase';
import { currentPeriodKey } from '@/lib/periods';
import type { IntervalType, Item, Page, PageType, ReminderConfig, ReminderTime } from '@/types';
import { newItemId } from '@/types';

// Each account is keyed by the user's ID number: users/{idNumber}/pages/{pageId}.
// The provider sets the active user before subscribing.
let activeUserId = '';

export function setActiveUser(id: string) {
  activeUserId = id;
}

function pagesCol() {
  if (!activeUserId) throw new Error('No active user set');
  return collection(db, 'users', activeUserId, 'pages');
}

const cacheKey = () => `pages-cache-v1:${activeUserId}`;

function normalizeItems(raw: any): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({
    id: i.id ?? newItemId(),
    text: i.text ?? '',
    checked: !!i.checked,
    note: i.note ?? '',
  }));
}

// Reads a Firestore doc into a Page, filling defaults and migrating older
// shapes: the previous single 'reminder' type (with interval 'once' or a
// recurring interval) is split into 'reminder' (once-off) and 'reminderList'.
function docToPage(id: string, data: any): Page {
  let type: PageType = data.type ?? 'list';
  let reminder: ReminderConfig | null = data.reminder ?? null;
  let onceAt: string | null = data.onceAt ?? null;

  if (type === 'reminder' && reminder) {
    if ((reminder.interval as string) === 'once') {
      onceAt = onceAt ?? (reminder as any).onceAt ?? null;
      reminder = null;
    } else {
      type = 'reminderList';
    }
  }
  if (type === 'reminderList' && !reminder) reminder = { interval: 'daily', times: [] };
  if (type === 'reminderList' && reminder) {
    reminder = { interval: reminder.interval, times: Array.isArray(reminder.times) ? reminder.times : [] };
  } else {
    reminder = null;
  }

  return {
    id,
    title: data.title ?? '',
    type,
    color: data.color ?? 'yellow',
    position: data.position ?? 0,
    items: normalizeItems(data.items),
    body: data.body ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    reminder,
    onceAt,
    sendEmail: !!data.sendEmail,
    sendPush: data.sendPush ?? true,
    archived: !!data.archived,
    lastResetPeriodKey: data.lastResetPeriodKey ?? '',
  };
}

// The Firebase JS SDK only has a memory cache in React Native, so we mirror
// the last snapshot into AsyncStorage to have data on offline cold starts.
export async function loadCachedPages(): Promise<Page[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey());
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((p) => docToPage(p.id, p));
  } catch {
    return [];
  }
}

export function subscribePages(onPages: (pages: Page[]) => void): () => void {
  return onSnapshot(
    pagesCol(),
    (snap) => {
      const pages = snap.docs
        .map((d) => docToPage(d.id, d.data()))
        .sort((a, b) => a.position - b.position);
      AsyncStorage.setItem(cacheKey(), JSON.stringify(pages)).catch(() => {});
      onPages(pages);
    },
    (err) => console.warn('pages subscription error', err)
  );
}

export async function createPage(opts: {
  title: string;
  type: PageType;
  color: string;
  position: number;
  interval?: IntervalType; // reminderList
  times?: ReminderTime[]; // reminderList
  onceAt?: string | null; // reminder
  itemTexts?: string[];
  body?: string;
  sendEmail?: boolean;
  sendPush?: boolean;
}): Promise<string> {
  const id = newItemId();
  const reminder: ReminderConfig | null =
    opts.type === 'reminderList' ? { interval: opts.interval ?? 'daily', times: opts.times ?? [] } : null;
  const items: Item[] = (opts.itemTexts ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ id: newItemId(), text, checked: false, note: '' }));

  await setDoc(doc(pagesCol(), id), {
    title: opts.title,
    type: opts.type,
    color: opts.color,
    position: opts.position,
    items,
    body: opts.body ?? '',
    tags: [],
    reminder,
    onceAt: opts.type === 'reminder' ? opts.onceAt ?? null : null,
    sendEmail: opts.sendEmail ?? false,
    sendPush: opts.sendPush ?? true,
    archived: false,
    lastResetPeriodKey: reminder ? currentPeriodKey(reminder.interval, new Date()) : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function deletePage(id: string): Promise<void> {
  await deleteDoc(doc(pagesCol(), id));
}

async function update(id: string, fields: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(pagesCol(), id), { ...fields, updatedAt: serverTimestamp() });
}

export const setTitle = (id: string, title: string) => update(id, { title });
export const setColor = (id: string, color: string) => update(id, { color });
export const setItems = (id: string, items: Item[]) => update(id, { items });
export const setTags = (id: string, tags: string[]) => update(id, { tags });
export const setBody = (id: string, body: string) => update(id, { body });
export const setOnceAt = (id: string, onceAt: string) => update(id, { onceAt });
export const setArchived = (id: string, archived: boolean) => update(id, { archived });
export const setSendEmail = (id: string, sendEmail: boolean) => update(id, { sendEmail });
export const setSendPush = (id: string, sendPush: boolean) => update(id, { sendPush });

export const setReminder = (id: string, reminder: ReminderConfig, lastResetPeriodKey: string) =>
  update(id, { reminder, lastResetPeriodKey });

export function addItem(page: Page, text: string): Promise<void> {
  return setItems(page.id, [...page.items, { id: newItemId(), text, checked: false, note: '' }]);
}

export function removeItem(page: Page, itemId: string): Promise<void> {
  return setItems(page.id, page.items.filter((i) => i.id !== itemId));
}

export function toggleItem(page: Page, itemId: string): Promise<void> {
  return setItems(
    page.id,
    page.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i))
  );
}

export function setItemText(page: Page, itemId: string, text: string): Promise<void> {
  return setItems(
    page.id,
    page.items.map((i) => (i.id === itemId ? { ...i, text } : i))
  );
}

export function setItemNote(page: Page, itemId: string, note: string): Promise<void> {
  return setItems(
    page.id,
    page.items.map((i) => (i.id === itemId ? { ...i, note } : i))
  );
}

// Applied lazily when a new period starts (reminderList only): uncheck
// everything and stamp the new period.
export function applyReset(page: Page, periodKey: string): Promise<void> {
  return update(page.id, {
    items: page.items.map((i) => ({ ...i, checked: false })),
    lastResetPeriodKey: periodKey,
  });
}
