#!/usr/bin/env python3
"""Render completion evidence from the authoritative registry; not another queue."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'engine'))
from company import Engine, atomic_write, now

GATES = ('core_workflow', 'save_reopen_export', 'reliability_recovery',
         'performance', 'usability_accessibility', 'responsive_behavior',
         'security_privacy', 'documentation_support', 'tests',
         'supported_platforms', 'critical_blockers')

def assess(record):
    observations = record.get('completion_observations') or {}
    candidate = observations.get('candidate_sha')
    gates = observations.get('gates') or {}
    evaluated = {}
    for name in GATES:
        gate = gates.get(name) or {}
        status = gate.get('status', 'UNVERIFIED')
        if status not in ('PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED'):
            status = 'UNVERIFIED'
        evidence = gate.get('evidence') or []
        if status == 'PASS':
            valid = (candidate and gate.get('source_sha') == candidate
                     and gate.get('observed_at') and gate.get('coverage_complete') is True
                     and evidence and all(isinstance(p,str) and Path(p).is_file() and Path(p).stat().st_size for p in evidence))
            if name == 'supported_platforms':
                supported = observations.get('supported_platforms') or []
                results = gate.get('platform_results') or {}
                valid = valid and supported and all(results.get(p) == 'PASS' for p in supported)
            if name == 'critical_blockers':
                valid = valid and gate.get('known_critical_blockers') == [] and gate.get('triage_complete') is True
            if not valid:
                status = 'UNVERIFIED'
        evaluated[name] = status
    complete = all(value == 'PASS' for value in evaluated.values())
    disposition = record.get('release_disposition') or {}
    return {'product_id':record['product_id'], 'name':record.get('product_name',record['product_id']),
            'complete':complete, 'candidate_sha':candidate, 'gates':evaluated,
            'evidence':observations, 'deployment':observations.get('deployment', {'status':'UNVERIFIED'}),
            'release_disposition':disposition,
            'inventory':record.get('release_inventory',{}),
            'gap_audit':record.get('inventory_gap_observation',{})}

def render(root=ROOT):
    manifest=json.loads((root/'release-program/manifest.json').read_text())
    engine=Engine(root)
    try:snapshot=engine.refresh()
    finally:engine.close()
    products={p['product_id']:p for p in snapshot['products']}
    rows=[assess(products.get(pid, {'product_id':pid})) for pid in manifest['confirmed_product_ids']]
    completed=sum(p['complete'] for p in rows)
    scope_complete=(manifest.get('scope_status')=='CONFIRMED' and len(rows)==manifest['requested_count'] and len({p['product_id'] for p in rows})==len(rows))
    result={'generated_at':now(),'requested_products':manifest['requested_count'],
            'confirmed_products':len(rows),'completed_products':completed,
            'assignment_complete':scope_complete and completed==manifest['requested_count'],
            'scope':manifest,'products':rows}
    lines=['# Product release matrix — ongoing assignment','',
           f'Updated: {result["generated_at"]}',
           f'**{completed}/{manifest["requested_count"]} products meet all documented completion gates. Assignment NOT COMPLETE.**' if not result['assignment_complete'] else f'**All {completed} scoped products meet the documented completion gates.**','',
           f'Named scope: {len(rows)}/{manifest["requested_count"]}. {manifest["scope_status"]}.',
           'Unnamed products are not silently selected, omitted, or counted as passing.','',
           'A completed queue task, pushed PR, passing subset or release wave is NOT a completed product.',
           'PASS requires exact-candidate evidence and complete declared coverage. Missing checks remain UNVERIFIED.', '']
    for row in rows:
        lines += ['## '+row['name'],'',f'- Product completion: {"COMPLETE" if row["complete"] else "INCOMPLETE"}',
                  '- Release status: '+str(row['release_disposition'].get('status','UNVERIFIED'))+' — '+str(row['release_disposition'].get('reason','Disposition pending qualification.')),
                  '- Candidate: '+str(row['candidate_sha'] or 'not yet pinned in completion record')]
        source=row['inventory'].get('source',{})
        for label,key in [('Repository','repo'),('Application','application_url')]:
            if source.get(key):lines.append('- '+label+': '+source[key])
        for name,status in row['gates'].items():
            observation=row['evidence'].get('gates',{}).get(name,{})
            lines.append('- '+name.replace('_',' ')+': **'+status+'** — '+str(observation.get('summary','No complete gate evidence recorded.')))
            for path in observation.get('evidence',[]):
                lines.append('  - ['+Path(path).name+']('+path+')')
        lines += ['- Deployment: '+json.dumps(row['deployment'],ensure_ascii=False),
                  '- Exact next action: '+str(row['evidence'].get('next_action','Continue claimed product work; update completion observations after milestone.')),'']
    if not scope_complete:
        lines += ['## Scope blocker','',manifest['scope_question'],
                  'Independent work continues on the four already-confirmed flagship products.','']
    lines += ['## Persistent work log','',
              '- Authoritative tasks/status/dependencies/changes/tests/blockers: [TASK_QUEUE.json](TASK_QUEUE.json).',
              '- Product gate observations: [PRODUCT_REGISTRY.json](PRODUCT_REGISTRY.json), field `completion_observations`.',
              '- Detailed dated evidence: [reports](reports/) and [Core Product Lab reports](core-product-lab/reports/).',
              '- Update records through engine/company.py; render this view with release-program/matrix.py.','']
    atomic_write(root/'RELEASE_MATRIX.md','\n'.join(lines))
    atomic_write(root/'release-program/release-matrix.json',json.dumps(result,indent=2)+'\n')
    queue=json.loads((root/'TASK_QUEUE.json').read_text())['tasks']
    scoped=[t for t in queue if t.get('product') in manifest['confirmed_product_ids'] and t['status']!='COMPLETE']
    scoped.sort(key=lambda t:(t.get('severity') or 'P9',-(t.get('priority') or 0),t['task_id']))
    work=['# Prioritized remaining product work','',
          'Canonical queue projection; severity precedes estimated priority. Active ownership must be preserved.',
          'First wave: Bounce, Pocket Studio, Key & BPM, Glyph Studio. Missing gate coverage remains work even without a separate defect task.','']
    for task in scoped:
        work += ['## '+task['task_id']+' — '+task['title'],
                 '- Product: '+task['product']+'; '+task['status']+'; severity '+str(task.get('severity') or 'unassigned')+'; estimated priority '+str(task.get('priority')),
                 '- Owner: '+str(task.get('owner') or 'unclaimed'),
                 '- Dependencies: '+', '.join(task.get('dependencies',[])),
                 '- Last result/blocker: '+str(task.get('result') or 'No result recorded.'),
                 '- Next: '+str(task.get('next_action') or 'Qualification required.'),'']
    atomic_write(root/'REMAINING_WORK.md','\n'.join(work))
    return result

if __name__=='__main__':
    result=render()
    print(json.dumps({k:result[k] for k in ['confirmed_products','requested_products','completed_products','assignment_complete']}))
