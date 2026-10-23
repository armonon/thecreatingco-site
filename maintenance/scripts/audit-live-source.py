#!/usr/bin/python3
"""Compare tracked website files with the verified published Netlify manifest.

Requires authenticated Netlify CLI. Uses GET operations only. Never deploys,
downloads CDN source, modifies repository files, or prints authentication tokens.
Exits 0 for matching live hashes, 2 for drift, and 1 for an incomplete audit.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

SITE = '59ccf268-f99f-43ba-89b6-1117fa561e93'
ROOT = pathlib.Path(__file__).resolve().parents[2]


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=120)
    if result.returncode:
        # Third-party diagnostics may contain credential-bearing URLs.
        raise RuntimeError('{} failed (exit {})'.format(args[0], result.returncode))
    return result.stdout


def api(operation, parameters):
    if operation not in {'getSite', 'getDeploy', 'listSiteFiles'}:
        raise ValueError('Unsupported API operation')
    return json.loads(run(['netlify', 'api', operation, '--data', json.dumps(parameters)]))


def audit():
    site = api('getSite', {'site_id': SITE})
    if site.get('id') != SITE or site.get('name') != 'momentium-creative':
        raise RuntimeError('Production site identity mismatch')
    deploy_id = (site.get('published_deploy') or {}).get('id')
    if not deploy_id:
        raise RuntimeError('Published deploy ID is unavailable')
    deploy = api('getDeploy', {'deploy_id': deploy_id})
    manifest = api('listSiteFiles', {'site_id': SITE})
    current = api('getSite', {'site_id': SITE})
    if (current.get('published_deploy') or {}).get('id') != deploy_id:
        raise RuntimeError('Production changed during audit; rerun against the new deployment')
    if not isinstance(manifest, list) or not manifest:
        raise RuntimeError('Production file manifest is empty or invalid')
    if any(entry.get('deploy_id') != deploy_id for entry in manifest):
        raise RuntimeError('Manifest contains files from an unexpected deployment')
    live = {entry['path'].lstrip('/'): entry for entry in manifest}
    result = {'matching': [], 'different': [], 'live_only': [], 'repository_only': []}
    tracked = run(['git', '-C', str(ROOT), 'ls-files', '-z']).split('\0')
    for name in filter(None, tracked):
        entry = live.pop(name, None)
        if entry is None:
            result['repository_only'].append(name)
            continue
        path = ROOT / name
        digest = (hashlib.sha1(path.read_bytes()).hexdigest()
                  if path.is_file() and not path.is_symlink() else None)
        result['matching' if digest == entry['sha'] else 'different'].append(name)
    result['live_only'] = sorted(live)
    return {
        'site_id': SITE, 'site_name': site['name'], 'published_deploy': deploy_id,
        'published_at': deploy.get('published_at'),
        'immutable_deploy_url': deploy.get('deploy_ssl_url'),
        'git_head': run(['git', '-C', str(ROOT), 'rev-parse', 'HEAD']).strip(),
        'counts': {key: len(value) for key, value in result.items()},
        'files': result, 'manifest': manifest,
        'function_metadata': [{key: function.get(key) for key in ['n', 'd']}
                              for function in deploy.get('available_functions', [])],
        'not_a_deployment_qualification': True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True,
                        help='Destination for the detailed JSON report; prefer outside the repository')
    args = parser.parse_args()
    try:
        result = audit()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n')
        drift = bool(result['files']['different'] or result['files']['live_only'])
        print(json.dumps({'report': str(args.output.resolve()), 'counts': result['counts'],
                          'published_deploy': result['published_deploy'], 'drift': drift}, indent=2))
        return 2 if drift else 0
    except Exception as error:
        print(json.dumps({'audit_completed': False, 'error_type': type(error).__name__,
                          'error': str(error)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
