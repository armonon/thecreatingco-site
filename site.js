const form = document.querySelector('#feedback-form');
if (form) {
  const params = new URLSearchParams(location.search);
  for (const name of ['product', 'category']) {
    const field = form.elements.namedItem(name);
    if (field?.options && [...field.options].some(option => option.value === params.get(name))) field.value = params.get(name);
  }
  const status = document.querySelector('#feedback-status');
  const reference = form.elements.namedItem('reference');
  if (reference) reference.value = 'MOM-' + crypto.randomUUID();
  document.querySelector('[data-feedback-download]')?.addEventListener('click', () => {
    const data = new FormData(form);
    const contents = `THECREATECO SUPPORT REPORT\nReference: ${data.get('reference')}\nDate: ${new Date().toISOString()}\nCategory: ${data.get('category')}\nProduct: ${data.get('product')}\nEmail: ${data.get('email')}\nDevice: ${data.get('device')}\n\nREQUEST\n${data.get('task')}\n\nDETAILS\n${data.get('result')}\n\nEXPECTED RESULT\n${data.get('expected')}\n\nThis file is a local copy, not proof of submission.\n`;
    const url = URL.createObjectURL(new Blob([contents], {type: 'text/plain'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.get('product') || 'momentium'}-feedback.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = 'Local copy requested. Downloading does not send your report.';
  });
  let sending = false;
  form.addEventListener('submit', async event => {
    // Only the main host and its review deploys provide Netlify form handling.
    const hosted = location.hostname === 'momentium-creative.netlify.app' || location.hostname.endsWith('--momentium-creative.netlify.app');
    if (!hosted) {
      form.action = 'https://momentium-creative.netlify.app/testing/received/';
      return;
    }
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your message...';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const body = new URLSearchParams(new FormData(form));
      const response = await fetch(form.action, {
        method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString(), signal: controller.signal,
      });
      if (!response.ok) throw new Error('Submission not accepted');
      status.textContent = `Message received. Your reference is ${reference.value}. Keep it for follow-up. Replies require an email address; response times may vary during alpha.`;
      button.textContent = 'Message sent';
    } catch {
      status.textContent = `We could not confirm delivery. Your message is still here. Download a copy and try again with the same reference: ${reference.value}.`;
      button.disabled = false;
      sending = false;
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
    }
  });
}
