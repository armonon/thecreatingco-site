#!/usr/bin/env python3
"""Build a screened, non-deploy company snapshot in this branch.

This deliberately does not sweep the home directory or publish the website.
Run from the company/operations worktree, review the manifest, then commit and
push the exact head with git-handoff/push_branch.py.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

HOME = pathlib.Path("/Users/agentsattari")
DEST = pathlib.Path(__file__).resolve().parent / "snapshot"
MAX_BYTES = 1_000_000
TEXT_SUFFIXES = {".md", ".json", ".py", ".txt", ".sh"}
REPORT_EXCLUDE_PARTS = {"site-packages", "node_modules", "venv", ".venv", "browser-profile", "recovery-profile"}
SENSITIVE = [
    re.compile(rb"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    re.compile(rb"(?:ghp_|github_pat_|sk-|xox[baprs]-)[A-Za-z0-9_-]{20,}"),
    re.compile(rb"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
    re.compile(rb"(?i)(?:verification|one.time|otp|2fa|login)\s+(?:code|pin)\s*[:=]?\s*\d{6,8}"),
]


def git(path: pathlib.Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(path), *args], text=True, capture_output=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else ""


def candidates() -> list[pathlib.Path]:
    files: list[pathlib.Path] = []
    company = HOME / "thecreateco-company"
    marketing = HOME / "thecreateco-marketing"
    for file in company.iterdir():
        if file.is_file() and file.suffix in {".md", ".json"}:
            files.append(file)
    for name in ("BRAND.md", "CATALOG.md", "COMMUNITY_RULES.md", "DIRECTIVE.md", "PRODUCTS.md", "STATE.md"):
        files.append(marketing / name)
    for root in (company / "engine", marketing / "engine" / "mktg", marketing / "engine" / "tests"):
        files.extend(f for f in root.rglob("*") if f.is_file() and f.suffix in {".py", ".md"})
    files.extend((marketing / "engine" / "bin" / name) for name in ("mktg", "scheduled-tick"))
    files.extend((marketing / "engine" / "config" / "routing.json", marketing / "engine" / "README.md"))
    lab = company / "core-product-lab"
    release = company / "release-program"
    for root in (lab, lab / "products", lab / "golden-projects", release):
        files.extend(f for f in root.iterdir() if f.is_file() and f.suffix in TEXT_SUFFIXES)
    handoff = HOME / "git-handoff"
    files.extend(f for f in handoff.iterdir() if f.is_file() and f.suffix in {".md", ".py"})
    for root in (company / "reports", lab / "reports", release / "reports"):
        files.extend(f for f in root.rglob("*.md") if not REPORT_EXCLUDE_PARTS.intersection(f.parts))
    return sorted(set(files))


def product_refs() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for marker in sorted((HOME / "code").glob("**/.git")):
        repo = marker.parent
        rel = repo.relative_to(HOME / "code")
        if rel.parts[0] not in {"wave2", "wave3", "wave4", "wave5", "sattari", "sattari-plugins-suite", "glyph-studio", "core-product-lab", "company-worktrees", "weblab"}:
            continue
        if any(part in {"node_modules", ".venv", "site-packages"} for part in repo.parts):
            continue
        remote = git(repo, "remote", "get-url", "origin")
        if not remote.startswith("https://github.com/armonon/"):
            continue
        sha = git(repo, "rev-parse", "HEAD")
        branch = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD")
        if remote.removesuffix(".git") == "https://github.com/armonon/thecreatingco-site" and branch == "company/operations":
            continue  # Avoid a self-reference that would create an hourly commit loop.
        if sha and branch:
            out.append({"repo": remote.removesuffix(".git"), "branch": branch, "sha": sha})
    return sorted({(x["repo"], x["branch"], x["sha"]): x for x in out}.values(), key=lambda x: (x["repo"], x["branch"], x["sha"]))


def main() -> int:
    if git(DEST.parent, "symbolic-ref", "--short", "HEAD") != "company/operations":
        print("Refusing to snapshot outside company/operations", file=sys.stderr)
        return 2
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    dirty_tracked = {
        line[3:]
        for line in git(HOME, "status", "--porcelain=v1", "-uno").splitlines()
        if len(line) > 3
    }
    copied: list[dict[str, object]] = []
    skipped: list[dict[str, str]] = []
    for source in candidates():
        rel = source.relative_to(HOME)
        if str(rel) in dirty_tracked:
            skipped.append({"path": str(rel), "reason": "dirty-tracked-source"})
            continue
        if not source.is_file() or source.is_symlink():
            skipped.append({"path": str(rel), "reason": "missing-or-symlink"})
            continue
        if source.stat().st_size > MAX_BYTES:
            skipped.append({"path": str(rel), "reason": "over-size-limit"})
            continue
        data = source.read_bytes()
        if b"\x00" in data or any(pattern.search(data) for pattern in SENSITIVE):
            skipped.append({"path": str(rel), "reason": "sensitive-or-binary"})
            continue
        target = DEST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        copied.append({"path": str(rel), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {
        "scope": "Screened company source and text evidence; not live databases, contacts, secrets, binary QA artifacts or full product source",
        "files": copied,
        "skipped": skipped,
        "product_git_refs": product_refs(),
    }
    (DEST / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"copied": len(copied), "skipped": len(skipped), "product_refs": len(manifest["product_git_refs"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
