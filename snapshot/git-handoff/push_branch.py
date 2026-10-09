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


def git(repo: pathlib.Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError(f"git {' '.join(args[:2])} failed: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout.strip()


def remote_head(repo: pathlib.Path, branch: str) -> str | None:
    line = git(repo, "ls-remote", "--heads", "origin", f"refs/heads/{branch}")
    return line.split("\t", 1)[0] if line else None


def handoff(repo: pathlib.Path, expected: str | None = None, receipt_path: pathlib.Path = RECEIPTS) -> dict:
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
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    with receipt_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(receipt, sort_keys=True) + "\n")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=pathlib.Path, help="Agent-owned checkout/worktree")
    parser.add_argument("--expect-sha", help="Exact tested commit SHA; abort if HEAD moved")
    args = parser.parse_args()
    try:
        print(json.dumps(handoff(args.repo, args.expect_sha), sort_keys=True))
        return 0
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"PUSH_BLOCKED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
