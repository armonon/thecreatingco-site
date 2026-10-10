import { parse } from 'parse5';
import { chromium } from 'playwright-core';
import { safeGet, validatePublicUrl, LIMITS } from './safe-fetch.mjs';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const MAX_LINKS = 24;
const MAX_CSS = 6;
const MAX_ISSUES = 100;
const MAX_DOM_NODES = 50_000;
const issue = (category, severity, title, evidence, fix, url = null) => ({ category, severity, title, evidence, fix, url });
const attrs = node => Object.fromEntries((node.attrs ?? []).map(a => [a.name.toLowerCase(), a.value]));
function flatten(root){const out=[],stack=[...(root.childNodes??[])].reverse();let truncated=false;while(stack.length){const node=stack.pop();if(out.length>=MAX_DOM_NODES){truncated=true;break;}out.push(node);const child=node.childNodes??[];for(let i=child.length-1;i>=0;i--)stack.push(child[i]);}return{nodes:out,truncated};}
function textContent(root){const parts=[],stack=[root];let chars=0;while(stack.length&&chars<20_000){const node=stack.pop();if(node.nodeName==='#text'){const value=node.value??'';parts.push(value.slice(0,20_000-chars));chars+=value.length;continue;}const child=node.childNodes??[];for(let i=child.length-1;i>=0;i--)stack.push(child[i]);}return parts.join('');}
const norm = s => (s ?? '').replace(/\s+/g, ' ').trim();
const abs = (href, base) => { try { const u = new URL(href, base); return ['http:','https:'].includes(u.protocol) ? u : null; } catch { return null; } };
const safeDisplayUrl = value => { try { const u=new URL(value);u.search='';u.hash='';u.username='';u.password='';return u.href; } catch { return null; } };

function add(list, ...args) { if (list.length < MAX_ISSUES) list.push(issue(...args)); else list.dropped=(list.dropped??0)+1; }

