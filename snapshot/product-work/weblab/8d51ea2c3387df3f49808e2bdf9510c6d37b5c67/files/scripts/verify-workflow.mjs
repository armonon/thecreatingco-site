import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const origin=process.env.WEBLAB_URL??'http://127.0.0.1:4177';
const expectedLinkCount=Number(process.env.WEBLAB_EXPECTED_LINKS??24);
const expectedBrowserStatus=process.env.WEBLAB_EXPECT_BROWSER??'checked';
const browser=await chromium.launch({headless:true,...(process.env.WEBLAB_CHROMIUM_PATH?{executablePath:process.env.WEBLAB_CHROMIUM_PATH}:{}),args:['--disable-background-networking','--no-first-run','--no-default-browser-check']});
const errors=[];const tmp=await mkdtemp(path.join(os.tmpdir(),'weblab-verify-'));
try {
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  await context.addInitScript({path:new URL('../node_modules/axe-core/axe.min.js',import.meta.url).pathname});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  const companyLink=page.getByRole('link',{name:'The Creating Co.'});
  assert.equal(await companyLink.getAttribute('href'),'https://thecreatingco.com/','company backlink');
  const axe=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length}));});
  assert.deepEqual(axe,[],'WebLab landing page axe violations');
  await page.getByLabel('Website address').fill('https://thecreatingco.com/');
  await page.getByRole('button',{name:/check my website/i}).click();
  await page.getByRole('heading',{name:'Here’s what we found'}).waitFor({timeout:75_000});
  const before=await page.evaluate(()=>({total:document.querySelector('#finding-count')?.textContent,linkMetric:[...document.querySelectorAll('.summary-cell')].find(e=>e.textContent.includes('LINKS CHECKED'))?.textContent,formsMetric:[...document.querySelectorAll('.summary-cell')].find(e=>e.textContent.includes('FORMS FOUND'))?.textContent,coverage:[...document.querySelectorAll('#coverage-list li')].map(e=>e.textContent)}));
  assert.match(before.linkMetric??'',new RegExp(String(expectedLinkCount)));assert.match(before.formsMetric??'',/2/);assert.ok(before.coverage.some(x=>x.includes('none submitted')));
  await page.setViewportSize({width:320,height:800});
  const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(layout.document<=layout.viewport+1&&layout.body<=layout.viewport+1,'320px report has horizontal overflow');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/download report/i}).click();const download=await downloadEvent;const reportPath=path.join(tmp,download.suggestedFilename());await download.saveAs(reportPath);const report=JSON.parse(await readFile(reportPath,'utf8'));
  assert.equal(report.url,'https://thecreatingco.com/');assert.equal(report.coverage.formsSubmitted,0);assert.equal(report.coverage.siteFilesChanged,0);assert.equal(report.coverage.linksChecked,expectedLinkCount);assert.equal(report.browser.status,expectedBrowserStatus);assert.equal(report.status,'complete');assert.equal(errors.length,0);
  console.log(JSON.stringify({result:'PASS',at:new Date().toISOString(),url:report.url,httpStatus:report.httpStatus,linkChecks:report.coverage.linksChecked,formsFound:report.homepage.forms.length,formsSubmitted:report.coverage.formsSubmitted,siteFilesChanged:report.coverage.siteFilesChanged,auditBrowserStatus:report.browser.status,axeViolations:report.browser.accessibility?.violations.length??null,responsiveViewports:report.browser.responsive?.viewports.map(v=>({width:v.width,overflow:v.overflow}))??null,reportUi320:layout,downloadFilename:download.suggestedFilename(),reportBytes:(await readFile(reportPath)).length,landingAxeViolations:axe.length,pageErrors:errors},null,2));
} finally {await rm(tmp,{recursive:true,force:true});await browser.close();}
