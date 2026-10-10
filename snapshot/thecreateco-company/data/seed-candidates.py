"""Initial decision estimates; hypotheses are not measured business outcomes."""
import json
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parent
base=Path('/Users/agentsattari')
sources={'product':'code/wave5/WAVE5.md','website_growth':'code/wave2/thecreatingco-live/maintenance/AGENTS.md','marketing':'thecreateco-marketing/STATE.md','operations':'thecreateco-marketing/engine/README.md','idea':'thecreateco-marketing/research/brand-expansion-2026-10-06.md'}
groups={
'product':[
('Reconcile Luma production with a reproducible source baseline','luma','Verify current deployment, preserve its full manifest and map source before preparing any release; do not automatically roll back.',10,9,9,4,3),
('Recheck Librarian reader 404 and prepare a source-level repair','librarian','Reproduce the reported reader failure; inspect function dependencies without exposing secrets; test a fix locally.',9,9,8,4,2),
('Verify Animate save/export recovery and assess undo','animate','Test loss scenarios and current undo/redo implementation; improve only reproduced gaps.',9,9,7,4,2),
('Qualify Locker cross-app open/save failure behavior','locker','Test valid, cancelled and failed handoffs without losing edits; capture a compatibility matrix.',9,9,7,4,2),
('Qualify Reclaim native restore and deletion safeguards','reclaim','Use disposable fixtures to verify preview, reversible removal and restore; do not touch real user files.',10,10,6,5,3),
('Verify Form review-versus-canonical feature parity','form','Document Cast/Room and canonical release differences; do not publish to a mismatched host.',8,8,8,3,2),
('Qualify ScenePilot Board to AutoCut workflow','scenepilot','Use a disposable project through save, handoff and export; report exact failure boundaries.',8,9,7,4,2),
('Test Glyph generated fonts and Brand Kit exports','glyph-studio','Validate real outputs, licensing metadata and reopen behavior; separate standalone and embedded Glyph.',8,8,7,3,2),
('Reconcile Moodboard and Portfolio implementation state','portfolio','Inspect new checkouts and outstanding work, then test import/save/export before assigning release maturity.',7,8,6,3,2),
('Audit offline update and cache recovery across non-music apps','suite','Use disposable browser profiles; verify update safety and unsaved-work preservation, not just installability.',9,9,6,5,3)],
'website_growth':[
('Reconcile hub launch registry with actually available products','hub','Compare published destinations against apps.json; include Animate only with live evidence and honest alpha status.',8,8,8,2,1),
('Retrieve verified aggregate analytics and define a weekly funnel baseline','hub','Use existing Netlify Analytics/Forms access if available; record visitor, signup and activation definitions, intervals and unavailable fields.',9,9,8,3,1),
('Audit the first-project journey for the strongest existing product','hub','Choose using available evidence, then observe visit → launch → first saved result; do not invent drop-off rates.',9,9,7,4,1),
('Prepare product-versus-module comparison and selection guide','hub','Test whether visitors can select the right tool; reuse current directory and avoid duplicating pages.',8,8,6,3,1),
('Verify hub forms, consent and success/error paths','hub','Inspect form configuration and use non-sending validation; production submissions require explicit test authorization.',9,9,7,3,2),
('Refresh factual product and release claims','hub','Reconcile marketing PRODUCTS with newer Reclaim download/analytics evidence before changing public claims.',9,8,9,2,1),
('Audit mobile keyboard navigation and first-action accessibility','hub','Measure existing pages at phone widths and keyboard-only flows; fix demonstrated defects.',8,8,7,4,1),
('Measure critical-page performance before optimization','hub','Capture baseline load/layout metrics on home, directory and one product page; optimize largest measured issue.',7,8,7,3,1),
('Check canonical links, sitemap and structured metadata for current releases','hub','Verify current live evidence; old sitemap issues may already be fixed, so avoid blindly reapplying them.',7,7,6,2,1),
('Verify first-use help and export-limit clarity','hub','Compare product-page instructions with current UI; document actual limits and usable recovery guidance.',8,8,7,3,1)],
'marketing':[
('Draft evidence-led Reclaim native-alpha demonstration','reclaim','Verify current download/release first; draft before/after workflow and restore caveat, not a release announcement.',8,8,7,3,1),
('Draft a single-project suite workflow story','suite','Use a real saved/exported project; identify capture gaps explicitly, no fictional results.',8,8,7,3,1),
('Turn verified Glyph outputs into a useful tutorial','glyph-studio','Show an actual validated font/export workflow and one concrete creator use case.',7,8,8,2,1),
('Review existing outreach outcomes before drafting more','company','Summarize opt-outs, replies and qualified interest in aggregate; no new sends in this task.',8,8,8,2,1),
('Prepare focused beta-testing invitations','company','Select one reproducible workflow and ask for specific feedback; use existing CRM and consent rules, draft only.',8,8,7,3,1),
('Research useful comparison-page opportunities','company','Compare verified capabilities and limitations, not invented competitor weaknesses or SEO volume.',7,7,5,3,1),
('Repurpose one verified fix into a development story','company','Require before/after evidence and a user benefit; avoid generic activity announcements.',7,7,7,2,1),
('Refresh community opportunity research and current rules','company','Recheck threads and rules before drafting; no posting or pretending to be an unaffiliated customer.',7,7,5,3,1),
('Design three first-result messaging experiments','company','Define audience, hypothesis, CTA and success measure; do not run until measurement and publishing authorization exist.',8,8,6,3,1),
('Audit free-pack usefulness and product handoff','company','Validate real pack files, licenses and import instructions; improve demonstrated friction before promotion.',7,8,7,3,1)],
'operations':[
('Install company source-of-truth and recoverable queue','company','Validate transactional claims, recovery, evidence gates and generated state; retain existing growth engine.',10,9,10,3,1),
('Inventory release provenance and unresolved source/deploy drift','company','Record source, deployment and rollback evidence for critical products; no deployment changes.',10,9,9,3,2),
('Connect company director to growth and bounded scheduling','company','Use one director loop, preserve CRM/delivery boundaries, update company state after growth batches, verify schedule.',9,8,9,3,1),
('Define shared feedback categories and product-quality rubric','company','Use BUG/UX/FEATURE/CONFUSION/PERFORMANCE/PRICING/DOCUMENTATION/PRAISE/MISSING_FEATURE; evidence before scores.',8,8,8,2,1),
('Establish recurring outcomes, model-cost and portfolio reviews','company','Weekly CEO and monthly portfolio reviews; use actual calls/cost estimates and product evidence, not task counts as success.',8,8,8,3,1)],
'idea':[
('Validate a release-provenance checker for small creative teams','company','Hypothesis: small teams lose source/deploy traceability; test existing tools and interviews before building.',8,8,4,4,2),
('Validate a project-rescue and portable-backup assistant','suite','Hypothesis: creators need dependable browser-project backups; first assess whether Locker already solves this.',9,9,4,5,3),
('Validate an export-readiness preflight inside existing editors','suite','Hypothesis: creators struggle to know whether deliverables satisfy destination specs; prefer a feature over another app.',8,8,4,4,2),
('Validate accessible portfolio checks inside Portfolio','portfolio','Hypothesis: independent creators need contrast/alt-text/keyboard checks; evaluate existing accessibility tools.',7,8,3,4,2),
('Validate a local asset-license and attribution companion','locker','Hypothesis: mixed creative assets lose license provenance; research workflows and legal boundaries first.',8,8,3,5,3),
('Validate a scene-to-delivery checklist for short filmmakers','scenepilot','Hypothesis: export/caption/aspect checks are repetitive; examine existing ScenePilot features before a prototype.',7,8,4,3,2),
('Validate feedback-to-revision annotations inside Moodboard','moodboard','Hypothesis: visual feedback becomes disconnected from revisions; research alternatives and avoid redundant collaboration tooling.',7,8,3,5,3),
('Validate brand-consistency checks as a Brand Kit extension','glyph-studio','Hypothesis: creators want to check type/color consistency in exports; compare existing Brand Kit scope first.',7,7,4,4,2),
('Validate a cross-app learning project rather than a new editor','suite','Hypothesis: one guided deliverable improves first use; validate with small usability sessions before coding.',8,9,5,3,1),
('Validate a privacy-first creator feedback inbox','company','Hypothesis: small teams need structured useful feedback without collecting excess personal data; compare existing forms first.',7,8,3,4,3)]}
items=[]
for category,rows in groups.items():
 for i,(title,product,action,impact,value,confidence,effort,risk) in enumerate(rows,1):
  prefix={'product':'P','website_growth':'W','marketing':'M','operations':'O','idea':'I'}[category]
  task={'task_id':f'{prefix}{i:02d}','title':title,'category':category,'workstream':{'product':'ENGINEERING','website_growth':'PRODUCT','marketing':'GROWTH','operations':'OPERATIONS','idea':'RESEARCH'}[category], 'product':product,'campaign':None,'status':'WAITING' if category=='idea' else 'QUEUED','model':'gpt-6-luna' if category in ['marketing','idea'] else 'gpt-6.1-sol','dependencies':[], 'scores':{'impact':impact,'user_value':value,'strategic_value':impact,'urgency':8 if prefix=='O' or i<3 else 5,'confidence':confidence,'effort':effort,'risk':risk},'expected_value':action,'next_action':action,'evidence_sources':[str(base/sources[category])], 'score_basis':'Provisional director estimate; evidence-backed opportunity, not measured ROI. Recheck before execution.','result':None}
  if category=='idea':
   task['validation_gate']='WAITING for problem/demand evidence and explicit prototype decision; do not auto-build.'
   task['opportunity_scores']={k:None for k in ['user_pain','market_demand','differentiation','build_feasibility','company_fit','shared_technology','monetization_potential','organic_growth_potential','competition_opportunity','wow_factor']}
   task['opportunity_scores'].update(user_pain=value,build_feasibility=10-effort,company_fit=8,shared_technology=7)
   task['opportunity_score_basis']='Only inferred fit/feasibility/pain estimated; market/commercial scores unknown pending research.'
   task['estimates']={'development_effort':effort,'maintenance_burden':None,'distribution_difficulty':None,'risk':risk}
  task['product'] = {'hub':'company-site','glyph-studio':'glyph','company':None,'suite':None}.get(task['product'],task['product'])
  task['dependencies'] = {'O03': ['O01'], 'O04': ['O01'], 'O05': ['O03'], 'W04': ['W01'], 'M01': ['W06'], 'M02': ['P04', 'P07'], 'M03': ['P08'], 'M09': ['W02'], 'W10': ['W06']}.get(task['task_id'],[])
  items.append(task)
