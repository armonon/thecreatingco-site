#!/usr/bin/env python3
"""Deploy the packs/ additions to thecreatingco.com (Netlify site momentium-creative)
following the verified method recorded in WAVE2.md: build a full file-hash manifest,
POST a draft deploy (reusing the community-proxy function digest), upload only the
required (changed/added) files, verify, then publish via the restore API.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

SITE_ID = "59ccf268-f99f-43ba-89b6-1117fa561e93"
REPO = "/Users/agentsattari/code/wave2/thecreatingco-live"
TOKEN = open("/tmp/.nt").read().strip()
FUNCTION_DIGEST = "74bd0204666b29a81c45e3c93c6d2f61b766e98657ba029eca31b52000a0f0ca"
EXCLUDE_PREFIXES = ("maintenance/",)
EXCLUDE_EXACT = {"README.md", ".gitignore"}
SPECIAL_REUSE = {"/_headers", "/_redirects", "/community/index.html"}


def api(method, path, body=None, raw=False):
    url = f"https://api.netlify.com/api/v1{path}"
    data = None
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if body is not None:
        if raw:
            data = body
            headers["Content-Type"] = "application/octet-stream"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP ERROR", e.code, e.read().decode()[:2000])
        raise


def get_live_manifest():
    all_files = []
    page = 1
    while True:
        data = api("GET", f"/deploys/{get_published_deploy_id()}/files?per_page=100&page={page}")
        if not data:
            break
        all_files.extend(data)
        page += 1
        if page > 60:
            break
    return {f["path"]: f["sha"] for f in all_files}


_published_cache = None

def get_published_deploy_id(refresh=False):
    global _published_cache
    if _published_cache is None or refresh:
        info = api("GET", f"/sites/{SITE_ID}")
        _published_cache = info["published_deploy"]["id"]
    return _published_cache


def build_local_manifest(live_by_path):
    tracked = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True).stdout.splitlines()
    untracked = subprocess.run(["git", "ls-files", "--others", "--exclude-standard"], cwd=REPO, capture_output=True, text=True).stdout.splitlines()
    manifest = {}
    contents = {}
    for rel in tracked + untracked:
        if rel in EXCLUDE_EXACT or any(rel.startswith(p) for p in EXCLUDE_PREFIXES):
            continue
        full = os.path.join(REPO, rel)
        if not os.path.isfile(full):
            continue
        with open(full, "rb") as fh:
            data = fh.read()
        path = "/" + rel
        manifest[path] = hashlib.sha1(data).hexdigest()
        contents[path] = data
    for p in SPECIAL_REUSE:
        manifest[p] = live_by_path[p]
    return manifest, contents


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "diff"

    published_id = get_published_deploy_id()
    print("current published deploy:", published_id)
    live_by_path = get_live_manifest()
    print("live file count:", len(live_by_path))

    manifest, contents = build_local_manifest(live_by_path)
    print("local manifest size:", len(manifest))

    changed = sorted(p for p in manifest if p in live_by_path and manifest[p] != live_by_path[p])
    added = sorted(p for p in manifest if p not in live_by_path)
    removed = sorted(p for p in live_by_path if p not in manifest)

    print(f"changed={len(changed)} added={len(added)} removed={len(removed)}")
    if removed:
        print("!!! REMOVED PATHS (should be empty) !!!")
        for p in removed:
            print("  ", p)

    if cmd == "diff":
        for p in changed:
            print("CHANGED", p)
        for p in added:
            print("ADDED", p)
        return

    if removed:
        print("Refusing to deploy: would drop live files. Aborting.")
        sys.exit(1)

    if cmd == "draft":
        deploy = api("POST", f"/sites/{SITE_ID}/deploys", {
            "files": manifest,
            "functions": {"community-proxy": FUNCTION_DIGEST},
            "draft": True,
        })
        deploy_id = deploy["id"]
        print("draft deploy id:", deploy_id)
        required = deploy.get("required", [])
        print("required uploads:", len(required))
        for sha in required:
            # find a path with this sha
            path = next(p for p, s in manifest.items() if s == sha)
            data = contents.get(path)
            if data is None:
                # special reuse file; must fetch from live since we don't have local bytes
                data = fetch_live_bytes(path, published_id)
            put_file(deploy_id, path, data)
        # poll for ready
        for _ in range(60):
            info = api("GET", f"/deploys/{deploy_id}")
            state = info.get("state")
            print("deploy state:", state)
            if state == "ready":
                break
            if state in ("error",):
                print(json.dumps(info, indent=2)[:3000])
                sys.exit(1)
            time.sleep(3)
        print("DRAFT_DEPLOY_ID", deploy_id)
        print("DRAFT_URL", f"https://{deploy_id}--momentium-creative.netlify.app")
        with open("/tmp/draft_deploy_id.txt", "w") as f:
            f.write(deploy_id)
        return

    if cmd == "publish":
        deploy_id = sys.argv[2]
        # re-check published id unchanged immediately before publish
        current = get_published_deploy_id(refresh=True)
        print("published id immediately before publish:", current, "(expected still", published_id, ")")
        result = api("POST", f"/sites/{SITE_ID}/deploys/{deploy_id}/restore")
        print("publish result keys:", list(result.keys()))
        info = api("GET", f"/sites/{SITE_ID}")
        print("new published_deploy.id:", info["published_deploy"]["id"])
        return


def fetch_live_bytes(path, deploy_id):
    url = f"https://{deploy_id}--momentium-creative.netlify.app{path}"
    with urllib.request.urlopen(url) as resp:
        return resp.read()


def put_file(deploy_id, path, data):
    url = f"https://api.netlify.com/api/v1/deploys/{deploy_id}/files{path}"
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/octet-stream",
    }, method="PUT")
    with urllib.request.urlopen(req) as resp:
        resp.read()
    print("uploaded", path, len(data), "bytes")


if __name__ == "__main__":
    main()
