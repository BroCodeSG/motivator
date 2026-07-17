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
import { ensureHtml } from '@/lib/richtext';
import type { IntervalType, Item, Page, PageType, ReminderConfig, ReminderTime } from '@/types';
import { newItemId } from '@/types';

// Each account is keyed by the user's ID number: users/{idNumber}/pages/{pageId}.
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
    note: ensureHtml(i.note ?? ''),
  }));
}

// Reads a Firestore doc into a Page, filling defaults and migrating older
// shapes. Legacy types: 'list' -> 'note' (items folded into the body as
// bullets); 'reminder' (once-off) -> 'note' with notify enabled.
function docToPage(id: string, data: any): Page {
  const raw = data.type ?? 'note';
  let type: PageType = 'note';
  let body: string = data.body ?? '';
  let notifyEnabled = !!data.notifyEnabled;
  let onceAt: string | null = data.onceAt ?? data.reminder?.onceAt ?? null;
  let items = normalizeItems(data.items);
  let reminder: ReminderConfig | null = data.reminder ?? null;

  const foldItemsIntoBody = () => {
    if (!body && items.length) body = items.map((i) => `- ${i.text}`).join('\n');
    items = [];
    reminder = null;
  };

  if (raw === 'reminderList') {
    type = 'reminderList';
    reminder = reminder ? { interval: reminder.interval, times: Array.isArray(reminder.times) ? reminder.times : [] } : { interval: 'daily', times: [] };
  } else if (raw === 'reminder') {
    type = 'note';
    notifyEnabled = true;
    foldItemsIntoBody();
  } else {
    // 'list', 'note', or unknown
    type = 'note';
    foldItemsIntoBody();
  }

  return {
    id,
    title: data.title ?? '',
    type,
    color: data.color ?? 'yellow',
    position: data.position ?? 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    archived: !!data.archived,
    body: ensureHtml(body),
    notifyEnabled,
    onceAt,
    items,
    reminder: type === 'reminderList' ? reminder : null,
    lastResetPeriodKey: data.lastResetPeriodKey ?? '',
    sendPush: data.sendPush ?? true,
    sendEmail: !!data.sendEmail,
  };
}

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
  body?: string;
  notifyEnabled?: boolean;
  onceAt?: string | null;
  interval?: IntervalType;
  times?: ReminderTime[];
  items?: { text: string; note?: string }[];
  sendEmail?: boolean;
  sendPush?: boolean;
}): Promise<string> {
  const id = newItemId();
  const isList = opts.type === 'reminderList';
  const reminder: ReminderConfig | null = isList
    ? { interval: opts.interval ?? 'daily', times: opts.times ?? [] }
    : null;
  const items: Item[] = isList
    ? (opts.items ?? [])
        .filter((i) => i.text.trim())
        .map((i) => ({ id: newItemId(), text: i.text.trim(), checked: false, note: i.note ?? '' }))
    : [];

  await setDoc(doc(pagesCol(), id), {
    title: opts.title,
    type: opts.type,
    color: opts.color,
    position: opts.position,
    tags: [],
    archived: false,
    body: isList ? '' : opts.body ?? '',
    notifyEnabled: isList ? false : !!opts.notifyEnabled,
    onceAt: isList ? null : opts.onceAt ?? null,
    items,
    reminder,
    lastResetPeriodKey: reminder ? currentPeriodKey(reminder.interval, new Date()) : '',
    sendPush: opts.sendPush ?? true,
    sendEmail: opts.sendEmail ?? false,
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
export const setNotifyEnabled = (id: string, notifyEnabled: boolean) => update(id, { notifyEnabled });
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
  return setItems(page.id, page.items.map((i) => (i.id === itemId ? { ...i, text } : i)));
}

export function setItemNote(page: Page, itemId: string, note: string): Promise<void> {
  return setItems(page.id, page.items.map((i) => (i.id === itemId ? { ...i, note } : i)));
}

// Applied lazily when a new period starts (reminderList only).
export function applyReset(page: Page, periodKey: string): Promise<void> {
  return update(page.id, {
    items: page.items.map((i) => ({ ...i, checked: false })),
    lastResetPeriodKey: periodKey,
  });
}