(root/'candidates.json').write_text(json.dumps(items,indent=2)+'\n')
context={'company':'thecreateco','goals':['Improve usefulness, reliability, retention and sustainable adoption','Focus on existing products before expanding the portfolio','Make decisions from dated evidence, not activity or vanity metrics'], 'metrics':{k:{'value':None,'source':None,'period':None,'status':'UNMEASURED — access/definitions not yet verified'} for k in ['visitors','downloads','signups','beta_testers','active_users','retention','revenue','operating_cost']},'biggest_bottleneck':'Insufficient current source/release and funnel evidence to reliably choose and measure improvements; Luma provenance drift is documented, current state needs recheck. This is an operational assessment, not a measured conversion diagnosis.', 'next_strategic_move':'Verify critical release baselines and actual analytics access, then fix the highest-impact demonstrated product/onboarding gap before expanding acquisition or building more apps.', 'blockers':['Luma documented production/source mismatch needs current verification; no automatic rollback.','Marketing claims/catalog lag newer app work; current live evidence is required.','Netlify Web Analytics is documented enabled, but company KPI values have not been retrieved or validated.','Wave 5 excludes music/Sattari/StemDeck changes; preserve that hold pending a specific superseding instruction.'], 'marketing_db':str(base/'thecreateco-marketing/engine/data/mktg.db'),'evidence_sources':[str(base/'code/wave5/WAVE5.md'),str(base/'code/wave2/thecreatingco-live/privacy/index.html')], 'observed_at':datetime.now(timezone.utc).isoformat(),'health':{'score':None,'reason':'No evidence-complete quality/funnel baseline yet.'}}
(root/'context.json').write_text(json.dumps(context,indent=2)+'\n')
(root/'experiment-template.json').write_text(json.dumps({k:None for k in ['experiment_id','hypothesis','audience','channel','message','cta','cost','success_metric','baseline','start_date','end_date','result','learning','next_action','evidence','publication_authorization']},indent=2)+'\n')
print('Wrote',len(items),'scored candidates; ideas held for validation; metrics unknown.')
