import {record} from './mini-checkpoints.js';
import {checkedURL} from './learn/hub.js';
const catalog=await fetch('/learn/catalog.json').then(r=>{if(!r.ok)throw Error('Lesson index unavailable');return r.json();});
const root=document.querySelector('[data-work-list]'),status=document.querySelector('[data-work-status]');
const find=key=>catalog.lessons.find(l=>l.key===key);
function readNative(name,key){return new Promise((resolve,reject)=>{const req=indexedDB.open(name,1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('projects');const value=tx.objectStore('projects').get(key);tx.oncomplete=()=>{db.close();resolve(value.result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function portable(lesson,url){
 if(lesson.product==='luma'){const saved=await readNative('luma-lesson-continuations-v1',url.searchParams.get('continue'));if(!(saved?.blob instanceof Blob))throw Error('This project is no longer available on this browser.');download(saved.blob,lesson.id+'.luma');return;}
 const saved=await record('get',url.searchParams.get('miniResume'));if(saved?.product!==lesson.product||saved?.lesson!==lesson.id)throw Error('This saved project is unavailable.');
 if(lesson.product==='stemdeck'){if(!(saved.payload instanceof Blob))throw Error('The session could not be read.');download(saved.payload,lesson.id+'.sattari');return;}
 if(typeof saved.payload!=='string')throw Error('The Form project could not be read.');const data=JSON.parse(saved.payload);download(new Blob([saved.payload],{type:'application/json'}),lesson.id+(data.patterns||data.pieces?'.formgarment':'.form'));
}
try{
 const saved=await record('get','learn-hub-directory-v1');const versions=Object.entries(saved?.versions||{}).sort((a,b)=>b[1].savedAt-a[1].savedAt);let count=0;
 for(const [key,value] of versions){const lesson=find(key);if(!lesson||Date.now()-value.savedAt>7*24*3600000)continue;let url;try{url=checkedURL(value.url,lesson,location.origin);}catch{continue;}
  const card=document.createElement('article');card.className='work-card';const h=document.createElement('h2');h.textContent=lesson.title;const meta=document.createElement('p');meta.textContent=catalog.products[lesson.product].name+' · Saved '+new Date(value.savedAt).toLocaleString();const actions=document.createElement('div');actions.className='project-actions';const resume=document.createElement('a');resume.href='/learn/'+lesson.product+'/?lesson='+lesson.id+'#learn-studio';resume.textContent='Resume in mini studio ↗';const full=document.createElement('a');full.href=url.href;full.textContent=lesson.product==='scenepilot'?'Open & download cut + sources ↗':'Open full studio ↗';actions.append(resume,full);
  if(lesson.product!=='scenepilot'){const button=document.createElement('button');button.textContent='Download editable project ↓';button.addEventListener('click',async()=>{button.disabled=true;try{await portable(lesson,url);status.textContent='Editable project downloaded.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});actions.append(button);}
  card.append(h,meta,actions);root.append(card);count++;
 }
 document.querySelector('[data-work-empty]').hidden=count>0;status.textContent=count?`${count} saved ${count===1?'project':'projects'} on this browser.`:'No saved projects yet. Save a lesson to see it here.';
}catch(error){status.textContent='Browser recovery is unavailable. Your downloaded project files are unaffected.';}
