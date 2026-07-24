---
name: tbka-note
description: Create a note, checklist, reminder, or recurring reminder on Stefan's TBKA site (The Better Keeps App). Use whenever the user wants to add/save/jot a note, list, checklist, shopping list, to-do, reminder, or recurring reminder to their "site", "app", "keeps", "TBKA", or "notes app". Handles picking the right format automatically from the details.
---

# Add a page to TBKA (The Better Keeps App)

TBKA is Stefan's personal Keep-style notes app. This skill creates a page by
running the bundled **`create_note.py`**, which writes directly to the app's
Firebase database over the internet (Firestore REST API). It needs only Python 3
(standard library) and internet — **no local key, no repo** — so it works both
on claude.ai and in Claude Code. New pages appear on his phone and at
https://thebetterreminderapp.web.app within seconds.

## How to run it

From this skill's directory:

```
python create_note.py --title "<title>" [flags]
```

(If `python` isn't found, try `python3`.) On success it prints
`Created <kind> "<title>" ...`. If it prints a network/permission error, tell
Stefan the write failed.

## Pick the format from what they describe, and map to flags

| What they describe | Flags |
|---|---|
| A thought / text / notes — free text | `--body "<text>"` |
| A list / shopping list / checklist, no schedule | `--checklist --items "A;B;C"` |
| Remind me once at a specific time | `--at "yyyy-mm-dd hh:mm"` (optionally `--body`) |
| Remind me repeatedly (daily/weekly/monthly) | `--type reminderList --interval daily|weekly|monthly --items "A;B;C" --times "<spec>"` |

Guide: no time + prose → text note; no time + a list → `--checklist`; one date/time → `--at`; "every day/week/month" → `--type reminderList`. If genuinely unsure, pick sensibly and say which format you used.

Other flags: `--color <white|red|orange|yellow|green|teal|blue|pink|purple|grey>`.

`--times` spec: daily `"08:00,18:00"`, weekly `"mon@08:00,fri@17:00"`, monthly `"1@08:00,15@18:00"` (day 1-28).

## Dates & times

Reminders need `yyyy-mm-dd hh:mm` (24h). **Resolve natural language against today's date yourself** (e.g. "next Wednesday 9am" → the coming Wednesday 09:00). Date only → default 09:00. Time only → today, or tomorrow if already past.

Body text supports light markdown that renders formatted in the app: `**bold**`, `*italic*`, `==highlight==`, `~~strike~~`, `# heading`, `- bullet`, `[label](url)`.

## If you can't run the script or have no internet (e.g. claude.ai) — build the link yourself

You do NOT need the script or a network to create a note. Just hand Stefan a **tap-to-add link**; his signed-in browser creates the page when he opens it. Build this URL and present it plainly (clickable), telling him to tap it:

`https://thebetterreminderapp.web.app/?new=1&title=<TITLE>&type=<note|reminderList>&<extra params>`

URL-encode every value (spaces → %20, etc.). Params:
- `title` (required)
- `type` = `note` (default) or `reminderList`
- `checklist=1` — tick-box note (with `items`)
- `body=<text>` — text note body (markdown ok)
- `items=A;B;C` — semicolon-separated (checklist note or reminder list)
- `notify=1` and `at=YYYY-MM-DDTHH:MM` — makes a note a one-off reminder (resolve the date yourself)
- `interval=daily|weekly|monthly` and `times=<spec>` — for `reminderList` (times spec: `08:00,18:00` daily; `mon@08:00` weekly; `15@08:00` monthly)
- `color=<name>`

Examples:
- text note → `.../?new=1&title=Test%202&type=note&body=Hello%20world`
- checklist → `.../?new=1&title=Test%20123&type=note&checklist=1&items=Milk;Eggs;Cheese`
- one-off reminder → `.../?new=1&title=Dentist&notify=1&at=2026-07-15T14:00`
- recurring → `.../?new=1&title=Morning&type=reminderList&interval=daily&items=Vitamins;Water&times=07:00`

## After running the script

The script prints one of two things — relay it accordingly:
- **"Created …"** — it wrote directly (network available, e.g. Claude Code). Tell Stefan what you created, its format, and that it's on his phone and web.
- **"TAP-TO-ADD LINK …\n<url>"** — no network here, so it produced a link. Give Stefan that URL to open (signed in to TBKA).

Reminders (push) fire from the installed Android app; email reminders need the GitHub Actions secrets set. Notes/lists themselves work everywhere immediately.

## Examples

- "note: call the bank about the overdraft" → `python create_note.py --title "Call the bank" --body "About the overdraft"`
- "shopping list: milk, bread, eggs" → `python create_note.py --title "Shopping" --checklist --items "Milk;Bread;Eggs"`
- "remind me of the dentist next Wednesday at 2pm" (resolve date) → `python create_note.py --title "Dentist appointment" --at "2026-07-15 14:00"`
- "every morning remind me to take vitamins and drink water" → `python create_note.py --title "Morning" --type reminderList --interval daily --items "Take vitamins;Drink water" --times "07:00"`
