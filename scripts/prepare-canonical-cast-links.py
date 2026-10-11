from pathlib import Path
import json,urllib.request,hashlib,concurrent.futures,time
import argparse
parser=argparse.ArgumentParser(description='Capture current immutable production and unify legacy Cast links.')
parser.add_argument('--output',type=Path,default=Path('reports/canonical-cast-20261011'))
args=parser.parse_args();r=args.output.resolve();r.mkdir(parents=True,exist_ok=True)
config=json.loads((Path.home()/'Library/Preferences/netlify/config.json').read_text());token=config['users'][config['userId']]['auth'];token=token.get('token') if isinstance(token,dict) else token
site='59ccf268-f99f-43ba-89b6-1117fa561e93'
def api(path):return json.load(urllib.request.urlopen(urllib.request.Request('https://api.netlify.com/api/v1'+path,headers={'Authorization':'Bearer '+token})))
meta=api('/sites/'+site);deploy=api('/deploys/'+meta['published_deploy']['id']);b={'site_id':site,'deploy':deploy,'files':api('/sites/'+site+'/files'),'functions':api('/sites/'+site+'/functions')}
if deploy.get('function_schedules'):raise SystemExit('Site has scheduled jobs; use a schedule-preserving deployment helper.')
(r/'company-baseline.json').write_text(json.dumps(b,indent=2))
root=r/'company-current';replace={};skipped=[]
def work(f):
 p=f['path']
 for attempt in range(3):
  try:d=urllib.request.urlopen(b['deploy']['deploy_ssl_url']+p,timeout=30).read();break
  except Exception as e:
   if attempt==2:return('skip',p,str(e))
   time.sleep(1)
 if hashlib.sha1(d).hexdigest()!=f['sha']:return('skip',p,'served bytes differ from immutable file manifest')
 s=d.decode();count=s.count('https://form-studio-review.netlify.app/studio')
 if count:
  target=root/p.lstrip('/');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(s.replace('https://form-studio-review.netlify.app/studio','https://form.thecreatingco.com/studio'));return('change',p,str(target))
 return('unchanged',p,None)
files=[x for x in b['files'] if x['path'].endswith(('.html','.json','.js')) and (x['path'].endswith('.html') or not x['path'].startswith(('/apps/','/assets/'))) and not x['path'].startswith('/.netlify/')]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for typ,p,value in pool.map(work,files):
  if typ=='change':replace[p]=value
  elif typ=='skip':skipped.append({'path':p,'reason':value})
plan={'site_id':b['site_id'],'expected_previous':b['deploy']['id'],'title':'Unify Cast links with published Form Studio across company catalogue','replace':replace,'functions':{},'preserve_function_config':True,'publish_blockers':[]};(r/'company-plan.json').write_text(json.dumps(plan,indent=2));(r/'company-link-scan.json').write_text(json.dumps({'examined':len(files),'changed':list(replace),'unavailable':skipped},indent=2));print('changed',len(replace),'unavailable',skipped)
