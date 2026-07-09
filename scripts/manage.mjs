// Admin CLI for TBKA's Firestore data. Runs on the PC with firebase-admin + a
// service account key, so it works regardless of security rules.
//
// Data is per user: users/{idNumber}/pages/{pageId}. Commands act on the
// default user (scripts/defaultUser.txt, set via set-user) unless --user given.
//
//   node scripts/manage.mjs set-user <idNumber>
//   node scripts/manage.mjs users
//   node scripts/manage.mjs list
//   node scripts/manage.mjs show <page>
//   node scripts/manage.mjs add-page "<title>" [--type list|reminderList|reminder]
//        [--interval daily|weekly|monthly] [--at "2026-07-15 09:00"]
//        [--color yellow] [--items "milk;bread;eggs"] [--push on|off] [--email on|off]
//   node scripts/manage.mjs add-once "<title>" "2026-07-15 09:00" [--color teal]
//   node scripts/manage.mjs remove-page <page>
//   node scripts/manage.mjs add-item <page> "<text>" [more items...]
//   node scripts/manage.mjs remove-item <page> <textOrIndex>
//   node scripts/manage.mjs check|uncheck <page> <textOrIndex>
//   node scripts/manage.mjs set-item-note <page> <textOrIndex> "<note>"
//   node scripts/manage.mjs tag|untag <page> <tag> [more...]
//   node scripts/manage.mjs set-times <page> "08:00,18:00" | "mon@08:00" | "1@08:00"
//   node scripts/manage.mjs set-once <page> "2026-07-15 09:00"
//   node scripts/manage.mjs archive|unarchive <page>
//   node scripts/manage.mjs notify <page> push|email on|off
//   node scripts/manage.mjs set-email "you@example.com"     (this account's reminder email)
//
// <page> = doc id or case-insensitive title prefix. Add --user <idNumber> to
// any command to act on another account.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const here = dirname(fileURLToPath(import.meta.url));
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(here, 'serviceAccountKey.json'), 'utf8'));
} catch {
  console.error('Missing scripts/serviceAccountKey.json (Firebase console -> Project settings -> Service accounts).');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const defaultUserPath = join(here, 'defaultUser.txt');

const COLORS = ['white', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'pink', 'purple', 'grey'];
const WEEKDAYS = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };
const WEEKDAY_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');

function resolveUser(flags) {
  if (flags.user) return flags.user;
  try {
    const id = readFileSync(defaultUserPath, 'utf8').trim();
    if (id) return id;
  } catch {}
  console.error('No user set. Pass --user <idNumber> or run: node scripts/manage.mjs set-user <idNumber>');
  process.exit(1);
}

const userDocFor = (id) => db.collection('users').doc(id);
const pagesColFor = (id) => userDocFor(id).collection('pages');

