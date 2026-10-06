#!/usr/bin/env python3
"""Wave 4 "one suite" pass over the static hub pages (idempotent).

- Quick-launch dialog: regrouped into the suite menu groups (Make / Film /
  Music / Everyday / Locker / Community) with one name per app, Locker added.
- Header: shared <tcc-suite-menu> (same apps menu as every app) before the
  Quick launch button; Locker link in the site menu.
- Suite kit script on every page that has the hub header.
- Home: one-name card titles (Form, Luma, Ghost, Glyph), Locker card.
- sitemap: /locker/.
Run from the repo root: python3 maintenance/scripts/wave4-brand-pass.py
"""
import glob, html, re, sys

ROOT_PAGES = [p for p in glob.glob('**/*.html', recursive=True)
              if not p.startswith(('maintenance/', 'locker/', 'suite/'))]

def articles(dialog):
    out = {}
    for m in re.finditer(r'<article class="mm-launch-item"[^>]*>.*?</article>', dialog, re.S):
        a = m.group(0)
        name = html.unescape(re.search(r'<strong class="launch-app-name">(.*?)</strong>', a).group(1))
        out[name] = a
    return out

import subprocess
# Source item details from the pre-pass dialog. Use git's copy of index.html as
# of the commit before this pass so re-runs are idempotent.
src = subprocess.run(['git', 'show', 'cd23df0:index.html'], capture_output=True, text=True, check=True).stdout
i = src.find('<dialog class="mm-launch-dialog"'); j = src.find('</dialog>', i) + 9
OLD = articles(src[i:j])

def field(a, pat, default=''):
    m = re.search(pat, a, re.S)
    return m.group(1) if m else default

def item(name, group, search, dot=None, p=None, open_href=None, details=None, lesson=None, base=None, extra_attrs=''):
    b = OLD.get(base or name, '')
    dot = dot or field(b, r'background:(#[0-9a-fA-F]{6})', '#d8ff3e')
    p = p if p is not None else field(b, r'<p>(.*?)</p>')
    open_href = open_href or field(b, r'<a href="([^"]+)">Open app')
    details = details if details is not None else field(b, r'<a href="([^"]+)">Product details')
    if lesson is None:
        lesson = field(b, r'<a class="hero-launch-lesson" href="([^"]+)"')
    n = html.escape(name, quote=False)
    s = (f'<article class="mm-launch-item" data-mm-search="{html.escape(search)}"{extra_attrs}>'
         f'<span class="mm-tool-dot" style="background:{dot}" aria-hidden="true"></span>'
         f'<div><strong class="launch-app-name">{n}</strong><p>{p}</p></div>'
         f'<a href="{open_href}">Open app<span class="visually-hidden">: {n}</span></a>')
    if details:
        s += f'<a href="{details}">Product details<span class="visually-hidden">: {n}</span> ↗</a>'
    if lesson:
        s += f'<a class="hero-launch-lesson" href="{lesson}">Try a prepared project<span class="visually-hidden">: {n}</span> ↗</a>'
    return s + '</article>'

def sub(p):
    return (p.replace('Sattari Labs ·', 'Sattari ·').replace('Luma Studio ·', 'Luma ·')
             .replace('Form Studio ·', 'Form ·'))

