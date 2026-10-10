// Real browser workflow with generated PCM reference files; no physical-device claim.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const browsers=await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const browserName=process.env.BOUNCE_BROWSER || 'chromium';
const base=process.env.BOUNCE_CHECK_URL || 'http://127.0.0.1:4318';
const out=process.env.BOUNCE_REPORT_DIR || '/tmp/bounce-workflow';
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
function wav(hz){const rate=44100,n=rate*2,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*hz/rate)*3000),44+i*2);return b;}
const fixtures=[{name:'Reference A.wav',mimeType:'audio/wav',buffer:wav(440)},{name:'Reference B.wav',mimeType:'audio/wav',buffer:wav(660)}];
// Own a fresh default storage partition; Chromium quota overrides target this partition.
const profile=await mkdtemp(join(tmpdir(),'bounce-workflow-'));
let context=await browsers[browserName].launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:1000},acceptDownloads:true,serviceWorkers:'block'});
let browser=context.browser();
let page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report={at:new Date().toISOString(),sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),browserName,browser:browser.version(),profile,checks:[],pass:false};
async function checkpoint(name,run){await run();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}
async function stored(){return page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('bounce-browser-testing',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('library').objectStore('library').get('saved');q.onsuccess=()=>r({name:q.result?.name,eq:q.result?.eq,names:q.result?.files.map(f=>f.name)});q.onerror=()=>j(q.error)});});}
try{
 await page.goto(base+'/browser/');await page.locator('#files').waitFor({state:'attached'});
 await checkpoint('import, actual media playback and reorder',async()=>{
  await page.locator('#files').setInputFiles(fixtures);await page.getByRole('button',{name:'Play Reference A.wav',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.05);
  await page.getByRole('button',{name:'Move Reference B.wav up',exact:true}).click();
  assert.deepEqual(await page.locator('#queue .track').allTextContents(),['Reference B.wav','Reference A.wav']);
 });
 await checkpoint('save, reload and restore browser library',async()=>{
  await page.locator('#playlist-name').fill('Reference library');
  await page.locator('#treble').fill('4');
  await page.locator('#save').click();await page.getByRole('status').filter({hasText:'Library saved'}).waitFor();
  await page.reload();await page.getByRole('status').filter({hasText:'Restored 2'}).waitFor();
  assert.equal(await page.locator('#playlist-name').inputValue(),'Reference library');
  assert.equal(await page.locator('#treble').inputValue(),'4');
  assert.deepEqual(await page.locator('#queue .track').allTextContents(),['Reference B.wav','Reference A.wav']);
 });
 await checkpoint('portable export bytes and independent manifest parser',async()=>{
  const download=page.waitForEvent('download');await page.locator('#export').click();const d=await download;await d.saveAs(out+'/roundtrip.bounce');
  const b=await readFile(out+'/roundtrip.bounce');assert.equal(b.subarray(0,8).toString(),'BOUNCE01');const len=b.readUInt32LE(8);const m=JSON.parse(b.subarray(12,12+len));
  assert.equal(m.name,'Reference library');assert.deepEqual(m.eq,[0,0,4]);let offset=12+len;
  for(const t of m.tracks){assert.equal(hash(b.subarray(offset,offset+t.size)),hash(fixtures.find(f=>f.name===t.name).buffer));offset+=t.size;}assert.equal(offset,b.length);
  const fresh=await context.newPage();await fresh.goto(base+'/browser/');await fresh.getByRole('status').filter({hasText:'Restored 2'}).waitFor();fresh.on('dialog',d=>d.accept());await fresh.locator('#library-file').setInputFiles(out+'/roundtrip.bounce');await fresh.getByRole('status').filter({hasText:'Opened 2'}).waitFor();assert.deepEqual(await fresh.locator('#queue .track').allTextContents(),m.tracks.map(t=>t.name));await fresh.close();report.archive_sha256=hash(b);
 });
 await checkpoint('damaged archive cannot replace current queue',async()=>{
  const b=await readFile(out+'/roundtrip.bounce');await page.locator('#library-file').setInputFiles({name:'truncated.bounce',mimeType:'application/octet-stream',buffer:b.subarray(0,b.length-5)});await page.getByRole('status').filter({hasText:'Incomplete Bounce library'}).waitFor();assert.equal(await page.locator('#queue .track').count(),2);
 });
 await checkpoint('save snapshots metadata before async file reads; later edits stay unsaved',async()=>{
  // Inject only IO latency, not storage outcome or application state.
  await page.evaluate(()=>{const original=Blob.prototype.arrayBuffer;window.releaseRead=null;Blob.prototype.arrayBuffer=async function(){await new Promise(r=>{window.releaseRead=r});return original.call(this)};window.restoreRead=()=>{Blob.prototype.arrayBuffer=original;};});
  await page.locator('#save').click();await page.waitForFunction(()=>typeof window.releaseRead==='function');
  await page.locator('#playlist-name').fill('New unsaved title');await page.locator('#bass').fill('6');
  await page.evaluate(()=>{window.restoreRead();window.releaseRead();});
  await page.waitForFunction(()=>!document.querySelector('#save').disabled);
  assert.deepEqual(await stored(),{name:'Reference library',eq:[0,0,4],names:['Reference B.wav','Reference A.wav']});
  assert.match(await page.locator('#status').innerText(),/changed.*saving|changed during saving/i);
 });
 if(browserName==='chromium') await checkpoint('actual browser quota rejection preserves last saved library',async()=>{
  await context.close();
  context=await browsers[browserName].launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:1000},acceptDownloads:true,serviceWorkers:'block'});browser=context.browser();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Storage.overrideQuotaForOrigin',{origin:new URL(base).origin,quotaSize:1});
  await page.goto(base+'/browser/');await page.locator('#status').filter({hasText:'Restored 2'}).waitFor();
  await page.locator('#files').setInputFiles({name:'Quota probe.wav',mimeType:'audio/wav',buffer:Buffer.alloc(32*1024*1024)});
  await page.locator('#save').click();await page.locator('#status').filter({hasText:'Could not save'}).waitFor();
  assert.deepEqual(await stored(),{name:'Reference library',eq:[0,0,4],names:['Reference B.wav','Reference A.wav']});
  assert.equal(await page.locator('#queue .track').count(),3,'failed save retains current queue');
  await cdp.send('Storage.overrideQuotaForOrigin',{origin:new URL(base).origin});
 });
 else report.checks.push({name:'actual browser quota rejection',status:'UNVERIFIED',reason:'No equivalent browser quota override in this harness; Chromium checked separately'});
 await checkpoint('published original musical studies load and play through actual audio element',async()=>{
  await page.locator('#demo').click();await page.getByRole('button',{name:'Play 01-first-light.wav',exact:true}).waitFor();
  for(const name of ['01-first-light.wav','02-open-water.wav','03-night-window.wav']){
   await page.getByRole('button',{name:'Play '+name,exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.05);
   assert.ok(await page.locator('audio').evaluate(a=>a.duration>20),'real composition decodes beyond20seconds');
  }
 });
 await checkpoint('phone controls fit viewport and keyboard labels remain present',async()=>{
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.getByRole('button',{name:'Move Reference A.wav up',exact:true}).count(),1);await page.screenshot({path:out+'/phone.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);report.pass=true;
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
