#!/usr/bin/env python3
"""Create a surgical Netlify draft over the exact published company-site manifest."""
from __future__ import annotations
import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = '59ccf268-f99f-43ba-89b6-1117fa561e93'
EXPECTED = '6ac9255b650074067734fcfc'
OUT = Path('/Users/agentsattari/thecreateco-company/reports/product-storytelling-2026-10-09')
SPECIAL = {'/_headers', '/_redirects', '/community/index.html'}


def token() -> str:
    config = json.loads((Path.home() / 'Library/Preferences/netlify/config.json').read_text())
    auth = config['users'][config['userId']]['auth']
    value = auth.get('token') if isinstance(auth, dict) else auth
    if not value:
        raise RuntimeError('Netlify CLI token is unavailable')
    return value


def request(method: str, route: str, data=None, binary=False):
    url = 'https://api.netlify.com/api/v1' + route
    headers = {'Authorization': 'Bearer ' + TOKEN}
    if data is not None:
        if binary:
            payload = data
            headers['Content-Type'] = 'application/octet-stream'
        else:
            payload = json.dumps(data).encode()
            headers['Content-Type'] = 'application/json'
    else:
        payload = None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as response:
        raw = response.read()
        return raw if binary else (json.loads(raw) if raw else {})


def page_sha(path: str) -> tuple[str, bytes]:
    full = ROOT / path.lstrip('/')
    data = full.read_bytes()
    return hashlib.sha1(data).hexdigest(), data


def create_draft() -> None:
    current = request('GET', f'/sites/{SITE}')
    published = current['published_deploy']['id']
    if published != EXPECTED:
        raise RuntimeError(f'Live site changed: expected {EXPECTED}, found {published}; stop and rebase')
    live_list = request('GET', f'/sites/{SITE}/files')
    live = {item['path']: item['sha'] for item in live_list}
    if len(live) != 1855 or not SPECIAL <= set(live):
        raise RuntimeError(f'Unexpected live manifest: {len(live)} paths')
    files = dict(live)
    contents = {}
    pages = sorted((ROOT / 'products').glob('*/index.html'))
    if len(pages) != 21:
        raise RuntimeError(f'Expected 21 product pages, found {len(pages)}')
    for path in pages:
        rel = '/' + path.relative_to(ROOT).as_posix()
        if rel not in live:
            raise RuntimeError('Product route not in live baseline: ' + rel)
        digest, data = page_sha(rel)
        files[rel] = digest
        contents[rel] = data
    overlays = {
        '/site-navigation.js', '/tools/index.html', '/start/index.html',
        '/start/start.css', '/start/media/community.png', '/start/media/store-current.jpg',
        '/sitemap.xml', '/site-refinement.css', '/app-logos.css',
        '/app-logos.js', '/product-story.css', '/product-story.js',
    }
    overlays.update('/assets/app-logos/' + path.name for path in sorted((ROOT / 'assets/app-logos').glob('*')) if path.is_file())
    for rel in sorted(overlays):
        digest, data = page_sha(rel)
        files[rel] = digest
        contents[rel] = data
    stories = json.loads((ROOT / 'content/product-stories.json').read_text())
    for story in stories.values():
        for slide in story['slides']:
            if slide[2] not in live:
                raise RuntimeError('Story image not in published asset manifest: ' + slide[2])
    changes = sorted(path for path in files if path in live and files[path] != live[path])
    added = sorted(path for path in files if path not in live)
    removed = sorted(path for path in live if path not in files)
    if not set(changes) <= overlays | {'/' + p.relative_to(ROOT).as_posix() for p in pages} or not set(added) <= overlays or removed:
        raise RuntimeError(f'Unexpected diff: changed={len(changes)} added={added} removed={removed}')
    if '/tools/index.html' not in changes or '/start/index.html' not in changes:
        raise RuntimeError('Expected Tools and start-page updates are absent from the draft')
    func = request('GET', f'/sites/{SITE}/functions')
    funcs = {entry['n']: entry['d'] for entry in func.get('functions', [])}
    digest = funcs.get('community-proxy')
    if not digest:
        raise RuntimeError('Current Community function digest unavailable')
    draft = request('POST', f'/sites/{SITE}/deploys', {
        'files': files,
        'functions': {'community-proxy': digest},
        'draft': True,
        'async': True,
    })
    deploy_id = draft['id']
    required = draft.get('required', [])
    for sha in required:
        matches = [p for p, value in files.items() if value == sha]
        rel = next((p for p in matches if p in contents), None)
        if rel is None:
            raise RuntimeError(f'Required upload has no staged bytes: {sha}')
        request('PUT', f'/deploys/{deploy_id}/files{rel}', contents[rel], binary=True)
    final = None
    for _ in range(90):
        final = request('GET', f'/deploys/{deploy_id}')
        if final.get('state') == 'ready':
            break
        if final.get('state') == 'error':
            raise RuntimeError('Draft failed: ' + json.dumps(final)[:1800])
        time.sleep(2)
    if not final or final.get('state') != 'ready':
        raise RuntimeError('Draft did not reach ready state')
    draft_files = request('GET', f'/deploys/{deploy_id}/files')
    draft_manifest = {item['path']: item['sha'] for item in draft_files}
    if draft_manifest != files:
        raise RuntimeError('Draft manifest differs from intended exact-snapshot overlay')
    OUT.mkdir(parents=True, exist_ok=True)
    receipt = {
        'baseline': published,
        'draft': deploy_id,
        'url': f'https://{deploy_id}--momentium-creative.netlify.app',
        'state': final.get('state'),
        'summary': final.get('summary'),
        'manifest_paths': len(files),
        'changed': changes,
        'added': added,
        'removed': removed,
        'community_function_digest': digest,
    }
    (OUT / 'draft.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


TOKEN = token()
if __name__ == '__main__':
    create_draft()
