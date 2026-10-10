#!/usr/bin/env python3
"""Safely refresh and push the exact company/operations snapshot head."""

from __future__ import annotations

import fcntl
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
HANDOFF = pathlib.Path("/Users/agentsattari/git-handoff/push_branch.py")
LOCK = pathlib.Path("/Users/agentsattari/.local/state/thecreateco-ops-sync.lock")


def run(*args: str, capture: bool = False) -> str:
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=True, timeout=600)
    return result.stdout.strip() if capture else ""


def main() -> int:
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w") as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Ops sync already running")
            return 0
        if run("git", "branch", "--show-current", capture=True) != "company/operations":
            raise RuntimeError("Wrong branch; refusing snapshot")
        if run("git", "status", "--porcelain=v1", capture=True):
            raise RuntimeError("Operations worktree dirty; review it before automated sync")
        run('git', 'fetch', '--quiet', 'origin', 'refs/heads/company/operations:refs/remotes/origin/company/operations')
        remote = run('git', 'rev-parse', 'refs/remotes/origin/company/operations', capture=True)
        current = run('git', 'rev-parse', 'HEAD', capture=True)
        if remote != current:
            ahead = subprocess.run(['git','merge-base','--is-ancestor',remote,current],cwd=ROOT).returncode == 0
            behind = subprocess.run(['git','merge-base','--is-ancestor',current,remote],cwd=ROOT).returncode == 0
            if behind:
                run('git','merge','--ff-only','refs/remotes/origin/company/operations')
            elif not ahead:
                raise RuntimeError('Operations branch diverged; retain local commits and reconcile, never force')
        run(sys.executable, str(ROOT / "sync_snapshot.py"))
        run("git", "add", "--", "snapshot")
        if run("git", "diff", "--cached", "--name-only", capture=True):
            run("git", "commit", "-m", "Refresh screened company operations snapshot")
        else:
            print("Operations snapshot unchanged; checking remote head")
        sha = run("git", "rev-parse", "HEAD", capture=True)
        result = subprocess.run(
            [sys.executable, str(HANDOFF), str(ROOT), "--expect-sha", sha, '--no-company-mirror'],
            cwd=ROOT, text=True, check=True, timeout=120,
        )
        return result.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f"OPS_SYNC_BLOCKED: {error}", file=sys.stderr)
        raise SystemExit(1)
