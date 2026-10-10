#!/usr/bin/env python3
"""Render a contact-free revenue view from authoritative company context. No DB writes."""
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def write_atomic(path, content):
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
        temporary = f.name
    os.replace(temporary, path)

def main():
    definitions = json.loads((ROOT/'data/revenue/metric-definitions.json').read_text())['metrics']
    with sqlite3.connect((ROOT/'engine/company.sqlite3').as_uri()+'?mode=ro', uri=True) as conn:
        conn.execute('PRAGMA query_only=ON')
        context = json.loads(conn.execute("SELECT value FROM metadata WHERE key='context'").fetchone()[0])
    allowed = ('value','currency','source','period','observed_at','status','definition','calls','numerator','denominator','cohort','coverage','freshness','status_reason')
    metrics = {name: {k:v for k,v in context.get('metrics',{}).get(name,{}).items() if k in allowed} for name in definitions}
    timestamp = datetime.now(timezone.utc).isoformat()
    snapshot = {'generated_at':timestamp,'source':'engine/company.sqlite3 context.metrics','metrics':metrics}
    lines = ['# Revenue dashboard', '', 'Generated: '+timestamp, '', 'Source: authoritative company context; this file is a generated view, not a second ledger.', '', 'Unknown is not zero. Financial values require company attribution, source, interval and currency. No invoice-level or contact data is loaded.', '']
    for name, obs in metrics.items():
        value = obs.get('value')
        evidence_complete = all(obs.get(k) is not None for k in ('source','period','observed_at'))
        rate_complete = name not in ('conversion_rate','retention') or all(obs.get(k) is not None for k in ('numerator','denominator','cohort'))
        status = obs.get('status') or 'UNVERIFIED'
        if value is not None and not (evidence_complete and rate_complete):
            status = 'INCOMPLETE_EVIDENCE — not verified'
        obs['display_status'] = status
        lines += ['## '+name.replace('_',' ').title(), '', 'Unknown / not measured' if value is None else str(value)+' '+str(obs.get('currency','')), '', 'Status: '+status, 'Definition: '+str(obs.get('definition') or definitions[name].get('definition','Unknown')), 'Source: '+str(obs.get('source') or 'Unknown'), 'Period: '+json.dumps(obs.get('period')), 'Observed: '+str(obs.get('observed_at') or 'Unknown')]
        for field in ('numerator','denominator','cohort','coverage','freshness','status_reason'):
            if field in obs:
                lines.append(field.title()+': '+json.dumps(obs[field]))
        lines.append('')
    lines += ['## Current decision', '', 'Read COMPANY_STATE.md for the current bottleneck and next strategic move; REVENUE_DIRECTIVE.md and data/revenue/paths.json for revenue targets and hypotheses. First provisional milestone: $1,000 verified trailing-30-day company revenue, unless records show it is already passed. MRR is tracked separately.', '', 'Refresh: python3 data/revenue/dashboard.py. Unknown-company AI cost is NOT replaced by partial marketing list-price estimates.', '']
    write_atomic(ROOT/'REVENUE_DASHBOARD.md','\n'.join(lines))
    write_atomic(ROOT/'data/revenue/dashboard-snapshot.json',json.dumps(snapshot,indent=2)+'\n')
    print('Revenue dashboard refreshed; '+str(sum(x.get('value') is not None for x in metrics.values()))+' populated observations; others unknown.')

if __name__ == '__main__':
    main()