// Mirrors src/lib/periods.ts (local time; weekly = ISO week, Monday start)
function currentPeriodKey(interval, now = new Date()) {
  if (interval === 'daily') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (interval === 'monthly') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const isoYear = d.getFullYear();
  const week = Math.ceil(((d - new Date(isoYear, 0, 1)) / 86400000 + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

async function findPage(col, ref) {
  const byId = await col.doc(ref).get();
  if (byId.exists) return byId;
  const all = await col.get();
  const matches = all.docs.filter((d) => (d.data().title ?? '').toLowerCase().startsWith(ref.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) console.error(`No page matches "${ref}". Pages: ${all.docs.map((d) => d.data().title).join(', ')}`);
  else console.error(`"${ref}" is ambiguous: ${matches.map((d) => d.data().title).join(', ')}`);
  process.exit(1);
}

function findItem(items, ref) {
  const idx = /^\d+$/.test(ref)
    ? Number(ref) - 1
    : items.findIndex((i) => i.text.toLowerCase().startsWith(ref.toLowerCase()));
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
    if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
    else rest.push(args[i]);
  }
  return { flags, rest };
}

function parseOnceAt(spec) {
  if (!spec) return null;
  const m = spec.trim().replace(' ', 'T').match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})$/);
  if (!m) {
    console.error(`Invalid date-time "${spec}" — use "yyyy-mm-dd hh:mm", e.g. "2026-07-15 09:00"`);
    process.exit(1);
  }
  return `${m[1]}T${pad(Number(m[2]))}:${m[3]}`;
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

const onFlag = (v) => v === 'on' || v === 'true' || v === 'yes';

function fmtTime(interval, t) {
  const clock = `${pad(t.hour)}:${pad(t.minute)}`;
  if (interval === 'weekly') return `${WEEKDAY_NAMES[t.weekday]} ${clock}`;
  if (interval === 'monthly') return `day ${t.day} ${clock}`;
  return clock;
}

function printPage(doc) {
  const p = doc.data();
  let head;
  if (p.type === 'reminder') head = `[reminder once: ${p.onceAt ? p.onceAt.replace('T', ' ') : 'no date'}]`;
  else if (p.type === 'reminderList')
    head = `[reminderList ${p.reminder?.interval}: ${(p.reminder?.times ?? []).map((t) => fmtTime(p.reminder.interval, t)).join(', ') || 'no times'}]`;
  else head = '[list]';
  const flags = [];
  if (p.type !== 'list') {
    if (p.sendPush ?? true) flags.push('push');
    if (p.sendEmail) flags.push('email');
  }
  if (p.archived) flags.push('ARCHIVED');
  const tags = (p.tags ?? []).length ? ' ' + p.tags.map((t) => `#${t}`).join(' ') : '';
  console.log(`${p.title || 'Untitled'} ${head}${flags.length ? ` {${flags.join(',')}}` : ''}${tags} (${p.color}, id ${doc.id})`);
  (p.items ?? []).forEach((i, n) => {
    console.log(`  ${n + 1}. ${p.type === 'list' ? '' : i.checked ? '[x] ' : '[ ] '}${i.text}${i.note ? `  — ${i.note}` : ''}`);
  });
}

const setUpdated = (obj) => ({ ...obj, updatedAt: FieldValue.serverTimestamp() });

const [cmd, ...rawArgs] = process.argv.slice(2);
const { flags, rest: argv } = parseFlags(rawArgs);
const needsUser = cmd !== undefined && !['set-user', 'users'].includes(cmd);
const user = needsUser ? resolveUser(flags) : null;
const col = needsUser ? pagesColFor(user) : null;

switch (cmd) {
  case 'set-user': {
    const id = argv[0];
    if (!/^\d{6,}$/.test(id ?? '')) { console.error('Usage: set-user <idNumber>'); process.exit(1); }
    writeFileSync(defaultUserPath, id, 'utf8');
    console.log(`Default user set to ${id}`);
    break;
  }

  case 'users': {
    const refs = await db.collection('users').listDocuments();
    if (!refs.length) { console.log('No accounts yet.'); break; }
    for (const ref of refs) {
      const snap = await ref.get();
      const pages = await ref.collection('pages').get();
      console.log(`${ref.id} — ${pages.size} page(s)${snap.data()?.email ? `, email ${snap.data().email}` : ''}`);
    }
    break;
  }

  case 'list': {
    const all = await col.orderBy('position').get();
    if (all.empty) console.log('No pages yet.');
    all.docs.forEach(printPage);
    break;
  }

  case 'show':
    printPage(await findPage(col, argv[0]));
    break;

  case 'add-page':
  case 'add-once': {
    let title, type, interval, onceAt, color, itemsSpec;
    if (cmd === 'add-once') {
      title = argv[0];
      if (!title || !argv[1]) { console.error('Usage: add-once "<title>" "yyyy-mm-dd hh:mm"'); process.exit(1); }
      type = 'reminder';
      onceAt = parseOnceAt(argv[1]);
      color = COLORS.includes(flags.color) ? flags.color : 'teal';
    } else {
      title = argv[0];
      if (!title) { console.error('Usage: add-page "<title>" [--type ...] ...'); process.exit(1); }
      type = ['list', 'reminderList', 'reminder'].includes(flags.type) ? flags.type : 'reminderList';
      interval = ['daily', 'weekly', 'monthly'].includes(flags.interval) ? flags.interval : 'daily';
      onceAt = type === 'reminder' ? parseOnceAt(flags.at) : null;
      color = COLORS.includes(flags.color) ? flags.color : 'yellow';
    }
    itemsSpec = flags.items ? flags.items.split(';').map((s) => s.trim()).filter(Boolean) : [];
    const all = await col.get();
    const position = all.docs.reduce((m, d) => Math.max(m, d.data().position ?? 0), 0) + 1;
    const id = newId();
    await col.doc(id).set({
      title,
      type,
      color,
      position,
      items: itemsSpec.map((text) => ({ id: newId(), text, checked: false, note: '' })),
      tags: [],
      reminder: type === 'reminderList' ? { interval, times: [] } : null,
      onceAt: type === 'reminder' ? onceAt : null,
      sendPush: type === 'list' ? false : flags.push ? onFlag(flags.push) : true,
      sendEmail: type === 'list' ? false : onFlag(flags.email),
      archived: false,
      lastResetPeriodKey: type === 'reminderList' ? currentPeriodKey(interval) : '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Created ${type} "${title}" (id ${id})`);
    if (type === 'reminderList') console.log('Set times with: set-times');
    break;
  }

  case 'remove-page': {
    const doc = await findPage(col, argv[0]);
    await doc.ref.delete();
    console.log(`Deleted "${doc.data().title}"`);
    break;
  }

  case 'add-item': {
    const doc = await findPage(col, argv[0]);
    const texts = argv.slice(1);
    if (!texts.length) { console.error('Usage: add-item <page> "<text>" [more...]'); process.exit(1); }
    const items = [...(doc.data().items ?? []), ...texts.map((text) => ({ id: newId(), text, checked: false, note: '' }))];
    await doc.ref.update(setUpdated({ items }));
    console.log(`Added ${texts.length} item(s) to "${doc.data().title}"`);
    break;
  }

  case 'remove-item': {
    const doc = await findPage(col, argv[0]);
    const items = [...(doc.data().items ?? [])];
    const [removed] = items.splice(findItem(items, argv[1]), 1);
    await doc.ref.update(setUpdated({ items }));
    console.log(`Removed "${removed.text}"`);
    break;
  }

  case 'check':
  case 'uncheck': {
    const doc = await findPage(col, argv[0]);
    const items = [...(doc.data().items ?? [])];
    const idx = findItem(items, argv[1]);
    items[idx] = { ...items[idx], checked: cmd === 'check' };
    await doc.ref.update(setUpdated({ items }));
    console.log(`${cmd === 'check' ? 'Checked' : 'Unchecked'} "${items[idx].text}"`);
    break;
  }

  case 'set-item-note': {
    const doc = await findPage(col, argv[0]);
    const items = [...(doc.data().items ?? [])];
    const idx = findItem(items, argv[1]);
    items[idx] = { ...items[idx], note: argv[2] ?? '' };
    await doc.ref.update(setUpdated({ items }));
    console.log(`Note on "${items[idx].text}" set`);
    break;
  }

  case 'tag':
  case 'untag': {
    const doc = await findPage(col, argv[0]);
    const given = argv.slice(1).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
    if (!given.length) { console.error(`Usage: ${cmd} <page> <tag> [more...]`); process.exit(1); }
    const current = doc.data().tags ?? [];
    const tags = cmd === 'tag' ? [...new Set([...current, ...given])] : current.filter((t) => !given.includes(t));
    await doc.ref.update(setUpdated({ tags }));
    console.log(`"${doc.data().title}" tags: ${tags.map((t) => `#${t}`).join(' ') || '(none)'}`);
    break;
  }

  case 'set-times': {
    const doc = await findPage(col, argv[0]);
    const p = doc.data();
    if (p.type !== 'reminderList' || !p.reminder) { console.error(`"${p.title}" is not a reminder list.`); process.exit(1); }
    const times = parseTimes(p.reminder.interval, argv[1]);
    await doc.ref.update(setUpdated({ 'reminder.times': times }));
    console.log(`"${p.title}" ${p.reminder.interval}: ${times.map((t) => fmtTime(p.reminder.interval, t)).join(', ')}`);
    console.log('The phone reschedules notifications next time the app opens.');
    break;
  }

  case 'set-once': {
    const doc = await findPage(col, argv[0]);
    const p = doc.data();
    if (p.type !== 'reminder') { console.error(`"${p.title}" is not a once-off reminder.`); process.exit(1); }
    const onceAt = parseOnceAt(argv[1]);
    await doc.ref.update(setUpdated({ onceAt, archived: false }));
    console.log(`"${p.title}" reminds once at ${onceAt.replace('T', ' ')}`);
    break;
  }

  case 'archive':
  case 'unarchive': {
    const doc = await findPage(col, argv[0]);
    await doc.ref.update(setUpdated({ archived: cmd === 'archive' }));
    console.log(`"${doc.data().title}" ${cmd === 'archive' ? 'archived' : 'restored'}`);
    break;
  }

  case 'notify': {
    const doc = await findPage(col, argv[0]);
    const field = argv[1] === 'push' ? 'sendPush' : argv[1] === 'email' ? 'sendEmail' : null;
    if (!field || !['on', 'off'].includes(argv[2])) { console.error('Usage: notify <page> push|email on|off'); process.exit(1); }
    await doc.ref.update(setUpdated({ [field]: argv[2] === 'on' }));
    console.log(`"${doc.data().title}" ${argv[1]} ${argv[2]}`);
    break;
  }

  case 'set-email': {
    const email = argv[0] ?? '';
    await userDocFor(user).set({ email }, { merge: true });
    console.log(`Reminder email for ${user} set to ${email || '(none)'}`);
    break;
  }

  default:
    console.error('Unknown command. See the header of scripts/manage.mjs for usage.');
    process.exit(1);
}
