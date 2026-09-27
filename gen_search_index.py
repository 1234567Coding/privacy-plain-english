#!/usr/bin/env python3
"""Generate search-index.json for Privacy Plain English.

Reads the 7 articles in articles/, extracting for each:
  - title   : h1 text (fallback: <title>)
  - url     : "articles/<slug>.html"
  - excerpt : first ~160 chars of the first paragraph after the h1
  - headings: list of h2 heading texts

Writes search-index.json at the site root and validates that every
URL resolves to a real local file.
"""
import json
import re
import html
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parent
ARTICLES_DIR = SITE_ROOT / "articles"
OUT_FILE = SITE_ROOT / "search-index.json"

SLUGS = [
    "best-vpn-for-travel",
    "do-i-need-a-vpn",
    "free-vs-paid-vpns",
    "how-to-set-up-a-vpn",
    "vpn-explained-for-beginners",
    "vpn-myths-busted",
    "what-is-an-ip-address",
]


def clean(text):
    """Strip tags, decode entities, collapse whitespace."""
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def build_entry(slug):
    path = ARTICLES_DIR / f"{slug}.html"
    src = path.read_text(encoding="utf-8")

    m = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S)
    if m:
        title = clean(m.group(1))
    else:
        m = re.search(r"<title[^>]*>(.*?)</title>", src, re.S | re.I)
        title = clean(m.group(1)) if m else slug.replace("-", " ").title()

    # First paragraph: prefer one after the h1, skip byline/affiliate-notice classes.
    body = src
    if m:
        body = src[m.end():]
    excerpt = ""
    for pm in re.finditer(r'<p([^>]*)>(.*?)</p>', body, re.S):
        attrs, inner = pm.group(1), pm.group(2)
        if re.search(r'class="[^"]*(byline|affiliate-notice|meta|kicker)', attrs):
            continue
        text = clean(inner)
        if len(text) >= 40:  # skip stub/empty paragraphs
            excerpt = text[:160].rstrip()
            break
    if not excerpt:
        excerpt = title

    headings = [
        clean(h) for h in re.findall(r"<h2[^>]*>(.*?)</h2>", src, re.S)
    ]

    return {
        "title": title,
        "url": f"articles/{slug}.html",
        "excerpt": excerpt,
        "headings": headings,
    }


def main():
    index = [build_entry(slug) for slug in SLUGS]

    # Validate: every URL resolves to a real local file.
    missing = [
        e["url"] for e in index if not (SITE_ROOT / e["url"]).is_file()
    ]
    if missing:
        raise SystemExit(f"ERROR: index URLs with no local file: {missing}")

    OUT_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Re-read and parse to prove the written file is valid JSON.
    parsed = json.loads(OUT_FILE.read_text(encoding="utf-8"))
    print(f"Wrote {OUT_FILE} with {len(parsed)} entries:")
    for e in parsed:
        print(f"  - {e['title'][:55]:57} -> {e['url']} ({len(e['headings'])} h2s)")


if __name__ == "__main__":
    main()
