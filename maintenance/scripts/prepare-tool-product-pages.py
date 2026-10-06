"""Build narrowly scoped tool pages from the current immutable live site."""
from pathlib import Path
from html import escape
import json
import runpy
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/tool-product-pages-20261006'
SITE = '59ccf268-f99f-43ba-89b6-1117fa561e93'
ORIGIN = 'https://thecreatingco.com'
SLUGS = ['autocut', 'captions', 'board', 'grade', 'mockup', 'glyph', 'split', 'key-bpm', 'vox', 'canvas', 'pocket', 'press']
helpers = runpy.run_path(str(ROOT / 'scripts/site-release-hardening.py'))
D, edits, opening = helpers['Document'], helpers['edits'], helpers['opening']


def capture():
    OUT.mkdir(parents=True, exist_ok=True)
    config = json.loads(Path('/Users/lillypad/Library/Preferences/netlify/config.json').read_text())
    auth = config['users'][config['userId']]['auth']
    token = auth.get('token') if isinstance(auth, dict) else auth

    def api(route):
        request = urllib.request.Request('https://api.netlify.com/api/v1' + route, headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    deploy = api('/sites/' + SITE)['published_deploy']
    baseline = {'deploy': deploy['id'], 'url': deploy['deploy_ssl_url'], 'files': api('/sites/' + SITE + '/files')}
    (OUT / 'baseline.json').write_text(json.dumps(baseline, indent=2))
    for route in ['/products/' + slug + '/index.html' for slug in SLUGS] + ['/sitemap.xml', '/tools/index.html', '/momentium.js']:
        with urllib.request.urlopen(deploy['deploy_ssl_url'] + route, timeout=60) as response:
            source = response.read().decode()
        destination = OUT / 'base' / route.lstrip('/')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(source)
        if route.endswith('.html') and route.startswith('/products/'):
            doc = D(source)
            main = doc.find('main')[0]
            print(json.dumps({'route': route, 'copy': doc.text(main)[:6500]}))
    print(json.dumps({'captured': deploy['id'], 'files': len(baseline['files'])}))


ICONS = {
    'next': '<path d="m9 18 6-6-6-6"/>',
    'previous': '<path d="m15 18-6-6 6-6"/>',
    'open': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
}


def icon(name):
    return '<svg class="lucide" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'


def build():
    baseline = json.loads((OUT / 'baseline.json').read_text())
    products = json.loads((ROOT / 'content/tool-product-pages.json').read_text())
    tools = {t['id']: t for t in json.loads((ROOT / 'content/creative-tools.json').read_text())}
    names = {p['slug']: p['name'] for p in products}
    names['glyph-studio'] = 'Glyph Studio'
    replacements = {}

    def stage(route, source):
        path = OUT / 'stage' / route.lstrip('/')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)
        replacements[route] = str(path)

    for product in products:
        slug, name = product['slug'], product['name']
        source = (OUT / 'base/products' / slug / 'index.html').read_text()
        tool = tools[product['asset']]
        url, family = tool['url'], product['family']
        e = escape
        image = '/assets/tool-products/' + product['asset'] + '.webp'
        lessons = product['lessons']
        feature_markup = ''.join('<div class="tp-feature"><span class="tp-number">' + str(i + 1).zfill(2) + '</span><h3>' + e(title) + '</h3><p>' + e(text) + '</p></div>' for i, (title, text) in enumerate(product['features']))
        lesson_markup = ''.join('<article data-tp-lesson' + ('' if i == 0 else ' hidden') + ' aria-labelledby="lesson-' + str(i) + '"><h3 id="lesson-' + str(i) + '">' + e(lesson['title']) + '</h3><p>' + e(lesson['brief']) + '</p><ol>' + ''.join('<li>' + e(step) + '</li>' for step in lesson['steps']) + '</ol></article>' for i, lesson in enumerate(lessons))
        options = ''.join('<option value="' + str(i) + '">' + e(lesson['title']) + '</option>' for i, lesson in enumerate(lessons))
        exports = ''.join('<div><dt>' + e(title) + '</dt><dd>' + e(text) + '</dd></div>' for title, text in product['exports'])
        related = ''.join('<a href="/products/' + related_slug + '/"><span>' + e(names[related_slug]) + '</span>' + icon('next') + '</a>' for related_slug in product['related'])
        example_note = {
            'autocut': 'Actual AutoCut workspace with existing demo media; not evidence of broad real-footage qualification.',
            'captions': 'Actual Captions workspace with an imported example subtitle file, not an automatic transcription result.',
            'press': 'Actual Press workspace. Night Current is a fictional artist used for this example.',
            'split': 'Actual Split workspace before importing a song. Separation output is not shown; performance varies by device.',
            'mockup': 'Actual PNG exported from Luma Mockups. Stylized procedural scene, not a photograph.',
        }.get(slug, 'Actual ' + name + ' workspace, captured in the public web app. Example project.')
        entry = '<p class="tp-entry">' + e(product['entry']) + '</p>' if product.get('entry') else ''
        faq_extra = '<details><summary>How is this different from Glyph Studio?</summary><p>Glyph is the simpler font maker inside Luma. <a href="/products/glyph-studio/">Standalone Glyph Studio</a> adds curve fitting and kerning; kerning exports to TTF only.</p></details>' if slug == 'glyph' else ''
        main = f'''<main id="main" data-tp-product="{slug}" style="--tp-tone:{product['tone']}">
<nav class="tp-subnav" aria-label="On this product page"><a href="/tools/">All tools</a><div><a href="#make">Make something</a><a href="#exports">Exports</a><a href="#limits">Alpha notes</a></div></nav>
<section class="tp-hero" id="top" aria-labelledby="product-title"><div class="tp-hero-copy"><p class="tp-eyebrow"><a href="/products/{product['parent']}/">{e(family)}</a><span>Public web alpha</span></p><h1 id="product-title">{e(name)}</h1><p class="tp-promise">{e(product['promise'])}</p><p class="tp-intro">{e(product['intro'])}</p><div class="tp-actions"><a class="tp-primary" href="{e(url)}" target="_blank" rel="noopener">Open {e(name)} {icon('open')}</a><a class="tp-secondary" href="#make">Choose a first project</a></div>{entry}</div><figure class="tp-workspace"><button type="button" data-tp-preview aria-label="Enlarge {e(name)} preview" title="Enlarge preview"><img src="{image}" width="1440" height="960" alt="{e(example_note)}" fetchpriority="high" decoding="async"></button><figcaption>{e(example_note)}</figcaption></figure></section>
<section class="tp-band" id="what-it-does" aria-labelledby="features-title"><div class="tp-inner"><p class="tp-eyebrow">FROM IDEA TO OUTPUT</p><h2 id="features-title">Make it your own.</h2><div class="tp-features">{feature_markup}</div></div></section>
<section class="tp-band tp-making" id="make" aria-labelledby="make-title"><span id="how-it-works"></span><div class="tp-inner"><p class="tp-eyebrow">A GOOD PLACE TO BEGIN</p><h2 id="make-title">One tool. Three starting points.</h2><div class="tp-lesson" data-tp-player><div class="tp-lesson-toolbar" data-tp-controls hidden><label for="project-picker">Project</label><select id="project-picker" data-tp-picker>{options}</select><div class="tp-cycle"><button type="button" data-tp-previous aria-label="Previous project" title="Previous project">{icon('previous')}</button><span data-tp-count role="status" aria-live="polite">1 / {len(lessons)}</span><button type="button" data-tp-next aria-label="Next project" title="Next project">{icon('next')}</button></div></div><div class="tp-lesson-content">{lesson_markup}</div><div class="tp-lesson-footer"><a class="tp-primary" href="{e(url)}" target="_blank" rel="noopener">Make it in {e(name)} {icon('open')}</a>{entry}</div></div></div></section>
<section class="tp-band" id="exports" aria-labelledby="exports-title"><div class="tp-inner tp-export-layout"><div><p class="tp-eyebrow">YOUR WORK, TO KEEP</p><h2 id="exports-title">Take the result with you.</h2><p>{e(product['save'])}</p></div><dl class="tp-exports">{exports}</dl></div></section>
<section class="tp-band tp-notes" id="limits" aria-labelledby="limits-title"><div class="tp-inner tp-note-layout"><div><p class="tp-eyebrow">BUILDING IN PUBLIC</p><h2 id="limits-title">An alpha. An invitation.</h2><p>Try it, make something, and tell us what needs to work better.</p><a class="tp-feedback" href="/testing/?product={slug}#feedback">Send {e(name)} feedback {icon('open')}</a></div><div class="tp-questions"><details open><summary>What should I know before starting?</summary><p>{e(product['limits'])}</p></details><details><summary>How do I keep my work?</summary><p>{e(product['save'])}</p></details><details><summary>Can I download a native app?</summary><p>This page opens the public web alpha. There are no public native downloads yet. <a href="/downloads/">Check current availability.</a></p></details>{faq_extra}</div></div></section>
<section class="tp-band tp-related" aria-labelledby="related-title"><span id="pr-next-title"></span><div class="tp-inner"><p class="tp-eyebrow">KEEP THE IDEA MOVING</p><h2 id="related-title">A next step, when you need it.</h2><nav aria-label="Related creative tools">{related}</nav><a class="tp-family-link" href="/products/{product['parent']}/">Explore {'StemDeck and Sattari' if product['parent'] == 'stemdeck' else e(family)} {icon('open')}</a></div></section>
<dialog class="tp-preview-dialog" data-tp-preview-dialog aria-label="{e(name)} preview"><form method="dialog"><button type="submit" aria-label="Close preview" title="Close preview"><svg class="lucide lucide-x" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button></form><img src="{image}" width="1440" height="960" alt="{e(example_note)}" loading="lazy"><p>{e(example_note)}</p></dialog>
</main>'''
        doc = D(source)
        source = edits(source, [(doc.find('main')[0]['start'], doc.find('main')[0]['end'], main)])
        doc = D(source)
        changes = []
        title = name + ' | ' + product['promise'] + ' | thecreateco'
        for node in doc.find('title'):
            changes.append((node['start'], node['end'], '<title>' + e(title) + '</title>'))
        for node in doc.find('link', rel='canonical'):
            node['attrs']['href'] = ORIGIN + '/products/' + slug + '/'
            changes.append((node['start'], node['open_end'], opening(node)))
        for node in doc.find('meta'):
            key = node['attrs'].get('name') or node['attrs'].get('property')
            if key in ['description', 'og:description', 'twitter:description']:
                node['attrs']['content'] = product['intro']
            elif key in ['og:title', 'twitter:title']:
                node['attrs']['content'] = title
            elif key in ['og:image', 'twitter:image']:
                node['attrs']['content'] = ORIGIN + '/assets/tool-products/' + product['asset'] + '-share.jpg'
            elif key == 'og:image:alt':
                node['attrs']['content'] = example_note
            else:
                continue
            changes.append((node['start'], node['open_end'], opening(node)))
        body = doc.find('body')[0]
        body['attrs']['class'] = 'momentium-shell tp-page'
        body['attrs'].pop('style', None)
        changes.append((body['start'], body['open_end'], opening(body)))
        schema = {'@context': 'https://schema.org', '@type': 'WebPage', 'name': name, 'description': product['intro'], 'url': ORIGIN + '/products/' + slug + '/', 'image': ORIGIN + image, 'isPartOf': {'@type': 'WebSite', 'name': 'thecreateco', 'url': ORIGIN}, 'about': {'@type': 'SoftwareApplication', 'name': name, 'url': url, 'operatingSystem': 'Web browser', 'applicationCategory': 'MultimediaApplication', 'softwareVersion': 'Public web alpha'}}
        for node in doc.find('script', type='application/ld+json'):
            changes.append((node['start'], node['end'], ''))
        changes.append((doc.find('head')[0]['close_start'], doc.find('head')[0]['close_start'], '<link rel="stylesheet" href="/tool-products.css"><script src="/tool-products.js" defer></script><script type="application/ld+json">' + json.dumps(schema).replace('<', '\\u003c') + '</script>'))
        stage('/products/' + slug + '/index.html', edits(source, changes))

    for asset in ['tool-products.css', 'tool-products.js']:
        replacements['/' + asset] = str(ROOT / 'content' / asset)
    for product in products:
        for suffix in ['.webp', '-share.jpg']:
            route = '/assets/tool-products/' + product['asset'] + suffix
            file = OUT / 'stage' / route.lstrip('/')
            assert file.exists(), str(file)
            replacements[route] = str(file)
    xml = ET.fromstring((OUT / 'base/sitemap.xml').read_text())
    ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', ns)
    present = {n.text for n in xml.iter('{' + ns + '}loc')}
    for slug in SLUGS:
        url = ORIGIN + '/products/' + slug + '/'
        if url not in present:
            node = ET.SubElement(xml, '{' + ns + '}url')
            ET.SubElement(node, '{' + ns + '}loc').text = url
    stage('/sitemap.xml', ET.tostring(xml, encoding='unicode'))
    directory_source = (OUT / 'base/tools/index.html').read_text()
    doc = D(directory_source)
    changes = []
    for product in products:
        cards = [n for n in doc.find('article') if n['attrs'].get('data-ct-name') == tools[product['asset']]['name'] + ' ' + tools[product['asset']]['family']]
        assert len(cards) == 1, product['slug']
        card = cards[0]
        if '/products/' + product['slug'] + '/' not in directory_source[card['start']:card['end']]:
            content = next(n for n in doc.find('div', **{'class': 'ct-tool-content'}) if card['start'] < n['start'] < n['end'] < card['end'])
            changes.append((content['close_start'], content['close_start'], '<a class="ct-product-details" href="/products/' + product['slug'] + '/">Learn more about ' + escape(product['name']) + '</a>'))
    changes.append((doc.find('head')[0]['close_start'], doc.find('head')[0]['close_start'], '<link rel="stylesheet" href="/tool-products.css">'))
    stage('/tools/index.html', edits(directory_source, changes))
    launch = (OUT / 'base/momentium.js').read_text()
    old = "function filter(){const query=input.value.trim().toLocaleLowerCase();let count=0;items.forEach(item=>{item.hidden=!item.dataset.mmSearch.includes(query);"
    new = "const normalizeSearch=value=>value.toLocaleLowerCase().replace(/&/g,' ').replace(/\\s+/g,' ').trim();\n    function filter(){const query=normalizeSearch(input.value);let count=0;items.forEach(item=>{item.hidden=!normalizeSearch(item.dataset.mmSearch).includes(query);"
    assert old in launch, 'Quick Launch changed; review before updating search'
    launch = launch.replace(old, new).replace("'8 apps \\u00b7 Public web editions'", "`${items.length} apps and tools \\u00b7 Public web editions`")
    launch = launch.replace("'8 apps · Public web editions'", "`${items.length} apps and tools · Public web editions`")
    stage('/momentium.js', launch)
    plan = {'site_id': SITE, 'expected_previous': baseline['deploy'], 'title': 'Twelve focused product pages: actual workspaces, guided projects, exports and honest alpha notes', 'replace': replacements}
    (OUT / 'plan.json').write_text(json.dumps(plan, indent=2))
    print(json.dumps({'pages': len(products), 'changed_files': len(replacements), 'baseline': baseline['deploy']}))


if __name__ == '__main__':
    if '--capture' in sys.argv:
        capture()
    else:
        build()