function inspectDocument(html, pageUrl, findings) {
  const visiblePageUrl=safeDisplayUrl(pageUrl)??pageUrl;
  const doc = parse(html);
  const {nodes:all,truncated} = flatten(doc);
  if(truncated)add(findings,'Coverage','info','Page structure exceeds the detailed-inspection limit.','WebLab inspected the first 50,000 DOM nodes only.','Simplify the page or run a targeted source-level audit; findings may omit later content.',pageUrl);
  const byName = name => all.filter(n => n.tagName === name);
  const declaredBase=byName('base').map(attrs).find(a=>a.href);
  const documentBase=declaredBase?abs(declaredBase.href,pageUrl)?.href??pageUrl:pageUrl;
  const metas = byName('meta').map(attrs);
  const links = byName('link').map(attrs);
  const title = norm(textContent(byName('title')[0] ?? {}));
  const description = metas.find(m => (m.name ?? '').toLowerCase() === 'description')?.content?.trim() ?? '';
  const viewport = metas.some(m => (m.name ?? '').toLowerCase() === 'viewport');
  const lang = attrs(byName('html')[0] ?? {}).lang;
  const canonical = links.find(l => (l.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))?.href;
  const h1s = byName('h1');
  const headings = all.filter(n => /^h[1-6]$/.test(n.tagName ?? '')).map(n => ({ level: Number(n.tagName[1]), text: norm(textContent(n)).slice(0,160) }));

  if (!title) add(findings,'SEO','high','Page has no title element.',`${visiblePageUrl} response HTML contains no non-empty <title>.`,'Add one unique, descriptive title that reflects this page’s purpose.',pageUrl);
  else if (title.length < 15 || title.length > 65) add(findings,'SEO','low','Title length may need review.',`Title is ${title.length} characters: “${title.slice(0,120)}”.`,'Review whether the title clearly identifies this page; length alone does not determine ranking.',pageUrl);
  if (!description) add(findings,'SEO','medium','Meta description is missing.',`${visiblePageUrl} has no description meta tag.`,'Write a distinct, accurate summary for this page.',pageUrl);
  else if (description.length > 170) add(findings,'SEO','low','Meta description is long.',`Description is ${description.length} characters.`,'Check how the description appears in search previews; there is no universal ranking length limit.');
  if (!viewport) add(findings,'Responsive','high','Viewport metadata is missing.','No <meta name="viewport"> was found in the response HTML.','Add a responsive viewport declaration and verify at real device widths.',pageUrl);
  if (!lang) add(findings,'Accessibility','medium','Document language is not declared.','The <html> element has no lang attribute.','Declare the primary content language on the root html element.',pageUrl);
  if (h1s.length === 0) add(findings,'SEO','medium','No main heading was found.','Response HTML contains no <h1>.','Add a visible page-level heading that describes the main content.',pageUrl);
  if (h1s.length > 1) add(findings,'SEO','low','Multiple main headings found.',`${h1s.length} <h1> elements were found.`,'Review the heading outline; multiple H1 elements can be valid HTML, so confirm the hierarchy is intentional.',pageUrl);
  if (!canonical) add(findings,'Metadata','low','Canonical URL is not declared.','No rel=canonical link was found.','If this page has duplicate or parameterized versions, set a canonical URL; otherwise this may be intentional.',pageUrl);
  const social = ['og:title','og:description','og:image'].filter(key => !metas.some(m => (m.property ?? '').toLowerCase() === key));
  if (social.length) add(findings,'Metadata','low','Social sharing metadata is incomplete.',`Missing ${social.join(', ')}.`,'Add accurate Open Graph metadata so shared links have a useful title, summary and preview image.',pageUrl);

  const imgs = byName('img');
  for (const img of imgs) if (!Object.hasOwn(attrs(img),'alt')) add(findings,'Accessibility','medium','Image has no text alternative.',`Image source: ${safeDisplayUrl(abs(attrs(img).src??'',pageUrl)?.href??'')??'(no src)'}.`,'Provide meaningful alt text, or alt="" when the image is decorative.',pageUrl);
  for (const el of all.filter(n => ['input','select','textarea'].includes(n.tagName))) {
    const a = attrs(el); if (a.type === 'hidden' || a.type === 'submit' || a.type === 'button') continue;
    const id = a.id;
    let ancestor=el.parentNode,nestedLabel=false,depth=0;while(ancestor&&depth++<256){if(ancestor.tagName==='label'){nestedLabel=true;break;}ancestor=ancestor.parentNode;}
    const hasLabel = (id && all.some(n => n.tagName === 'label' && attrs(n).for === id)) || nestedLabel || !!a['aria-label'] || !!a['aria-labelledby'];
    if (!hasLabel) add(findings,'Forms','medium','Form control has no accessible label.',`${el.tagName}${a.type ? ` type=${a.type}` : ''}${id ? ` id=${id}` : ''}.`,'Add a visible associated label, or a concise aria-label where a visible label is not appropriate.',pageUrl);
    if (a.type === 'password' && new URL(pageUrl).protocol !== 'https:') add(findings,'Security','high','Password form is served over HTTP.',`${pageUrl} is not HTTPS.`,'Serve sign-in and password forms only over HTTPS.',pageUrl);
  }
  const foundLinks = [];
  for (const node of byName('a')) {
    const a = attrs(node); if (!a.href) continue;
    const target = abs(a.href, documentBase); if (!target) continue;
    const name = norm(textContent(node)) || a['aria-label'] || a.title || '';
    if (!name) add(findings,'Accessibility','medium','Link has no accessible name.',`Link points to ${safeDisplayUrl(target.href)}.`,'Add descriptive visible text or an accessible label.',pageUrl);
    if (a.target === '_blank' && !/\bnoopener\b/.test(a.rel ?? '')) add(findings,'Security','low','New-tab link lacks noopener.',`Link points to ${safeDisplayUrl(target.href)}.`,'Add rel="noopener" (usually with noreferrer) for target=_blank links.',pageUrl);
    foundLinks.push({ href: target.href, displayHref:safeDisplayUrl(target.href), internal: target.hostname === new URL(pageUrl).hostname, source: pageUrl, text: name.slice(0,100) });
  }
  const formData = byName('form').map(form => {
    const a = attrs(form); const fields = flatten(form).nodes.filter(n => ['input','select','textarea','button'].includes(n.tagName)).map(n => { const x=attrs(n);return {tag:n.tagName,type:x.type ?? n.tagName,name:x.name ?? '',label:(x['aria-label'] ?? x.placeholder ?? '').slice(0,80)}; });
    const action = a.action ? (abs(a.action,documentBase)?.href ?? '') : documentBase;
    return { method:(a.method ?? 'get').toUpperCase(), action:safeDisplayUrl(action), fields };
  });
  if (byName('form').length) add(findings,'Forms','info','Forms found; WebLab did not submit them.',`${byName('form').length} form(s) inspected structurally; submission, validation and success/error flows were not exercised.`,'Use the dedicated form-flow check in a safe staging environment; never submit a production form as part of this scan.',pageUrl);

  return { title, titleLength:title.length, description, descriptionLength:description.length, canonical:canonical ? safeDisplayUrl(abs(canonical,documentBase)?.href??'') : null, documentBase:safeDisplayUrl(documentBase), viewport, lang:lang ?? null, headingOutline:headings.slice(0,30), images:imgs.length, links:foundLinks, forms:formData };
}

