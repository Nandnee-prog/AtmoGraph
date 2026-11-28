r"""
news_source.py  -  news kahan se aayegi: free RSS ya sample_news.json (fallback).
"""
import json
import re
from pathlib import Path

import feedparser

ROOT = Path(__file__).resolve().parents[2]

FEEDS = {   # free RSS feeds (URL kabhi badal sakte hain, tab sample par fallback hota hai)
    "BBC Business": "http://feeds.bbci.co.uk/news/business/rss.xml",
    "Google News (shipping)": "https://news.google.com/rss/search?q=port+strike+OR+shipping+disruption+OR+supply+chain&hl=en-US&gl=US&ceid=US:en",
}


def load_sample():
    with open(ROOT / "data" / "sample" / "sample_news.json", encoding="utf-8") as f:
        return json.load(f)


def fetch_rss(limit_per_feed=15):
    items = []
    for name, url in FEEDS.items():
        feed = feedparser.parse(url)               # network fail par entries khaali aati hain
        for e in feed.entries[:limit_per_feed]:
            summary = re.sub(r"<[^>]+>", " ", e.get("summary", ""))   # HTML tags hatao
            items.append({"id": e.get("link", ""), "headline": e.get("title", ""),
                          "summary": summary.strip(), "source": name,
                          "published": e.get("published", "")})
        print(f"  RSS {name}: {len(feed.entries[:limit_per_feed])} items")
    return items


def get_news(source="sample"):
    """Return (items, source_used)."""
    if source == "rss":
        items = fetch_rss()
        if items:
            return items, "rss"
        print("RSS se kuch nahi mila, sample_news.json use ho raha hai.")
    return load_sample(), "sample"