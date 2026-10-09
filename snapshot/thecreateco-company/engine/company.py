#!/usr/bin/env python3
"""Durable company state and fenced, leased task queue. Python standard library only."""
from __future__ import annotations
import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import uuid
try:
    import telemetry
except ImportError:
    telemetry = None

STATUSES = {'QUEUED','RUNNING','WAITING','COMPLETE','FAILED','BLOCKED','NEEDS_REVIEW'}
TERMINAL = {'COMPLETE','NEEDS_REVIEW','BLOCKED','FAILED'}
MAX_ATTEMPTS = 3

def priority_key(task):
    """Severity first, then evidence-based estimate; unknown severity is not P0."""
    severity = task.get('severity')
    return (int(severity[1]) if severity in {f'P{i}' for i in range(7)} else 7,
            -(task.get('priority') or 0), task['task_id'])

def eligible_tasks(tasks, products=None):
    by_id = {t['task_id']: t for t in tasks}
    busy = {t.get('product') for t in tasks if t['status']=='RUNNING' and t.get('product')}
    held = {p['product_id'] for p in (products or []) if p.get('execution_hold')}
    return [t for t in sorted(tasks,key=priority_key) if t['status']=='QUEUED'
            and t.get('product') not in busy
            and t.get('product') not in held and not t.get('execution_hold')
            and all(by_id.get(d,{}).get('status')=='COMPLETE' for d in t['dependencies'])]

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')

def dumps(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False)

def load_json(path):
    with open(path, encoding='utf-8') as stream:
        return json.load(stream, parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))

def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def validate_task(raw):
    if not isinstance(raw, dict):
        raise ValueError('Every task must be an object')
    task = dict(raw)
    for field in ('task_id','title'):
        if not isinstance(task.get(field), str) or not task[field].strip():
            raise ValueError('Task requires nonempty ' + field)
    task.setdefault('status','QUEUED')
    if task['status'] not in STATUSES - {'RUNNING','COMPLETE','NEEDS_REVIEW'}:
        raise ValueError('Seed/enqueued tasks cannot be RUNNING, COMPLETE, or NEEDS_REVIEW')
    if task.get('severity') is not None and task['severity'] not in {'P0','P1','P2','P3','P4','P5','P6'}:
        raise ValueError('Task severity must be null or P0–P6')
    for budget in ('token_budget','tool_budget','context_token_budget'):
        value = task.get(budget)
        if value is not None and (isinstance(value,bool) or not isinstance(value,int) or value <= 0):
            raise ValueError(budget+' must be a positive integer or null')
    deps = task.setdefault('dependencies', [])
    if not isinstance(deps, list) or any(not isinstance(v, str) for v in deps) or task['task_id'] in deps:
        raise ValueError('Invalid dependencies for ' + task['task_id'])
    scores = task.setdefault('scores', {})
    if not isinstance(scores, dict):
        raise ValueError('scores must be an object')
    for key, value in scores.items():
        if value is not None and (isinstance(value, bool) or not isinstance(value, (float,int)) or not 0 <= value <= 10):
            raise ValueError('Score must be null or 0–10: ' + key)
    keys = ('impact','user_value','confidence','effort','risk')
    task['priority'] = round(scores['impact'] * scores['user_value'] * scores['confidence'] / (scores['effort'] + scores['risk'] + 1), 4) if all(scores.get(k) is not None for k in keys) else None
    task['priority_basis'] = 'ESTIMATE: impact × user_value × confidence / (effort + risk + 1)'
    for field in ('category','workstream','product','campaign','model','expected_value','next_action'):
        task.setdefault(field, None)
    task['risk'] = scores.get('risk', task.get('risk'))
    task.update(created_at=task.get('created_at') or now(), started_at=None, completed_at=None, result=None, attempts=0, owner=None, lease_until=None)
    return task

def check_dependencies(tasks):
    by_id = {t['task_id']: t for t in tasks}
    if len(by_id) != len(tasks):
        raise ValueError('Duplicate task IDs')
    visiting, visited = set(), set()
    def visit(key):
        if key in visiting:
            raise ValueError('Dependency cycle involving ' + key)
        if key in visited:
            return
        visiting.add(key)
        for dep in by_id[key].get('dependencies', []):
            if dep not in by_id:
                raise ValueError('Unknown dependency: ' + dep)
            visit(dep)
        visiting.remove(key)
        visited.add(key)
    for key in by_id:
        visit(key)