function pageCssLinks(html, pageUrl) {
  const doc=parse(html), all=flatten(doc).nodes,base=all.find(n=>n.tagName==='base'&&attrs(n).href),documentBase=base?abs(attrs(base).href,pageUrl)?.href??pageUrl:pageUrl;return all.filter(n=>n.tagName==='link').map(attrs).filter(a=>(a.rel??'').toLowerCase().split(/\s+/).includes('stylesheet')&&a.href).map(a=>abs(a.href,documentBase)?.href).filter(Boolean);
}

// Rebuild only inert, semantic HTML for axe/layout checks. Never pass the
// remote document to a browser parser: even a well-intended regex sanitizer
// can miss HTML's error-recovery and foreign-content parsing rules.
const SAFE_TAGS = new Set(('html body main header footer nav section article aside div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote pre code strong em b i small mark s sub sup br hr figure figcaption picture source img a button form fieldset legend label input select option optgroup textarea output progress meter table caption thead tbody tfoot tr th td colgroup col details summary time address').split(' '));
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const SAFE_ATTRS = new Set(('id class role title lang dir hidden tabindex name type value placeholder required disabled readonly multiple checked selected minlength maxlength min max step autocomplete for form aria-label aria-labelledby aria-describedby aria-hidden aria-expanded aria-controls aria-current aria-live aria-atomic alt width height colspan rowspan scope headers open datetime').split(' '));
function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function serializeInert(node) {
  if(node.nodeName==='#text') return escapeHtml(node.value??'');
  if(!node.tagName) return (node.childNodes??[]).map(serializeInert).join('');
  const tag=node.tagName.toLowerCase();
  if(['script','style','iframe','object','embed','svg','math','template','noscript'].includes(tag)) return '';
  const children=(node.childNodes??[]).map(serializeInert).join('');
  if(!SAFE_TAGS.has(tag)) return children;
  const safe=(node.attrs??[]).filter(a=>SAFE_ATTRS.has(a.name.toLowerCase())||a.name.toLowerCase().startsWith('aria-')||a.name.toLowerCase().startsWith('data-'))
    .filter(a=>!a.name.toLowerCase().startsWith('on'))
    .map(a=>` ${a.name.toLowerCase()}="${escapeHtml(a.value)}"`).join('');
  return VOID_TAGS.has(tag)?`<${tag}${safe}>`:`<${tag}${safe}>${children}</${tag}>`;
}
function inertBody(html) {
  const doc=parse(html),nodes=flatten(doc).nodes,body=nodes.find(n=>n.tagName==='body'),root=nodes.find(n=>n.tagName==='html'),titleNode=nodes.find(n=>n.tagName==='title');
  return {body:body?serializeInert(body):serializeInert(doc),lang:attrs(root??{}).lang??'',title:norm(textContent(titleNode??{}))};
}

async function browserChecks(html, styles, timeoutMs = 15000) {
  const executablePath = process.env.WEBLAB_CHROMIUM_PATH;
  const browser = await chromium.launch({ headless:true, ...(executablePath ? { executablePath } : {}), args:['--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check'] });
  try {
    const page=await browser.newPage({ viewport:{width:1440,height:900}, serviceWorkers:'block' });
    await page.route('**/*', route => route.request().url()==='about:blank' ? route.continue() : route.abort('blockedbyclient'));
    const nonce=randomBytes(24).toString('base64');
    const csp=`default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'nonce-${nonce}'`;
    const cssText=styles.map(s=>`<style>${s.replace(/<\/style/gi,'<\\/style').replace(/@import\s+[^;]+;?/gi,'').replace(/url\((?!\s*["']?#)[^)]*\)/gi,'none')}</style>`).join('');
    const inert=inertBody(html);
    const safeHtml=`<!doctype html><html${inert.lang?` lang="${escapeHtml(inert.lang)}"`:''}><head><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escapeHtml(inert.title)}</title>${cssText}</head>${inert.body}</html>`;
    await page.setContent(safeHtml, { waitUntil:'domcontentloaded', timeout:timeoutMs });
    const executionProbe=await page.evaluate(()=>window.WEBLAB_POC??null);
    const axeSource=await readFile(new URL('../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
    await page.evaluate(({nonce,source})=>{const script=document.createElement('script');script.nonce=nonce;script.textContent=source;document.head.append(script);},{nonce,source:axeSource});
    const accessibility=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}});return{violations:r.violations.slice(0,30).map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.slice(0,5).map(n=>({target:n.target.slice(0,5),summary:n.failureSummary?.slice(0,500)}))})),passes:r.passes.length,incomplete:r.incomplete.length,engine:'axe-core',scope:'Static response HTML in isolated browser; page scripts removed; not an authenticated or interaction audit.'};});
    const layouts=[];
    for(const width of [320,375,768,1024,1440]) { await page.setViewportSize({width,height:900});layouts.push(await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1}))); }
    return { accessibility, responsive:{viewports:layouts,scope:'Static response HTML/CSS only; JavaScript-driven layout and interactive navigation were not executed.'},security:{remoteScriptsExecuted:false,executionProbe,construction:'Remote markup was parsed and reconstructed from an inert semantic allowlist; scripts, event handlers, SVG, embedded content and URL-bearing attributes were omitted. A per-scan CSP nonce permits only the local axe engine.'} };
  } finally { await browser.close(); }
}

