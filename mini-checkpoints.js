const database='momentium-mini-lessons-v1';
export function record(action,key,value){
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open(database,1);
  open.onupgradeneeded=()=>open.result.createObjectStore('sessions');
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('sessions',action==='put'?'readwrite':'readonly');
   const request=action==='put'?tx.objectStore('sessions').put(value,key):tx.objectStore('sessions').get(key);
   tx.oncomplete=()=>{db.close();resolve(request.result);};
   tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('The checkpoint could not be saved.'));};
  };
 });
}
export async function resume(product,lesson){
 const id=new URLSearchParams(location.search).get('miniResume');if(!id)return null;
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('This saved lesson link is invalid.');
 const saved=await record('get',id);
 if(!saved||saved.product!==product||saved.lesson!==lesson)throw Error('This exact lesson is not saved in this browser.');
 return saved.payload;
}
