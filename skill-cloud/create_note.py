#!/usr/bin/env python3
"""Create a TBKA page via the Firestore REST API (works from anywhere with
internet — no local files or service-account key needed, because the project's
security rules are open). Used by the tbka-note skill on claude.ai and in
Claude Code.

Examples:
  python create_note.py --title "Call the bank" --body "About the overdraft"
  python create_note.py --title "Shopping" --checklist --items "Milk;Bread;Eggs"
  python create_note.py --title "Dentist" --at "2026-07-15 14:00"
  python create_note.py --title "Morning" --type reminderList --interval daily \
      --items "Vitamins;Water" --times "07:00"
"""
import argparse
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

PROJECT = "thebetterreminderapp"
API_KEY = "AIzaSyBDXg97CDEoBi3_1OO0U_hWAYaK7q6LD_U"  # public web key; DB rules are open by design
USER_ID = "0006015226084"  # Stefan's TBKA account
COLORS = ["white", "red", "orange", "yellow", "green", "teal", "blue", "pink", "purple", "grey"]
WEEKDAYS = {"sun": 1, "mon": 2, "tue": 3, "wed": 4, "thu": 5, "fri": 6, "sat": 7}


def s(v): return {"stringValue": v}
def b(v): return {"booleanValue": bool(v)}
def i(v): return {"integerValue": str(int(v))}
def nul(): return {"nullValue": None}
def arr(vals): return {"arrayValue": {"values": vals}}
def mp(fields): return {"mapValue": {"fields": fields}}


def new_id():
    return format(int(time.time() * 1000), "x") + format(int(time.time_ns()) % 100000, "x")


def parse_once(spec):
    spec = spec.strip().replace(" ", "T")
    m = re.match(r"^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})$", spec)
    if not m:
        sys.exit(f'Invalid date-time "{spec}" — use "yyyy-mm-dd hh:mm".')
    return f"{m.group(1)}T{int(m.group(2)):02d}:{m.group(3)}"


def parse_times(interval, spec):
    out = []
    for part in spec.split(","):
        part = part.strip()
        if interval == "daily":
            h, _, mm = part.partition(":")
            out.append(mp({"hour": i(h), "minute": i(mm or 0)}))
        else:
            prefix, _, clock = part.partition("@")
            h, _, mm = clock.partition(":")
            if interval == "weekly":
                wd = WEEKDAYS.get(prefix[:3].lower())
                if not wd:
                    sys.exit(f'Unknown weekday "{prefix}"')
                out.append(mp({"weekday": i(wd), "hour": i(h), "minute": i(mm or 0)}))
            else:  # monthly
                out.append(mp({"day": i(int(prefix)), "hour": i(h), "minute": i(mm or 0)}))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--type", choices=["note", "reminderList"], default="note")
    ap.add_argument("--checklist", action="store_true")
    ap.add_argument("--body", default="")
    ap.add_argument("--items", default="")  # "a;b;c"
    ap.add_argument("--notify", action="store_true")  # note -> one-off reminder
    ap.add_argument("--at", default="")  # "yyyy-mm-dd hh:mm"
    ap.add_argument("--interval", choices=["daily", "weekly", "monthly"], default="daily")
    ap.add_argument("--times", default="")
    ap.add_argument("--color", default="yellow")
    ap.add_argument("--user", default=USER_ID)
    a = ap.parse_args()
    uid = a.user

    is_list = a.type == "reminderList"
    checklist = (a.type == "note") and a.checklist
    notify = (a.type == "note") and (a.notify or bool(a.at))
    has_items = is_list or checklist
    color = a.color if a.color in COLORS else "yellow"
    now = datetime.now(timezone.utc).isoformat()

    items = []
    if has_items and a.items:
        for t in [x.strip() for x in a.items.split(";") if x.strip()]:
            items.append(mp({"id": s(new_id()), "text": s(t), "checked": b(False), "note": s("")}))

    reminder = nul()
    last_reset = ""
    if is_list:
        times = parse_times(a.interval, a.times) if a.times else []
        reminder = mp({"interval": s(a.interval), "times": arr(times)})
        last_reset = datetime.now().strftime("%Y-%m-%d") if a.interval == "daily" else datetime.now().strftime("%Y-%m")

    fields = {
        "title": s(a.title),
        "type": s(a.type),
        "color": s(color),
        "position": i(int(time.time())),
        "tags": arr([]),
        "archived": b(False),
        "archivedAt": nul(),
        "body": s("" if has_items else a.body),
        "checklist": b(checklist),
        "notifyEnabled": b(notify),
        "onceAt": s(parse_once(a.at)) if (notify and a.at) else nul(),
        "items": arr(items),
        "reminder": reminder,
        "lastResetPeriodKey": s(last_reset),
        "sendPush": b(True),
        "sendEmail": b(False),
        "createdAt": {"timestampValue": now},
        "updatedAt": {"timestampValue": now},
    }

    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)"
        f"/documents/users/{uid}/pages?key={API_KEY}"
    )
    req = urllib.request.Request(
        url, data=json.dumps({"fields": fields}).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            r.read()
    except Exception as e:  # noqa: BLE001
        detail = getattr(e, "read", lambda: b"")()
        sys.exit(f"Failed to create page: {e}\n{detail.decode(errors='ignore') if detail else ''}")

    kind = "reminder list" if is_list else ("reminder" if notify else ("checklist note" if checklist else "note"))
    print(f'Created {kind} "{a.title}" on TBKA (account {uid}).')


if __name__ == "__main__":
    main()
