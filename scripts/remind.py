"""Send ending-event reminders once per event and threshold."""
import json
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "data/events.json"
LEDGER = ROOT / "data/reminders-sent.json"


def due(feed, sent, now, thresholds, selected):
    items = []
    for event in feed.get("events", []):
        if event.get("hidden") or event.get("disabled"):
            continue
        if selected and event.get("gameId") not in selected:
            continue
        try:
            end = datetime.fromisoformat(event["endAt"].replace("Z", "+00:00"))
            hours = (end - now).total_seconds() / 3600
            if hours <= 0:
                continue
            for threshold in thresholds:
                key = f'{event["id"]}:{event["endAt"]}:{threshold}'
                if hours <= threshold and key not in sent:
                    items.append((key, threshold, event, end))
        except (KeyError, TypeError, ValueError):
            continue
    return items


def send(message):
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT") or "465"), context=ssl.create_default_context(), timeout=30) as server:
        server.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        server.send_message(message)


def main():
    required = ("ALERT_EMAIL", "ALERT_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD")
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        print("SKIP reminders: configure " + ", ".join(missing))
        return
    feed = json.loads(FEED.read_text(encoding="utf-8-sig"))
    ledger = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {"sent": {}}
    sent = ledger.setdefault("sent", {})
    now = datetime.now(timezone.utc)
    thresholds = sorted({int(x) for x in (os.environ.get("ALERT_HOURS") or "24,6").split(",") if x.strip()}, reverse=True)
    if not thresholds or any(x <= 0 or x > 168 for x in thresholds):
        raise ValueError("ALERT_HOURS values must be between 1 and 168")
    selected = set(filter(None, (os.environ.get("ALERT_GAME_IDS") or "").replace(" ", "").split(",")))
    games = {game["id"]: game["name"] for game in feed.get("games", [])}
    for key, threshold, event, end in due(feed, sent, now, thresholds, selected):
        message = EmailMessage()
        message["From"] = os.environ["ALERT_FROM"]
        message["To"] = os.environ["ALERT_EMAIL"]
        game = games.get(event["gameId"], event["gameId"])
        message["Subject"] = f"[次元时刻] {game} 活动将在 {threshold} 小时内结束"
        message.set_content("\n".join((f"游戏：{game}", f"活动：{event['title']}", f"结束时间：{end.strftime('%Y-%m-%d %H:%M %z')}", f"公告：{event.get('sourceUrl') or '无'}", f"时间线：{os.environ.get('SITE_URL') or 'https://xiaofan3689.dpdns.org/'}")))
        send(message)
        sent[key] = now.isoformat(timespec="seconds")
        LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"SENT {event['gameId']} {event['title']} ({threshold}h)")
    print("Reminder check complete")


if __name__ == "__main__":
    main()
