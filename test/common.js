const touchStyles=document.createElement('link');
touchStyles.rel='stylesheet';
touchStyles.href=new URL('./touch.css',import.meta.url).href;
document.head.append(touchStyles);
export const $=s=>document.querySelector(s);
export function status(text){$('#status').textContent=text}
let lastDownload;
export function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.textContent=`Download ${name}`;a.className='pill';
  let holder=document.querySelector('#download-ready');
  if(!holder){holder=document.createElement('div');holder.id='download-ready';holder.className='app-toolbar';$('#status').after(holder)}
  holder.replaceChildren(a);
  if(lastDownload)URL.revokeObjectURL(lastDownload);
  lastDownload=url;
  a.click();
}
export function bytes(n){if(n<1024)return `${n} B`;const k=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));return `${(n/1024**k).toFixed(1)} ${['B','KB','MB','GB'][k]}`}
export function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e}
export const demoFiles=['/assets/audio/01-first-light.wav','/assets/audio/02-open-water.wav','/assets/audio/03-night-window.wav'];
export async function loadDemoFiles(){return Promise.all(demoFiles.map(async (url)=>{const r=await fetch(url);if(!r.ok)throw Error('The original study could not be loaded. Try your own file.');return new File([await r.blob()],decodeURIComponent(url.split('/').pop()),{type:'audio/wav'})}))}
