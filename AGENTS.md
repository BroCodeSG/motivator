# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Motivator app

Google Keep-style Android app (Expo SDK 57 + expo-router + TypeScript). Multi-user: accounts are keyed by ID number with a PIN (SHA-256 hash in `users/{idNumber}`, entered once, session persists). Each user's pages live in `users/{idNumber}/pages`. Two page types: `reminder` (checkable items, daily/weekly/monthly notification times, only fires while items are unticked, ticks reset each period) and `list` (plain bullets).

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
node scripts/manage.mjs add-page "<title>" [--type reminder|list] [--interval daily|weekly|monthly] [--color yellow]
node scripts/manage.mjs remove-page <page>
node scripts/manage.mjs add-item <page> "<text>" [more...]
node scripts/manage.mjs remove-item <page> <textOrIndex>
node scripts/manage.mjs check|uncheck <page> <textOrIndex>
node scripts/manage.mjs set-times <page> "08:00,18:00"          # daily
node scripts/manage.mjs set-times <page> "mon@08:00,fri@17:00"  # weekly
node scripts/manage.mjs set-times <page> "1@08:00,15@18:00"     # monthly (day 1-28)
```

`<page>` = doc id or case-insensitive title prefix. The phone resyncs its notification schedule next time the app opens (data itself syncs live).

## Run / build

- Dev: `npx expo start` then Expo Go on the phone. NOTE: expo-notifications crashes on import in Expo Go on Android (SDK 53+), so src/lib/notifications.ts lazy-loads it and no-ops in Expo Go — reminders are only testable in an EAS build.
- APK: `eas build -p android --profile preview` (free tier, ~15 builds/month).
