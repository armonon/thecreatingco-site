#!/usr/bin/env python3
"""Record exact tested company source bytes and publish to company/operations."""
import argparse,json
from pathlib import Path
import subprocess,sys

ROOT=Path('/Users/agentsattari/code/company-worktrees/thecreatingco-operations')
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--evidence',type=Path,required=True);p.add_argument('--file',type=Path,action='append',required=True);p.add_argument('--record-only',action='store_true');args=p.parse_args()
    evidence=args.evidence.resolve()
    if not evidence.is_file() or not evidence.stat().st_size:raise ValueError('Existing nonempty verification evidence required')
    command=[sys.executable,str(ROOT/'sync_snapshot.py'),'--checkpoint-evidence',str(evidence)]
    for f in args.file:command+=['--checkpoint-source',str(f.resolve())]
    subprocess.run(command,check=True)
    if not args.record_only:subprocess.run([sys.executable,str(ROOT/'publish_snapshot.py')],check=True)
if __name__=='__main__':main()