MATURITIES = {'IDEA','RESEARCH','PROTOTYPE','ALPHA','BETA','RELEASE_CANDIDATE','PRODUCTION','MATURE','MAINTENANCE','PAUSED','RETIRED'}
PRODUCT_KINDS = {'standalone','module','infrastructure'}

def validate_products(products):
    by_id = {}
    for product in products:
        if not isinstance(product,dict) or not isinstance(product.get('product_id'),str) or not product['product_id'].strip():
            raise ValueError('Each product requires a nonempty product_id')
        if product['product_id'] in by_id:
            raise ValueError('Duplicate product IDs')
        by_id[product['product_id']] = product
        if product.get('maturity') is not None and product['maturity'] not in MATURITIES:
            raise ValueError('Unsupported product maturity')
        if product.get('kind') not in PRODUCT_KINDS:
            raise ValueError('Product kind must be standalone, module, or infrastructure')
        quality = product.get('quality_scores')
        if quality is not None and not isinstance(quality,dict):
            raise ValueError('quality_scores must be a dimension mapping or null')
        scores = [product.get('quality_score')] + list((quality or {}).values())
        for score in scores:
            if score is not None and (isinstance(score,bool) or not isinstance(score,(int,float)) or not 1 <= score <= 10):
                raise ValueError('Product quality scores must be null or 1–10')
        if any(score is not None for score in scores):
            if not all(product.get(key) for key in ('evidence_sources','observed_at','quality_evidence')):
                raise ValueError('Product quality requires evidence_sources, observed_at, and quality_evidence')
        users = product.get('active_users')
        if users is not None:
            if isinstance(users,bool) or not isinstance(users,int) or users < 0:
                raise ValueError('active_users must be null or a nonnegative integer')
            evidence = product.get('user_metrics_evidence')
            if not isinstance(evidence,dict) or not all(evidence.get(key) for key in ('source','period','observed_at')):
                raise ValueError('active_users requires user_metrics_evidence source, period, and observed_at')
        dumps(product)
    visiting, visited = set(), set()
    def visit(key):
        if key in visiting:
            raise ValueError('Product parent cycle involving '+key)
        if key in visited:
            return
        visiting.add(key)
        parent = by_id[key].get('parent_product_id')
        if parent is not None:
            if not isinstance(parent,str) or parent not in by_id:
                raise ValueError('Unknown product parent for '+key)
            visit(parent)
        visiting.remove(key)
        visited.add(key)
    for key in by_id:
        visit(key)

def validate_context(context):
    if not isinstance(context, dict) or not isinstance(context.get('metrics', {}), dict) or not isinstance(context.get('blockers', []), list):
        raise ValueError('Context metrics must be an object and blockers a list')
    for observation in context.get('metrics', {}).values():
        if not isinstance(observation, dict):
            raise ValueError('Each metric must be an observation object')
        if observation.get('value') is not None and not all(observation.get(k) for k in ('source','period','observed_at')):
            raise ValueError('Measured metrics require source, period, and observed_at')
    health = context.get('health') or {}
    if not isinstance(health, dict):
        raise ValueError('Health must be an observation object')
    score = health.get('score')
    if score is not None:
        if isinstance(score, bool) or not isinstance(score, (int,float)) or not 0 <= score <= 10:
            raise ValueError('Health score must be null or 0–10')
        if not all(health.get(k) for k in ('source','observed_at','rubric','coverage')):
            raise ValueError('Health score requires source, observed_at, rubric, and coverage')
    dumps(context)

