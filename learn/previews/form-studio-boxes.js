import {formExamples,exampleURL} from './form-examples.js';
import {boxIcons} from './form-box-icons.js';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/learn/previews/form-studio-boxes.css';document.head.append(sheet);
let expanded=null,background=[],ancestors=[],returnFocus=null;
function closeExpanded(){
  if(!expanded)return;
  expanded.classList.remove('form-box-expanded');
  expanded.removeAttribute('role');expanded.removeAttribute('aria-modal');
  const button=expanded.querySelector('[data-form-expand]');
  button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Expand Form Studio');button.title='Expand Form Studio';
  background.forEach(([node,value])=>node.inert=value);background=[];
  ancestors.forEach(node=>node.classList.remove('form-box-ancestor'));ancestors=[];
  document.body.classList.remove('form-box-open');expanded=null;returnFocus?.focus();
}
function expand(root){
  if(expanded===root){closeExpanded();return;}
  closeExpanded();returnFocus=document.activeElement;expanded=root;
  root.classList.add('form-box-expanded');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',root.dataset.title+' · Form Studio');
  const button=root.querySelector('[data-form-expand]');button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','Close expanded Form Studio');button.title='Close expanded Form Studio';
  for(let branch=root;branch.parentElement;branch=branch.parentElement){
    const parent=branch.parentElement;parent.classList.add('form-box-ancestor');ancestors.push(parent);
    for(const sibling of parent.children)if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}
    if(parent===document.body)break;
  }
  document.body.classList.add('form-box-open');button.focus();
}
document.addEventListener('keydown',event=>{
  if(!expanded)return;
  if(event.key==='Escape'){event.preventDefault();closeExpanded();}
  if(event.key==='Tab'){
    const controls=[...expanded.querySelectorAll('button:not([hidden]),a[href],iframe')];
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  }
});
export function nativeFormBox(root,id){
  const spec=formExamples[id];if(!spec)return;
  root.classList.add('lp','lp-native');root.dataset.kind=id;
  root.replaceChildren();
  const header=document.createElement('div');header.className='form-box-header';
  const title=document.createElement('b');title.textContent='Form Studio / '+spec.title;
  const standalone=document.createElement('a');standalone.href=exampleURL(id,false);standalone.target='_blank';standalone.rel='noopener';standalone.textContent='Open standalone';
  const maximize=document.createElement('button');maximize.type='button';maximize.dataset.formExpand='';maximize.title='Expand Form Studio';maximize.setAttribute('aria-label',maximize.title);maximize.setAttribute('aria-expanded','false');maximize.innerHTML=boxIcons.Maximize2;
  header.append(title,standalone,maximize);
  const stage=document.createElement('div');stage.className='form-box-stage';
  const poster=document.createElement('img');poster.src=spec.poster;poster.alt=spec.title+' in Form Studio';poster.loading='lazy';
  const open=document.createElement('button');open.type='button';open.className='form-box-start';open.innerHTML=boxIcons.Box+'<span>Open Form Studio</span>';
  const status=document.createElement('p');status.className='form-box-status';status.setAttribute('role','status');status.textContent='Editable project / public alpha';
  stage.append(poster,open);root.append(header,stage,status);
  let frame=null;
  const load=()=>{
    if(frame)return;
    frame=document.createElement('iframe');frame.title='Form Studio / '+spec.title;frame.src=exampleURL(id);frame.allow='fullscreen';
    status.textContent='Opening '+spec.title+'…';open.hidden=true;stage.append(frame);
    frame.addEventListener('load',()=>{
      poster.hidden=true;status.textContent='Form Studio / '+spec.title;
      try{frame.contentDocument.addEventListener('keydown',e=>{
        if(expanded!==root)return;
        if(e.key==='Escape'&&!frame.contentDocument.querySelector('[role="dialog"],[role="alertdialog"]')){e.preventDefault();closeExpanded();}
        if(e.key==='Tab'){
          const controls=[...frame.contentDocument.querySelectorAll('button:not(:disabled),summary,a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('[hidden],[inert]'));
          if(frame.contentDocument.activeElement===(e.shiftKey?controls[0]:controls.at(-1))){e.preventDefault();maximize.focus();}
        }
      });}catch{}
    });
  };
  open.addEventListener('click',load);maximize.addEventListener('click',()=>{load();expand(root);});
  // Scrolling never disposes an edited document or rebuilds its iframe.
  return {root,pause(){},resume(){}};
}
for(const root of document.querySelectorAll('[data-form-native]'))nativeFormBox(root,root.dataset.formNative);
