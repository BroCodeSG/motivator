// Scheduled email sender for TBKA reminders. Runs on GitHub Actions every few
// minutes (see .github/workflows/reminders.yml). For each account with an
// email set, finds reminders that are due right now and emails them, using a
// per-page key to avoid sending the same occurrence twice.
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON (CI). Falls back to the
//                             local scripts/serviceAccountKey.json for testing.
//   SMTP_USER, SMTP_PASS      Gmail address + app password used to send.
//   TZ                        set to the users' timezone (e.g. Africa/Johannesburg)
//                             so local reminder times are interpreted correctly.
//
// Flags: --dry-run  compute and log what would be sent, but don't send or mark.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');
const LOOKBACK_MS = 20 * 60 * 1000; // send if a scheduled time landed in the last 20 min
const here = dirname(fileURLToPath(import.meta.url));

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return JSON.parse(readFileSync(join(here, '..', 'serviceAccountKey.json'), 'utf8'));
}

initializeApp({ credential: cert(serviceAccount()) });
const db = getFirestore();

const pad = (n) => String(n).padStart(2, '0');

// Most recent scheduled occurrence for a reminderList time, in local time.
function recentOccurrence(interval, t, now) {
  if (interval === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.hour, t.minute, 0, 0);
  }
  if (interval === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), Math.min(t.day ?? 1, 28), t.hour, t.minute, 0, 0);
  }
  // weekly: this ISO week's occurrence for the weekday (expo 1=Sun..7=Sat)
  const isoDow = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1..Sun=7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoDow - 1));
  const offsetFromMonday = (((t.weekday ?? 1) - 1) + 6) % 7;
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offsetFromMonday, t.hour, t.minute, 0, 0);
}

// Returns { key, body } if the page is due for an email now, else null.
function dueEmail(page, now) {
  const unchecked = (page.items ?? []).filter((i) => !i.checked);
  const bodyFrom = (items) =>
    items.map((i) => (i.note ? `• ${i.text} (${i.note})` : `• ${i.text}`)).join('\n') || page.title;

  if (page.type === 'reminder') {
    if (!page.onceAt) return null;
    const at = new Date(page.onceAt);
    if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) return null;
    if ((page.items ?? []).length > 0 && unchecked.length === 0) return null;
    return { key: `once:${page.onceAt}`, body: bodyFrom(unchecked.length ? unchecked : page.items ?? []) };
  }

  if (page.type === 'reminderList' && page.reminder) {
    if (unchecked.length === 0 && (page.items ?? []).length > 0) return null; // nothing outstanding
    let best = null;
    for (const t of page.reminder.times ?? []) {
      const occ = recentOccurrence(page.reminder.interval, t, now);
      const ms = now.getTime() - occ.getTime();
      if (ms >= 0 && ms <= LOOKBACK_MS && (!best || occ.getTime() > best.getTime())) best = occ;
    }
    if (!best) return null;
    return { key: `${page.reminder.interval}:${best.toISOString()}`, body: bodyFrom(unchecked) };
  }

  return null;
}

let transporter = null;
async function send(to, subject, text) {
  if (DRY) {
    console.log(`[dry-run] would email ${to}: "${subject}"\n${text}\n`);
    return;
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP_USER / SMTP_PASS not set — cannot send.');
    return;
  }
  if (!transporter) {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  await transporter.sendMail({ from: `TBKA <${process.env.SMTP_USER}>`, to, subject, text });
  console.log(`Emailed ${to}: "${subject}"`);
}

const now = new Date();
console.log(`TBKA reminder cron @ ${now.toString()} (TZ=${process.env.TZ ?? 'system'})${DRY ? ' [dry-run]' : ''}`);

const users = await db.collection('users').listDocuments();
let sent = 0;
for (const userRef of users) {
  const user = (await userRef.get()).data() ?? {};
  const email = (user.email ?? '').trim();
  const pages = await userRef.collection('pages').get();
  for (const doc of pages.docs) {
    const page = doc.data();
    if (page.archived || !page.sendEmail) continue;
    const due = dueEmail(page, now);
    if (!due) continue;
    if (page.lastEmailKey === due.key) continue; // already sent this occurrence
    if (!email) {
      console.log(`Page "${page.title}" is due but ${userRef.id} has no email set — skipping.`);
      continue;
    }
    await send(email, page.title || 'Reminder', due.body);
    sent++;
    if (!DRY) await doc.ref.update({ lastEmailKey: due.key });
  }
}
console.log(`Done. ${sent} email(s) ${DRY ? 'would be ' : ''}sent.`);
process.exit(0);
