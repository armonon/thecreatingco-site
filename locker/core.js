/*! thecreateco Locker core v1 — storage + origin allowlist.
 * Used by /locker/bridge.html (iframe bridge) and /locker/ (Locker page and
 * popup handoff). Files live in IndexedDB on the thecreatingco.com origin, in
 * this browser on this device. No cloud, no account, no sync. */
(function (global) {
  'use strict';

  var DB_NAME = 'tcc-locker';
  var STORE = 'files';
  var MAX_META = 64 * 1024;

  // Exact-match origin allowlist. Anchored regexes only; no suffix matching
  // (evilthecreatingco.com, thecreatingco.com.evil.com, http:// variants fail).
  var NETLIFY_SITES = [
    'momentium-creative', 'scene-pilot', 'luma-studio-app', 'sattari',
    'glyph-studio-610', 'form-studio-review', 'ghost-garment-studio-lp',
    'librarian-atlas', 'universal-computer-operator', 'bounce-music-player',
    'stemdeck-studio'
  ];
  var ALLOW = [
    /^https:\/\/thecreatingco\.com$/,
    /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+thecreatingco\.com$/,
    /^https:\/\/sattarimusic\.com$/,
    /^https:\/\/www\.sattarimusic\.com$/,
    // Production + draft/deploy-preview hosts of our own Netlify sites only:
    // <site>.netlify.app, <24-hex deploy id>--<site>.netlify.app,
    // deploy-preview-<n>--<site>.netlify.app
    new RegExp('^https:\\/\\/(?:(?:[0-9a-f]{24}|deploy-preview-\\d{1,6})--)?(?:' +
      NETLIFY_SITES.join('|') + ')\\.netlify\\.app$'),
    /^http:\/\/localhost(?::\d{1,5})?$/
  ];

  function allowed(origin) {
    if (typeof origin !== 'string' || origin.length > 253) return false;
    for (var i = 0; i < ALLOW.length; i++) if (ALLOW[i].test(origin)) return true;
    return false;
  }

  // ---- IndexedDB ----------------------------------------------------------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(fail('unavailable', 'This browser has no IndexedDB storage available (private mode?).'));
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var s = req.result.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('created', 'created');
      };
      req.onsuccess = function () {
        var d = req.result;
        d.onversionchange = function () { d.close(); dbp = null; };
        resolve(d);
      };
      req.onerror = function () { dbp = null; reject(wrap(req.error)); };
      req.onblocked = function () { dbp = null; reject(fail('unavailable', 'The Locker is busy in another tab. Close other Locker tabs and try again.')); };
    });
    return dbp;
  }

  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function wrap(e) {
    if (e && e.code && typeof e.code === 'string') return e;
    var name = e && e.name;
    if (name === 'QuotaExceededError' || (e && /quota/i.test(e.message || ''))) {
      return fail('quota', 'Your browser is out of storage space for the Locker. Delete files you no longer need at thecreatingco.com/locker, then try again.');
    }
    return fail('storage', 'The Locker could not use browser storage' + (e && e.message ? ': ' + e.message : '.'));
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = d.transaction(STORE, mode); } catch (e) { return reject(wrap(e)); }
        var out;
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(wrap(t.error)); };
        t.onabort = function () { reject(wrap(t.error)); };
        try { fn(t.objectStore(STORE), function (v) { out = v; }); } catch (e) { try { t.abort(); } catch (_) {} reject(wrap(e)); }
      });
    });
  }

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function strip(e) {
    return { id: e.id, name: e.name, type: e.type, size: e.size, app: e.app, created: e.created, updated: e.updated || e.created, meta: e.meta || {} };
  }

  function cleanName(n) {
    n = String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    return (n || 'Untitled').slice(0, 200);
  }
  function cleanMeta(m) {
    if (m == null) return {};
    var s;
    try { s = JSON.stringify(m); } catch (e) { throw fail('bad-request', 'meta must be plain JSON data.'); }
    if (!s || s.length > MAX_META) throw fail('bad-request', 'meta is too large (64 KB max).');
    return JSON.parse(s);
  }

  // accepts: ["*/*", "audio/*", "image/png", ".glb"]
  function matches(entry, accepts) {
    if (!accepts || !accepts.length) return false;
    var type = String(entry.type || '').toLowerCase();
    var name = String(entry.name || '').toLowerCase();
    for (var i = 0; i < accepts.length; i++) {
      var a = String(accepts[i]).toLowerCase().trim();
      if (a === '*/*' || a === '*') return true;
      if (a.charAt(0) === '.') { if (name.slice(-a.length) === a) return true; continue; }
      if (a.slice(-2) === '/*') { if (type.indexOf(a.slice(0, -1)) === 0) return true; continue; }
      if (a === type) return true;
    }
    return false;
  }

  var persistAsked = false;
  function askPersist() {
    if (persistAsked) return;
    persistAsked = true;
    try {
      if (navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(function (p) { if (!p && navigator.storage.persist) return navigator.storage.persist(); }).catch(function () {});
      }
    } catch (e) {}
  }

  var channel = null;
  try { channel = new BroadcastChannel('tcc-locker'); } catch (e) {}
  function changed(kind, id) { try { channel && channel.postMessage({ kind: kind, id: id }); } catch (e) {} }

  var api = {
    allowed: allowed,
    matches: matches,
    askPersist: askPersist,
    channel: channel,

    save: function (a, app, origin) {
      a = a || {};
      var blob = a.blob;
      if (!(blob instanceof Blob)) return Promise.reject(fail('bad-request', 'save() needs a Blob in `blob`.'));
      var entry;
      try {
        entry = {
          id: uid(),
          name: cleanName(a.name),
          type: String(a.type || blob.type || 'application/octet-stream').slice(0, 200),
          size: blob.size,
          app: String(app || 'unknown').slice(0, 64),
          origin: origin || '',
          created: Date.now(),
          meta: cleanMeta(a.meta),
          blob: blob
        };
        entry.updated = entry.created;
      } catch (e) { return Promise.reject(e); }
      askPersist();
      return tx('readwrite', function (s) { s.add(entry); }).then(function () {
        changed('saved', entry.id);
        return entry.id;
      });
    },

    list: function (a) {
      a = a || {};
      return tx('readonly', function (s, done) {
        var out = [];
        s.index('created').openCursor(null, 'prev').onsuccess = function (ev) {
          var c = ev.target.result;
          if (!c) return done(out);
          var v = c.value;
          if ((!a.types || matches(v, a.types)) && (!a.app || v.app === a.app)) out.push(strip(v));
          c.continue();
        };
      });
    },

    get: function (a) {
      var id = a && a.id;
      return tx('readonly', function (s, done) {
        s.get(String(id)).onsuccess = function (ev) { done(ev.target.result); };
      }).then(function (v) {
        if (!v) throw fail('not-found', 'That file is no longer in the Locker.');
        var e = strip(v); e.blob = v.blob; return e;
      });
    },

    remove: function (a) {
      var id = String(a && a.id);
      return tx('readwrite', function (s) { s.delete(id); }).then(function () { changed('removed', id); return true; });
    },

    rename: function (a) {
      var id = String(a && a.id), name = cleanName(a && a.name);
      return tx('readwrite', function (s, done) {
        s.get(id).onsuccess = function (ev) {
          var v = ev.target.result;
          if (!v) return done(false);
          v.name = name; v.updated = Date.now(); s.put(v); done(true);
        };
      }).then(function (ok) {
        if (!ok) throw fail('not-found', 'That file is no longer in the Locker.');
        changed('renamed', id); return true;
      });
    },

    estimate: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted() : false])
        .then(function (r) { return { usage: r[0].usage, quota: r[0].quota, persisted: !!r[1] }; });
    }
  };

  var OPS = { save: 1, list: 1, get: 1, remove: 1, rename: 1, estimate: 1 };

  // Handle one protocol request. `reply(msg)` posts back to the requester.
  api.serve = function (ev, reply) {
    var d = ev.data;
    if (!d || d.tcc !== 1 || d.kind !== 'req') return false;
    if (!allowed(ev.origin)) {
      reply({ tcc: 1, kind: 'reply', id: d.id, ok: false, error: { code: 'forbidden', message: 'This site is not allowed to use the thecreateco Locker.' } });
      return true;
    }
    if (!OPS[d.op]) {
      reply({ tcc: 1, kind: 'reply', id: d.id, ok: false, error: { code: 'bad-request', message: 'Unknown Locker operation.' } });
      return true;
    }
    var p = d.op === 'save' ? api.save(d.args, d.app, ev.origin) : api[d.op](d.args || {});
    p.then(function (result) {
      reply({ tcc: 1, kind: 'reply', id: d.id, ok: true, result: result });
    }, function (e) {
      e = wrap(e);
      reply({ tcc: 1, kind: 'reply', id: d.id, ok: false, error: { code: e.code || 'storage', message: e.message } });
    });
    return true;
  };

  global.TCCLockerCore = api;
})(self);