GROUPS = [
    ('make', 'Make', [
        item('Form', 'make', 'form 3d cad design make', base='Form Studio'),
        item('Cast', 'make', 'cast form jewelry ring preview make', p=sub(field(OLD['Cast'], r'<p>(.*?)</p>'))),
        item('Luma', 'make', 'luma image layers color design make', base='Luma Studio'),
        item('Mockup', 'make', 'mockup luma tee hoodie poster design make', p=sub(field(OLD['Mockup'], r'<p>(.*?)</p>'))),
        item('Glyph', 'make', 'glyph font type lettering design make', base='Glyph Studio'),
        item('Ghost', 'make', 'ghost garment 3d design make', base='Ghost Studio'),
    ]),
    ('film', 'Film', [
        item('ScenePilot', 'film', 'scenepilot video editor film'),
        item('AutoCut', 'film', 'autocut scenepilot video beat edit film'),
        item('Captions', 'film', 'captions subtitles scenepilot film'),
        item('Board', 'film', 'board storyboard shot list scenepilot film'),
        item('Grade', 'film', 'grade color lut scenepilot film'),
        item('Reframe', 'film', 'reframe vertical crop scenepilot film', dot='#b8a3ff',
             p='ScenePilot · wide video to vertical, square &amp; 4:5',
             open_href='https://scenepilot.thecreatingco.com/tools/reframe/', details=''),
    ]),
    ('music', 'Music', [
        item('StemDeck', 'music', 'stemdeck stems remix sound music'),
        item('Split', 'music', 'split stems separate sattari sound music', p=sub(field(OLD['Split'], r'<p>(.*?)</p>'))),
        item('Key & BPM', 'music', 'key bpm tempo sattari sound music', p=sub(field(OLD['Key & BPM'], r'<p>(.*?)</p>'))),
        item('Vox', 'music', 'vox vocal pitch harmony sattari sound music', p=sub(field(OLD['Vox'], r'<p>(.*?)</p>'))),
        item('Canvas', 'music', 'canvas visuals loop sattari sound music', p=sub(field(OLD['Canvas'], r'<p>(.*?)</p>'))),
        item('Pocket', 'music', 'pocket beat loop sketch sattari sound music', p=sub(field(OLD['Pocket'], r'<p>(.*?)</p>'))),
        item('Press', 'music', 'press epk link in bio sattari music', p=sub(field(OLD['Press'], r'<p>(.*?)</p>'))),
    ]),
    ('everyday', 'Everyday', [
        item('Librarian', 'everyday', 'librarian books pdf read organize everyday'),
        item('Reclaim', 'everyday', 'reclaim duplicate files organize everyday'),
        item('Bounce', 'everyday', 'bounce music player sound everyday'),
    ]),
    ('locker', 'Locker', [
        item('Locker', 'locker', 'locker files library saved send everyday', dot='#d8ff3e',
             p='Your files across the apps · kept in this browser', open_href='/locker/', details='', lesson=''),
    ]),
    ('community', 'Community', [
        OLD['Sessions'].replace('data-mm-search="sessions sound community other apps"', 'data-mm-search="sessions listening sound community"'),
        OLD['Pocket Studio'].replace('data-mm-search="pocket studio sound community other apps"', 'data-mm-search="pocket studio voice memos sound community"'),
    ]),
]

def build_list():
    out = '<div class="mm-launch-list">'
    for gid, gname, items in GROUPS:
        n = len(items)
        out += (f'<section data-mm-launch-group="{gid}" aria-label="{gname}"><h3 class="mm-launch-group-title">'
                f'{gname} <span>{n} {"app" if n == 1 else "apps"}</span></h3>' + ''.join(items) + '</section>')
    return out + '</div>'

NEW_LIST = build_list()
TOTAL = sum(len(g[2]) for g in GROUPS)

MENU_EL = '<tcc-suite-menu style="display:inline-block;width:36px;height:36px;flex:none;vertical-align:middle"></tcc-suite-menu>'
SCRIPT = '<script src="/suite/v1/suite.js" data-app="home" data-menu="none" defer></script>'

