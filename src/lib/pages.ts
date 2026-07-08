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
import type { IntervalType, Item, Page, PageType, ReminderConfig } from '@/types';
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

function docToPage(id: string, data: any): Page {
  return {
    id,
    title: data.title ?? '',
    type: data.type ?? 'list',
    color: data.color ?? 'yellow',
    position: data.position ?? 0,
    items: Array.isArray(data.items) ? data.items : [],
    notes: data.notes ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    reminder: data.reminder ?? null,
    lastResetPeriodKey: data.lastResetPeriodKey ?? '',
  };
}

// The Firebase JS SDK only has a memory cache in React Native, so we mirror
// the last snapshot into AsyncStorage to have data on offline cold starts.
export async function loadCachedPages(): Promise<Page[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey());
    return raw ? (JSON.parse(raw) as Page[]) : [];
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
  interval?: IntervalType;
  position: number;
}): Promise<string> {
  const id = newItemId();
  const reminder: ReminderConfig | null =
    opts.type === 'reminder' ? { interval: opts.interval ?? 'daily', times: [], onceAt: null } : null;
  await setDoc(doc(pagesCol(), id), {
    title: opts.title,
    type: opts.type,
    color: opts.color,
    position: opts.position,
    items: [],
    notes: '',
    tags: [],
    reminder,
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
export const setNotes = (id: string, notes: string) => update(id, { notes });

export const setReminder = (id: string, reminder: ReminderConfig, lastResetPeriodKey: string) =>
  update(id, { reminder, lastResetPeriodKey });

export function addItem(page: Page, text: string): Promise<void> {
  return setItems(page.id, [...page.items, { id: newItemId(), text, checked: false }]);
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

// Applied lazily when a new period starts: uncheck everything and stamp the new period.
export function applyReset(page: Page, periodKey: string): Promise<void> {
  return update(page.id, {
    items: page.items.map((i) => ({ ...i, checked: false })),
    lastResetPeriodKey: periodKey,
  });
}
