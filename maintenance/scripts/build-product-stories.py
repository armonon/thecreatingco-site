#!/usr/bin/env python3
"""Add accessible image-led workflow stories to every product detail page."""
from __future__ import annotations
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORIES = json.loads((ROOT / 'content/product-stories.json').read_text())
LINK = '<link rel="stylesheet" href="/product-story.css?v=20261009">'
SCRIPT = '<script src="/product-story.js?v=20261009" defer></script>'
TAG_RE = re.compile(r'<!--.*?-->|</?[^>]+>', re.S)


def element_end(source: str, marker: re.Match) -> int:
    tag = marker.group(1).lower()
    depth = 1
    for token in TAG_RE.finditer(source, marker.end()):
        raw = token.group(0)
        if raw.startswith('<!--'):
            continue
        parsed = re.match(r'<\s*(/?)\s*([\w:-]+)', raw)
        if not parsed or parsed.group(2).lower() != tag:
            continue
        if parsed.group(1):
            depth -= 1
            if depth == 0:
                return token.end()
        elif not raw.rstrip().endswith('/>'):
            depth += 1
    raise ValueError(f'Unclosed <{tag}> element')


def hero_end(source: str) -> int:
    marker = re.search(r'<([a-zA-Z][\w:-]*)\b[^>]*\bid=["\']top["\'][^>]*>', source, re.I | re.S)
    if not marker:
        raise ValueError('No #top hero found')
    return element_end(source, marker)


def render(slug: str, story: dict) -> str:
    name = html.escape(story['name'])
    slides = story['slides']
    panels = []
    steps = []
    for i, (title, body, image, alt) in enumerate(slides, 1):
        safe_title, safe_body = html.escape(title), html.escape(body)
        safe_image, safe_alt = html.escape(image, quote=True), html.escape(alt, quote=True)
        panel_id = f'product-story-{slug}-{i}'
        panels.append(
            f'<figure class="tcc-story-frame" id="{panel_id}" role="tabpanel" tabindex="0" '
            f'data-story-frame><img src="{safe_image}" alt="{safe_alt}" loading="lazy" decoding="async" '
            f'width="1600" height="1000"><figcaption>{safe_alt}</figcaption></figure>'
        )
        steps.append(
            f'<article class="tcc-story-step" data-story-step><p class="tcc-story-count">'
            f'{i:02d} <span aria-hidden="true">/</span> {len(slides):02d}</p>'
            f'<h3>{safe_title}</h3><p>{safe_body}</p></article>'
        )
    return (
        f'<section class="tcc-product-story" data-product-story="{slug}" '
        f'style="--story-accent:{html.escape(story["tone"], quote=True)}" '
        f'aria-labelledby="product-story-{slug}-title">'
        f'<div class="tcc-story-heading"><p class="tcc-story-kicker">A VISUAL TOUR · {name.upper()}</p>'
        f'<h2 id="product-story-{slug}-title">The work, as it comes together.</h2>'
        f'<p>{html.escape(story["intro"])}</p></div>'
        f'<div class="tcc-story-layout"><div class="tcc-story-visual" data-story-visual>'
        f'<div class="tcc-story-frames">{"".join(panels)}</div>'
        f'<nav class="tcc-story-controls" data-story-controls role="tablist" '
        f'aria-label="{name} visual tour" hidden></nav></div>'
        f'<div class="tcc-story-copy">{"".join(steps)}'
        f'<p class="tcc-story-status tcc-story-sr-only" data-story-status role="status" aria-live="polite" hidden></p>'
        f'</div></div></section>'
    )


def main() -> None:
    pages = sorted((ROOT / 'products').glob('*/index.html'))
    slugs = {p.parent.name for p in pages}
    if slugs != set(STORIES):
        raise SystemExit(f'Product/story mismatch: pages={sorted(slugs)} stories={sorted(STORIES)}')
    updated = []
    for page in pages:
        slug = page.parent.name
        source = page.read_text()
        existing = re.search(r'<(section)\b[^>]*data-product-story=["\']' + re.escape(slug) + r'["\'][^>]*>', source, re.I | re.S)
        if LINK not in source:
            source = source.replace('</head>', LINK + SCRIPT + '</head>', 1)
        if existing:
            end = element_end(source, existing)
            source = source[:existing.start()] + render(slug, STORIES[slug]) + source[end:]
        else:
            # Keep the story immediately after the existing hero and before product detail sections.
            at = hero_end(source)
            source = source[:at] + render(slug, STORIES[slug]) + source[at:]
        page.write_text(source)
        updated.append(slug)
    print(json.dumps({'updated': updated, 'count': len(updated)}))


if __name__ == '__main__':
    main()
