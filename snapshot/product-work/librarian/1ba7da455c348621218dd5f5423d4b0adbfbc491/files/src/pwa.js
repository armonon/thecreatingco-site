// Installable/offline support + thecreateco suite kit, web only (never in the iOS/Electron shells).
//
// Service worker updates are opt-in: when a new deploy's worker is waiting and this page
// was already controlled (a returning visitor), show "Update available — Reload". Only that
// click posts SKIP_WAITING; the page reloads once the new worker takes control.
//
// Suite kit (https://thecreatingco.com/suite/v1/suite.js): shared app menu + Locker. It is
// optional — if it is missing, blocked or offline, Librarian works exactly the same.

const SUITE_SRC = 'https://thecreatingco.com/suite/v1/suite.js';

function toast(message, actionLabel, onAction) {
  document.querySelector('.pwa-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'pwa-toast';
  el.setAttribute('role', 'status');
  const text = document.createElement('span'); text.textContent = message; el.append(text);
  if (actionLabel) { const b = document.createElement('button'); b.className = 'btn-primary'; b.textContent = actionLabel; b.onclick = onAction; el.append(b); }
  const x = document.createElement('button'); x.className = 'pwa-toast-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×'; x.onclick = () => el.remove(); el.append(x);
  document.body.append(el);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
  const offerUpdate = worker => toast('Update available.', 'Reload', () => { reloading = true; worker.postMessage({ type: 'SKIP_WAITING' }); });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      if (reg.waiting && hadController) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing; if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed') return;
          if (hadController) offerUpdate(worker);
          else toast('Librarian is ready to work offline — your library and reader open without a connection.');
        });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
}

export function loadSuiteKit() {
  if (document.querySelector(`script[src="${SUITE_SRC}"]`)) return;
  const s = document.createElement('script');
  s.src = SUITE_SRC; s.defer = true; s.dataset.app = 'librarian';
  s.onerror = () => {}; // optional: offline or unreachable is fine
  document.head.append(s);
}

/** window.TCC.locker when the suite kit has loaded, else null. */
export function locker() {
  const l = window.TCC && window.TCC.locker;
  return l && typeof l.save === 'function' && typeof l.onOpen === 'function' ? l : null;
}

/** Calls fn(locker) once the kit is available (polls ~30 s; also listens for a 'tcc:ready' event). */
export function whenLocker(fn, timeoutMs = 30000) {
  const now = locker(); if (now) { fn(now); return; }
  const started = Date.now();
  const done = () => { clearInterval(timer); window.removeEventListener('tcc:ready', check); };
  const check = () => { const l = locker(); if (l) { done(); fn(l); } else if (Date.now() - started > timeoutMs) done(); };
  const timer = setInterval(check, 250);
  window.addEventListener('tcc:ready', check);
}