class Engine:
    def __init__(self, root):
        self.root = Path(root).resolve()
        (self.root / 'engine').mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / 'engine/company.sqlite3', timeout=30, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, status TEXT NOT NULL, priority REAL, body TEXT NOT NULL, token TEXT);
        CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, task_id TEXT, type TEXT NOT NULL, body TEXT NOT NULL);
        ''')

    @contextlib.contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
        except BaseException:
            self.db.rollback()
            raise
        else:
            self.db.commit()

    def event(self, event_type, task_id=None, **body):
        self.db.execute('INSERT INTO events(at,task_id,type,body) VALUES (?,?,?,?)', (now(),task_id,event_type,dumps(body)))

    def get_tasks(self):
        return sorted([json.loads(row['body']) for row in self.db.execute('SELECT body FROM tasks')],key=priority_key)

    def save_task(self, task, token=None):
        self.db.execute('INSERT INTO tasks(id,status,priority,body,token) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,priority=excluded.priority,body=excluded.body,token=excluded.token', (task['task_id'],task['status'],task['priority'],dumps(task),token))

    def init(self):
        # Parse and validate the whole input before changing any persisted state.
        products = load_json(self.root / 'data/products.json')
        candidates = load_json(self.root / 'data/candidates.json')
        context = load_json(self.root / 'data/context.json')
        if not isinstance(products,list) or not isinstance(candidates,list) or not isinstance(context,dict):
            raise ValueError('Seeds must be product/task lists and a context object')
        ids = set()
        for product in products:
            if not isinstance(product,dict) or not isinstance(product.get('product_id'),str) or not product['product_id'].strip() or product['product_id'] in ids:
                raise ValueError('Invalid or duplicate product_id')
            ids.add(product['product_id'])
            dumps(product)
        tasks = [validate_task(t) for t in candidates]
        if len({t['task_id'] for t in tasks}) != len(tasks):
            raise ValueError('Duplicate candidate IDs')
        validate_context(context)
        with self.transaction():
            existing = {t['task_id']: t for t in self.get_tasks()}
            additions = {t['task_id']: t for t in tasks if t['task_id'] not in existing}
            check_dependencies(list(existing.values()) + list(additions.values()))
            existing_products = {r['id']:json.loads(r['body']) for r in self.db.execute('SELECT id,body FROM products')}
            new_products = {p['product_id']:p for p in products if p['product_id'] not in existing_products}
            validate_products(list(existing_products.values()) + list(new_products.values()))
            for product in new_products.values():
                self.db.execute('INSERT INTO products(id,body) VALUES (?,?)', (product['product_id'],dumps(product)))
            for task in additions.values():
                self.save_task(task)
                self.event('ENQUEUED', task['task_id'], source='seed')
            self.db.execute('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)', ('context',dumps(context)))
            self.db.execute('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)', ('sources_loaded_at',dumps(now())))
            self.event('INITIALIZED', products_added=len(new_products), tasks_added=len(additions))
        return self.refresh()

    def enqueue(self, task):
        task = validate_task(task)
        with self.transaction():
            tasks = self.get_tasks()
            check_dependencies(tasks + [task])
            self.save_task(task)
            self.event('ENQUEUED', task['task_id'])
        self.refresh()
        return task

    def revise(self, patch, reason):
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError('A review/validation reason is required for task revisions')
        if not isinstance(patch, dict) or not patch.get('task_id'):
            raise ValueError('Revision requires task_id')
        editable = {'title','category','workstream','product','campaign','status','model','dependencies','scores','expected_value','next_action','evidence_sources','severity','area','test_requirements','source_evidence','task_type','model_tier','token_budget','tool_budget','context_token_budget','acceptance_criteria','constraints','value_category','escalation_reason'}
        if set(patch) - editable - {'task_id'}:
            raise ValueError('Revision contains noneditable fields')
        with self.transaction():
            tasks = self.get_tasks()
            original = next((t for t in tasks if t['task_id']==patch['task_id']),None)
            if original is None or original['status'] in {'RUNNING','COMPLETE'}:
                raise ValueError('Cannot revise missing, running, or completed task')
            merged = dict(original, **patch)
            if merged['status'] not in {'QUEUED','WAITING','BLOCKED'}:
                raise ValueError('Revision status must be QUEUED, WAITING, or BLOCKED')
            if merged['status']=='QUEUED' and original.get('attempts',0)>=MAX_ATTEMPTS:
                raise ValueError('Retry budget exhausted; create a reviewed follow-up task')
            validated = validate_task(merged)
            for key in ('attempts','created_at','started_at','completed_at','result','last_outcome','result_evidence'):
                if key in original:
                    validated[key] = original[key]
            check_dependencies([validated if t['task_id']==validated['task_id'] else t for t in tasks])
            self.save_task(validated)
            self.event('REVISED',validated['task_id'],changes=patch,previous_status=original['status'],reason=reason)
        self.refresh()
        return validated

    def update_context(self, patch):
        if not isinstance(patch, dict):
            raise ValueError('Context update must be an object')
        dumps(patch)
        with self.transaction():
            row = self.db.execute("SELECT value FROM metadata WHERE key='context'").fetchone()
            context = json.loads(row['value']) if row else {}
            before = json.loads(dumps(context))
            for key, value in patch.items():
                if key == 'metrics':
                    if not isinstance(value,dict):
                        raise ValueError('Metrics must be an object')
                    for metric in value.values():
                        if not isinstance(metric,dict):
                            raise ValueError('Each metric must be an observation object')
                        if metric.get('value') is not None and not all(metric.get(field) for field in ('source','period','observed_at')):
                            raise ValueError('Measured metrics require source, period, and observed_at')
                    context['metrics'] = dict(context.get('metrics',{}), **value)
                else:
                    context[key] = value
            validate_context(context)
            context['updated_at'] = now()
            self.db.execute('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ('context',dumps(context)))
            self.event('CONTEXT_UPDATED', before=before,patch=patch,after=context)
        self.refresh()
        return {'updated_context_fields':sorted(patch),'updated_at':context['updated_at']}

    def update_products(self, products):
        if isinstance(products, dict):
            products = [products]
        if not isinstance(products,list):
            raise ValueError('Product update must be an object or list of objects')
        for product in products:
            if not isinstance(product,dict) or not isinstance(product.get('product_id'),str) or not product['product_id'].strip():
                raise ValueError('Each product patch requires product_id')
        if len({p['product_id'] for p in products}) != len(products):
            raise ValueError('Duplicate product IDs')
        dumps(products)
        with self.transaction():
            existing = {r['id']:json.loads(r['body']) for r in self.db.execute('SELECT id,body FROM products')}
            merged = dict(existing)
            for patch in products:
                product = dict(existing.get(patch['product_id'],{}), **patch)
                product['updated_at'] = now()
                merged[product['product_id']] = product
            validate_products(list(merged.values()))
            for patch in products:
                product = merged[patch['product_id']]
                self.db.execute('INSERT INTO products(id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',(product['product_id'],dumps(product)))
                self.event('PRODUCT_UPDATED',product_id=product['product_id'],before=existing.get(product['product_id']),patch=patch,after=product)
        self.refresh()
        return {'updated_products':[p['product_id'] for p in products]}

    def recover_locked(self):
        recovered = []
        current = now()
        for task in self.get_tasks():
            if task['status'] == 'RUNNING' and task.get('lease_until') and task['lease_until'] <= current:
                task['status'] = 'BLOCKED' if task['attempts'] >= MAX_ATTEMPTS else 'QUEUED'
                task.update(owner=None,lease_until=None)
                task['next_action'] = 'Human review required: retry budget exhausted' if task['status']=='BLOCKED' else 'Resume from recorded progress after expired lease'
                self.save_task(task)
                self.event('LEASE_EXPIRED',task['task_id'],attempts=task['attempts'],status=task['status'])
                recovered.append(task['task_id'])
        return recovered

    def recover(self):
        with self.transaction():
            recovered = self.recover_locked()
        self.refresh()
        return {'recovered':recovered}

    def claim(self, owner, task_id=None, minutes=45):
        if not owner.strip() or not 1 <= minutes <= 1440:
            raise ValueError('Owner required; lease minutes must be 1–1440')
        claimed = None
        with self.transaction():
            self.recover_locked()
            tasks = self.get_tasks()
            by_id = {t['task_id']:t for t in tasks}
            if task_id and task_id not in by_id:
                raise ValueError('Unknown task: ' + task_id)
            products = [json.loads(r['body']) for r in self.db.execute('SELECT body FROM products')]
            for task in eligible_tasks(tasks,products):
                if task_id and task['task_id'] != task_id:
                    continue
                if task['status'] != 'QUEUED' or task.get('attempts',0) >= MAX_ATTEMPTS:
                    continue
                if any(by_id[d]['status'] != 'COMPLETE' for d in task['dependencies']):
                    continue
                if telemetry is not None and (self.root/'data/cost-policy.json').is_file():
                    admission = telemetry.preflight(self.root,dict(task,agent=owner,
                        low_value=task.get('severity') in {'P5','P6'}))
                    if admission.get('decision') == 'defer_low_value':
                        continue
                token = uuid.uuid4().hex
                task.update(status='RUNNING',owner=owner,started_at=now(),completed_at=None,lease_until=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=minutes)).isoformat(timespec='seconds'),attempts=task['attempts']+1)
                self.save_task(task,token)
                self.event('CLAIMED',task['task_id'],owner=owner,attempt=task['attempts'],lease_until=task['lease_until'])
                claimed = dict(task, lease_token=token)
                break
        self.refresh()
        return claimed or {'claimed':False,'reason':'No eligible queued task; dependencies must be COMPLETE'}

    def owned_task(self, task_id, owner, token):
        row = self.db.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone()
        if row is None:
            raise ValueError('Unknown task')
        task = json.loads(row['body'])
        if task['status'] != 'RUNNING' or task.get('owner') != owner or not token or row['token'] != token or task['lease_until'] <= now():
            raise ValueError('Stale or invalid lease: claim again; this owner/token cannot write')
        return task

    def heartbeat(self, task_id, owner, token, minutes=45):
        if not 1 <= minutes <= 1440:
            raise ValueError('Lease minutes must be 1–1440')
        with self.transaction():
            task = self.owned_task(task_id,owner,token)
            task['lease_until'] = (dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=minutes)).isoformat(timespec='seconds')
            self.save_task(task,token)
            self.event('HEARTBEAT',task_id,owner=owner,lease_until=task['lease_until'])
        self.refresh()
        return task

    def finish(self, task_id, owner, token, status, result, next_action=None, evidence=None):
        if status not in TERMINAL or not result.strip():
            raise ValueError('Valid final status and nonempty result required')
        evidence_path = None
        if evidence:
            evidence_path = Path(evidence).expanduser()
            if not evidence_path.is_absolute():
                evidence_path = self.root / evidence_path
            evidence_path = evidence_path.resolve()
        if status in {'COMPLETE','NEEDS_REVIEW'} and (not evidence_path or not evidence_path.is_file() or evidence_path.stat().st_size == 0):
            raise ValueError('COMPLETE/NEEDS_REVIEW requires an existing nonempty evidence file')
        with self.transaction():
            task = self.owned_task(task_id,owner,token)
            task.update(status=status,result=result,next_action=next_action,completed_at=now() if status=='COMPLETE' else None,owner=None,lease_until=None)
            if evidence_path:
                task['result_evidence'] = {'path':str(evidence_path),'recorded_at':now(),'bytes':evidence_path.stat().st_size if evidence_path.exists() else None}
            if status == 'FAILED':
                fingerprint = hashlib.sha256(' '.join(result.split()).encode()).hexdigest()
                repeated = task.get('identical_failure_count',0)+1 if task.get('failure_fingerprint')==fingerprint else 1
                task.update(failure_fingerprint=fingerprint,identical_failure_count=repeated)
                task['status'] = 'BLOCKED' if task['attempts'] >= MAX_ATTEMPTS or repeated >= 2 else 'QUEUED'
                task['last_outcome'] = 'FAILED'
                if task['status'] == 'BLOCKED':
                    task['next_action'] = 'Bounded Sol review required: retry budget exhausted; no identical automatic retry. ' + (next_action or '')
            self.save_task(task)
            self.event('FINISHED',task_id,owner=owner,outcome=status,status=task['status'],result=result,evidence=str(evidence_path) if evidence_path else None)
        self.refresh()
        return task

    def snapshot_locked(self):
        meta = {r['key']:json.loads(r['value']) for r in self.db.execute('SELECT * FROM metadata')}
        return {'generated_at':now(),'sources_loaded_at':meta.get('sources_loaded_at'),'context':meta.get('context',{}),'products':[json.loads(r['body']) for r in self.db.execute('SELECT body FROM products ORDER BY id')],'tasks':self.get_tasks(),'recent_events':[dict(r,body=json.loads(r['body'])) for r in self.db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 12')],'recent_results':[dict(r,body=json.loads(r['body'])) for r in self.db.execute("SELECT * FROM events WHERE type='FINISHED' ORDER BY id DESC LIMIT 5")]}

    def refresh(self):
        # Hold the writer lock until all files are replaced, so an older export
        # cannot race after a newer export. Each individual file is atomic.
        with self.transaction():
            snapshot = self.snapshot_locked()
            snapshot['marketing'] = marketing_summary(snapshot['context'].get('marketing_db'), self.root)
            snapshot['cost_telemetry'] = telemetry.compact_snapshot(self.root) if telemetry else None
            atomic_write(self.root / 'PRODUCT_REGISTRY.json',json.dumps({'generated_at':snapshot['generated_at'],'source_loaded_at':snapshot['sources_loaded_at'],'products':snapshot['products']},indent=2,ensure_ascii=False,allow_nan=False)+'\n')
            atomic_write(self.root / 'TASK_QUEUE.json',json.dumps({'generated_at':snapshot['generated_at'],'tasks':snapshot['tasks']},indent=2,ensure_ascii=False,allow_nan=False)+'\n')
            atomic_write(self.root / 'COMPANY_STATE.md',render(snapshot))
        return snapshot

    def close(self):
        self.db.close()

def marketing_summary(path, root):
    result = {'observed_at':now(),'status':'unavailable','queue_statuses':{},'campaign_statuses':{},'outcomes':{}}
    if not path:
        result['reason'] = 'No marketing database configured'
        return result
    path = Path(path).expanduser()
    if not path.is_absolute():
        path = root / path
    if not path.is_file():
        result['reason'] = 'Configured marketing database not found'
        return result
    try:
        with contextlib.closing(sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True,timeout=2)) as connection:
            connection.execute('PRAGMA query_only=ON')
            tables = {r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for table, destination in [('tasks','queue_statuses'),('queue','queue_statuses'),('campaigns','campaign_statuses'),('outcomes','outcomes')]:
                if table not in tables:
                    continue
                columns = {r[1] for r in connection.execute(f'PRAGMA table_info("{table}")')}
                column = next((c for c in ('status','outcome','result_type','event_type') if c in columns),None)
                if column:
                    result[destination][table] = {str(r[0]):r[1] for r in connection.execute(f'SELECT "{column}",COUNT(*) FROM "{table}" GROUP BY "{column}"')}
            if 'outcomes' in tables:
                columns = {r[1] for r in connection.execute('PRAGMA table_info(outcomes)')}
                for column in ('impressions','clicks','replies','signups','conversions','engagement','cost'):
                    if column in columns:
                        aggregate = connection.execute(f'SELECT COUNT("{column}"), SUM("{column}") FROM outcomes').fetchone()
                        result['outcomes'][column] = {'recorded_values':aggregate[0], 'sum_of_recorded_values':aggregate[1], 'scope':'all recorded marketing outcomes; missing observations excluded'}
                if 'ts' in columns:
                    interval = connection.execute('SELECT MIN(ts),MAX(ts) FROM outcomes').fetchone()
                    result['outcome_period'] = {'earliest_record':interval[0],'latest_record':interval[1]}
            if 'campaigns' in tables:
                columns = {r[1] for r in connection.execute('PRAGMA table_info(campaigns)')}
                allowed = [column for column in ('campaign_id','name','product','status','goal','updated_at') if column in columns]
                if allowed:
                    cursor = connection.execute('SELECT '+','.join('"'+column+'"' for column in allowed)+' FROM campaigns LIMIT 100')
                    result['campaigns'] = [dict(zip(allowed,row)) for row in cursor]
            if 'model_calls' in tables:
                columns = {r[1] for r in connection.execute('PRAGMA table_info(model_calls)')}
                if {'model','ok','est_cost'} <= columns:
                    result['model_usage'] = [{'model':r[0],'calls':r[1],'successful_calls':r[2],'estimated_cost_recorded':r[3]} for r in connection.execute('SELECT model,COUNT(*),SUM(CASE WHEN ok=1 THEN 1 ELSE 0 END),SUM(est_cost) FROM model_calls GROUP BY model')]
            result['status'] = 'read_only_snapshot'
            result['scope'] = 'Marketing records only; not company visitor/download/signup metrics'
    except sqlite3.Error as error:
        result['reason'] = 'Marketing database unavailable: ' + type(error).__name__
    return result

def display(value):
    if value is None or value == '':
        return 'Unknown / not measured'
    if isinstance(value,(list,dict)):
        return dumps(value)
    return str(value).replace('\n',' ')

def render(snapshot):
    context, tasks, products = snapshot['context'],snapshot['tasks'],snapshot['products']
    by_id = {t['task_id']:t for t in tasks}
    eligible = eligible_tasks(tasks,products)
    active = [t for t in tasks if t['status']=='RUNNING']
    top = (active or eligible or [None])[0]
    def short(value,limit=220):
        text = display(value)
        return text if len(text)<=limit else text[:limit-1]+'…'
    health = context.get('health') or {}
    health_text = 'Unknown / not scored — evidence-backed health rubric not yet measured.'
    if health.get('score') is not None:
        health_text = f"{health['score']}/10; observed {short(health.get('observed_at'),40)}; coverage: {short(health.get('coverage'),100)}; rubric: {short(health.get('rubric'),100)}; source: {short(health.get('source'),150)}"
    lines = ['# '+short(context.get('company','Company'),100)+' — Current State','',f"Updated: {snapshot['generated_at']} | Seeds loaded: {display(snapshot['sources_loaded_at'])}",'','## COMPANY HEALTH',health_text,'','## GOALS',short(context.get('goals'),300),'','## TOP PRIORITY',f"{top['task_id']} — {short(top['title'],130)} (priority {display(top['priority'])}; estimate)" if top else 'No eligible task currently queued.','','## PRODUCTS',f'{len(products)} registered entries; inventory may be incomplete.']
    for key in ('maturity','kind'):
        counts = {}
        for product in products:
            value = str(product.get(key) or 'UNKNOWN')
            counts[value] = counts.get(value,0)+1
        lines.append(key.title()+': '+short(', '.join(f'{v} {k}' for k,v in sorted(counts.items())) or 'No entries',250))
    lines.extend(['','## THIS WEEK / KEY METRICS'])
    metrics = context.get('metrics') or {}
    unknown = []
    for name, observation in metrics.items():
        if not isinstance(observation,dict) or observation.get('value') is None:
            unknown.append(name)
            continue
        lines.append(f"- {name}: {short(observation.get('value'),35)}; period: {short(observation.get('period'),55)}; source: {short(observation.get('source'),65)}; observed: {short(observation.get('observed_at'),35)}")
    if unknown:
        lines.append('Unknown / not measured: '+short(', '.join(unknown),350)+'. Never interpreted as zero.')
        periods = sorted({str(v.get('period')) for v in metrics.values() if isinstance(v,dict) and v.get('value') is None and v.get('period')})
        lines.append('Unknown-metric reporting periods: '+(short(', '.join(periods),180) if periods else 'not provided')+'. Individual source details retained in context.')
    if not metrics:
        lines.append('Visitors, downloads, signups, beta testers: unknown; source/period unavailable.')
    lines.extend(['','## CURRENT WORK'])
    for task in active[:8]+eligible[:8]:
        lines.append(f"- {task['task_id']} {short(task['title'],85)} — {task['status']}; priority {display(task['priority'])} (estimate)")
    counts = {status:sum(t['status']==status for t in tasks) for status in sorted(STATUSES)}
    lines.append('Queue totals: '+', '.join(f'{status} {count}' for status,count in counts.items() if count))
    lines.append('Showing up to 8 running + 8 eligible queued; full details: TASK_QUEUE.json.')
    lines.extend(['','## BIGGEST BOTTLENECK',short(context.get('biggest_bottleneck'),350),'','## NEXT STRATEGIC MOVE',short(context.get('next_strategic_move'),350),'','## BLOCKERS'])
    for blocker in context.get('blockers',[])[:4]:
        lines.append('- '+short(blocker,180))
    gated = [t for t in tasks if t['status'] in {'BLOCKED','WAITING','NEEDS_REVIEW'}]
    if gated:
        lines.append(f'{len(gated)} tasks gated by review/validation/blockers; see TASK_QUEUE.json.')
    lines.extend(['','## RECENT RESULTS'])
    # Completions remain visible even after many unrelated metadata updates.
    results = snapshot.get('recent_results', [event for event in snapshot['recent_events'] if event['type']=='FINISHED'])[:5]
    for event in results:
        lines.append(f"- {event['at']} {event['task_id']} {event['body'].get('outcome')}: {short(event['body'].get('result'),130)}")
    if not results:
        lines.append('No task results recorded yet.')
    marketing = snapshot['marketing']
    lines.extend(['','## MARKETING SUMMARY',f"Read-only snapshot: {marketing['status']}; observed {marketing['observed_at']}."])
    if marketing.get('reason'):
        lines.append(short(marketing['reason']))
    lines.append('Queue statuses: '+short(marketing.get('queue_statuses'),250))
    lines.append('Campaign statuses: '+short(marketing.get('campaign_statuses'),200))
    outcomes = marketing.get('outcomes',{})
    lines.append('Recorded outcomes: '+short({k:v.get('sum_of_recorded_values') for k,v in outcomes.items() if isinstance(v,dict) and 'sum_of_recorded_values' in v},200))
    lines.append('Outcome period: '+short(marketing.get('outcome_period'),140))
    lines.append('Marketing counts are NOT company traffic metrics. Source: '+short(context.get('marketing_db'),150))
    cost = snapshot.get('cost_telemetry')
    if cost:
        lines.extend(['','## AI COST / GOVERNOR',
            'Observed: '+short(cost.get('observed_at'),40),
            'Today: '+short(cost.get('daily'),350),
            'Governor: '+short(cost.get('governor'),180),
            'Coverage gaps: '+short(cost.get('coverage_gaps'),350),
            'Details: data/cost-snapshot.json; list-price estimates are not billed spend.'])
    lines.extend(['','## SOURCES / RECOVERY','Authoritative: engine/company.sqlite3 (transactional audit history). Exports: PRODUCT_REGISTRY.json / TASK_QUEUE.json.','Health/quality/traffic unknown unless measured. Priority scores are estimates. Evidence files require reviewer verification.','Lease tokens omitted. Recover expired leases before selecting work. Context/product updates preserve history.',''])
    return '\n'.join(lines)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',default=str(Path(__file__).resolve().parent.parent))
    sub = parser.add_subparsers(dest='command',required=True)
    for name in ('init','refresh','status','recover'):
        sub.add_parser(name)
    for name in ('enqueue','revise','update-context','update-products'):
        command = sub.add_parser(name)
        command.add_argument('--file',required=True,help='JSON input object or product list')
        if name=='revise':
            command.add_argument('--reason',required=True,help='Validation/review reason, preserved in audit history')
    claim = sub.add_parser('claim')
    claim.add_argument('--owner',required=True)
    claim.add_argument('--id')
    claim.add_argument('--minutes',type=int,default=45)
    for name in ('heartbeat','finish'):
        command = sub.add_parser(name)
        command.add_argument('id')
        command.add_argument('--owner',required=True)
        command.add_argument('--token',required=True)
        if name == 'heartbeat':
            command.add_argument('--minutes',type=int,default=45)
        else:
            command.add_argument('--status',choices=sorted(TERMINAL),required=True)
            command.add_argument('--result',required=True)
            command.add_argument('--next-action')
            command.add_argument('--evidence')
    args = parser.parse_args(argv)
    engine = None
    try:
        engine = Engine(args.root)
        if args.command=='init':
            snapshot = engine.init()
            result = {'initialized':True,'products':len(snapshot['products']),'tasks':len(snapshot['tasks']),'generated_at':snapshot['generated_at']}
        elif args.command in ('refresh','status'):
            snapshot = engine.refresh()
            if args.command=='status':
                print(render(snapshot))
                return 0
            result = {'refreshed':True,'generated_at':snapshot['generated_at']}
        elif args.command=='recover':
            result = engine.recover()
        elif args.command=='enqueue':
            result = engine.enqueue(load_json(args.file))
        elif args.command=='revise':
            result = engine.revise(load_json(args.file),args.reason)
        elif args.command=='update-context':
            result = engine.update_context(load_json(args.file))
        elif args.command=='update-products':
            result = engine.update_products(load_json(args.file))
        elif args.command=='claim':
            result = engine.claim(args.owner,args.id,args.minutes)
        elif args.command=='heartbeat':
            result = engine.heartbeat(args.id,args.owner,args.token,args.minutes)
        else:
            result = engine.finish(args.id,args.owner,args.token,args.status,args.result,args.next_action,args.evidence)
        print(json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False))
        return 0
    except (ValueError,OSError,sqlite3.Error) as error:
        print('Error: '+str(error),file=sys.stderr)
        return 1
    finally:
        if engine:
            engine.close()

if __name__ == '__main__':
    sys.exit(main())
