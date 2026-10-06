const form=document.querySelector('[data-remix-form]'),status=document.querySelector('[data-remix-status]');
const key='momentium-remix-nickname';try{form.elements.nickname.value=localStorage.getItem(key)||'';}catch{}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const values=new FormData(form),button=form.querySelector('button[type=submit]');
 const links=['resultURL','sourceURL'].map(field=>new URL(String(values.get(field))));
 if(links.some(u=>u.protocol!=='https:')){status.textContent='Use public HTTPS links for the result and source project.';return;}
 const nickname=String(values.get('nickname')).trim();button.disabled=true;status.textContent='Sending your remix for review…';
 const result=`Nickname: ${nickname}\nResult: ${links[0].href}\nEditable source: ${links[1].href}\nOriginal / credits: ${values.get('credits')}\nRemix permission: ${values.get('permission')}\nDescription: ${values.get('description')}\nContributor confirmed the right to submit these links for public review.`;
 // Use the site's existing private moderation/support form; never pretend a pending post is public.
 const body=new URLSearchParams({'form-name':'momentium-support','bot-field':String(values.get('bot-field')||''),category:'feedback',product:String(values.get('product')),task:'Community remix submission: '+String(values.get('title')),result,email:String(values.get('email')||''),reference:'community-remix-v1'});
 try{const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!response.ok)throw Error('Submission could not be confirmed.');try{localStorage.setItem(key,nickname);}catch{}status.textContent='Submitted to thecreateco for review. It is not public yet. Keep your files and links available; include an email if you want a reply.';form.reset();form.elements.nickname.value=nickname;}catch(error){status.textContent=error.message+' Your details remain here. Please retry or use Support.';}finally{button.disabled=false;}
});
