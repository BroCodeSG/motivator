// Admin CLI for the Motivator app's Firestore data. Runs on the PC with
// firebase-admin + a service account key, so it works regardless of rules.
//
// Data is per user: users/{idNumber}/pages/{pageId}. Commands act on the
// default user (scripts/defaultUser.txt, set via set-user) unless --user is given.
//
//   node scripts/manage.mjs set-user <idNumber>     # remember the default account
//   node scripts/manage.mjs users                   # list all accounts
//   node scripts/manage.mjs list
//   node scripts/manage.mjs show <page>
//   node scripts/manage.mjs add-page "<title>" [--type reminder|list] [--interval daily|weekly|monthly] [--color yellow]
//   node scripts/manage.mjs remove-page <page>
//   node scripts/manage.mjs add-item <page> "<text>" [more items...]
//   node scripts/manage.mjs remove-item <page> <textOrIndex>
//   node scripts/manage.mjs check <page> <textOrIndex>
//   node scripts/manage.mjs uncheck <page> <textOrIndex>
//   node scripts/manage.mjs set-times <page> "<times>"
//       daily:   "08:00,12:30,18:00"
//       weekly:  "mon@08:00,fri@17:00"
//       monthly: "1@08:00,15@18:00"     (day of month 1-28)
//
// <page> matches a document id or a case-insensitive title prefix.
// Add --user <idNumber> to any command to act on another account.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const keyPath = join(dirname(fileURLToPath(import.meta.url)), 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error(`Missing or unreadable ${keyPath}`);
  console.error('Download it from Firebase console -> Project settings -> Service accounts.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const defaultUserPath = join(dirname(fileURLToPath(import.meta.url)), 'defaultUser.txt');

function resolveUser(flags) {
  if (flags.user) return flags.user;
  try {
    const id = readFileSync(defaultUserPath, 'utf8').trim();
    if (id) return id;
  } catch {}
  console.error('No user set. Pass --user <idNumber> or run: node scripts/manage.mjs set-user <idNumber>');
  process.exit(1);
}

function pagesColFor(userId) {
  return db.collection('users').doc(userId).collection('pages');
}

const COLORS = ['white', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'pink', 'purple', 'grey'];
const WEEKDAYS = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };
const WEEKDAY_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Mirrors src/lib/periods.ts (local time; weekly = ISO week, Monday start)
function currentPeriodKey(interval, now = new Date()) {
  if (interval === 'daily') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (interval === 'monthly') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Thursday of this ISO week
  const isoYear = d.getFullYear();
  const week = Math.ceil(((d - new Date(isoYear, 0, 1)) / 86400000 + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

async function findPage(ref) {
  const byId = await pagesCol.doc(ref).get();
  if (byId.exists) return byId;
  const all = await pagesCol.get();
  const matches = all.docs.filter((d) => (d.data().title ?? '').toLowerCase().startsWith(ref.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    console.error(`No page matches "${ref}". Pages: ${all.docs.map((d) => d.data().title).join(', ')}`);
  } else {
    console.error(`"${ref}" is ambiguous: ${matches.map((d) => d.data().title).join(', ')}`);
  }
  process.exit(1);
}

function findItem(items, ref) {
  const idx = /^\d+$/.test(ref) ? Number(ref) - 1 : items.findIndex((i) => i.text.toLowerCase().startsWith(ref.toLowerCase()));
  if (idx < 0 || idx >= items.length) {
    console.error(`No item matches "${ref}". Items: ${items.map((i, n) => `${n + 1}. ${i.text}`).join(' | ')}`);
    process.exit(1);
  }
  return idx;
}

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    } else {
      rest.push(args[i]);
    }
  }
  return { flags, rest };
}

function parseTimes(interval, spec) {
  return spec.split(',').map((part) => {
    const trimmed = part.trim();
    if (interval === 'daily') {
      const [h, m] = trimmed.split(':').map(Number);
      return { hour: h, minute: m ?? 0 };
    }
    const [prefix, clock] = trimmed.split('@');
    if (!clock) throw new Error(`"${trimmed}" must look like ${interval === 'weekly' ? 'mon@08:00' : '15@08:00'}`);
    const [h, m] = clock.split(':').map(Number);
    if (interval === 'weekly') {
      const weekday = WEEKDAYS[prefix.slice(0, 3).toLowerCase()];
      if (!weekday) throw new Error(`Unknown weekday "${prefix}"`);
      return { weekday, hour: h, minute: m ?? 0 };
    }
    const day = Number(prefix);
    if (!(day >= 1 && day <= 28)) throw new Error(`Day of month must be 1-28, got "${prefix}"`);
    return { day, hour: h, minute: m ?? 0 };
  });
}

function fmtTime(interval, t) {
  const clock = `${pad(t.hour)}:${pad(t.minute)}`;
  if (interval === 'weekly') return `${WEEKDAY_NAMES[t.weekday]} ${clock}`;
  if (interval === 'monthly') return `day ${t.day} ${clock}`;
  return clock;
}

function printPage(doc) {
  const p = doc.data();
  const head = p.type === 'reminder' && p.reminder
    ? `[reminder, ${p.reminder.interval}: ${p.reminder.times.map((t) => fmtTime(p.reminder.interval, t)).join(', ') || 'no times'}]`
    : '[list]';
  console.log(`${p.title || 'Untitled'} ${head} (${p.color}, id ${doc.id})`);
  (p.items ?? []).forEach((i, n) => {
    console.log(`  ${n + 1}. ${p.type === 'reminder' ? (i.checked ? '[x] ' : '[ ] ') : ''}${i.text}`);
  });
}

async function updateItems(doc, items) {
  await doc.ref.update({ items, updatedAt: FieldValue.serverTimestamp() });
}

const [cmd, ...rawArgs] = process.argv.slice(2);
const { flags, rest: argv } = parseFlags(rawArgs);
const needsUser = !['set-user', 'users'].includes(cmd) && cmd !== undefined;
const user = needsUser ? resolveUser(flags) : null;
const pagesCol = needsUser ? pagesColFor(user) : null;

switch (cmd) {
  case 'set-user': {
    const id = argv[0];
    if (!/^\d{6,}$/.test(id ?? '')) { console.error('Usage: set-user <idNumber> (digits only)'); process.exit(1); }
    writeFileSync(defaultUserPath, id, 'utf8');
    console.log(`Default user set to ${id}`);
    break;
  }

  case 'users': {
    const refs = await db.collection('users').listDocuments();
    if (refs.length === 0) { console.log('No accounts yet.'); break; }
    for (const ref of refs) {
      const pages = await ref.collection('pages').get();
      console.log(`${ref.id} — ${pages.size} page(s)`);
    }
    break;
  }

  case 'list': {
    const all = await pagesCol.orderBy('position').get();
    if (all.empty) console.log('No pages yet.');
    all.docs.forEach(printPage);
    break;
  }

  case 'show': {
    printPage(await findPage(argv[0]));
    break;
  }

  case 'add-page': {
    const title = argv[0];
    if (!title) { console.error('Usage: add-page "<title>" [--type ...] [--interval ...] [--color ...]'); process.exit(1); }
    const type = flags.type === 'list' ? 'list' : 'reminder';
    const interval = ['daily', 'weekly', 'monthly'].includes(flags.interval) ? flags.interval : 'daily';
    const color = COLORS.includes(flags.color) ? flags.color : 'yellow';
    const all = await pagesCol.get();
    const position = all.docs.reduce((max, d) => Math.max(max, d.data().position ?? 0), 0) + 1;
    const id = newId();
    await pagesCol.doc(id).set({
      title,
      type,
      color,
      position,
      items: [],
      reminder: type === 'reminder' ? { interval, times: [] } : null,
      lastResetPeriodKey: type === 'reminder' ? currentPeriodKey(interval) : '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Created ${type} page "${title}" (id ${id})`);
    if (type === 'reminder') console.log('No reminder times set yet — use set-times.');
    break;
  }

  case 'remove-page': {
    const doc = await findPage(argv[0]);
    await doc.ref.delete();
    console.log(`Deleted "${doc.data().title}"`);
    break;
  }

  case 'add-item': {
    const doc = await findPage(argv[0]);
    const texts = argv.slice(1);
    if (texts.length === 0) { console.error('Usage: add-item <page> "<text>" [more...]'); process.exit(1); }
    const items = [...(doc.data().items ?? []), ...texts.map((text) => ({ id: newId(), text, checked: false }))];
    await updateItems(doc, items);
    console.log(`Added ${texts.length} item(s) to "${doc.data().title}"`);
    break;
  }

  case 'remove-item': {
    const doc = await findPage(argv[0]);
    const items = [...(doc.data().items ?? [])];
    const idx = findItem(items, argv[1]);
    const [removed] = items.splice(idx, 1);
    await updateItems(doc, items);
    console.log(`Removed "${removed.text}" from "${doc.data().title}"`);
    break;
  }

  case 'check':
  case 'uncheck': {
    const doc = await findPage(argv[0]);
    const items = [...(doc.data().items ?? [])];
    const idx = findItem(items, argv[1]);
    items[idx] = { ...items[idx], checked: cmd === 'check' };
    await updateItems(doc, items);
    console.log(`${cmd === 'check' ? 'Checked' : 'Unchecked'} "${items[idx].text}"`);
    break;
  }

  case 'set-times': {
    const doc = await findPage(argv[0]);
    const p = doc.data();
    if (p.type !== 'reminder' || !p.reminder) { console.error(`"${p.title}" is not a reminder page.`); process.exit(1); }
    const times = parseTimes(p.reminder.interval, argv[1]);
    await doc.ref.update({ 'reminder.times': times, updatedAt: FieldValue.serverTimestamp() });
    console.log(`"${p.title}" now reminds ${p.reminder.interval}: ${times.map((t) => fmtTime(p.reminder.interval, t)).join(', ')}`);
    console.log('Note: the phone reschedules its notifications next time the app is opened.');
    break;
  }

  default:
    console.error('Unknown command. See the header of scripts/manage.mjs for usage.');
    process.exit(1);
}
