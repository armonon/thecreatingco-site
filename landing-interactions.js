/* Small, explicit interactions. No autoplay, tracking or persistent user data. */
(() => {
 const tabs=[...document.querySelectorAll('[data-hero-tab]')];
 function select(index,focus=false){tabs.forEach((tab,i)=>{const on=i===index;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;const panel=document.getElementById(tab.getAttribute('aria-controls'));panel.hidden=!on;if(!on)panel.querySelectorAll('audio,video').forEach(media=>media.pause());});if(focus)tabs[index].focus();}
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(i));tab.addEventListener('keydown',event=>{const positions={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};if(event.key in positions){event.preventDefault();select(positions[event.key],true);}});});
 const breakdown=document.querySelector('[data-hero-breakdown]');breakdown?.addEventListener('click',()=>{const showing=breakdown.getAttribute('aria-pressed')!=='true';document.querySelector('[data-hero-artwork]').hidden=showing;document.querySelector('[data-hero-workspace]').hidden=!showing;breakdown.setAttribute('aria-pressed',String(showing));breakdown.textContent=showing?'See the finished poster ↗':'See the workspace ↗';});
 const header=document.querySelector('.mm-header');if(header&&'ResizeObserver' in window)new ResizeObserver(()=>document.documentElement.style.setProperty('--landing-header-height',`${Math.ceil(header.getBoundingClientRect().height)}px`)).observe(header);
 const dialog=document.querySelector('.landing-feedback'),trigger=document.querySelector('[data-landing-feedback]'),form=document.querySelector('[data-landing-feedback-form]');
 if(!dialog||!trigger||!form)return;
 trigger.addEventListener('click',()=>{dialog.showModal();form.querySelector('[name=task]').focus();});dialog.querySelector('[data-feedback-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger.focus());dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit]'),status=form.querySelector('[data-inline-feedback-status]');if(button.disabled)return;
  const data=new FormData(form);if(String(data.get('bot-field')||'').trim())return;
  button.disabled=true;button.textContent='Sending…';status.textContent='Sending your feedback…';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const result=await fetch('/',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});if(!result.ok)throw Error('Not confirmed');status.textContent='Thank you. Your feedback has been received. If you left an email, we can reply there.';form.reset();}
  catch(error){status.textContent=error.name==='AbortError'?'The request timed out. Your message is still here. Please try again.':'We couldn’t confirm delivery. Your message is still here. Retry or use the full support form.';}
  finally{clearTimeout(timeout);button.disabled=false;button.textContent='Send feedback ↗';}
 });
})();
