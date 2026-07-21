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
from urllib.parse import urlencode

WEB_APP = "https://thebetterreminderapp.web.app"
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


def parse_times_plain(interval, spec):
    """Parse a times spec into plain dicts {hour,minute,weekday?,day?}."""
    out = []
    for part in spec.split(","):
        part = part.strip()
        if interval == "daily":
            h, _, mm = part.partition(":")
            out.append({"hour": int(h), "minute": int(mm or 0)})
        else:
            prefix, _, clock = part.partition("@")
            h, _, mm = clock.partition(":")
            if interval == "weekly":
                wd = WEEKDAYS.get(prefix[:3].lower())
                if not wd:
                    sys.exit(f'Unknown weekday "{prefix}"')
                out.append({"weekday": wd, "hour": int(h), "minute": int(mm or 0)})
            else:  # monthly
                out.append({"day": int(prefix), "hour": int(h), "minute": int(mm or 0)})
    return out


def _time_to_fs(t):
    f = {"hour": i(t["hour"]), "minute": i(t["minute"])}
    if "weekday" in t:
        f["weekday"] = i(t["weekday"])
    if "day" in t:
        f["day"] = i(t["day"])
    return mp(f)


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
    once_at = parse_once(a.at) if (notify and a.at) else None

    # Plain, portable spec (also used to build the tap-to-add link).
    spec = {
        "title": a.title,
        "type": a.type,
        "checklist": checklist,
        "body": "" if has_items else a.body,
        "items": [x.strip() for x in a.items.split(";") if x.strip()] if has_items else [],
        "notify": notify,
        "onceAt": once_at,
        "interval": a.interval,
        "times": parse_times_plain(a.interval, a.times) if (is_list and a.times) else [],
        "color": color,
    }
    kind = "reminder list" if is_list else ("reminder" if notify else ("checklist note" if checklist else "note"))

    now = datetime.now(timezone.utc).isoformat()
    reminder = mp({"interval": s(a.interval), "times": arr([_time_to_fs(t) for t in spec["times"]])}) if is_list else nul()
    last_reset = ""
    if is_list:
        last_reset = datetime.now().strftime("%Y-%m-%d") if a.interval == "daily" else datetime.now().strftime("%Y-%m")
    fields = {
        "title": s(a.title),
        "type": s(a.type),
        "color": s(color),
        "position": i(int(time.time())),
        "tags": arr([]),
        "archived": b(False),
        "archivedAt": nul(),
        "body": s(spec["body"]),
        "checklist": b(checklist),
        "notifyEnabled": b(notify),
        "onceAt": s(once_at) if once_at else nul(),
        "items": arr([mp({"id": s(new_id()), "text": s(t), "checked": b(False), "note": s("")}) for t in spec["items"]]),
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
        print(f'Created {kind} "{a.title}" on TBKA (account {uid}). It is on the phone and web now.')
        return
    except Exception:  # noqa: BLE001 — no network here (e.g. claude.ai sandbox): fall back to a link.
        q = {"new": "1", "title": a.title, "type": a.type, "color": color}
        if checklist:
            q["checklist"] = "1"
        if spec["body"]:
            q["body"] = spec["body"]
        if spec["items"]:
            q["items"] = ";".join(spec["items"])
        if notify:
            q["notify"] = "1"
        if once_at:
            q["at"] = once_at
        if is_list:
            q["interval"] = a.interval
            if a.times:
                q["times"] = a.times
        link = f"{WEB_APP}/?{urlencode(q)}"
        print(
            f'TAP-TO-ADD LINK (open it signed in to TBKA to create the {kind} "{a.title}"):\n{link}'
        )


if __name__ == "__main__":
    main()
