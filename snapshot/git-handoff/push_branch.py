#!/usr/bin/env python3
"""Push one verified agent branch and record the exact remote head.

This is a per-task handoff, not a repository sweeper. It never stages, commits,
force-pushes, merges, or pushes protected branches.
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import subprocess
import sys

RECEIPTS = pathlib.Path(__file__).resolve().parent / "receipts.jsonl"
PROTECTED = {"main", "master", "develop", "development", "production", "stable"}
COMPANY_CONFIG = pathlib.Path(__file__).with_name('company_destination.json')


def mirror_company(origin: str, branch: str) -> dict | None:
    """After a company source push, also hand off its screened committed delta."""
    if branch == 'company/operations' or not COMPANY_CONFIG.is_file():
        return None
    config = json.loads(COMPANY_CONFIG.read_text())
    remote = origin.removesuffix('.git')
    if remote.startswith('git@github.com:'):
        remote = 'https://github.com/' + remote.split(':', 1)[1]
    scopes = set(config.get('additional_company_repos', []))
    registry = pathlib.Path(config['product_registry'])
    if registry.is_file():
        scopes.update(p['repo'].removesuffix('.git') for p in json.loads(registry.read_text())['products'] if isinstance(p.get('repo'), str))
    if remote not in scopes:
        return None
    try:
        done = subprocess.run([sys.executable, config['publisher']], capture_output=True, text=True, timeout=600)
        if done.returncode:
            return {'status': 'blocked', 'destination': config['destination'], 'reason': 'operations publisher failed; source branch remains pushed', 'exit_code': done.returncode}
        for line in reversed(done.stdout.splitlines()):
            try: result = json.loads(line)
            except json.JSONDecodeError: continue
            if result.get('branch') == 'company/operations' and result.get('sha'):
                return {'status': result['result'], 'destination': config['destination'], 'sha': result['sha']}
        return {'status': 'blocked', 'destination': config['destination'], 'reason': 'publisher returned no verified operations SHA'}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'status': 'blocked', 'destination': config['destination'], 'reason': type(error).__name__}


def git(repo: pathlib.Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError(f"git {' '.join(args[:2])} failed: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout.strip()


def remote_head(repo: pathlib.Path, branch: str) -> str | None:
    line = git(repo, "ls-remote", "--heads", "origin", f"refs/heads/{branch}")
    return line.split("\t", 1)[0] if line else None


def handoff(repo: pathlib.Path, expected: str | None = None, receipt_path: pathlib.Path = RECEIPTS, company_mirror: bool = True) -> dict:
    repo = repo.resolve()
    if not (repo / ".git").exists():
        raise RuntimeError("Not a Git checkout or worktree")
    branch = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD")
    if branch in PROTECTED or branch.startswith(("release/", "production/", "hotfix/main/")):
        raise RuntimeError(f"Protected branch {branch}; use a review branch")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", branch) or ".." in branch or "//" in branch:
        raise RuntimeError("Unsafe branch name")
    if git(repo, "status", "--porcelain=v1", "-uno"):
        raise RuntimeError("Tracked files are dirty; finish and verify this task first")
    sha = git(repo, "rev-parse", "HEAD")
    if expected and sha != expected:
        raise RuntimeError(f"HEAD changed: expected {expected}, found {sha}")
    origin = git(repo, "remote", "get-url", "origin")
    if not origin:
        raise RuntimeError("No origin remote")
    before = remote_head(repo, branch)
    if before != sha:
        if git(repo, "rev-parse", "HEAD") != sha:
            raise RuntimeError("HEAD changed before push")
        git(repo, "push", "--porcelain", "-u", "origin", f"HEAD:refs/heads/{branch}")
    after = remote_head(repo, branch)
    if after != sha:
        raise RuntimeError(f"Remote head differs after push: {after or 'missing'}")
    receipt = {
        "at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "repo": str(repo), "branch": branch, "sha": sha,
        "result": "pushed" if before != sha else "already-current",
    }
    if company_mirror:
        try:
            mirrored = mirror_company(origin, branch)
        except (OSError, ValueError, KeyError) as error:
            mirrored = {'status':'blocked','reason':'source branch pushed; company mirror configuration invalid','error':type(error).__name__}
        if mirrored is not None:
            receipt['company_operations'] = mirrored
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    with receipt_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(receipt, sort_keys=True) + "\n")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=pathlib.Path, help="Agent-owned checkout/worktree")
    parser.add_argument("--expect-sha", help="Exact tested commit SHA; abort if HEAD moved")
    parser.add_argument('--no-company-mirror', action='store_true', help='Internal operations publisher recursion guard')
    args = parser.parse_args()
    try:
        receipt = handoff(args.repo, args.expect_sha, company_mirror=not args.no_company_mirror)
        print(json.dumps(receipt, sort_keys=True))
        return 1 if receipt.get('company_operations', {}).get('status') == 'blocked' else 0
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"PUSH_BLOCKED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
