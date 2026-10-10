#!/usr/bin/env python3
"""Screen company state/source and exact committed product work into operations."""
from __future__ import annotations
import argparse,hashlib,json,os
from pathlib import Path
import shutil,subprocess,tempfile
from screening import path_reason,content_reason,PRIVATE_PARTS
from archive_product_work import archive,discover

WORKSPACE_ROOT=Path('/Users/agentsattari')
ROOT=Path(__file__).resolve().parent
DEST=ROOT/'snapshot'
CHECKPOINTS=WORKSPACE_ROOT/'.local/state/thecreateco-source-checkpoints.json'
MAX_BYTES=2_000_000
TEXT={'.md','.json','.py','.txt','.sh','.plist','.toml','.yaml','.yml'}

def git(path,*args):
    p=subprocess.run(['git','-C',str(path),*args],capture_output=True,text=True,timeout=60)
    return p.stdout.strip() if p.returncode==0 else ''

def walk(root,suffixes):
    if not root.is_dir():return []
    result=[]
    for where,dirs,files in os.walk(root):
        dirs[:]=[d for d in dirs if d not in PRIVATE_PARTS and d not in {'dist','build','vite-cache','synthetic-publish','published-app-artifact'}]
        for name in files:
            p=Path(where)/name
            if p.suffix in suffixes:result.append(p)
    return result

def candidates(workspace=WORKSPACE_ROOT):
    company=workspace/'thecreateco-company';marketing=workspace/'thecreateco-marketing';files=[]
    if company.is_dir():files += [p for p in company.iterdir() if p.is_file() and p.suffix in TEXT]
    for folder in ['engine','data','automation','core-product-lab','release-program']:
        root=company/folder
        # Reports are text evidence only, never copied packaged applications/venvs.
        for p in walk(root,TEXT):
            if 'reports' in p.relative_to(root).parts and p.suffix!='.md':continue
            files.append(p)
    files += walk(company/'reports',{'.md'})
    if marketing.is_dir():files += [p for p in marketing.iterdir() if p.is_file() and p.suffix in {'.md','.json'}]
    for folder in ['engine/mktg','engine/tests','engine/config','content','research','outreach','packs-build']:
        files += walk(marketing/folder,TEXT)
    files += [marketing/'engine/README.md',marketing/'engine/bin/mktg',marketing/'engine/bin/scheduled-tick']
    for folder in ['git-handoff','operations-supervisor']:
        root=workspace/folder
        files += [p for p in root.iterdir() if p.is_file() and p.suffix in TEXT] if root.is_dir() else []
        files += walk(root/'tests',{'.py'})
    return sorted(set(files))

def requires_checkpoint(rel):
    p=Path(rel)
    return p.suffix in {'.py','.sh'} or '/engine/config/' in '/'+str(p) or '/engine/bin/' in '/'+str(p)

def read_checkpoints():
    try:return json.loads(CHECKPOINTS.read_text())
    except FileNotFoundError:return {'files':{}}

def checkpoint_sources(paths,evidence):
    evidence=Path(evidence).resolve()
    if not evidence.is_file():raise ValueError('Checkpoint evidence file required')
    data=read_checkpoints();data.setdefault('files',{})
    count=0
    allowed=set(candidates())
    for source in paths:
        source=Path(source).resolve()
        if source not in allowed:raise ValueError('Source outside company export scope')
        rel=source.relative_to(WORKSPACE_ROOT)
        if source.is_symlink() or path_reason(rel):continue
        content=source.read_bytes()
        if content_reason(content) or len(content)>MAX_BYTES:continue
        data['files'][str(rel)]={'sha256':hashlib.sha256(content).hexdigest(),'evidence':str(evidence.relative_to(WORKSPACE_ROOT)),'evidence_sha256':hashlib.sha256(evidence.read_bytes()).hexdigest()}
        count+=1
    CHECKPOINTS.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(dir=CHECKPOINTS.parent,prefix='.checkpoint-')
    with os.fdopen(fd,'w') as f:json.dump(data,f,indent=2);f.write('\n')
    os.replace(tmp,CHECKPOINTS)
    return count

def build(target,workspace=WORKSPACE_ROOT,checkpoints=None,products=True):
    target=Path(target);target.mkdir(parents=True,exist_ok=True)
    approvals=checkpoints if checkpoints is not None else read_checkpoints()
    copied=[];skipped=[]
    for source in candidates(workspace):
        rel=source.relative_to(workspace);reason=path_reason(rel)
        if not reason and (not source.is_file() or source.is_symlink()):reason='missing-or-symlink'
        if not reason and source.stat().st_size>MAX_BYTES:reason='over-size-limit'
        if reason:skipped.append({'path':str(rel),'reason':reason});continue
        data=source.read_bytes();digest=hashlib.sha256(data).hexdigest();reason=content_reason(data)
        if not reason and requires_checkpoint(rel) and approvals.get('files',{}).get(str(rel),{}).get('sha256')!=digest:
            reason='code-checkpoint-not-recorded-or-source-changed'
        if reason:skipped.append({'path':str(rel),'reason':reason});continue
        dst=target/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data)
        copied.append({'path':str(rel),'bytes':len(data),'sha256':digest})
    product_records=archive(target/'product-work',workspace) if products else []
    manifest={'scope':'Screened company state, checkpointed source, text evidence and exact committed product review deltas; no credentials/contacts/databases or dirty product work',
        'files':copied,'skipped':skipped,'product_work':product_records,
        'product_git_refs':[{'repo':x['repo'],'branch':branch,'sha':x['sha']} for x in product_records for branch in x['branches']]}
    (target/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint-evidence',type=Path)
    parser.add_argument('--checkpoint-source',type=Path,action='append',default=[])
    args=parser.parse_args(argv)
    if git(ROOT,'symbolic-ref','--short','HEAD')!='company/operations':raise RuntimeError('Wrong branch')
    if args.checkpoint_source:
        if not args.checkpoint_evidence:raise ValueError('Evidence required for source checkpoints')
        print(json.dumps({'checkpointed':checkpoint_sources(args.checkpoint_source,args.checkpoint_evidence)}))
        return 0
    # Build completely before replacing the tracked generated snapshot. A failed
    # collection preserves the prior version and cannot erase unrelated source.
    stage=Path(tempfile.mkdtemp(prefix='.snapshot-',dir=ROOT))
    try:
        manifest=build(stage)
        if DEST.exists():
            old=ROOT/'.previous-snapshot'
            if old.exists():raise RuntimeError('Recovery snapshot already exists; inspect before publishing')
            os.replace(DEST,old)
            try:os.replace(stage,DEST)
            except BaseException:os.replace(old,DEST);raise
            shutil.rmtree(old) # generated prior snapshot retained in Git history
        else:os.replace(stage,DEST)
    finally:
        if stage.exists():shutil.rmtree(stage)
    print(json.dumps({'copied':len(manifest['files']),'skipped':len(manifest['skipped']),'product_commits':len(manifest['product_work'])}))
    return 0

if __name__=='__main__':raise SystemExit(main())
