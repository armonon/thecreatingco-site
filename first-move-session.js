/* Native editors own their checkpoints. A failed save never releases a session. */
export function checkpoint(frame, {product, lesson, origin, receive=window, timeout=30000}) {
 return new Promise((resolve,reject)=>{
  const request=crypto.randomUUID();
  const finish=(error,value)=>{clearTimeout(timer);receive.removeEventListener('message',message);error?reject(error):resolve(value);};
  const message=event=>{
   const d=event.data;if(event.origin!==origin||event.source!==frame.contentWindow||d?.request!==request)return;
   if(['mini:error','luma-box:continue-error','scenepilot-lesson-error'].includes(d.type)){finish(Error(d.message||'Could not keep your edits. Your session is still open.'));return;}
   if((product==='form'||product==='stemdeck')&&d.type==='mini:checkpointed'&&d.lesson===lesson){if(d.payload==null)finish(Error('The editor did not return a saved project.'));else finish(null,{payload:d.payload});return;}
   const url=continuationUrl(d,product,lesson,origin);if(url)finish(null,{url});
  };
  const timer=setTimeout(()=>finish(Error('Saving took too long. Your session is still open. Retry or download your project.')),timeout);
  receive.addEventListener('message',message);
  frame.contentWindow.postMessage({type:product==='luma'?'luma-box:continue':product==='scenepilot'?'scenepilot-lesson-continue':'mini:checkpoint',request},origin);
 });
}

export function continuationUrl(d,product,lesson,origin){
 const expected=product==='luma'?'luma-box:continued':product==='scenepilot'?'scenepilot-lesson-continued':null;
 if(!expected||d?.type!==expected)return null;
 try{const url=new URL(d.url),id=url.searchParams.get('continue');
  if(url.origin!==origin||url.pathname!==`/learn/${product}/workshops/`||url.searchParams.get('workshop')!==lesson)return null;
  if(product==='luma'&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id||''))return null;
  if(product==='scenepilot'&&(url.searchParams.get('full')!=='1'||!/^scene-lesson-[a-f0-9-]{36}$/.test(id||'')))return null;
  return url.href;
 }catch{return null;}
}
