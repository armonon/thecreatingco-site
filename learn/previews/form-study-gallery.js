const root=document.querySelector('#model-studies');
if(root)setup().catch(()=>{const note=root.querySelector('[data-fs-note]');if(note)note.textContent='Study details unavailable. The Form editors and project downloads remain available.';});
async function setup(){
  const response=await fetch('/assets/form-studies/studies.json');if(!response.ok)throw Error('Study details unavailable');
  const studies=await response.json(),q=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];let current=studies[0];
  const examples={'equine-reverie':'sculpt','circle-of-anarchy':'circle','wwspc':'relief','forest-landscape':'terrain'};
  function shot(index){const s=current.shots[index];q('[data-fs-image]').src='/assets/form-studies/'+s[0]+'.jpg';q('[data-fs-image]').alt=current.name+' / '+s[1];q('[data-fs-caption-title]').textContent=s[1];q('[data-fs-caption]').textContent=s[2];all('[data-fs-shot]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.fsShot)===index)));}
  function select(id){
    current=studies.find(s=>s.id===id);if(!current)return;
    all('[data-fs-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fsModel===id)));
    all('[data-form-native]').forEach(box=>box.hidden=box.dataset.formNative!==examples[id]);
    for(const [selector,value] of [['[data-fs-name]',current.name],['[data-fs-tag]',current.tag],['[data-fs-intro]',current.intro],['[data-fs-note]',current.note],['[data-fs-meta]',current.faces.toLocaleString()+' faces / 100 mm study scale']])q(selector).textContent=value;
    q('[data-fs-steps]').replaceChildren(...current.lesson.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    q('[data-fs-project]').href='/assets/form-studies/'+id+'.form';q('[data-fs-obj]').href='/assets/form-studies/'+id+'.obj';
    q('.fs-shot-tabs').replaceChildren(...current.shots.map((s,i)=>{const b=document.createElement('button');b.type='button';b.dataset.fsShot=String(i);b.textContent=s[1];b.addEventListener('click',()=>shot(i));return b;}));shot(0);
  }
  all('[data-fs-model]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.fsModel)));
  const dialog=q('dialog');all('[data-fs-expand]').forEach(b=>b.addEventListener('click',()=>{const image=dialog.querySelector('img');image.src=q('[data-fs-image]').src;image.alt=q('[data-fs-image]').alt;q('[data-fs-dialog-title]').textContent=image.alt;dialog.showModal();}));q('[data-fs-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  select(current.id);
}
