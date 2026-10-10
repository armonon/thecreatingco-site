#!/usr/bin/env python3
"""Archive exact committed company branch changes, never dirty working-tree contents."""
from __future__ import annotations
import hashlib,json,os
from pathlib import Path,PurePosixPath
import subprocess
from screening import path_reason,content_reason

WORKSPACE=Path('/Users/agentsattari')
PRUNE={'.git','node_modules','.next','dist','build','.cache','.venv','venv','vendor','target','Library','DerivedData','site-packages'}
TEXT={'.md','.txt','.py','.js','.jsx','.ts','.tsx','.mjs','.cjs','.json','.css','.html','.svg','.yml','.yaml','.toml','.lock','.sh','.rs','.go','.swift','.kt','.java','.cpp','.c','.h','.hpp','.vue','.svelte','.sql','.xml','.plist','.cmake','.gradle','.bat','.ps1','.ini','.cfg','.gitignore'}
MAX_FILE=2_000_000
MAX_PATCH=40_000_000

def git(repo,*args,binary=False):
    p=subprocess.run(['git','-C',str(repo),*args],capture_output=True,timeout=90)
    if p.returncode: return None
    return p.stdout if binary else p.stdout.decode('utf-8','replace').strip()

def company_remotes(workspace=WORKSPACE):
    registry=json.loads((workspace/'thecreateco-company/PRODUCT_REGISTRY.json').read_text())
    remotes={p['repo'].removesuffix('.git') for p in registry['products'] if isinstance(p.get('repo'),str)}
    remotes.update({'https://github.com/armonon/scenepilot-compositor','https://github.com/armonon/scenepilot-studio-badass','https://github.com/armonon/weblab'})
    return remotes

def discover(workspace=WORKSPACE):
    remotes=company_remotes(workspace);found={}
    for root in [workspace/'code',workspace/'Sattari',workspace/'worktrees']:
        if not root.is_dir():continue
        for where,dirs,files in os.walk(root):
            repo=Path(where)
            if len(repo.relative_to(root).parts)>5:dirs[:]=[];continue
            if '.git' not in dirs and '.git' not in files:
                dirs[:]=[d for d in dirs if d not in PRUNE];continue
            dirs[:]=[]
            remote=git(repo,'remote','get-url','origin') or ''
            if remote.startswith('git@github.com:'):remote='https://github.com/'+remote.split(':',1)[1]
            remote=remote.removesuffix('.git')
            if remote not in remotes:continue
            branch=git(repo,'symbolic-ref','--quiet','--short','HEAD');sha=git(repo,'rev-parse','HEAD')
            if not sha or not branch or branch=='company/operations':continue
            key=(remote,sha)
            item=found.setdefault(key,{'repo':remote,'sha':sha,'branches':[],'checkout':repo})
            if branch not in item['branches']:item['branches'].append(branch)
    return sorted(found.values(),key=lambda x:(x['repo'],x['sha']))

def export_commit(repo,sha,target):
    """A patch against the branch's base captures the complete committed review delta."""
    target=Path(target);target.mkdir(parents=True,exist_ok=True)
    default=git(repo,'symbolic-ref','--quiet','refs/remotes/origin/HEAD')
    refs=[default,'refs/remotes/origin/main','refs/remotes/origin/master']
    base=None
    for ref in refs:
        if ref and git(repo,'rev-parse','--verify',ref):
            base=git(repo,'merge-base',ref,sha)
            if base:break
    if not base:base=git(repo,'rev-parse',sha+'^')
    if not base:base=git(repo,'hash-object','-t','tree','/dev/null')
    changed=git(repo,'diff','--name-only','-z',base,sha,binary=True)
    if changed is None:raise RuntimeError('Cannot enumerate committed changes')
    files=[];omitted=[];parts=[]
    for raw in changed.split(b'\x00'):
        if not raw:continue
        name=raw.decode('utf-8','strict');path=PurePosixPath(name)
        reason=path_reason(name)
        if not reason and path.suffix.lower() not in TEXT and path.name not in {'Dockerfile','Makefile','CMakeLists.txt','LICENSE','.gitignore','.gitattributes'}:reason='non-source-or-binary-asset'
        mode=git(repo,'ls-tree',sha,'--',name) or ''
        if not reason and mode and not mode.startswith(('100644 ','100755 ')):reason='symlink-or-submodule'
        data=git(repo,'show',sha+':'+name,binary=True) if mode else b''
        if data is None:reason=reason or 'unreadable-git-object'
        if not reason and len(data)>MAX_FILE:reason='source-size-limit'
        if not reason:reason=content_reason(data)
        patch=git(repo,'diff','--no-ext-diff','--no-textconv','--no-renames','--full-index',base,sha,'--',name,binary=True) if not reason else None
        if not reason and patch is None:reason='diff-unavailable'
        if not reason:reason=content_reason(patch)
        if reason:omitted.append({'path':name,'reason':reason});continue
        if sum(map(len,parts))+len(patch)>MAX_PATCH:omitted.append({'path':name,'reason':'branch-patch-size-limit'});continue
        parts.append(patch)
        record={'path':name,'status':'present' if mode else 'deleted','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
        if mode:
            dst=target/'files'/name;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data)
        files.append(record)
    patch=b''.join(parts);(target/'changes.patch').write_bytes(patch)
    manifest={'sha':sha,'base_sha':base,'scope':'Committed screened review delta, not a release or complete binary artifact','files':files,'omitted':omitted,'patch_sha256':hashlib.sha256(patch).hexdigest()}
    (target/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

def archive(destination,workspace=WORKSPACE):
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True);records=[]
    for item in discover(workspace):
        slug=item['repo'].rsplit('/',1)[1];target=destination/slug/item['sha']
        record=export_commit(item['checkout'],item['sha'],target)
        record.update(repo=item['repo'],branches=sorted(item['branches']),archive_path=str(target.relative_to(destination)),local_worktree_dirty=bool(git(item['checkout'],'status','--porcelain=v1','-uno')))
        # No local checkout path or commit author/contact metadata is published.
        (target/'MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
        records.append({k:record[k] for k in ['repo','sha','base_sha','branches','archive_path','local_worktree_dirty']}|{'files':len(record['files']),'omitted':len(record['omitted'])})
    (destination/'INDEX.json').write_text(json.dumps({'scope':'Exact committed company Git changes; dirty/untracked files never copied','records':records},indent=2)+'\n')
    return records
