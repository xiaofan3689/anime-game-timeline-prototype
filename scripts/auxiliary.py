"""Supplemental feeds. SRA wins title conflicts; never infer dates from news."""
import re
from concurrent.futures import ThreadPoolExecutor

ROUTES = {"pcr": ("pcr", "公主连结（国服）"), "genshin": ("ys", "原神"), "starrail": ("sr", "崩坏：星穹铁道"), "fgo": ("fgo", "FGO（国服）"), "ak": ("ak", "明日方舟"), "mc": ("ww", "鸣潮"), "pns": ("pgr", "战双帕弥什"), "ba": ("ba-cn", "蔚蓝档案（国服）"), "ba-jp": ("ba-jp", "蔚蓝档案（日服）"), "nikke": ("nikke", "NIKKE（国际服）"), "cbjq": ("snowbreak", "尘白禁区"), "endfield": ("end", "明日方舟：终末地"), "nte": ("nte", "异环"), "zzz": ("zzz", "绝区零")}
BASE = "https://gebc.lee-sikaha.cloudns.ch/"
def key(game, title):
    return game, re.sub(r"[\W_]+", "", title).casefold()

def collect(get_json, iso, event_id, valid_event, games, events, sources, previous, now):
    def fetch(route):
        try:
            body = get_json(BASE + route)
            rows = body.get("data")
            if not isinstance(rows, list):
                raise ValueError("unsupported response schema")
            return route, rows, None
        except Exception as exc:
            return route, None, str(exc)
    seen = {key(e["gameId"], e["title"]) for e in events}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, ROUTES))
    for route, rows, error in results:
        game, name = ROUTES[route]
        added = 0
        if error:
            candidates = [e for e in previous.get("events", []) if e.get("sourceName") == "game-schedule" and e.get("gameId") == game]
        else:
            candidates = []
            for row in rows:
                try:
                    title = str(row.get("title") or row.get("name") or "").strip()
                    if not title:
                        continue
                    start, end = iso(row["start_time"]), iso(row["end_time"])
                    candidates.append(valid_event({"id": event_id(game,title,start), "gameId": game, "title": title, "startAt": start, "endAt": end, "category": "活动", "sourceType": "community", "sourceName": "game-schedule", "sourceUrl": row.get("linkUrl") or BASE+route, "imageUrl": row.get("banner")}))
                except (KeyError, TypeError, ValueError):
                    continue
        for e in candidates:
            k = key(game,e["title"])
            if k in seen:
                continue
            seen.add(k)
            events.append(e)
            added += 1
        if added and game not in games:
            games[game] = {"id":game,"name":name,"iconUrl":None,"version":None,"versionName":None,"bannerUrl":None}
        sources.append({"gameId":game,"sourceName":"game-schedule","url":BASE+route,"status":"stale" if error else "ok","fetchedAt":None if error else now,"eventCount":added,"error":error})
    endpoint = "https://api.ennead.cc/mihoyo/honkai/news/events?lang=zh-cn"
    try:
        news = get_json(endpoint)
        sources.append({"gameId":"honkai","sourceName":"Ennead","url":endpoint,"status":"ok","fetchedAt":now,"kind":"news"})
    except Exception as exc:
        news = previous.get("honkaiNews", [])
        sources.append({"gameId":"honkai","sourceName":"Ennead","url":endpoint,"status":"stale","kind":"news","error":str(exc)})
    return news