changed = []
for path in ROOT_PAGES:
    s = open(path, encoding='utf-8').read()
    orig = s
    # 1. dialog list
    di = s.find('<dialog class="mm-launch-dialog"')
    if di != -1:
        dj = s.find('</dialog>', di) + 9
        d = s[di:dj]
        li = d.find('<div class="mm-launch-list">')
        le = d.find('<p class="mm-launch-empty"')
        if li != -1 and le != -1:
            d = d[:li] + NEW_LIST + d[le:]
            d = re.sub(r'<p class="mm-launch-count"([^>]*)>.*?</p>',
                       lambda m: f'<p class="mm-launch-count"{m.group(1)}>{TOTAL} apps and tools.</p>', d, flags=re.S)
            d = d.replace('placeholder="Try “sound” or “Creative Suite”"', 'placeholder="Try “sound”, “film” or “Locker”"')
        s = s[:di] + d + s[dj:]
    # 2. header: shared suite menu + Locker in site menu
    hi = s.find('<header class="header mm-header">')
    if hi != -1:
        he = s.find('</header>', hi) + 9
        h = s[hi:he]
        if '<tcc-suite-menu' not in h:
            for anchor in ('<button class="mm-launch-button"', '<details class="site-menu"', '</header>'):
                if anchor in h:
                    h = h.replace(anchor, MENU_EL + anchor, 1)
                    break
        if 'href="/locker/"' not in h and '<a href="/work/">Your work</a>' in h:
            h = h.replace('<a href="/work/">Your work</a>', '<a href="/work/">Your work</a><a href="/locker/">Locker</a>', 1)
        s = s[:hi] + h + s[he:]
        # 3. suite kit script
        if '/suite/v1/suite.js' not in s:
            k = s.rfind('</body>')
            s = s[:k] + SCRIPT + s[k:] if k != -1 else s + SCRIPT
    if s != orig:
        open(path, 'w', encoding='utf-8').write(s)
        changed.append(path)

# 4. home page: one-name card titles + Locker card
p = 'index.html'
s = open(p, encoding='utf-8').read(); orig = s
for old, new in (('Form Studio', 'Form'), ('Luma Studio', 'Luma'), ('Ghost Studio', 'Ghost'), ('Glyph Studio', 'Glyph')):
    s = s.replace(f'>{old}</a></h3>', f'>{new}</a></h3>')
    s = s.replace(f'<span class="visually-hidden">: {old}</span>', f'<span class="visually-hidden">: {new}</span>')
    s = s.replace(f'aria-label="Learn More: {old}"', f'aria-label="Learn More: {new}"')
s = s.replace('<div class="mm-notable-category">Design · Form Studio</div>', '<div class="mm-notable-category">Design · Form</div>')
LOCKER_CARD = ('<article class="mm-tool mm-notable-card" data-mm-product="locker" data-mm-category="Read &amp; organize" style="--tool-tone:#d8ff3e" data-mm-edition="Web app">'
               '<div class="mm-notable-art"><span class="mm-notable-badge">New</span><a href="/locker/" aria-label="Open Locker" class="mm-notable-icon">'
               '<img src="/locker/icon.svg" alt="" width="96" height="96" loading="lazy"></a></div><div class="mm-notable-category">Read &amp; organize</div>'
               '<h3><a href="/locker/">Locker</a></h3><p class="mm-notable-description">One place for files from thecreateco apps. Kept in this browser on this device: no cloud, no account.</p>'
               '<p class="mm-notable-edition">Web app</p><div class="mm-tool-actions"><a class="mm-solid" href="/locker/">Open App<span class="visually-hidden">: Locker</span></a></div></article>')
if 'data-mm-product="locker"' not in s:
    k = s.find('<article class="mm-tool mm-notable-card" data-mm-product="sessions"')
    if k == -1: sys.exit('sessions card not found')
    s = s[:k] + LOCKER_CARD + s[k:]
s = s.replace('>4 suite products + 7 other apps + 13 focused tools<', '>4 suite products + 8 other apps + 13 focused tools<')
if s != orig:
    open(p, 'w', encoding='utf-8').write(s)
    if p not in changed: changed.append(p)

# 5. sitemap
p = 'sitemap.xml'
s = open(p, encoding='utf-8').read()
if '/locker/' not in s:
    s = s.replace('<url><loc>https://thecreatingco.com/learn/</loc></url>', '<url><loc>https://thecreatingco.com/locker/</loc></url><url><loc>https://thecreatingco.com/learn/</loc></url>', 1)
    open(p, 'w', encoding='utf-8').write(s); changed.append(p)

print(f'{len(changed)} files changed')
for c in sorted(changed): print(' ', c)