async function mapLimit(items, limit, mapper) {
  const result=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;try{result[i]=await mapper(items[i],i)}catch(error){result[i]={error:error.message}}}}));return result;
}

export async function auditWebsite(input,{fetcher=safeGet, clock=()=>new Date(), timeoutMs=15000,requestTimeoutMs=LIMITS.timeoutMs,linkTimeoutMs=4000,linkConcurrency=4,maxLinkChecks=MAX_LINKS,cssTimeoutMs=4000,cssConcurrency=3,maxStylesheets=MAX_CSS,browserChecksEnabled=true}={}) {
  const started=clock().toISOString();const initial=validatePublicUrl(input);const normalized=initial.href;
  const findings=[];let main;
  try { main=await fetcher(normalized,{timeoutMs:requestTimeoutMs}); }
  catch(error){return{url:safeDisplayUrl(normalized),startedAt:started,finishedAt:clock().toISOString(),status:'failed',error:error.message,findings:[issue('Reliability','high','Website could not be fetched.',error.message,'Check the public URL, DNS, TLS certificate and whether the site is currently available.',safeDisplayUrl(normalized))]};}
  const contentType=main.headers?.['content-type'] ?? main.headers?.get?.('content-type') ?? '';
  if(main.status<200||main.status>=400) add(findings,'Reliability','high',`Homepage returned HTTP ${main.status}.`,`Checked final URL ${main.url ?? normalized}.`,'Confirm the homepage route and hosting response; WebLab does not change the site.',main.url ?? normalized);
  if(contentType && !contentType.toLowerCase().includes('text/html')) add(findings,'Reliability','high','The URL did not return an HTML page.',`Content-Type: ${contentType}.`,'Enter the address of a web page, not a file or API endpoint.',main.url ?? normalized);
  const html=main.body.toString('utf8');const finalUrl=main.url ?? normalized;
  const homepage=inspectDocument(html,finalUrl,findings);
  const urls=[...new Set(homepage.links.map(l=>l.href))].slice(0,maxLinkChecks);
  if(new Set(homepage.links.map(l=>l.href)).size>maxLinkChecks)add(findings,'Coverage','info','Some page links were not checked.',`Found more than ${maxLinkChecks} distinct links; this runtime checks at most ${maxLinkChecks}.`,'Treat broken-link results as a sample, not a complete crawl.',finalUrl);
  const broken=await mapLimit(urls,linkConcurrency,async href=>{
    try { const r=await fetcher(href,{maxBytes:128*1024,timeoutMs:linkTimeoutMs});return{url:r.url??href,status:r.status,internal:new URL(href).hostname===new URL(finalUrl).hostname}; }
    catch(error){return{url:href,status:null,error:error.message,internal:new URL(href).hostname===new URL(finalUrl).hostname};}
  });
  for(const result of broken) if(result.error||result.status>=400) add(findings,'Links','medium',result.error?'Link could not be checked.':`Link returned HTTP ${result.status}.`,result.error??`${safeDisplayUrl(result.url)} responded ${result.status}.`,'Review the destination, update the link, or remove it if no longer relevant.',result.url);
  const allCssUrls=pageCssLinks(html,finalUrl),cssUrls=allCssUrls.slice(0,maxStylesheets);if(allCssUrls.length>maxStylesheets)add(findings,'Coverage','info','Some stylesheet files were not included in the responsive check.',`Found ${allCssUrls.length} stylesheet links; WebLab checks up to ${maxStylesheets} and does not follow CSS @import rules.`,'Treat responsive findings as a sampled check; inspect remaining and imported stylesheets for a complete result.',finalUrl);const css=await mapLimit(cssUrls,cssConcurrency,async url=>{const r=await fetcher(url,{maxBytes:LIMITS.cssBytes,timeoutMs:cssTimeoutMs});return r.status>=200&&r.status<300?r.body.toString('utf8'):null;});const unavailableCss=css.filter(result=>result===null||typeof result==='object').length;if(unavailableCss)add(findings,'Coverage','info','Some sampled stylesheets could not be loaded.',`${unavailableCss} of ${cssUrls.length} sampled stylesheet responses were unavailable or exceeded the safe response limit.`,'Treat responsive findings as incomplete and inspect the missing stylesheets separately.',finalUrl);
  let browser={status:'unavailable',reason:null};
  if(!browserChecksEnabled){browser={status:'unavailable',reason:'Browser checks are disabled in this serverless runtime; no bundled browser engine is configured.'};add(findings,'Coverage','info','Responsive and accessibility browser checks did not run.','The hosted function does not include a headless browser engine.','Run the browser-enabled local workflow or configure a supported isolated browser runtime; these checks are unverified.',finalUrl);}
  else try {browser={status:'checked',...(await browserChecks(html,css.filter(x=>typeof x==='string'&&!x.startsWith('Error:')),timeoutMs))};}
  catch(error){browser={status:'unavailable',reason:`Browser checks could not run: ${error.message}`};add(findings,'Coverage','info','Responsive and accessibility browser checks did not run.',error.message,'Install/point WebLab at its supported Chromium runtime and rerun; these checks are not passed.',finalUrl);}
  if(browser.status==='checked') {
    for(const v of browser.accessibility.violations) add(findings,'Accessibility',v.impact==='critical'||v.impact==='serious'?'high':'medium',`Accessibility: ${v.id}.`,v.description,`Inspect the affected elements (${v.nodes.flatMap(n=>n.target).slice(0,4).join(', ')}) and make the smallest WCAG-aligned correction.`,finalUrl);
    for(const v of browser.responsive.viewports.filter(v=>v.overflow)) add(findings,'Responsive','medium',`Page overflows horizontally at ${v.width}px.`,`Document width ${v.documentWidth}px at viewport ${v.width}px.`,'Identify the overflowing element and adapt layout without shrinking complex desktop workspaces into unusable phone layouts.',finalUrl);
  }
  const responseMs=main.elapsedMs ?? null;
  if(responseMs!==null) {
    const severity=responseMs>5000?'high':responseMs>2500?'medium':responseMs>1000?'low':null;
    if(severity)add(findings,'Performance',severity,`Homepage response took ${responseMs} ms.`,`WebLab measured one initial HTML response; this is not a Core Web Vitals or full-page speed score.`,'Measure repeatably from target regions and inspect hosting, server response and asset loading before choosing an optimization.',finalUrl);
  }
  const findingsByCategory=Object.fromEntries(['SEO','Metadata','Links','Responsive','Forms','Accessibility','Performance','Reliability','Security','Coverage'].map(k=>[k,findings.filter(f=>f.category===k).length]));
  homepage.links=homepage.links.map(link=>({...link,href:link.displayHref,source:safeDisplayUrl(link.source)}));
  for(const check of broken) check.url=safeDisplayUrl(check.url);
  for(const finding of findings) if(finding.url) finding.url=safeDisplayUrl(finding.url);
  const droppedFindings=findings.dropped??0;
  return {url:safeDisplayUrl(normalized),finalUrl:safeDisplayUrl(finalUrl),startedAt:started,finishedAt:clock().toISOString(),status:'complete',httpStatus:main.status,contentType,homepage,linkChecks:broken,performance:{initialHtmlResponseMs:responseMs,scope:'One bounded HTML GET from this server; not Lighthouse, Core Web Vitals, synthetic user timing or a regional performance guarantee.'},browser,findings:findings.slice(0,MAX_ISSUES),findingsTruncated:droppedFindings>0,omittedFindings:droppedFindings,findingsByCategory,coverage:{pagesChecked:1,linksChecked:broken.length,linkLimit:maxLinkChecks,formsSubmitted:0,siteFilesChanged:0,authenticatedRoutesTested:0,launchReadiness:'PARTIAL — see missing dynamic, source, platform and deployment checks'},summary:{total:findings.length+droppedFindings,high:findings.filter(f=>f.severity==='high').length,medium:findings.filter(f=>f.severity==='medium').length,low:findings.filter(f=>f.severity==='low').length,omitted:droppedFindings}};
}
