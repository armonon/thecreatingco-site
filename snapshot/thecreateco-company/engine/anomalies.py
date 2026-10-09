#!/usr/bin/env python3
"""Create deduplicated optimization tasks from sanitized telemetry, without inference."""
import datetime as dt
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo
from company import Engine


def sync(root):
    root = Path(root)
    if (root/'PAUSE').exists():
        return {'status':'paused','created':[]}
    snapshot = json.loads((root/'data/cost-snapshot.json').read_text())
    observed = dt.datetime.fromisoformat(snapshot['observed_at'].replace('Z','+00:00'))
    day = observed.astimezone(ZoneInfo('America/Los_Angeles')).strftime('%Y%m%d')
    engine = Engine(root)
    made = []
    try:
        existing = {t['task_id'] for t in engine.get_tasks()}
        for anomaly in snapshot.get('anomalies',[]):
            kind = anomaly.get('kind')
            if not isinstance(kind,str) or not re.fullmatch('[a-z_]{1,60}',kind):
                continue
            task_id = 'OS-COST-'+kind.upper().replace('_','-')+'-'+day
            if task_id in existing:
                continue
            engine.enqueue({'task_id':task_id,'title':'Investigate observed telemetry: '+kind,
                'category':'OPERATIONS','workstream':'COST_OPTIMIZATION','severity':'P3',
                'model':'openai/gpt-6-luna','model_tier':'LUNA','token_budget':8000,'tool_budget':20,
                'context_token_budget':8000,'source_evidence':'data/cost-snapshot.json',
                'expected_value':'Resolve evidence-backed efficiency issue; receipt counts are not billing or per-call totals',
                'scores':{'impact':6,'user_value':6,'confidence':8,'effort':2,'risk':1},
                'test_requirements':'Inspect bounded sanitized receipts, confirm cause and verify smallest fix with deterministic regression evidence; preserve current owners and routing',
                'next_action':'Verify anomaly is still current after OS routing recovery; close with evidence if already resolved. Do not retry identical failures or reread raw transcripts.'})
            existing.add(task_id);made.append(task_id)
    finally:
        engine.close()
    return {'created':made,'observed_at':snapshot['observed_at']}

if __name__=='__main__':
    print(json.dumps(sync(Path(__file__).resolve().parents[1])))
