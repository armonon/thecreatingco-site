// Opening a prepared workspace is automatic; audio still needs the Play control.
const sessionParams=new URLSearchParams(location.search);
if(sessionParams.get('auto')==='1'||/^[a-f0-9-]{36}$/.test(sessionParams.get('miniResume')||'')){
 const open=()=>{const button=document.querySelector('button.sw-start');if(!button)return false;button.click();return true;};
 if(!open()){
  const observer=new MutationObserver(()=>{if(open())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),30000);
 }
}
