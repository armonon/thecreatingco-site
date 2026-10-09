#!/usr/bin/env python3
"""Evidence views + severity-first selection; company.py owns all queue writes."""
import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
PRODUCTS = ('scenepilot', 'luma', 'form', 'stemdeck')

def ranked(tasks, products=None):
    by_id = {t['task_id']: t for t in tasks}
    busy = {t.get('product') for t in tasks if t['status'] == 'RUNNING'}
    held = {p['product_id'] for p in (products or []) if p.get('execution_hold')}
    def eligible(t):
        return (t.get('product') in PRODUCTS and t['status'] == 'QUEUED'
                and t.get('product') not in busy
                and t.get('product') not in held
                and not t.get('execution_hold')
                and all(by_id.get(d, {}).get('status') == 'COMPLETE'
                        for d in t.get('dependencies', [])))
    return sorted((t for t in tasks if eligible(t)), key=lambda t: (
        {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4, 'P5': 5, 'P6': 6}.get(t.get('severity'), 7),
        -(t.get('priority') if t.get('priority') is not None else -1), t['task_id']))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('action', choices=['next', 'refresh'])
    args = ap.parse_args()
    subprocess.run([sys.executable, str(ROOT.parent/'engine/company.py'), '--root', str(ROOT.parent), 'refresh'], check=True, stdout=subprocess.DEVNULL)
    tasks = json.loads((ROOT.parent/'TASK_QUEUE.json').read_text())['tasks']
    products = json.loads((ROOT.parent/'PRODUCT_REGISTRY.json').read_text())['products']
    paused = (ROOT/'PAUSE').exists() or (ROOT.parent/'PAUSE').exists()
    available = [] if paused else ranked(tasks, products)
    if args.action == 'next':
        print(json.dumps({'paused': paused, 'task': available[0] if available else None}, indent=2))
        return
    observed = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    (ROOT/'PRIORITIES.json').write_text(json.dumps({'generated_at': observed, 'paused': paused, 'note': 'Read-only company queue projection; severity first, priorities are estimates. Claim by ID via company.py.', 'eligible': available, 'all_flagship_tasks': [t for t in tasks if t.get('product') in PRODUCTS]}, indent=2)+'\n')
    lines = ['# Core Product Health', '', 'Updated: '+observed, '', 'Quality scores: unknown until measured. Local checks are not release qualification.', '']
    for name in PRODUCTS:
        path = ROOT/'products'/f'{name}.json'
        state = json.loads(path.read_text()) if path.exists() else {}
        nested_status = state.get('status') if isinstance(state.get('status'), dict) else {}
        readiness = state.get('release_readiness') or nested_status.get('release_readiness') or state.get('verification', {}).get('release_readiness') or 'Unverified; audit in progress.'
        lines += ['## '+name.upper(), '', '- Audit report: [report](reports/'+name+'-initial.md)',
                  '- Readiness: '+str(readiness),
                  '- Quality score: '+str(state.get('quality_score') or 'Unknown / not scored'),
                  '- Golden workflow: '+str(state.get('golden_workflow_status', 'Not yet fully qualified'))]
        owned = [t for t in tasks if t.get('product') == name and t['status'] != 'COMPLETE']
        lines += ['- '+t['task_id']+' — '+t['status']+': '+t['title'] for t in owned[:5]]
        lines += ['']
    lines += ['## Next eligible task', '', 'PAUSED' if paused else (available[0]['task_id']+' — '+available[0]['title'] if available else 'None: inspect active ownership/blockers before creating work.'), '', 'Full unified queue: [PRIORITIES.json](PRIORITIES.json). Original truth: ../engine/company.sqlite3, managed through ../engine/company.py.', '']
    (ROOT/'HEALTH.md').write_text('\n'.join(lines))
    print(json.dumps({'products': len(PRODUCTS), 'eligible': len(available), 'paused': paused}))

if __name__ == '__main__':
    main()
