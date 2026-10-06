"""Restore the tools directory without undoing the newer Wave 2 homepage."""
from pathlib import Path
import json
import runpy
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/wave2-reconciliation-20261006'
ORIGINAL = ROOT / 'reports/creative-tools-20261006'
helpers = runpy.run_path(str(ROOT / 'scripts/site-release-hardening.py'))
directory = runpy.run_path(str(ROOT / 'scripts/prepare-creative-tools.py'))
Document, edits = helpers['Document'], helpers['edits']
TOOLS = json.loads((ROOT / 'content/creative-tools.json').read_text())
GLYPH = {'id': 'glyph-studio', 'name': 'Glyph Studio', 'family': 'Independent app / Luma family', 'product': 'glyph-studio',
         'category': 'Image', 'description': 'Draw your own font, fit curves and adjust kerning. Kerning exports to TTF only.',
         'url': 'https://glyph-studio-610.netlify.app/', 'mode': 'Standalone web app'}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    config = json.loads(Path('/Users/lillypad/Library/Preferences/netlify/config.json').read_text())
    auth = config['users'][config['userId']]['auth']
    token = auth.get('token') if isinstance(auth, dict) else auth

    def api(route):
        req = urllib.request.Request('https://api.netlify.com/api/v1' + route, headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)

    site = '59ccf268-f99f-43ba-89b6-1117fa561e93'
    deploy = api('/sites/' + site)['published_deploy']
    baseline = {'deploy': deploy['id'], 'url': deploy['deploy_ssl_url'], 'files': api('/sites/' + site + '/files')}
    (OUT / 'baseline.json').write_text(json.dumps(baseline, indent=2))
    replacements = {}

    def live(route):
        with urllib.request.urlopen(deploy['deploy_ssl_url'] + route, timeout=60) as response:
            source = response.read().decode()
        path = OUT / 'base' / route.lstrip('/')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)
        return source

    def stage(route, source):
        path = OUT / 'stage' / route.lstrip('/')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)
        replacements[route] = str(path)

    home = live('/index.html')
    doc = Document(home)
    assert not doc.find(id='focused-tools'), 'Review the current tools section before replacing it'
    signup = doc.find(id='join-launch')
    assert len(signup) == 1
    discovery = '''<section class="ct-section" id="focused-tools" aria-labelledby="focused-tools-title"><div class="ct-heading"><div><p class="ct-kicker">FILM / SOUND / LETTERING / DESIGN</p><h2 id="focused-tools-title">Find your next tool.</h2><p>Explore the new ScenePilot tools, Sattari Labs, Luma workspaces and standalone Glyph Studio. Cast remains a preview.</p></div><a class="ct-directory-link" href="/tools/">Explore the tools <span aria-hidden="true">&#8599;</span></a></div></section>'''
    source = edits(home, [(signup[0]['start'], signup[0]['start'], discovery)])
    stage('/index.html', directory['navigation'](directory['add_css'](source)))

    previous = (ORIGINAL / 'stage/tools/index.html').read_text()
    previous_doc = Document(previous)
    main_markup = previous[previous_doc.find('main')[0]['start']:previous_doc.find('main')[0]['end']]
    main_markup = main_markup.replace('Ten standalone tools. Three workspaces inside our studios. Make an edit, find a groove or try something new.',
        'ScenePilot, Sattari Labs and Luma tools, Form Cast in preview, plus standalone Glyph Studio.')
    parsed = Document(main_markup)
    listing = [node for node in parsed.find('div') if 'data-ct-list' in node['attrs']]
    assert len(listing) == 1
    glyph_card = directory['card'](GLYPH).replace('data-ct-tool ', 'data-ct-tool data-ct-family="glyph-studio" ')
    main_markup = edits(main_markup, [(listing[0]['open_end'], listing[0]['open_end'], glyph_card)])
    main_markup = main_markup.replace('<option value="stemdeck">Sattari / StemDeck</option>', '<option value="stemdeck">Sattari Labs</option>')
    main_markup = main_markup.replace('<option value="form">Form Studio</option>', '<option value="form">Form Studio</option><option value="glyph-studio">Glyph Studio</option>')
    main_markup = main_markup.replace('data-ct-count>13 tools</p>', 'data-ct-count data-ct-count-unit="entry">14 entries</p>')
    parsed = Document(main_markup)
    for node in parsed.find('article', **{'data-ct-name': 'Cast Form Studio'}):
        fragment = main_markup[node['start']:node['end']].replace('<span>Alpha</span>', '<span>Preview</span>')
        main_markup = edits(main_markup, [(node['start'], node['end'], fragment)])
    doc = Document(home)
    source = edits(home, [(doc.find('main')[0]['start'], doc.find('main')[0]['end'], main_markup)])
    doc = Document(source)
    changes = [(doc.find('title')[0]['start'], doc.find('title')[0]['end'], '<title>Focused creative tools | thecreateco</title>')]
    for node in doc.find('meta'):
        key = node['attrs'].get('name') or node['attrs'].get('property')
        if key in ('description', 'og:description', 'twitter:description'):
            node['attrs']['content'] = 'Explore ScenePilot tools, Sattari Labs, Luma Mockups and Glyph, Form Cast in preview, and standalone Glyph Studio.'
        elif key in ('og:title', 'twitter:title'):
            node['attrs']['content'] = 'Focused creative tools | thecreateco'
        elif key == 'og:url':
            node['attrs']['content'] = 'https://thecreatingco.com/tools/'
        else:
            continue
        changes.append((node['start'], node['open_end'], helpers['opening'](node)))
    for node in doc.find('link', rel='canonical'):
        node['attrs']['href'] = 'https://thecreatingco.com/tools/'
        changes.append((node['start'], node['open_end'], helpers['opening'](node)))
    schema = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Focused creative tools', 'url': 'https://thecreatingco.com/tools/',
              'mainEntity': {'@type': 'ItemList', 'numberOfItems': 14, 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': t['name'], 'url': t['url']} for i, t in enumerate([GLYPH] + TOOLS)]}}
    for node in doc.find('script', type='application/ld+json'):
        changes.append((node['start'], node['end'], '<script type="application/ld+json">' + json.dumps(schema) + '</script>'))
    source = edits(source, changes)
    doc = Document(source)
    body = doc.find('body')[0]
    body['attrs']['class'] = 'momentium-shell ct-tools-page'
    body['attrs'].pop('data-review-home', None)
    source = edits(source, [(body['start'], body['open_end'], helpers['opening'](body)), (body['close_start'], body['close_start'], '<script src="/creative-tools.js" defer></script>')])
    stage('/tools/index.html', directory['navigation'](directory['add_css'](source)))

    xml = live('/sitemap.xml')
    tree = ET.fromstring(xml)
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    if not any(node.text == 'https://thecreatingco.com/tools/' for node in tree.iter('{' + namespace + '}loc')):
        node = ET.SubElement(tree, '{' + namespace + '}url')
        ET.SubElement(node, '{' + namespace + '}loc').text = 'https://thecreatingco.com/tools/'
    stage('/sitemap.xml', ET.tostring(tree, encoding='unicode'))
    for asset in ('creative-tools.css', 'creative-tools.js'):
        replacements['/' + asset] = str(ROOT / 'content' / asset)
    for tool in TOOLS:
        image = ORIGINAL / 'assets' / (tool['id'] + '.webp')
        assert image.exists()
        replacements['/assets/creative-tools/' + image.name] = str(image)
    replacements['/assets/creative-tools/glyph-studio.webp'] = str(OUT / 'glyph-studio.webp')
    replacements['/assets/share/autocut.jpg'] = str(OUT / 'autocut.jpg')
    for local in replacements.values():
        assert Path(local).exists(), local
    plan = {'site_id': site, 'expected_previous': deploy['id'], 'title': 'Restore tools directory beside Wave 2, disclose Cast preview and repair AutoCut share image', 'replace': replacements}
    (OUT / 'plan.json').write_text(json.dumps(plan, indent=2))
    print(json.dumps({'baseline': deploy['id'], 'changed_files': len(replacements), 'retained_wave2': True}))


if __name__ == '__main__':
    main()
