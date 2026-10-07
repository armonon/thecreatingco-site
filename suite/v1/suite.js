/*! thecreateco suite kit v1 · https://thecreatingco.com/suite/v1/suite.js
 * <script src="https://thecreatingco.com/suite/v1/suite.js" data-app="<id>" defer></script>
 * Shared app menu (<tcc-suite-menu>) + window.TCC.locker. Dependency-free.
 * Fails silently: if this file or the Locker can't be reached, the app keeps working. */
(function () {
  'use strict';
  if (window.TCC && window.TCC.version) return;

  var VERSION = '1.0.0';
  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src*="/suite/v1/suite.js"]');
    return s[s.length - 1] || null;
  })();
  var ds = (script && script.dataset) || {};
  var BASE = 'https://thecreatingco.com';
  try { if (script && script.src) BASE = new URL(script.src, location.href).origin; } catch (e) {}
  var LOCKER_URL = BASE + '/locker/';

  // Fallback registry, generated from /suite/v1/apps.json at publish time.
  var REGISTRY = /*@REGISTRY*/{"version":1,"updated":"2026-10-07","notes":"opens:true = the app handles ?tcc-open= via TCC.locker.onOpen (shown in Locker Send-to menus). accepts = MIME types, type/* wildcards or .extensions.","home":{"name":"thecreatingco.com","url":"https://thecreatingco.com/"},"groups":[{"id":"make","name":"Make"},{"id":"film","name":"Film"},{"id":"music","name":"Music"},{"id":"everyday","name":"Everyday"},{"id":"locker","name":"Locker"}],"apps":[{"id":"form","name":"Form","group":"make","blurb":"3D & CAD","url":"https://form.thecreatingco.com/studio","openUrl":"https://form.thecreatingco.com/studio","page":"https://thecreatingco.com/products/form/","accepts":["model/gltf-binary","model/stl","model/obj",".glb",".stl",".obj",".ply",".usd",".usda"]},{"id":"cast","name":"Cast","parent":"form","group":"make","status":"preview","blurb":"Jewelry casting checks","url":"https://form-studio-review.netlify.app/studio","openUrl":"https://form-studio-review.netlify.app/studio","page":"https://thecreatingco.com/products/form/#cast","accepts":["model/stl","model/gltf-binary","model/obj",".stl",".glb",".obj"],"opens":true},{"id":"luma","name":"Luma","group":"make","blurb":"Layered image editor","url":"https://luma.thecreatingco.com/studio","openUrl":"https://luma.thecreatingco.com/studio","page":"https://thecreatingco.com/products/luma/","accepts":["image/png","image/jpeg","image/webp","image/gif","image/svg+xml",".luma","font/otf","font/ttf",".otf",".ttf"],"opens":true},{"id":"mockup","name":"Mockup","parent":"luma","group":"make","blurb":"Art onto products","url":"https://luma.thecreatingco.com/studio","openUrl":"https://luma.thecreatingco.com/studio","page":"https://thecreatingco.com/products/mockup/","accepts":["image/png","image/jpeg","image/webp","image/svg+xml"]},{"id":"glyph","name":"Glyph","group":"make","blurb":"Draw your own font","url":"https://glyph-studio-610.netlify.app/","openUrl":"https://glyph-studio-610.netlify.app/studio","page":"https://thecreatingco.com/products/glyph-studio/","accepts":[".glyph"],"opens":true},{"id":"ghost","name":"Ghost","group":"make","blurb":"Garment photos to 3D","url":"https://ghost.thecreatingco.com/","openUrl":"https://ghost.thecreatingco.com/","page":"https://thecreatingco.com/products/ghost/","accepts":["image/png","image/jpeg","image/webp",".ghost",".ghostbatch"],"opens":true},{"id":"scenepilot","name":"ScenePilot","group":"film","blurb":"Beat-aware video editor","url":"https://scenepilot.thecreatingco.com/app/","openUrl":"https://scenepilot.thecreatingco.com/app/","page":"https://thecreatingco.com/products/scenepilot/","accepts":["video/*","audio/*","image/png","image/jpeg","image/webp",".cube",".srt",".vtt","text/vtt"],"opens":true},{"id":"autocut","name":"AutoCut","parent":"scenepilot","group":"film","blurb":"Cut to the beat","url":"https://scenepilot.thecreatingco.com/tools/autocut/","openUrl":"https://scenepilot.thecreatingco.com/tools/autocut/","page":"https://thecreatingco.com/products/autocut/","accepts":["video/*","audio/*"],"opens":true},{"id":"captions","name":"Captions","parent":"scenepilot","group":"film","blurb":"Speech to captions","url":"https://scenepilot.thecreatingco.com/tools/captions/","openUrl":"https://scenepilot.thecreatingco.com/tools/captions/","page":"https://thecreatingco.com/products/captions/","accepts":["video/*","audio/*"],"opens":true},{"id":"board","name":"Board","parent":"scenepilot","group":"film","blurb":"Script to storyboard","url":"https://scenepilot.thecreatingco.com/tools/board/","openUrl":"https://scenepilot.thecreatingco.com/tools/board/","page":"https://thecreatingco.com/products/board/","accepts":["text/plain",".txt",".fountain"]},{"id":"grade","name":"Grade","parent":"scenepilot","group":"film","blurb":"Grade from a reference","url":"https://scenepilot.thecreatingco.com/tools/grade/","openUrl":"https://scenepilot.thecreatingco.com/tools/grade/","page":"https://thecreatingco.com/products/grade/","accepts":["image/png","image/jpeg","image/webp","video/*",".cube"],"opens":true},{"id":"reframe","name":"Reframe","parent":"scenepilot","group":"film","blurb":"Wide to vertical","url":"https://scenepilot.thecreatingco.com/tools/reframe/","openUrl":"https://scenepilot.thecreatingco.com/tools/reframe/","page":"https://thecreatingco.com/products/scenepilot/","accepts":["video/*"],"opens":true},{"id":"stemdeck","name":"StemDeck","group":"music","blurb":"Stem remix studio","url":"https://stemdeck.thecreatingco.com/studio","openUrl":"https://stemdeck.thecreatingco.com/studio","page":"https://thecreatingco.com/products/stemdeck/","accepts":["audio/*"],"opens":true},{"id":"sattari","name":"Sattari","group":"music","blurb":"Music tools","url":"https://sattarimusic.com/studio","openUrl":"https://sattarimusic.com/studio","page":"https://thecreatingco.com/products/stemdeck/#sattari-labs","accepts":[]},{"id":"split","name":"Split","parent":"sattari","group":"music","blurb":"Separate stems","url":"https://sattarimusic.com/studio/split","openUrl":"https://sattarimusic.com/studio/split","page":"https://thecreatingco.com/products/split/","accepts":["audio/*"],"opens":true},{"id":"key-bpm","name":"Key & BPM","parent":"sattari","group":"music","blurb":"Key and tempo","url":"https://sattarimusic.com/studio/keybpm","openUrl":"https://sattarimusic.com/studio/keybpm","page":"https://thecreatingco.com/products/key-bpm/","accepts":["audio/*"],"opens":true},{"id":"vox","name":"Vox","parent":"sattari","group":"music","blurb":"Vocal tune & harmony","url":"https://sattarimusic.com/studio/vox","openUrl":"https://sattarimusic.com/studio/vox","page":"https://thecreatingco.com/products/vox/","accepts":["audio/*"],"opens":true},{"id":"canvas","name":"Canvas","parent":"sattari","group":"music","blurb":"Audio-reactive visuals","url":"https://sattarimusic.com/studio/canvas","openUrl":"https://sattarimusic.com/studio/canvas","page":"https://thecreatingco.com/products/canvas/","accepts":["audio/*","image/png","image/jpeg","image/webp"],"opens":true},{"id":"pocket","name":"Pocket","parent":"sattari","group":"music","blurb":"Beat sketchpad","url":"https://sattarimusic.com/studio/pocket","openUrl":"https://sattarimusic.com/studio/pocket","page":"https://thecreatingco.com/products/pocket/","accepts":[]},{"id":"press","name":"Press","parent":"sattari","group":"music","blurb":"Press kit builder","url":"https://sattarimusic.com/press","openUrl":"https://sattarimusic.com/press","page":"https://thecreatingco.com/products/press/","accepts":["image/png","image/jpeg","image/webp"],"opens":true},{"id":"librarian","name":"Librarian","group":"everyday","blurb":"Books & PDF reader","url":"https://librarian.thecreatingco.com/","openUrl":"https://librarian.thecreatingco.com/","page":"https://thecreatingco.com/products/librarian/","accepts":["application/pdf",".pdf"]},{"id":"reclaim","name":"Reclaim","group":"everyday","blurb":"Duplicate file review","url":"https://reclaim.thecreatingco.com/browser/","openUrl":"https://reclaim.thecreatingco.com/browser/","page":"https://thecreatingco.com/products/reclaim/","accepts":[]},{"id":"bounce","name":"Bounce","group":"everyday","blurb":"Player for your music","url":"https://bounce.thecreatingco.com/browser/","openUrl":"https://bounce.thecreatingco.com/browser/","page":"https://thecreatingco.com/products/bounce/","accepts":["audio/*"],"opens":true},{"id":"locker","name":"Locker","group":"locker","blurb":"Your files, across the apps","url":"https://thecreatingco.com/locker/","openUrl":"https://thecreatingco.com/locker/","accepts":["*/*"]},{"id":"sessions","name":"Sessions","group":"community","menu":false,"blurb":"Shared listening rooms","url":"https://thecreatingco.com/community/network?view=Sessions","openUrl":"https://thecreatingco.com/community/network?view=Sessions","accepts":[]},{"id":"pocket-studio","name":"Pocket Studio","group":"community","menu":false,"blurb":"Voice memos & sharing","url":"https://thecreatingco.com/community/network?view=Pocket%20Studio","openUrl":"https://thecreatingco.com/community/network?view=Pocket%20Studio","accepts":[]}]}/*@END*/;
  var registry = REGISTRY || { groups: [], apps: [] };

  function findApp(id) {
    for (var i = 0; i < registry.apps.length; i++) if (registry.apps[i].id === id) return registry.apps[i];
    return null;
  }
  function guessApp() {
    var best = null, bestLen = -1, here = location.origin + location.pathname;
    registry.apps.forEach(function (a) {
      try {
        var u = new URL(a.url);
        if (u.origin === location.origin && here.indexOf(u.origin + u.pathname) === 0 && u.pathname.length > bestLen) { best = a.id; bestLen = u.pathname.length; }
      } catch (e) {}
    });
    return best || '';
  }
  var APP = ds.app || guessApp();

  // ---- Locker transport mode ------------------------------------------------
  // bridge: hidden iframe to BASE/locker/bridge.html. Shares storage with the
  //         Locker page only when this page is same-site with BASE
  //         (thecreatingco.com and *.thecreatingco.com).
  // popup:  everyone else (sattarimusic.com, *.netlify.app, localhost) gets a
  //         partitioned iframe, so we talk to a first-party popup instead.
  var baseHost = new URL(BASE).hostname;
  var sameSite = location.origin === BASE ||
    (baseHost === 'thecreatingco.com' && location.protocol === 'https:' && /(^|\.)thecreatingco\.com$/.test(location.hostname));
  var MODE = ds.locker === 'off' ? 'off' : (ds.locker === 'bridge' || ds.locker === 'popup') ? ds.locker : (sameSite ? 'bridge' : 'popup');

  function lockerError(code, message) {
    var e = new Error(message);
    e.name = 'TCCLockerError';
    e.code = code;
    return e;
  }
  var MSG = {
    unavailable: 'The Locker can’t be reached right now (offline?). Your work in this app is not affected.',
    blocked: 'Your browser blocked the Locker window. Allow pop-ups for this site, or start this from a button click.',
    isolated: 'This page can’t open the Locker window (Cross-Origin-Opener-Policy). Use same-origin-allow-popups.',
    closed: 'The Locker window was closed before it finished.',
    timeout: 'The Locker took too long to answer.'
  };

  var pending = {};
  var seq = 0;
  function send(win, op, args, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = (++seq) + '.' + Math.random().toString(36).slice(2);
      var timer = setTimeout(function () { finish(lockerError('timeout', MSG.timeout)); }, timeoutMs || 60000);
      var watch = setInterval(function () { if (win.closed) finish(lockerError('closed', MSG.closed)); }, 700);
      function finish(error, result) {
        if (!pending[id]) return;
        delete pending[id];
        clearTimeout(timer); clearInterval(watch);
        if (error) reject(error); else resolve(result);
      }
      pending[id] = finish;
      try {
        win.postMessage({ tcc: 1, kind: 'req', id: id, op: op, args: args || {}, app: APP }, BASE);
      } catch (e) {
        finish(lockerError('bad-request', 'Could not send this to the Locker: ' + e.message));
      }
    });
  }
  function settle(d) {
    var f = pending[d.id];
    if (!f) return;
    if (d.ok) f(null, d.result);
    else f(lockerError((d.error && d.error.code) || 'storage', (d.error && d.error.message) || 'Locker error.'));
  }

  // bridge
  var bridge = null;
  function bridgeConnect() {
    if (bridge) return bridge.ready;
    bridge = { frame: document.createElement('iframe') };
    bridge.ready = new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(false); }, 8000);
      bridge.onReady = function () { clearTimeout(t); resolve(true); };
    });
    var f = bridge.frame;
    f.src = BASE + '/locker/bridge.html';
    f.title = 'thecreateco Locker';
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    f.style.display = 'none';
    var attach = function () { (document.body || document.documentElement).appendChild(f); };
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);
    return bridge.ready;
  }

  // popup handoff (first-party window on BASE)
  var handoff = null;
  function handoffWindow() {
    if (handoff && !handoff.win.closed) return handoff;
    var w = null;
    try {
      w = window.open(LOCKER_URL + '?handoff=' + encodeURIComponent(APP || ''), 'tcc-locker-handoff', 'popup,width=440,height=600');
    } catch (e) {}
    if (!w) throw lockerError('popup-blocked', MSG.blocked);
    if (w.closed) throw lockerError('popup-blocked', MSG.isolated);
    handoff = { win: w };
    handoff.ready = new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(lockerError('timeout', MSG.timeout)); }, 30000);
      var watch = setInterval(function () { if (w.closed) { clearInterval(watch); clearTimeout(t); reject(lockerError('closed', MSG.closed)); } }, 700);
      handoff.onReady = function () { clearTimeout(t); clearInterval(watch); resolve(); };
    });
    return handoff;
  }

  // Must stay synchronous up to window.open so popup mode works from a click.
  function call(op, args, timeoutMs) {
    if (MODE === 'off') return Promise.reject(lockerError('unavailable', MSG.unavailable));
    if (MODE === 'popup') {
      var h;
      try { h = handoffWindow(); } catch (e) { return Promise.reject(e); }
      return h.ready.then(function () { return send(h.win, op, args, timeoutMs); });
    }
    return bridgeConnect().then(function (ok) {
      if (!ok) throw lockerError('unavailable', MSG.unavailable);
      return send(bridge.frame.contentWindow, op, args, timeoutMs);
    });
  }

  function toBlob(f) {
    if (!f) return null;
    var b = f.blob != null ? f.blob : f.file;
    if (b instanceof Blob) return b;
    if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return new Blob([b], { type: f.type || '' });
    return null;
  }
  function normFile(f) {
    var blob = toBlob(f);
    if (!blob) throw lockerError('bad-request', 'Pass { name, type, blob } with a Blob, File or ArrayBuffer.');
    return { name: f.name || (blob.name) || 'Untitled', type: f.type || blob.type || 'application/octet-stream', blob: blob, meta: f.meta };
  }

  // ---- sendTo / onOpen ------------------------------------------------------
  var served = []; // windows we opened via sendTo, and what they may ask for
  function sendTo(appId, idOrFile) {
    var app = findApp(appId);
    if (!app) return Promise.reject(lockerError('unknown-app', 'No app called "' + appId + '" in the suite registry.'));
    var direct = idOrFile && typeof idOrFile === 'object';
    var file = null, id = idOrFile;
    if (direct) {
      try { file = normFile(idOrFile); } catch (e) { return Promise.reject(e); }
      id = 'x-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    if (!id) return Promise.reject(lockerError('bad-request', 'sendTo(appId, id) needs a Locker file id.'));
    var url = new URL(app.openUrl || app.url);
    url.searchParams.set('tcc-open', String(id));
    var w = null;
    try { w = window.open(url.href, '_blank'); } catch (e) {}
    if (!w) return Promise.reject(lockerError('popup-blocked', MSG.blocked));
    served.push({ win: w, origin: url.origin, id: String(id), file: file, until: Date.now() + 15 * 60 * 1000 });
    return Promise.resolve({ app: app.id, url: url.href, id: String(id) });
  }

  function serveOpenRequest(ev) {
    var d = ev.data, now = Date.now();
    served = served.filter(function (s) { return s.until > now && !s.win.closed; });
    var s = null;
    for (var i = 0; i < served.length; i++) if (served[i].win === ev.source && served[i].id === d.id) s = served[i];
    if (!s || s.origin !== ev.origin) return;
    var p = s.file
      ? Promise.resolve({ id: s.id, name: s.file.name, type: s.file.type, size: s.file.blob.size, app: APP, created: Date.now(), meta: s.file.meta || {}, blob: s.file.blob })
      : call('get', { id: s.id });
    p.then(function (entry) {
      ev.source.postMessage({ tcc: 1, kind: 'open-file', id: s.id, ok: true, entry: entry }, ev.origin);
    }, function (e) {
      ev.source.postMessage({ tcc: 1, kind: 'open-file', id: s.id, ok: false, error: { code: e.code, message: e.message } }, ev.origin);
    });
  }

  var openId = null;
  try { openId = new URLSearchParams(location.search).get('tcc-open'); } catch (e) {}
  var opened = { entry: null, handlers: [], waiters: {} };

  function deliver(entry) {
    if (opened.entry) return;
    opened.entry = entry;
    try {
      var u = new URL(location.href);
      u.searchParams.delete('tcc-open');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) {}
    hideToast();
    opened.handlers.forEach(function (fn) { runHandler(fn, entry); });
    try { window.dispatchEvent(new CustomEvent('tcc:open', { detail: entry })); } catch (e) {}
  }
  function runHandler(fn, entry) {
    Promise.resolve().then(function () { return fn(entry); }).catch(function (e) {
      if (window.console) console.error('[tcc] onOpen handler failed', e);
    });
  }
  function askOpener(id) {
    return new Promise(function (resolve, reject) {
      if (!window.opener || window.opener === window) return reject(lockerError('not-found', 'No sender window.'));
      var t = setTimeout(function () { delete opened.waiters[id]; reject(lockerError('timeout', MSG.timeout)); }, 5000);
      opened.waiters[id] = function (d) {
        clearTimeout(t); delete opened.waiters[id];
        if (d.ok && d.entry && d.entry.blob instanceof Blob) resolve(d.entry);
        else reject(lockerError((d.error && d.error.code) || 'not-found', (d.error && d.error.message) || 'Not found.'));
      };
      try { window.opener.postMessage({ tcc: 1, kind: 'open-request', id: id }, '*'); } catch (e) { reject(e); }
    });
  }
  function startOpen() {
    if (!openId) return;
    var id = openId;
    var ephemeral = id.indexOf('x-') === 0;
    var p;
    if (ephemeral) p = askOpener(id);
    else if (MODE === 'bridge') p = call('get', { id: id }).catch(function () { return askOpener(id); });
    else p = askOpener(id);
    p.then(deliver, function () {
      if (ephemeral) {
        toast('The file sent to this app didn’t arrive. Try sending it again.', null);
        return;
      }
      toast('A file from your Locker is waiting for this app.', 'Open file', function () {
        call('get', { id: id }).then(deliver, function (e) { toast(e.message, null); });
      });
    });
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || d.tcc !== 1) return;
    if (bridge && ev.source === bridge.frame.contentWindow && ev.origin === BASE) {
      if (d.kind === 'ready') bridge.onReady();
      else if (d.kind === 'reply') settle(d);
      else if (d.kind === 'changed') emit('tcc:locker-change', d.change);
      return;
    }
    if (handoff && ev.source === handoff.win && ev.origin === BASE) {
      if (d.kind === 'ready') handoff.onReady();
      else if (d.kind === 'reply') settle(d);
      return;
    }
    if (d.kind === 'open-request' && typeof d.id === 'string') return serveOpenRequest(ev);
    if (d.kind === 'open-file' && ev.source === window.opener && opened.waiters[d.id]) {
      if (!isTrusted(ev.origin)) return;
      opened.waiters[d.id](d);
    }
  });

  // Same allowlist as /locker/core.js (exact matches, no suffix tricks).
  function isTrusted(origin) {
    if (origin === BASE || origin === location.origin) return true;
    return /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+)?thecreatingco\.com$/.test(origin) ||
      /^https:\/\/(www\.)?sattarimusic\.com$/.test(origin) ||
      /^https:\/\/(?:(?:[0-9a-f]{24}|deploy-preview-\d{1,6})--)?(?:momentium-creative|scene-pilot|luma-studio-app|sattari|glyph-studio-610|form-studio-review|ghost-garment-studio-lp|librarian-atlas|universal-computer-operator|bounce-music-player|stemdeck-studio)\.netlify\.app$/.test(origin) ||
      /^http:\/\/localhost(?::\d{1,5})?$/.test(origin);
  }

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  // ---- registry -------------------------------------------------------------
  var appsP = null;
  function apps() {
    if (!appsP) {
      appsP = fetch(BASE + '/suite/v1/apps.json', { mode: 'cors', credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { if (j && j.apps) registry = j; return registry; })
        .catch(function () { return registry; });
    }
    return appsP.then(function (r) { return r.apps.map(function (a) { return Object.assign({}, a); }); });
  }

  // ---- public API -----------------------------------------------------------
  var locker = {
    get mode() { return MODE; },
    get available() { return status.available; },
    save: function (f) {
      var file;
      try { file = normFile(f || {}); } catch (e) { return Promise.reject(e); }
      return call('save', file, 180000);
    },
    list: function (opts) {
      opts = opts || {};
      return call('list', { types: opts.types || null, app: opts.app || null });
    },
    get: function (id) { return call('get', { id: String(id) }, 180000); },
    remove: function (id) { return call('remove', { id: String(id) }); },
    rename: function (id, name) { return call('rename', { id: String(id), name: name }); },
    estimate: function () { return call('estimate', {}); },
    sendTo: sendTo,
    onOpen: function (fn) {
      if (typeof fn !== 'function') return function () {};
      opened.handlers.push(fn);
      if (opened.entry) runHandler(fn, opened.entry);
      return function () { opened.handlers = opened.handlers.filter(function (h) { return h !== fn; }); };
    },
    accepts: function (appId, entry) {
      var a = findApp(appId);
      return !!(a && matchAccepts(entry, a.accepts));
    },
    targets: function (entry) {
      return apps().then(function (list) {
        return list.filter(function (a) { return a.id !== 'locker' && a.menu !== false && a.opens === true && matchAccepts(entry, a.accepts); });
      });
    }
  };

  function matchAccepts(entry, accepts) {
    if (!accepts || !accepts.length) return false;
    var type = String(entry.type || '').toLowerCase(), name = String(entry.name || '').toLowerCase();
    return accepts.some(function (a) {
      a = String(a).toLowerCase();
      if (a === '*/*') return true;
      if (a.charAt(0) === '.') return name.slice(-a.length) === a;
      if (a.slice(-2) === '/*') return type.indexOf(a.slice(0, -1)) === 0;
      return a === type;
    });
  }

  var status = { version: VERSION, app: APP, mode: MODE, available: MODE === 'popup', opening: !!openId };
  var ready = new Promise(function (resolve) {
    function done(avail) {
      status.available = !!avail;
      resolve(TCC);
      emit('tcc:ready', status);
    }
    if (MODE === 'bridge') bridgeConnect().then(done);
    else setTimeout(function () { done(MODE === 'popup'); }, 0);
  });

  var TCC = window.TCC = {
    version: VERSION,
    app: APP,
    base: BASE,
    ready: ready,
    status: status,
    apps: apps,
    locker: locker,
    menu: { open: function () { var m = firstMenu(); if (m) openPanel(m); }, close: function () { closePanel(false); } }
  };

  // ---- UI: <tcc-suite-menu> + panel ----------------------------------------
  var ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="3" cy="3" r="1.8"/><circle cx="9" cy="3" r="1.8"/><circle cx="15" cy="3" r="1.8"/><circle cx="3" cy="9" r="1.8"/><circle cx="9" cy="9" r="1.8"/><circle cx="15" cy="9" r="1.8"/><circle cx="3" cy="15" r="1.8"/><circle cx="9" cy="15" r="1.8"/><circle cx="15" cy="15" r="1.8"/></svg>';
  var FONT = 'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;';
  var TRIGGER_CSS =
    ':host{display:inline-block;width:36px;height:36px;flex:none;vertical-align:middle;color:inherit;contain:layout style}' +
    ':host([hidden]){display:none}' +
    'button{all:unset;box-sizing:border-box;display:grid;place-items:center;width:100%;height:100%;border-radius:10px;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent}' +
    'button:hover,button[aria-expanded=true]{background:rgba(127,127,127,.18)}' +
    'button:focus-visible{outline:2px solid #d8ff3e;outline-offset:2px}' +
    ':host([floating]){position:fixed;z-index:2147482990;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:40px;height:40px;color:#f4f1ea}' +
    ':host([floating][position=br]){left:auto;right:max(12px,env(safe-area-inset-right))}' +
    ':host([floating][position=tl]){bottom:auto;top:max(12px,env(safe-area-inset-top))}' +
    ':host([floating][position=tr]){bottom:auto;left:auto;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right))}' +
    ':host([floating]) button{background:#151515;border:1px solid rgba(255,255,255,.16);border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,.35);opacity:.92}' +
    ':host([floating]) button:hover{opacity:1;background:#222}' +
    '@media print{:host{display:none}}';
  var PANEL_CSS =
    '.panel,.toast{' + FONT + 'box-sizing:border-box;position:fixed;z-index:2147483000;background:#151515;color:#f4f1ea;border:1px solid rgba(255,255,255,.13);box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:14px;line-height:1.35;-webkit-font-smoothing:antialiased;text-align:left;letter-spacing:normal}' +
    '.panel{border-radius:16px;padding:12px 12px 10px;overflow:auto;overscroll-behavior:contain;width:560px}' +
    '.panel[hidden],.toast[hidden]{display:none}' +
    '.panel.sheet{left:8px!important;right:8px;bottom:max(8px,env(safe-area-inset-bottom))!important;top:auto!important;width:auto!important;max-height:min(78vh,640px)!important;border-radius:18px}' +
    '.head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 4px 4px}' +
    '.brand{font-weight:700;font-size:13px;letter-spacing:.01em}' +
    '.brand span{color:#9b978d;font-weight:500}' +
    '.x{all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#bdb9ae;font-size:20px;line-height:1}' +
    '.x:hover{background:rgba(255,255,255,.08)}.x:focus-visible{outline:2px solid #d8ff3e}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}.sheet .grid{grid-template-columns:1fr}' +
    'h2{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:#9b978d;margin:10px 8px 4px}' +
    'ul{list-style:none;margin:0;padding:0}' +
    'a{color:inherit;text-decoration:none;border-radius:10px;outline-offset:1px}' +
    'a:hover{background:rgba(255,255,255,.07)}a:focus-visible{outline:2px solid #d8ff3e;background:rgba(255,255,255,.07)}' +
    'a.app{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:8px 10px}' +
    '.name{font-weight:600}.blurb{color:#9b978d;font-size:12px;text-align:right}' +
    '.tools{display:flex;flex-wrap:wrap;gap:4px;padding:0 6px 6px 10px}' +
    '.tools a{font-size:12.5px;padding:5px 10px;border:1px solid rgba(255,255,255,.13);border-radius:999px;min-height:18px}' +
    '.tools em{font-style:normal;color:#9b978d;font-size:11px;margin-left:4px}' +
    'a[aria-current=page]{background:rgba(216,255,62,.12);box-shadow:inset 3px 0 0 #d8ff3e}' +
    '.tools a[aria-current=page]{box-shadow:none;border-color:#d8ff3e}' +
    '.foot{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}' +
    '.foot a{padding:8px 10px}.foot .locker{flex:1 1 auto;display:flex;gap:10px;align-items:baseline}' +
    '.foot .locker .name{color:#d8ff3e}' +
    '.toast{left:50%;transform:translateX(-50%);bottom:max(16px,env(safe-area-inset-bottom));border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 24px)}' +
    '.toast p{margin:0}.toast button{all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;font-weight:600;font-size:13px;white-space:nowrap}' +
    '.toast .primary{background:#d8ff3e;color:#111}.toast .ghost{color:#bdb9ae}.toast button:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '@media (prefers-reduced-motion:no-preference){.panel:not([hidden]){animation:tccIn .14s ease-out}}' +
    '@keyframes tccIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
    '@media (forced-colors:active){.panel,.toast{border:1px solid CanvasText}}';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ui = null;
  var current = null; // trigger element whose panel is open
  function layer() {
    if (ui) return ui;
    var host = document.createElement('tcc-suite-layer');
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483000;display:block';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + PANEL_CSS + '</style>' +
      '<div class="panel" role="dialog" aria-modal="false" aria-label="thecreateco apps" hidden></div>' +
      '<div class="toast" role="status" aria-live="polite" hidden></div>';
    document.body.appendChild(host);
    ui = { host: host, root: root, panel: root.querySelector('.panel'), toast: root.querySelector('.toast') };
    ui.panel.addEventListener('keydown', panelKeys);
    ui.panel.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.x')) closePanel(true);
    });
    return ui;
  }

  function link(a, cls) {
    var cur = a.id === APP ? ' aria-current="page"' : '';
    return '<a class="' + cls + '" href="' + esc(a.url) + '"' + cur + '>';
  }
  function renderPanel() {
    var groups = (registry.groups || []).filter(function (g) { return g.id !== 'locker'; });
    var tops = registry.apps.filter(function (a) { return !a.parent && a.menu !== false; });
    var html = '<div class="head"><span class="brand">thecreateco <span>apps</span></span>' +
      '<button type="button" class="x" aria-label="Close apps menu">×</button></div><nav class="grid" aria-label="thecreateco apps">';
    groups.forEach(function (g) {
      var list = tops.filter(function (a) { return a.group === g.id; });
      if (!list.length) return;
      html += '<section aria-labelledby="tcc-g-' + esc(g.id) + '"><h2 id="tcc-g-' + esc(g.id) + '">' + esc(g.name) + '</h2><ul>';
      list.forEach(function (a) {
        html += '<li>' + link(a, 'app') + '<span class="name">' + esc(a.name) + '</span><span class="blurb">' + esc(a.blurb || '') + '</span></a>';
        var kids = registry.apps.filter(function (k) { return k.parent === a.id && k.menu !== false; });
        if (kids.length) {
          html += '<ul class="tools" aria-label="' + esc(a.name) + ' tools">';
          kids.forEach(function (k) {
            html += '<li>' + link(k, 'tool') + esc(k.name) + (k.status === 'preview' ? '<em>preview</em>' : '') + '</a></li>';
          });
          html += '</ul>';
        }
        html += '</li>';
      });
      html += '</ul></section>';
    });
    var lockerApp = findApp('locker') || { id: 'locker', url: LOCKER_URL, name: 'Locker', blurb: 'Your files, across the apps' };
    var home = registry.home || { name: 'thecreatingco.com', url: 'https://thecreatingco.com/' };
    html += '</nav><div class="foot">' + link(lockerApp, 'locker') + '<span class="name">' + esc(lockerApp.name) + '</span><span class="blurb">' + esc(lockerApp.blurb || '') + '</span></a>' +
      '<a class="home" href="' + esc(home.url) + '">' + esc(home.name) + '</a></div>';
    ui.panel.innerHTML = html;
  }

  function place(trigger) {
    var p = ui.panel, vw = window.innerWidth, vh = window.innerHeight;
    if (vw <= 640 || trigger.hasAttribute('floating')) {
      if (vw <= 640) { p.className = 'panel sheet'; p.removeAttribute('style'); return; }
    }
    p.className = 'panel';
    var r = trigger.getBoundingClientRect();
    var w = Math.min(560, vw - 16);
    var left = Math.min(Math.max(8, r.left), vw - w - 8);
    var below = vh - r.bottom - 16, above = r.top - 16;
    var s = 'left:' + left + 'px;width:' + w + 'px;';
    if (below >= 360 || below >= above) s += 'top:' + (r.bottom + 8) + 'px;max-height:' + Math.max(160, below) + 'px;';
    else s += 'bottom:' + (vh - r.top + 8) + 'px;max-height:' + Math.max(160, above) + 'px;';
    p.setAttribute('style', s);
  }

  function links() { return Array.prototype.slice.call(ui.panel.querySelectorAll('a, button.x')); }
  function openPanel(trigger) {
    if (!document.body) return;
    layer();
    if (current && current !== trigger) closePanel(false);
    apps(); // refresh registry in the background
    renderPanel();
    current = trigger;
    ui.panel.hidden = false;
    place(trigger);
    trigger._setExpanded(true);
    var focusEl = ui.panel.querySelector('a[aria-current=page]') || ui.panel.querySelector('a');
    if (focusEl) focusEl.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
  }
  function closePanel(returnFocus) {
    if (!ui || ui.panel.hidden) return;
    ui.panel.hidden = true;
    var t = current;
    current = null;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', escKey, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    if (t) { t._setExpanded(false); if (returnFocus) t._focus(); }
  }
  var raf = 0;
  function reposition(ev) {
    if (ev && ev.type === 'scroll' && ev.target && ui.panel.contains && (ev.target === ui.panel)) return;
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; if (current) place(current); });
  }
  function outside(ev) {
    var path = ev.composedPath ? ev.composedPath() : [ev.target];
    if (path.indexOf(ui.host) !== -1 || (current && path.indexOf(current) !== -1)) return;
    closePanel(false);
  }
  function escKey(ev) {
    if (ev.key === 'Escape' && current) { ev.stopPropagation(); closePanel(true); }
  }
  function panelKeys(ev) {
    var all = links(), i = all.indexOf(ui.root.activeElement), n = all.length;
    if (!n) return;
    var k = ev.key, next = -1;
    if (k === 'ArrowDown' || k === 'ArrowRight') next = (i + 1) % n;
    else if (k === 'ArrowUp' || k === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = n - 1;
    else if (k === 'Tab') {
      if ((!ev.shiftKey && i === n - 1) || (ev.shiftKey && i <= 0)) { ev.preventDefault(); closePanel(true); }
      return;
    } else return;
    ev.preventDefault();
    all[next].focus();
  }

  var mounted = 0;
  function firstMenu() { return document.querySelector('tcc-suite-menu'); }

  if (window.customElements && !customElements.get('tcc-suite-menu')) {
    customElements.define('tcc-suite-menu', class extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          var root = this.attachShadow({ mode: 'open' });
          root.innerHTML = '<style>' + TRIGGER_CSS + '</style><button type="button" part="button" aria-haspopup="dialog" aria-expanded="false" aria-label="thecreateco apps" title="thecreateco apps">' + ICON + '</button>';
          var self = this, btn = root.querySelector('button');
          btn.addEventListener('click', function () {
            if (current === self) closePanel(true); else openPanel(self);
          });
          btn.addEventListener('keydown', function (ev) {
            if ((ev.key === 'ArrowDown') && current !== self) { ev.preventDefault(); openPanel(self); }
          });
          this._btn = btn;
        }
        if (!this.hasAttribute('floating')) {
          mounted++;
          var f = document.querySelectorAll('tcc-suite-menu[floating]');
          for (var i = 0; i < f.length; i++) f[i].remove();
        }
      }
      disconnectedCallback() {
        if (!this.hasAttribute('floating')) mounted = Math.max(0, mounted - 1);
        if (current === this) closePanel(false);
      }
      _setExpanded(v) { if (this._btn) this._btn.setAttribute('aria-expanded', v ? 'true' : 'false'); }
      _focus() { if (this._btn) this._btn.focus(); }
    });
  }

  function ensureFloating() {
    if (ds.menu === 'none' || mounted > 0 || !document.body || !window.customElements) return;
    if (document.querySelector('tcc-suite-menu')) return;
    var m = document.createElement('tcc-suite-menu');
    m.setAttribute('floating', '');
    if (/^(bl|br|tl|tr)$/.test(ds.menuPosition || '')) m.setAttribute('position', ds.menuPosition);
    document.body.appendChild(m);
  }

  // ---- toast (used when a Locker file can't be fetched automatically) ------
  var toastTimer = 0;
  function toast(text, actionLabel, action) {
    if (!document.body) return;
    layer();
    var t = ui.toast;
    t.innerHTML = '<p>' + esc(text) + '</p>' + (actionLabel ? '<button type="button" class="primary">' + esc(actionLabel) + '</button>' : '') + '<button type="button" class="ghost">Dismiss</button>';
    t.hidden = false;
    var primary = t.querySelector('.primary');
    if (primary) primary.addEventListener('click', function () { hideToast(); action(); });
    t.querySelector('.ghost').addEventListener('click', hideToast);
    clearTimeout(toastTimer);
    if (!actionLabel) toastTimer = setTimeout(hideToast, 8000);
  }
  function hideToast() { if (ui) ui.toast.hidden = true; }

  // ---- boot -----------------------------------------------------------------
  function boot() {
    startOpen();
    var later = function () { setTimeout(ensureFloating, 1200); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
