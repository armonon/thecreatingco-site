"""Add the native audio overview to the current Tools availability table.

Pass a fresh Netlify baseline JSON, its immutable /tools/index.html capture,
and an output directory. This changes one table and its introductory sentence;
the deploy helper must retain all other file/function digests and compare the
published deploy ID before promoting the reviewed draft.
"""
from pathlib import Path
import hashlib
import json
import sys

ROW = '<tr><th scope="row">Sattari audio suite</th><td>In development · no public installer</td><td><a href="https://sattari-audio-suite.netlify.app/">Explore native audio ↗</a></td></tr>'

def main():
    baseline = json.loads(Path(sys.argv[1]).read_text())
    capture = Path(sys.argv[2]).read_bytes()
    expected = next(f['sha'] for f in baseline['files'] if f['path'] == '/tools/index.html')
    if hashlib.sha1(capture).hexdigest() != expected:
        raise SystemExit('Tools capture does not match the immutable baseline')
    text = capture.decode()
    marker = '<details class="native-availability">'
    if text.count(marker) != 1 or 'https://sattari-audio-suite.netlify.app/' in text:
        raise SystemExit('Unexpected or already-integrated native directory')
    start = text.index(marker)
    end = text.index('</details>', start) + len('</details>')
    original = text[start:end]
    old = 'No public Mac installer is available for these editions. You can use their web editions today.'
    if old not in original or original.count('</tbody>') != 1:
        raise SystemExit('Availability table changed; re-review the current layout')
    new = original.replace(old, 'Public Mac installers are not available for these editions. Open an available web edition or explore the native audio suite.').replace('</tbody>', ROW + '</tbody>')
    root = Path(sys.argv[3]).resolve()
    root.mkdir(parents=True, exist_ok=True)
    page = root / 'tools.html'
    page.write_text(text[:start] + new + text[end:])
    plan = {'site_id': baseline['site_id'], 'expected_previous': baseline['deploy']['id'],
            'title': 'Connect Sattari native audio overview to the company Tools directory',
            'replace': {'/tools/index.html': str(page)}, 'functions': {},
            'preserve_function_config': True,
            'function_schedules': baseline['deploy'].get('function_schedules') or [],
            'publish_blockers': []}
    (root / 'plan.json').write_text(json.dumps(plan, indent=2))
    (root / 'changes.json').write_text(json.dumps({'path': '/tools/index.html',
        'baseline_sha1': expected, 'updated_sha1': hashlib.sha1(page.read_bytes()).hexdigest(),
        'scope': 'One native availability row and its introductory sentence; outside bytes unchanged'}, indent=2))
    print('Prepared one current Tools availability table update.')

if __name__ == '__main__':
    main()
