"""Merge community activity feeds and hand-entered events into a public JSON feed."""
import json
import hashlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/events.json"
MANUAL = ROOT / "data/manual.json"
GAMES = {
    "ys": "原神", "nte": "异环", "sr": "崩坏：星穹铁道",
    "zzz": "绝区零", "ww": "鸣潮", "ak": "明日方舟",
    "end": "明日方舟：终末地", "ba-cn": "蔚蓝档案（国服）",
    "ba-jp": "蔚蓝档案（日服）", "ba-global": "蔚蓝档案（国际服）",
    "xtlr": "星塔旅人", "infinitynikki": "无限暖暖",
    "gf2": "少女前线2：追放", "pgr": "战双帕弥什",
    "czn": "卡厄斯梦境（国际服）", "bd2": "棕色尘埃2",
    "nikke": "NIKKE（国际服）", "hyrz": "火影忍者",
}
GAME_ICONS = {
    "ys": "https://ys.mihoyo.com/favicon.ico",
    "nte": "https://nte.perfectworld.com/favicon.ico",
    "sr": "https://sr.mihoyo.com/favicon.ico",
    "zzz": "https://zzz.mihoyo.com/favicon.ico",
    "ww": "https://mc.kurogames.com/favicon.ico",
    "ak": "https://ak.hypergryph.com/favicon.ico",
    "end": "https://endfield.hypergryph.com/favicon.ico",
    "ba-cn": "https://bluearchive-cn.com/favicon.ico",
    "ba-jp": "https://bluearchive.jp/favicon.ico",
    "ba-global": "https://bluearchive.nexon.com/favicon.ico",
    "xtlr": "https://stella-sora.com/favicon.ico",
    "infinitynikki": "https://infinitynikki.infoldgames.com/favicon.ico",
    "gf2": "https://gf2.sunborngame.com/favicon.ico",
    "pgr": "https://pns.kurogames.com/favicon.ico",
    "czn": "https://chaoszeronightmare.com/favicon.ico",
    "bd2": "https://www.browndust2.com/favicon.ico",
    "nikke": "https://nikke-en.com/favicon.ico",
    "hyrz": "https://hyrz.qq.com/favicon.ico",
}
BASE = "https://starrailassistant.top/api/v1/activity/"
CN_OFFSET = "+08:00"


def iso(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("缺少时间")
    value = value.strip().replace("Z", "+00:00")
    if len(value) == 10:
        raise ValueError("时间需精确到分钟并带时区")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        # SRA's Chinese feeds use local server times without a numeric offset.
        value += CN_OFFSET
        parsed = datetime.fromisoformat(value)
    return parsed.isoformat(timespec="seconds")


def event_id(game_id, name, start):
    key = f"{game_id}|{name}|{start}".encode("utf-8")
    return hashlib.sha256(key).hexdigest()[:20]


def valid_event(item):
    start = datetime.fromisoformat(item["startAt"])
    end = datetime.fromisoformat(item["endAt"])
    if end <= start:
        raise ValueError("结束时间必须晚于开始时间")
    return item


def get_json(url):
    req = Request(url, headers={"User-Agent": "AnimeEventsPrototype/0.1 (+https://github.com/)", "Accept": "application/json"})
    with urlopen(req, timeout=18) as response:
        return json.load(response)


def load_previous():
    if not OUT.exists():
        return {}
    try:
        previous = json.loads(OUT.read_text(encoding="utf-8-sig"))
        if not isinstance(previous, dict):
            raise ValueError("缓存根节点必须是对象")
        return previous
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"WARN 忽略损坏的旧活动缓存 {OUT}: {exc}")
        return {}


def write_feed(result):
    encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    json.loads(encoded)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=OUT.parent, prefix="events.", suffix=".tmp", delete=False) as handle:
            name = handle.name
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        json.loads(Path(name).read_text(encoding="utf-8"))
        os.replace(name, OUT)
    finally:
        if name and Path(name).exists():
            Path(name).unlink()


