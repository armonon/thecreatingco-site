/* thecreateco Locker page: grid, previews, send-to, and the popup handoff
 * used by apps on other sites (sattarimusic.com, *.netlify.app, localhost). */
(function () {
  'use strict';
  var core = self.TCCLockerCore;
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(location.search);
  var isHandoff = params.has('handoff');

  function say(text, isError) {
    var m = $('#msg');
    m.textContent = text || '';
    m.classList.toggle('error', !!isError);
  }
  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    var u = ['KB', 'MB', 'GB', 'TB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (n >= 10 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
  }
  function fmtDate(t) {
    try { return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; }
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  if (!core) { say('The Locker could not start in this browser.', true); return; }

  if (isHandoff) return handoff();
  normal();

  // ---------------------------------------------------------------- handoff
  function handoff() {
    document.body.classList.add('handoff-mode');
    document.title = 'Locker handoff · thecreateco';
    var box = $('#handoff');
    box.hidden = false;
    var title = $('#handoff-title'), text = $('#handoff-text'), log = $('#handoff-log');
    $('#handoff-close').addEventListener('click', function () { window.close(); });
    var opener = window.opener;
    if (!opener || opener === window) {
      title.textContent = 'Nothing to connect';
      text.textContent = 'This window opens when a thecreateco app needs your Locker. You can close it.';
      return;
    }
    var idle = 0, busy = 0;
    function armIdle() {
      clearTimeout(idle);
      if (!busy) idle = setTimeout(function () { window.close(); }, 4000);
    }
    var VERB = { save: 'Saving', list: 'Listing files', get: 'Opening', remove: 'Deleting', rename: 'Renaming', estimate: 'Checking space' };
    window.addEventListener('message', function (ev) {
      if (ev.source !== opener) return;
      var d = ev.data;
      if (!d || d.tcc !== 1 || d.kind !== 'req') return;
      var host = ev.origin.replace(/^https?:\/\//, '');
      if (!core.allowed(ev.origin)) {
        title.textContent = 'Not allowed';
        text.textContent = host + ' isn’t a thecreateco app, so it can’t use your Locker.';
      } else {
        title.textContent = 'Connected to ' + host;
      }
      var label = (VERB[d.op] || d.op) + (d.op === 'save' && d.args && d.args.name ? ' “' + d.args.name + '”' : '');
      var li = el('li', { text: label + '…' });
      log.appendChild(li);
      busy++; clearTimeout(idle);
      core.serve(ev, function (msg) {
        busy--;
        li.textContent = label + (msg.ok ? ' — done' : ' — ' + (msg.error && msg.error.message));
        try { ev.source.postMessage(msg, ev.origin); } catch (e) {}
        if (!msg.ok && msg.error && (msg.error.code === 'quota' || msg.error.code === 'forbidden')) { clearTimeout(idle); return; }
        armIdle();
      });
    });
    title.textContent = 'Connecting…';
    try { opener.postMessage({ tcc: 1, kind: 'ready', v: 1 }, '*'); } catch (e) {}
    idle = setTimeout(function () { window.close(); }, 30000);
  }

  // ----------------------------------------------------------------- normal
  function normal() {
    var registry = { apps: [] };
    var entries = [];
    var urls = [];
    var tcc = null;

    // Suite menu + sendTo come from the shared kit; storage works without it.
    var s = document.createElement('script');
    s.src = '/suite/v1/suite.js';
    s.defer = true;
    s.dataset.app = 'locker';
    document.head.appendChild(s);
    window.addEventListener('tcc:ready', function () { tcc = window.TCC; });

    fetch('/suite/v1/apps.json').then(function (r) { return r.json(); }).then(function (j) {
      registry = j; fillFilter(); render();
    }).catch(function () {});

    function appName(id) {
      for (var i = 0; i < registry.apps.length; i++) if (registry.apps[i].id === id) return registry.apps[i].name;
      return id === 'unknown' || !id ? 'Unknown app' : id;
    }
    function fillFilter() {
      var sel = $('#app-filter'), cur = sel.value;
      var seen = {};
      entries.forEach(function (e) { seen[e.app] = 1; });
      sel.innerHTML = '';
      sel.appendChild(el('option', { value: '', text: 'All apps' }));
      Object.keys(seen).sort(function (a, b) { return appName(a).localeCompare(appName(b)); }).forEach(function (id) {
        sel.appendChild(el('option', { value: id, text: appName(id) }));
      });
      sel.value = seen[cur] ? cur : '';
    }

    function load() {
      return core.list({}).then(function (list) {
        entries = list; fillFilter(); render();
      }, function (e) { say(e.message, true); });
    }

    function kindOf(type) {
      type = String(type || '');
      if (/^image\//.test(type)) return 'image';
      if (/^audio\//.test(type)) return 'audio';
      if (/^video\//.test(type)) return 'video';
      return 'file';
    }
    function extLabel(e) {
      var m = /\.([a-z0-9]{1,6})$/i.exec(e.name || '');
      return m ? m[1] : (String(e.type || 'file').split('/').pop() || 'file').slice(0, 8);
    }

    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (items) {
      items.forEach(function (it) {
        if (!it.isIntersecting) return;
        io.unobserve(it.target);
        fillPreview(it.target);
      });
    }, { rootMargin: '200px' }) : null;

    function fillPreview(box) {
      var id = box.getAttribute('data-id'), kind = box.getAttribute('data-kind');
      core.get({ id: id }).then(function (e) {
        var url = URL.createObjectURL(e.blob);
        urls.push(url);
        box.innerHTML = '';
        if (kind === 'image') box.appendChild(el('img', { src: url, alt: 'Preview of ' + e.name, loading: 'lazy', decoding: 'async' }));
        else if (kind === 'video') box.appendChild(el('video', { src: url, controls: '', preload: 'metadata', playsinline: '', 'aria-label': 'Preview of ' + e.name }));
        else if (kind === 'audio') box.appendChild(el('audio', { src: url, controls: '', preload: 'metadata', 'aria-label': 'Play ' + e.name }));
      }).catch(function () {});
    }

    function render() {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      urls = [];
      var q = $('#q').value.trim().toLowerCase(), app = $('#app-filter').value;
      var shown = entries.filter(function (e) {
        return (!app || e.app === app) && (!q || e.name.toLowerCase().indexOf(q) !== -1 || appName(e.app).toLowerCase().indexOf(q) !== -1);
      });
      var grid = $('#grid');
      grid.innerHTML = '';
      $('#empty').hidden = entries.length > 0;
      if (entries.length && !shown.length) grid.appendChild(el('li', { class: 'none', text: 'No files match.' }));
      shown.forEach(function (e) { grid.appendChild(card(e)); });
      meter();
    }

    function card(e) {
      var kind = kindOf(e.type);
      var preview = el('div', { class: 'preview', 'data-id': e.id, 'data-kind': kind }, [el('span', { class: 'kind', text: extLabel(e) })]);
      if (kind !== 'file') { if (io) io.observe(preview); else fillPreview(preview); }
      var title = el('h2', { class: 'fname', title: e.name, text: e.name });
      var facts = el('p', { class: 'facts' }, [
        el('span', { class: 'badge', text: appName(e.app) }),
        el('span', { text: fmtSize(e.size) }),
        el('time', { datetime: new Date(e.created).toISOString(), text: fmtDate(e.created) })
      ]);
      var sendBtn = el('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', text: 'Send to' });
      var sendList = el('ul', { hidden: '' });
      var send = el('div', { class: 'send' }, [sendBtn, sendList]);
      sendBtn.addEventListener('click', function () { toggleSend(e, sendBtn, sendList); });
      send.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !sendList.hidden) { ev.stopPropagation(); closeSend(sendBtn, sendList); sendBtn.focus(); }
      });
      send.addEventListener('focusout', function (ev) {
        if (!send.contains(ev.relatedTarget)) closeSend(sendBtn, sendList);
      });
      var actions = el('div', { class: 'actions' }, [
        el('button', { type: 'button', class: 'btn', text: 'Download', 'aria-label': 'Download ' + e.name, onclick: function () { download(e); } }),
        send,
        el('button', { type: 'button', class: 'btn', text: 'Rename', 'aria-label': 'Rename ' + e.name, onclick: function () { rename(e, title); } }),
        el('button', { type: 'button', class: 'btn danger', text: 'Delete', 'aria-label': 'Delete ' + e.name, onclick: function () { remove(e); } })
      ]);
      sendBtn.setAttribute('aria-label', 'Send ' + e.name + ' to another app');
      return el('li', { class: 'card' }, [preview, el('div', { class: 'info' }, [title, facts]), actions]);
    }

    function closeSend(btn, list) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function toggleSend(e, btn, list) {
      if (!list.hidden) return closeSend(btn, list);
      list.innerHTML = '';
      var targets = registry.apps.filter(function (a) {
        return a.id !== 'locker' && a.menu !== false && a.opens === true && core.matches(e, a.accepts);
      });
      if (!targets.length) list.appendChild(el('li', { class: 'none', text: 'No app opens this kind of file from the Locker yet. Download it and open it in the app instead.' }));
      targets.forEach(function (a) {
        var label = a.name + (a.parent ? ' (' + appName(a.parent) + ')' : '');
        list.appendChild(el('li', null, [el('button', { type: 'button', text: label, onclick: function () { sendTo(a, e); closeSend(btn, list); } })]));
      });
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var first = list.querySelector('button');
      if (first) first.focus();
    }
    function sendTo(app, e) {
      if (!tcc) { say('Send to needs the suite kit, which didn’t load. Check your connection and reload.', true); return; }
      tcc.locker.sendTo(app.id, e.id).then(function () {
        say('Opened ' + app.name + ' with “' + e.name + '”.');
      }, function (err) { say(err.message, true); });
    }

    function download(e) {
      core.get({ id: e.id }).then(function (full) {
        var url = URL.createObjectURL(full.blob);
        var a = el('a', { href: url, download: full.name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      }, function (err) { say(err.message, true); });
    }

    function rename(e, title) {
      var input = el('input', { type: 'text', value: e.name, 'aria-label': 'New name for ' + e.name });
      title.textContent = '';
      title.appendChild(input);
      input.focus(); input.select();
      var done = false;
      function finish(save) {
        if (done) return; done = true;
        var v = input.value.trim();
        if (save && v && v !== e.name) {
          core.rename({ id: e.id, name: v }).then(function () { say('Renamed to “' + v + '”.'); load(); }, function (err) { say(err.message, true); load(); });
        } else { title.textContent = e.name; }
      }
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', function () { finish(true); });
    }

    function remove(e) {
      if (!window.confirm('Delete “' + e.name + '” from your Locker? This can’t be undone.')) return;
      core.remove({ id: e.id }).then(function () { say('Deleted “' + e.name + '”.'); load(); }, function (err) { say(err.message, true); });
    }

    function addFiles(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      core.askPersist();
      var n = 0;
      files.reduce(function (p, f) {
        return p.then(function () {
          return core.save({ name: f.name, type: f.type, blob: f }, 'locker', location.origin).then(function () { n++; });
        });
      }, Promise.resolve()).then(function () {
        say('Added ' + n + (n === 1 ? ' file.' : ' files.'));
      }, function (err) {
        say((n ? 'Added ' + n + ', then stopped: ' : '') + err.message, true);
      }).then(load);
    }

    function meter() {
      core.estimate().then(function (est) {
        if (!est || !est.quota) return;
        var total = entries.reduce(function (t, e) { return t + (e.size || 0); }, 0);
        $('#meter').textContent = entries.length + (entries.length === 1 ? ' file, ' : ' files, ') + fmtSize(total) +
          '. This browser lets this site use about ' + fmtSize(est.quota) + '.' +
          (est.persisted ? ' Storage is marked persistent.' : '');
      }).catch(function () {});
    }

    $('#add').addEventListener('change', function (ev) { addFiles(ev.target.files); ev.target.value = ''; });
    $('#q').addEventListener('input', render);
    $('#app-filter').addEventListener('change', render);

    var dragDepth = 0;
    window.addEventListener('dragenter', function (ev) {
      if (!ev.dataTransfer || Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') === -1) return;
      dragDepth++; $('#drop').hidden = false;
    });
    window.addEventListener('dragleave', function () { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
    window.addEventListener('dragover', function (ev) { if (!$('#drop').hidden) ev.preventDefault(); });
    window.addEventListener('drop', function (ev) {
      if ($('#drop').hidden) return;
      ev.preventDefault(); dragDepth = 0; $('#drop').hidden = true;
      addFiles(ev.dataTransfer.files);
    });

    var t = 0;
    function soon() { clearTimeout(t); t = setTimeout(load, 150); }
    if (core.channel) core.channel.addEventListener('message', soon);
    window.addEventListener('tcc:locker-change', soon);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) soon(); });

    load();
    registerSW();
  }

  // ------------------------------------------------------- service worker
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/locker/sw.js', { scope: '/locker/' }).then(function (reg) {
      function prompt(w) {
        if (!w || !navigator.serviceWorker.controller) return;
        var bar = $('#update');
        bar.hidden = false;
        $('#update-btn').onclick = function () { w.postMessage({ type: 'skip-waiting' }); };
      }
      if (reg.waiting) prompt(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') prompt(w); });
      });
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloaded || $('#update').hidden) return;
        reloaded = true; location.reload();
      });
    }).catch(function () {});
  }
})();
