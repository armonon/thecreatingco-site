import {resume} from './mini-checkpoints.js';
const main=document.querySelector('[data-product-examples]'),product=main?.dataset.productExamples,params=new URLSearchParams(location.search),lesson=params.get('miniLesson')||'default';
if(main){
 const inputs=()=>[...main.querySelectorAll('input:not([type=file]),select,textarea')];
 let restored=false;
 async function start(){
  try{
   const saved=await resume(product,lesson);
   if(saved){
    saved.inputs?.forEach((value,i)=>{const input=inputs()[i];if(!input||typeof value.value!=='string')return;input.value=value.value;if(typeof value.checked==='boolean')input.checked=value.checked;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
    if(saved.document)main.querySelectorAll('[data-pt-pdf]').forEach(button=>{if(button.dataset.ptPdf===saved.document)button.click();});
    if(saved.compared)main.querySelector('[data-px-hash]')?.click();
   }else if(product==='librarian'&&lesson==='materials')main.querySelectorAll('[data-pt-pdf]')[1]?.click();
   restored=true;if(parent!==window)parent.postMessage({type:'mini:ready',lesson},location.origin);
  }catch(error){const note=document.createElement('p');note.setAttribute('role','alert');note.textContent=error.message;main.prepend(note);}
 }
 const prompts={
  ghost:{silhouette:['Compare the silhouette','Slide between the two captured results. Compare the shoulder, hem and overall drape. These are visual estimates from photographs.'],detail:['Inspect the garment details','Compare the sleeve and hem in each captured study. Keep the source photograph in mind; this is not a physical fit measurement.']},
  librarian:{field:['Read your field notes','Open the Field notes PDF, explore its pages, and keep the original file with Download original PDF.'],materials:['Build a materials reference','Read Materials & sound. Switch documents to compare the two guides, then download the original you want to keep.']},
  reclaim:{duplicates:['Find the identical pair','Compare the sample files by their SHA-256 contents. Identify the matching briefs before downloading the read-only report.'],names:['Look beyond the filename','Compare both notes.txt files. Their names match, but their contents do not. Verify the hashes and keep the report.']},
  bounce:{warmth:['Shape the low end','Play the original mix and change Bass. Compare a small boost with a small cut; Mid and Treble remain available.'],voice:['Find the middle','Change Mid while listening to the same recording. Compare the presence of instruments and voice without changing the original file.'],air:['Refine the top end','Audition the Treble band. Compare clarity and softness, then use Reset EQ to return all bands to neutral.']}
 };
 const prompt=prompts[product]?.[lesson];if(prompt){main.querySelector('h1').textContent=prompt[0];const text=document.createElement('p');text.textContent=prompt[1];main.querySelector('h1').after(text);}
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='mini:checkpoint')return;
  try{
   if(!restored||main.querySelector('[data-px-hash]')?.disabled)throw Error('Wait for the lesson or comparison to finish before switching.');
   const payload={inputs:inputs().map(input=>({value:input.value,checked:input.checked})),document:main.querySelector('[data-pt-pdf][aria-pressed=true]')?.dataset.ptPdf,compared:!!main.querySelector('[data-px-report]:not(:disabled)')};
   main.querySelectorAll('audio,video').forEach(media=>media.pause());
   parent.postMessage({type:'mini:checkpointed',request:event.data.request,lesson,payload},location.origin);
  }catch(error){parent.postMessage({type:'mini:error',request:event.data.request,message:error.message},location.origin);}
 });
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
}