def main():
    previous = load_previous()
    manual = json.loads(MANUAL.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    games = {k: {"id": k, "name": v, "iconUrl": GAME_ICONS.get(k), "version": None, "versionName": None, "bannerUrl": None} for k, v in GAMES.items()}
    events = []
    sources = []
    previous_events = previous.get("events", [])
    previous_sources = {s.get("gameId"): s for s in previous.get("sources", [])}
    success = 0
    for game_id, name in GAMES.items():
        url = BASE + game_id + ".json"
        try:
            feed = get_json(url)
            if not isinstance(feed.get("activities"), list):
                raise ValueError("上游数据缺少 activities 列表")
            games[game_id].update({"version": feed.get("version"), "versionName": feed.get("versionName"), "bannerUrl": feed.get("cover") or None})
            count = 0
            for activity in feed["activities"]:
                try:
                    start, end = iso(activity["startTime"]), iso(activity["endTime"])
                    title = str(activity["name"]).strip()
                    if not title:
                        raise ValueError("活动名称为空")
                    events.append(valid_event({
                        "id": event_id(game_id, title, start), "gameId": game_id,
                        "title": title, "startAt": start, "endAt": end,
                        "category": activity.get("kind") or "活动",
                        "sourceType": "community", "sourceName": "SRA 社区整理",
                        "sourceUrl": url, "imageUrl": activity.get("cover"),
                    }))
                    count += 1
                except (KeyError, TypeError, ValueError) as exc:
                    print(f"SKIP {game_id}: {exc}")
            sources.append({"gameId": game_id, "url": url, "fetchedAt": now, "status": "ok", "eventCount": count})
            success += 1
            print(f"OK {name}: {count} events")
        except Exception as exc:
            kept = [e for e in previous_events if e.get("gameId") == game_id and e.get("sourceType") == "community"]
            events.extend(kept)
            old = previous_sources.get(game_id, {})
            sources.append({"gameId": game_id, "url": url, "fetchedAt": old.get("fetchedAt"), "status": "stale", "eventCount": len(kept)})
            print(f"STALE {name}: {exc}")
    for game in manual.get("games", []):
        if not all(isinstance(game.get(k), str) and game[k].strip() for k in ("id", "name", "iconUrl")):
            raise ValueError("人工游戏需要 id、name、iconUrl")
        games[game["id"]] = {k: game.get(k) for k in ("id", "name", "iconUrl", "version", "versionName", "bannerUrl", "versionNoticeAt", "nextVersionAt", "nextVersionEstimated")}
    for item in manual.get("events", []):
        game_id, title = item["gameId"], item["title"].strip()
        if game_id not in games or not title:
            raise ValueError("人工活动需要已定义的游戏及非空名称")
        start, end = iso(item["startAt"]), iso(item["endAt"])
        # Manual entries require an explicit timezone, avoiding ambiguous region times.
        if not any(mark in item["startAt"][10:] for mark in ("+", "-", "Z")) or not any(mark in item["endAt"][10:] for mark in ("+", "-", "Z")):
            raise ValueError("人工活动时间必须带时区偏移，例如 +08:00")
        events.append(valid_event({
            "id": item.get("id") or event_id(game_id, title, start),
            "gameId": game_id, "title": title, "startAt": start, "endAt": end,
            "category": item.get("category") or "活动",
            "sourceType": "manual", "sourceName": "人工录入",
            "sourceUrl": item.get("sourceUrl"), "imageUrl": item.get("imageUrl"),
        }))
    events = list({e["id"]: e for e in events}.values())
    events.sort(key=lambda e: (e["startAt"], e["gameId"], e["title"]))
    if not success and not previous_events and not manual.get("events"):
        print("WARN 所有上游均失败，写入有效的空活动数据，等待下次同步恢复")
    result = {"schemaVersion": 1, "generatedAt": now, "games": list(games.values()), "events": events, "sources": sources}
    write_feed(result)
    print(f"WROTE {len(events)} events")


if __name__ == "__main__":
    main()
