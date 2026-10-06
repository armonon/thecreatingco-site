(() => {
  const buttons=[...document.querySelectorAll('[data-pt-pdf]')];
  buttons.forEach(button=>button.addEventListener('click',()=>{
    document.querySelector('.pt-pdf').src=button.dataset.ptPdf;
    document.querySelector('[data-pt-download]').href=button.dataset.ptPdf;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));
})();
