const form=document.querySelector('#audit-form');
const input=document.querySelector('#site-url');
const button=document.querySelector('#audit-button');
const status=document.querySelector('#status');
const results=document.querySelector('#results');
let lastReport=null;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};

form.addEventListener('submit',async event=>{
  event.preventDefault();results.hidden=true;status.hidden=false;status.className='status loading';status.replaceChildren(el('span','spinner'),el('span','', 'Checking the public page, links and the checks supported by this deployment…'));
  button.disabled=true;button.querySelector('span').textContent='Checking…';
  try {
    const response=await fetch('/api/audit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:input.value.trim()})});
    const report=await response.json();if(!response.ok)throw new Error(report.error??'The check could not be completed.');
    lastReport=report;render(report);status.hidden=true;results.hidden=false;results.scrollIntoView({behavior:'smooth',block:'start'});
  } catch(error) { status.className='status error';status.replaceChildren(el('strong','', 'Couldn’t complete that check. '),document.createTextNode(error.message)); }
  finally {button.disabled=false;button.querySelector('span').textContent='Check my website';}
});

function render(report){
  document.querySelector('#result-url').textContent=report.finalUrl??report.url;
  const meta=report.homepage??{};
  document.querySelector('#snapshot-title').textContent=meta.title||'No page title found';
  document.querySelector('#snapshot-description').textContent=meta.description||'No meta description was present in the response HTML.';
  document.querySelector('#finding-count').textContent=`${report.summary.total} found`;
  const cells=[['TOTAL',report.summary.total],['HIGH PRIORITY',report.summary.high],['LINKS CHECKED',report.coverage.linksChecked],['FORMS FOUND',meta.forms?.length??0],['HTML RESPONSE',report.performance.initialHtmlResponseMs===null?'—':`${report.performance.initialHtmlResponseMs} ms`]];
  const grid=document.querySelector('#summary-grid');grid.replaceChildren(...cells.map(([label,value])=>{const box=el('div','summary-cell');box.append(el('strong','',value),el('span','',label));return box;}));
  const details=[['HTTP status',report.httpStatus??'Not reached'],['Language',meta.lang??'Not declared'],['Viewport',meta.viewport?'Declared':'Missing'],['Canonical',meta.canonical??'Not declared'],['Headings',meta.headingOutline?.length??0],['Browser QA',report.browser?.status==='checked'?'Static checks run':'Not run']];
  const dl=document.querySelector('#snapshot-details');dl.replaceChildren(...details.map(([k,v])=>{const row=el('div');row.append(el('dt','',k),el('dd','',v));return row;}));
  const cover=[`One public HTML page; ${report.coverage.linksChecked} of up to ${report.coverage.linkLimit} page links checked.`,`Forms found: ${meta.forms?.length??0}; none submitted.`,`Site files changed: ${report.coverage.siteFilesChanged}.`,report.performance.scope,report.browser?.responsive?.scope??report.browser?.reason??'Responsive layout was not verified.',report.browser?.accessibility?.scope??'Accessibility browser checks were not verified.','Authenticated, JavaScript-driven and deployment checks are not included.'];
  document.querySelector('#coverage-list').replaceChildren(...cover.map(t=>el('li','',t)));
  const host=document.querySelector('#findings');host.replaceChildren();
  if(!report.findings.length)host.append(el('div','finding empty','No issues were detected in the checks that ran. This is not a launch certification; review the coverage boundaries below.'));
  for(const item of report.findings){const card=el('article','finding');const top=el('div','finding-top');top.append(el('h4','',item.title),el('span',`severity ${item.severity}`,item.severity));card.append(top,el('p','',item.evidence),el('p','fix',`Suggested next step: ${item.fix}`));if(item.url)card.append(el('p','source',item.url));host.append(card);}
  document.querySelector('#scan-time').textContent=`Checked ${new Date(report.finishedAt).toLocaleString()} · Download is a local JSON report.`;
}

document.querySelector('#new-check').addEventListener('click',()=>{results.hidden=true;status.hidden=true;input.focus();window.scrollTo({top:0,behavior:'smooth'});});
document.querySelector('#download-report').addEventListener('click',()=>{if(!lastReport)return;const file=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=`weblab-report-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
