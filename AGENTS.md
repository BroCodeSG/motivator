# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# TBKA (The Better Keeps App), formerly "Motivator"

Google Keep-style app (Expo SDK 57 + expo-router + TypeScript; Android APK + web). Multi-user: accounts keyed by ID number + PIN (SHA-256 hash in `users/{idNumber}`, `email` field for reminders, entered once, session persists). Pages live in `users/{idNumber}/pages`. TWO page types:
- `note` — a rich-text note (`body`, markdown: **bold** *italic* ==highlight== ~~strike~~ `# heading` `- bullet` `[text](url)`). Turn on `notifyEnabled` + set `onceAt` and it becomes a one-off reminder that fires/emails the body, then auto-archives once past.
- `reminderList` — recurring checklist (daily/weekly/monthly times); each item has its own rich-text `note` block; fires while items unticked; ticks reset each period.

Legacy migration lives in docToPage (`src/lib/pages.ts`): old `list`→`note` (items folded into body bullets), old `reminder`→`note`+notify. Rich text: `src/components/RichText.tsx` (RichText renderer + RichTextEditor with a B/I/H/S/bullet/H1/link toolbar). Pages have tags, color, `sendPush`/`sendEmail`, `archived`. Detail screen = view mode (tick + Edit) / edit mode, centered card. Home has search + type filter (All/Notes/Reminders/Recurring) + tag filter. Push = local notifications on the installed Android app. Email = GitHub Actions cron (scripts/cron/).

- Data model + CRUD: `src/lib/pages.ts`, types in `src/types.ts`
- Period/reset logic (pure, Jest-tested): `src/lib/periods.ts` — `npm test`
- Notification reconciler: `src/lib/notifications.ts` (cancel-all + rebuild on every app event)
- Weekday convention everywhere: expo-notifications style, 1=Sunday..7=Saturday

## Managing Stefan's items from the PC

When Stefan asks to add/remove/check items or pages, use the admin CLI (requires `scripts/serviceAccountKey.json`, gitignored):

Commands act on the default account (`scripts/manage.mjs set-user <idNumber>` once, stored in gitignored scripts/defaultUser.txt); add `--user <idNumber>` to target someone else. `node scripts/manage.mjs users` lists accounts.

```
node scripts/manage.mjs list
node scripts/manage.mjs show <page>
node scripts/manage.mjs add-page "<title>" [--type note|reminderList] [--interval daily|weekly|monthly] [--items "a;b;c"] [--notify on] [--at "2026-07-15 09:00"] [--body "..."] [--push on|off] [--email on|off] [--color yellow]
node scripts/manage.mjs add-note "<title>" [--body "..."]          # a plain note
node scripts/manage.mjs add-once "<title>" "2026-07-15 09:00"      # a note with a one-off reminder; resolve natural dates yourself
node scripts/manage.mjs set-body <page> "<markdown body>"          # note body
node scripts/manage.mjs remove-page <page>
node scripts/manage.mjs add-item <page> "<text>" [more...]         # reminderList only
node scripts/manage.mjs remove-item <page> <textOrIndex>
node scripts/manage.mjs check|uncheck <page> <textOrIndex>
node scripts/manage.mjs set-item-note <page> <textOrIndex> "<note>"
node scripts/manage.mjs tag|untag <page> <tag> [more...]
node scripts/manage.mjs set-times <page> "08:00,18:00" | "mon@08:00,fri@17:00" | "1@08:00,15@18:00"
node scripts/manage.mjs set-once <page> "2026-07-15 09:00"         # turns a note into a one-off reminder
node scripts/manage.mjs archive|unarchive <page>
node scripts/manage.mjs notify <page> push|email on|off
node scripts/manage.mjs set-email "you@example.com"            # this account's reminder email
```

`<page>` = doc id or case-insensitive title prefix. The phone resyncs its notification schedule next time the app opens (data itself syncs live).

## Email reminders (GitHub Actions cron)

`scripts/cron/notify-cron.mjs` + `.github/workflows/reminders.yml` send emails for pages with `sendEmail` on, every ~10 min. Dedup via a per-page `lastEmailKey`. Needs repo secrets: `FIREBASE_SERVICE_ACCOUNT` (service-account JSON), `SMTP_USER` + `SMTP_PASS` (Gmail address + app password). Test locally: `node scripts/cron/notify-cron.mjs --dry-run` (uses local serviceAccountKey.json; sends nothing). TZ is pinned to Africa/Johannesburg in the workflow so local reminder times resolve correctly.

## Run / build

- Dev: `npx expo start` then Expo Go. NOTE: expo-notifications crashes on import in Expo Go on Android (SDK 53+), so src/lib/notifications.ts lazy-loads it and no-ops there — push reminders only work in an EAS build.
- Web: `npx expo export --platform web` → deploy `dist/` with `npx firebase-tools deploy --only hosting` (project thebetterreminderapp → https://thebetterreminderapp.web.app). Time pickers, dialogs, notifications have web fallbacks.
- APK: `eas build -p android --profile preview` (free tier, ~15 builds/month).
