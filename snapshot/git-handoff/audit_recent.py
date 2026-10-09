#!/usr/bin/env python3
"""Read-only audit of recent Git worktree heads against current origin refs.

This does not stage, commit, push, fetch, or alter any checkout. A head may be
reachable on another verified remote branch even when its local branch name was
never published (for example, a detached QA base given a temporary branch).
"""

import argparse
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import subprocess

DEFAULT_ROOTS = [
    Path('/Users/agentsattari/code'),
    Path('/Users/agentsattari/Sattari'),
    Path('/Users/agentsattari/worktrees'),
]
PRUNE = {'.git', 'node_modules', '.next', 'dist', 'build', '.cache',
         '.venv', 'vendor', 'target', 'Library', 'DerivedData'}
PROTECTED = {'main', 'master', 'develop', 'development', 'production', 'stable'}


def git(repo: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(['git', '-C', str(repo), *args],
                                capture_output=True, text=True, timeout=25)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def discover(roots: list[Path], cutoff: int) -> list[dict]:
    found = []
    for root in roots:
        if not root.is_dir():
            continue
        for where, dirs, files in os.walk(root):
            if len(Path(where).relative_to(root).parts) > 4:
                dirs[:] = []
                continue
            if '.git' not in dirs and '.git' not in files:
                dirs[:] = [name for name in dirs if name not in PRUNE]
                continue
            dirs[:] = []
            repo = Path(where)
            stamp = git(repo, 'log', '-1', '--format=%ct')
            if not stamp or int(stamp) < cutoff:
                continue
            branch = git(repo, 'symbolic-ref', '--quiet', '--short', 'HEAD')
            if not branch or branch in PROTECTED:
                continue
            sha = git(repo, 'rev-parse', 'HEAD')
            origin = git(repo, 'remote', 'get-url', 'origin')
            if not sha or not origin:
                continue
            status = git(repo, 'status', '--porcelain=v1')
            found.append({'repo': str(repo), 'branch': branch, 'sha': sha,
                          'origin': origin, 'last_commit_unix': int(stamp),
                          'dirty_entries': len(status.splitlines()) if status else 0})
    return found


def remote_head(repo: Path, branch: str) -> tuple[str, str | None]:
    output = git(repo, 'ls-remote', '--heads', 'origin', f'refs/heads/{branch}')
    if output is None:
        return 'unknown', None
    return 'ok', output.split('\t', 1)[0] if output else None


def check(item: dict) -> dict:
    repo = Path(item['repo'])
    branch, sha = item['branch'], item['sha']
    state, remote = remote_head(repo, branch)
    if state == 'unknown':
        return {**item, 'status': 'unknown', 'remote_head': None}
    if remote == sha:
        return {**item, 'status': 'exact', 'remote_head': remote}
    refs = git(repo, 'branch', '-r', '--contains', 'HEAD') or ''
    for line in refs.splitlines():
        ref = line.strip()
        if not ref.startswith('origin/') or ' -> ' in ref:
            continue
        name = ref.removeprefix('origin/')
        cached = git(repo, 'rev-parse', ref)
        result, current = remote_head(repo, name)
        if result == 'ok' and cached and current == cached:
            return {**item, 'status': 'contained_elsewhere',
                    'remote_head': remote, 'containing_remote': ref}
    return {**item, 'status': 'unpublished', 'remote_head': remote}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--root', type=Path, action='append', dest='roots')
    args = parser.parse_args()
    if args.days < 1 or args.days > 90:
        parser.error('--days must be 1..90')
    cutoff = int((dt.datetime.now(dt.timezone.utc) -
                  dt.timedelta(days=args.days)).timestamp())
    items = discover(args.roots or DEFAULT_ROOTS, cutoff)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = sorted(pool.map(check, items), key=lambda item: item['repo'])
    counts = {status: sum(item['status'] == status for item in results)
              for status in ('exact', 'contained_elsewhere', 'unpublished', 'unknown')}
    print(json.dumps({'as_of': dt.datetime.now(dt.timezone.utc).isoformat(),
                      'days': args.days, 'counts': counts,
                      'dirty_checkouts': sum(item['dirty_entries'] > 0 for item in results),
                      'exceptions': [item for item in results
                                     if item['status'] in ('unpublished', 'unknown')]},
                     sort_keys=True))
    return 0 if counts['unpublished'] == counts['unknown'] == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
