# TBKA — The Better Keeps App

A Google Keep-style Android app for staying on track. Built with Expo (React Native + TypeScript) and Firebase Firestore — everything runs on free tiers.

## What it does

- **Pages as colored cards** on a Keep-style grid, two kinds:
  - **Reminder pages** — checkable items with daily, weekly, or monthly reminders at as many times as you like (e.g. daily at 08:00 and 18:00, or monthly on the 1st and 15th). Notifications only fire while items are still unticked, and ticks reset automatically at the start of each new day/week/month.
  - **List pages** — plain bullet lists, no reminders.
- **Simple accounts** — sign in once with an ID number + PIN; each user gets their own pages.
- **Offline-friendly** — pages are cached locally; notifications are scheduled on-device.
- **Admin CLI** — `scripts/manage.mjs` edits any account's data from a PC (add/remove/check items, set reminder times), handy for driving the app from scripts or AI assistants.

## Setup

1. `npm install`
2. Create a free Firebase project, enable Firestore, and set rules to allow access (this app uses convenience-grade auth — don't store anything sensitive).
3. Copy `src/firebase-config.example.ts` to `src/firebase-config.ts` and fill in your web app config from the Firebase console.
4. For the admin CLI: download a service account key to `scripts/serviceAccountKey.json` (Project settings → Service accounts) and run `node scripts/manage.mjs set-user <idNumber>` once.

## Run

- Dev: `npx expo start`, then open in Expo Go on Android (local notifications work in Expo Go).
- Tests: `npm test` (date/period logic).
- APK: `eas build -p android --profile preview` with a free [expo.dev](https://expo.dev) account.

## Security note

Auth is an ID number + hashed PIN stored in Firestore with open rules — it keeps accounts separate between honest users, nothing more. By design, for non-confidential data only.
