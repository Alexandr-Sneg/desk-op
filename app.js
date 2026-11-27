/* Рабочий стол ОП РФ. Без фреймворков; совместимо со старым Safari (без ?. ?? replaceChildren Array.at). */
(function () {
  'use strict';
  var main = document.getElementById('main'), navEl = document.getElementById('nav');
  var SECTIONS = null, pendingCount = 0;
  // STATIC — копия на GitHub Pages: данные зашифрованы, ключ из пароля (PBKDF2), правки подтверждаются в Telegram
  var STATIC = !!document.querySelector('meta[name="desk-mode"][content="static"]');
  var BASE = STATIC ? '' : '/';
  var BOT = 'https://t.me/ms_alex_bot';
  var KEY = null, DATA = null, LS = 'deskKey1';
  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var ZN = { 'Ц': 'Центр', 'Ю': 'Юг', 'С': 'Север', 'Б': 'Без региона', 'Отдел': 'Отдел' };
  var SECTION_TAG = { prices: 'Прайсы', clients: 'Клиенты', plans: 'Планы', fact: 'Выполнение', training: 'Обучение', system: 'Проекты' };

  // ---------- утилиты ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(x, d) { if (x == null || !isFinite(x)) return '—'; return Number(x).toFixed(d == null ? 1 : d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function u(x) { return x == null ? '—' : num(x, 1) + ' ю'; }
  function pct(x) { return x == null || !isFinite(x) ? '—' : Math.round(x * 100) + '%'; }
  function ymName(ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dt(ms) { var d = new Date(ms); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function size(b) { return b > 1048576 ? num(b / 1048576, 1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ'; }
  // ---------- зашифрованная копия ----------
  function b64ToBytes(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function bytesToB64(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function decrypt(buf, key) {
    var u = new Uint8Array(buf);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key || KEY, u.subarray(12));
  }
  function getBin(url, noCache) { return fetch(url + (noCache ? '?t=' + Date.now() : ''), { cache: noCache ? 'no-store' : 'default' }).then(function (r) { if (!r.ok) throw new Error('Ошибка загрузки ' + r.status); return r.arrayBuffer(); }); }
  function blob(name) { return getBin('b/' + name + '.bin').then(function (b) { return decrypt(b); }); }
  function blobJson(name) { return blob(name).then(function (b) { return JSON.parse(new TextDecoder('utf-8').decode(b)); }); }
  function loadData(key) {
    return getBin('data.bin', true).then(function (b) { return decrypt(b, key); }).then(function (b) { DATA = JSON.parse(new TextDecoder('utf-8').decode(b)); KEY = key; });
  }
  function importRaw(raw) { return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt']); }
  function unlock() {
    if (!window.crypto || !crypto.subtle || !window.TextDecoder) { main.innerHTML = '<div class="card err">Этот браузер слишком старый для защищённой страницы. Обновите iOS или откройте в другом браузере.</div>'; return Promise.reject(new Error('old')); }
    var saved = null; try { saved = localStorage.getItem(LS); } catch (e) {}
    if (saved) return importRaw(b64ToBytes(saved)).then(loadData).catch(function () { try { localStorage.removeItem(LS); } catch (e) {} return askPassword(); });
    return askPassword();
  }
  function askPassword() {
    document.querySelector('.nav').style.display = 'none';
    main.innerHTML = '<div class="login" style="margin-top:8vh"><div class="card"><h2>Рабочий стол</h2><div class="muted small">Введите пароль Рабочего стола. Телефон его запомнит.</div>' +
      '<form id="pf"><label for="pp">Пароль</label><input id="pp" type="password" autocomplete="current-password" required><button class="btn pri" type="submit">Открыть</button><div id="pe" class="err small" style="margin-top:10px"></div></form></div></div>';
    return new Promise(function (ok) {
      var f = document.getElementById('pf'), e = document.getElementById('pe');
      f.addEventListener('submit', function (ev) {
        ev.preventDefault(); e.textContent = 'Проверяю…'; var b = f.querySelector('button'); b.disabled = true;
        var variants = passVariants(document.getElementById('pp').value);
        fetch('meta.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
          // пробуем варианты ввода по очереди: как есть, без пробелов, русская раскладка, без заглавной первой буквы
          function tryAt(i) {
            if (i >= variants.length) return Promise.reject(new Error('bad'));
            return crypto.subtle.importKey('raw', new TextEncoder().encode(variants[i]), 'PBKDF2', false, ['deriveBits']).then(function (pk) {
              return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64ToBytes(m.salt), iterations: m.iter, hash: 'SHA-256' }, pk, 256);
            }).then(function (bits) {
              return importRaw(bits).then(function (key) { return loadData(key).then(function () { try { localStorage.setItem(LS, bytesToB64(bits)); } catch (x) {} }); });
            }).catch(function () { return tryAt(i + 1); });
          }
          return tryAt(0);
        }).then(function () { document.querySelector('.nav').style.display = ''; ok(); })
          .catch(function () { e.textContent = 'Неверный пароль. Проверьте раскладку: пароль латиницей, например vzqt-…'; b.disabled = false; });
      });
    });
  }
  var RU = 'йцукенгшщзхъфывапролджэячсмитьбюё', EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
  function passVariants(p) {
    var t = p.replace(/^\s+|\s+$/g, ''), lay = '', out = [];
    for (var i = 0; i < t.length; i++) { var ch = t.charAt(i), lo = ch.toLowerCase(), k = RU.indexOf(lo); lay += k < 0 ? ch : (ch !== lo ? EN.charAt(k).toUpperCase() : EN.charAt(k)); }
    [p, t, lay, t.charAt(0).toLowerCase() + t.slice(1), lay.charAt(0).toLowerCase() + lay.slice(1)].forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function q(url, k) { var m = url.match(new RegExp('[?&]' + k + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function staticApi(url) {
    var D = DATA, p = url.split('?')[0];
    if (p === '/api/home') return Promise.resolve(D.home);
    if (p === '/api/feed') return Promise.resolve(D.feed);
    if (p === '/api/sections') return Promise.resolve(D.sections);
    if (p === '/api/actions') return Promise.resolve(D.actions);
    if (p === '/api/grading') return Promise.resolve(D.grading);
    if (p === '/api/plans') return Promise.resolve(D.plans);
    if (p === '/api/money') return D.moneyBlob ? blobJson(D.moneyBlob) : Promise.resolve({ none: true });
    var one = { '/api/forecast': 'forecastBlob', '/api/debts': 'debtsBlob', '/api/sleeping': 'sleepingBlob' }[p];
    if (one) return D[one] ? blobJson(D[one]) : Promise.resolve({ none: true });
    if (p === '/api/managers') return Promise.resolve(D.managers || []);
    if (p === '/api/training') return D.trainingBlob ? blobJson(D.trainingBlob) : Promise.reject(new Error('Нет данных обучения'));
    if (p === '/api/training/answers') { var tb = (D.trainingAnswers || {})[q(url, 'mgr') + '|' + q(url, 'lesson')]; return tb ? blobJson(tb) : Promise.reject(new Error('Нет данных')); }
    if (p === '/api/competitors') return D.competitorsBlob ? blobJson(D.competitorsBlob) : Promise.resolve({ none: true });
    if (p === '/api/actionpreview') { var ab = (D.previewBlobs || {})[q(url, 'id')]; return ab ? blobJson(ab) : Promise.resolve({ error: 'Детали правки есть на компе' }); }
    if (p === '/api/manager') { var mb = (D.managerBlobs || {})[q(url, 'm')]; return mb ? blobJson(mb) : Promise.resolve({ error: 'Нет данных' }); }
    if (p === '/api/products') { var pb = D.productsBlobs || {}, pm = q(url, 'ym'); if (!pb[pm]) pm = D.productsLast; return pb[pm] ? blobJson(pb[pm]) : Promise.resolve({ none: true }); }
    if (p === '/api/grading/plan') { var n = D.gradPlans[q(url, 'date')]; return n ? blobJson(n) : Promise.reject(new Error('Нет списка')); }
    if (p === '/api/fileinfo') { var fi = D.files[q(url, 'f')]; return fi ? Promise.resolve(fi) : Promise.reject(new Error('Файл не найден')); }
    if (p === '/api/fact') {
      var ym = q(url, 'ym'), sh = D.factShared; if (!ym || !D.factBlobs[ym]) ym = sh.curYm;
      if (!ym || !D.factBlobs[ym]) return Promise.resolve({ months: sh.months || [], status: sh.status });
      return blobJson(D.factBlobs[ym]).then(function (o) { for (var k in sh) o[k] = sh[k]; return o; });
    }
    return Promise.reject(new Error('Недоступно в копии для телефона'));
  }
  function fileBuffer(id) {
    if (STATIC) { var fi = DATA.files[id]; return fi ? blob(fi.blob) : Promise.reject(new Error('Файл не найден')); }
    return fetch('/api/file?f=' + encodeURIComponent(id), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('Ошибка ' + r.status); return r.arrayBuffer(); });
  }
  var MIMES = { pdf: 'application/pdf', html: 'text/html', htm: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  function saveFile(id) {
    var fi = DATA.files[id]; if (!fi) return;
    fileBuffer(id).then(function (buf) {
      var url = URL.createObjectURL(new Blob([buf], { type: MIMES[fi.ext] || 'application/octet-stream' }));
      var a = document.createElement('a'); a.href = url; a.download = fi.name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 60000);
    }).catch(function (e) { alert('Не удалось скачать: ' + e.message); });
  }
  document.addEventListener('click', function (ev) { var fh = ev.target.closest ? ev.target.closest('.card.fold > h3') : null; if (fh) { fh.parentNode.classList.toggle('open'); return; } var a = ev.target.closest ? ev.target.closest('[data-dl]') : null; if (a && STATIC) { ev.preventDefault(); saveFile(a.getAttribute('data-dl')); } });

  function api(url, opts) {
    if (STATIC) return staticApi(url);
    opts = opts || {}; opts.credentials = 'same-origin';
    if (opts.json) { opts.method = 'POST'; opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(opts.json); }
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { location.href = '/login'; throw new Error('login'); }
      return r.json().then(function (j) { if (!r.ok && !opts.soft) throw new Error(j.error || j.msg || ('Ошибка ' + r.status)); return j; });
    });
  }
  function fail(e) { if (e && e.message === 'login') return; main.innerHTML = '<div class="card err">Не получилось загрузить: ' + esc(e && e.message || e) + '</div>'; }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild || d.firstChild; }
  function statusOf(ratio, closed) {
    if (ratio == null || !isFinite(ratio)) return '';
    if (closed) return ratio >= 1 ? '<span class="st good">выполнен</span>' : '<span class="st bad">не выполнен</span>';
    return ratio >= 1 ? '<span class="st good">в темпе</span>' : ratio >= 0.9 ? '<span class="st warn">чуть отстаёт</span>' : '<span class="st bad">отстаёт</span>';
  }

  // ---------- меню ----------
  var ROUTES = [['home', 'Главная'], ['maneuver', 'Манёвр'], ['fact', 'Выполнение'], ['money', 'Деньги'], ['debts', 'Дебиторка'], ['managers', 'Менеджеры'], ['clients', 'Клиентская база'], ['sleeping', 'Засыпающие'],
    ['plans', 'Планы'], ['prices', 'Прайсы и конкуренты'], ['redaction', 'Редакция'], ['training', 'Обучение']];
  function drawNav(cur) {
    navEl.innerHTML = ROUTES.map(function (r) {
      return '<a href="#' + r[0] + '" class="' + (r[0] === cur ? 'on' : '') + '">' + esc(r[1]) + (r[0] === 'home' && pendingCount ? '<span class="badge">' + pendingCount + '</span>' : '') + '</a>';
    }).join('');
    var on = navEl.querySelector('.on'); if (on && on.scrollIntoView && window.innerWidth < 700) try { on.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {}
  }
  document.getElementById('logout').addEventListener('click', function () {
    if (STATIC) { try { localStorage.removeItem(LS); } catch (e) {} location.hash = ''; location.reload(); return; }
    api('/api/logout', { json: {} }).then(function () { location.href = '/login'; });
  });

  function route() {
    if (STATIC && !DATA) return;
    var h = (location.hash || '#home').slice(1), parts = h.split('/');
    var r = parts[0] || 'home';
    drawNav(r === 'view' ? '' : r);
    window.scrollTo(0, 0);
    main.innerHTML = '<div class="loading">Загрузка…</div>';
    if (r === 'view') return viewFile(decodeURIComponent(parts[1] || ''));
    if (r === 'red') { drawNav('redaction'); return redPage(decodeURIComponent(parts[1] || ''), parts[2]); }
    if (r === 'mgr') { drawNav('managers'); return managerPage(decodeURIComponent(parts[1] || '')); }
    if (r === 'home') return home();
    return section(r);
  }
  window.addEventListener('hashchange', route);

  function getSections() { return SECTIONS ? Promise.resolve(SECTIONS) : api('/api/sections').then(function (s) { SECTIONS = s; return s; }); }

  // ---------- файлы ----------
  function filesHtml(groups) {
    return groups.map(function (g, gi) {
      return '<div class="card' + (gi ? ' fold' : '') + '"><h3>' + esc(g.title) + ' <span class="small muted">· ' + g.files.length + '</span></h3><ul class="files">' + g.files.map(function (f) {
        return '<li><span class="ext ' + esc(f.ext) + '">' + esc(f.ext) + '</span><div class="fmeta"><a class="fname" href="#view/' + encodeURIComponent(f.id) + '">' + esc(f.name) + '</a>' +
          '<span class="fsub">' + dt(f.mtime) + ' · ' + size(f.size) + '</span></div>' +
          (STATIC ? '<a class="dl" href="#" data-dl="' + esc(f.id) + '">Скачать</a>' : '<a class="dl" href="/api/file?f=' + encodeURIComponent(f.id) + '&dl=1">Скачать</a>') + '</li>';
      }).join('') + '</ul></div>';
    }).join('');
  }

  // ---------- правки на подтверждение ----------
  var ST = { pending: ['warn', 'ждёт подтверждения', ''], error: ['bad', 'ошибка — можно повторить', 'err'], confirmed: ['idle', 'выполняется', 'idle'], applying: ['idle', 'выполняется', 'idle'],
    done: ['good', 'выполнено', 'done'], rejected: ['idle', 'отклонено', 'idle'], expired: ['idle', 'срок истёк', 'idle'], test: ['idle', 'тест', 'idle'] };
  function actionHtml(a) {
    var s = ST[a.status] || ['idle', a.status, 'idle'];
    var can = a.status === 'pending' || a.status === 'error' || a.status === 'test';
    return '<div class="act ' + s[2] + '" data-kind="' + esc(a.kind) + '" data-key="' + esc(a.key) + '">' +
      '<div class="row"><span class="ttl">' + esc(a.title) + '</span><span class="st ' + s[0] + '">' + esc(s[1]) + '</span></div>' +
      '<div class="small muted">Создано ' + esc(a.created || '') + (a.expires ? ' · действует до ' + esc(a.expires.split('-').reverse().join('.')) : '') + '</div>' +
      (a.text ? '<div class="note">' + esc(a.text) + '</div>' : '') + (a.error ? '<div class="note err">' + esc(a.error) + '</div>' : '') +
      (a.moves && a.moves.length ? '<div class="moves">' + a.moves.slice(0, 16).map(function (m) { return esc(m.k) + ': <b>' + m.n + '</b>'; }).join('<br>') + '</div>' : '') +
      '<div class="row" style="margin-top:10px">' +
      (can && !STATIC ? '<button class="btn ok" data-do="ok" type="button">✅ Подтвердить</button><button class="btn no" data-do="no" type="button">❌ Отклонить</button>' : '') +
      (can && STATIC ? '<a class="btn ok" href="' + BOT + '" target="_blank" rel="noopener">Подтвердить в Telegram</a>' : '') +
      (a.kind === 'grad' ? '<button class="btn" data-do="list" type="button">Список на передачу</button>' : '') +
      (a.akind ? '<button class="btn" data-do="preview" type="button">' + (a.status === 'done' ? 'Что изменено' : 'Что изменится') + '</button>' : '') +
      (!STATIC && a.status === 'done' && (a.akind === 'prices' || a.akind === 'transfer') ? '<button class="btn no" data-do="rollback" type="button">↩ Откатить</button>' : '') +
      '</div><div class="msg small" style="margin-top:8px"></div><div class="lst"></div></div>';
  }
  function bindActions(root, after) {
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button[data-do]') : null; if (!b) return;
      var card = b.closest('.act'), kind = card.getAttribute('data-kind'), key = card.getAttribute('data-key'), what = b.getAttribute('data-do');
      var msg = card.querySelector('.msg');
      if (what === 'list') return toggleList(card, key);
      if (what === 'preview') return showPreview(card, key);
      if (what === 'rollback') { if (window.confirm('Подготовить откат этой правки? Он тоже выполнится только после «Подтвердить».')) propose({ type: 'rollback', id: key }, msg, b).then(function () { setTimeout(after, 1500); }); return; }
      var title = card.querySelector('.ttl').textContent;
      if (!window.confirm((what === 'ok' ? 'Подтвердить и выполнить в МойСклад?\n\n' : 'Отклонить? В мс ничего не изменится.\n\n') + title)) return;
      var btns = card.querySelectorAll('button[data-do=ok],button[data-do=no]'); for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
      msg.textContent = 'Отправляю…';
      api('/api/action', { json: { kind: kind, key: key, do: what }, soft: true }).then(function (r) {
        msg.textContent = r.msg || (r.ok ? 'Готово' : 'Не получилось'); msg.className = 'msg small ' + (r.ok ? '' : 'err');
        setTimeout(after, 1500);
      }).catch(function (e) { msg.textContent = 'Ошибка: ' + e.message; msg.className = 'msg small err'; for (var i = 0; i < btns.length; i++) btns[i].disabled = false; });
    });
  }
  function toggleList(card, date) {
    var box = card.querySelector('.lst');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="loading">Загрузка списка…</div>';
    api('/api/grading/plan?date=' + encodeURIComponent(date)).then(function (rows) {
      box.innerHTML = '<div class="row" style="margin:10px 0"><input type="search" placeholder="Поиск: клиент, ИНН, менеджер" style="flex:1;min-width:0"><span class="small muted cnt"></span></div><div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Клиент</th><th class="l">От кого</th><th class="l">Кому</th><th class="l">Градация</th><th class="l">Причина</th></tr></thead><tbody></tbody></table></div>';
      var tb = box.querySelector('tbody'), inp = box.querySelector('input'), cnt = box.querySelector('.cnt');
      function draw() {
        var q = inp.value.toLowerCase(), shown = rows.filter(function (r) { return !q || (r.name + ' ' + r.inn + ' ' + r.from + ' ' + r.to).toLowerCase().indexOf(q) >= 0; });
        cnt.textContent = shown.length + ' из ' + rows.length;
        tb.innerHTML = shown.slice(0, 500).map(function (r) { return '<tr><td class="l">' + esc(r.name) + (r.inn ? '<div class="small muted">ИНН ' + esc(r.inn) + '</div>' : '') + '</td><td class="l">' + esc(r.from) + '</td><td class="l">' + esc(r.to) + '</td><td class="l">' + esc(r.grade) + '</td><td class="l small">' + esc(r.kind) + '</td></tr>'; }).join('');
      }
      inp.addEventListener('input', draw); draw();
    }).catch(function (e) { box.innerHTML = '<div class="err small">' + esc(e.message) + '</div>'; });
  }

  // ---------- главная ----------
  function home() {
    Promise.all([api('/api/home'), api('/api/feed')]).then(function (x) {
      var h = x[0], feed = x[1], f = h.fact;
      pendingCount = h.actions.filter(function (a) { return a.status === 'pending' || a.status === 'error'; }).length; drawNav('home');
      var html = '';
      if (f && f.reg) {
        var vk = f.plans ? Object.keys(f.plans) : [], pace = f.wdAll ? f.wdDone / f.wdAll : null;
        html += '<div class="card"><div class="row" style="justify-content:space-between"><h2>Приход денег — ' + esc(ymName(f.ym)) + '</h2><a href="#fact" class="small">Подробно →</a></div><div class="tiles">' +
          '<div class="tile"><div class="k">Факт отдела</div><div class="v">' + u(f.reg['Отдел']) + '</div><div class="s">' + (f.isCur ? 'прошло ' + f.wdDone + ' из ' + f.wdAll + ' раб. дней' : 'месяц закрыт') + '</div></div>' +
          vk.map(function (k) { var pl = f.plans[k]['Отдел'], r = f.reg['Отдел'] / pl; return '<div class="tile"><div class="k">' + esc(k === 'plan' ? 'План' : k === 'plan1' ? 'План 1 (+5%)' : 'План 2 (+10%)') + ': ' + u(pl) + '</div><div class="v">' + pct(r) + '</div><div class="s">' + statusOf(f.isCur ? r / pace : r, !f.isCur) + '</div></div>'; }).join('') +
          ['Ц', 'Ю', 'С'].map(function (z) { var pl = vk.length ? f.plans[vk[0]][z] : null; return '<div class="tile"><div class="k">' + ZN[z] + '</div><div class="v">' + u(f.reg[z]) + '</div><div class="s">' + (pl ? pct(f.reg[z] / pl) + ' плана' + (vk.length > 1 ? ' 1' : '') : '') + '</div></div>'; }).join('') +
          '</div>';
        var ex = h.extra || {};
        if (ex.forecast || ex.products) {
          var fp = ex.forecast, pp = ex.products;
          html += '<div class="tiles" style="margin-top:12px">' +
            (fp ? '<a class="tile" href="#maneuver" style="color:inherit"><div class="k">Прогноз месяца по датам оплаты</div><div class="v">' + num(fp.byDates / 1e6) + ' ю</div><div class="s">' + (fp.plan ? pct(fp.byDates / fp.plan) + ' плана · ' : '') + 'по прошлым мес. ' + num((fp.bySeason || 0) / 1e6) + ' ю →</div></a>' : '') +
            (fp && fp.plan ? '<a class="tile" href="#maneuver" style="color:inherit"><div class="k">' + (fp.plan > fp.byDates ? 'Не хватает до плана' : 'Запас над планом') + '</div><div class="v ' + (fp.plan > fp.byDates ? 'neg' : 'pos') + '">' + num(Math.abs(fp.plan - fp.byDates) / 1e6) + ' ю</div><div class="s">осталось ' + fp.remIncl + ' раб. дн. · долги клиентов ' + num(fp.debt / 1e6) + ' ю</div></a>' : '') +
            (pp ? '<a class="tile" href="#fact" style="color:inherit"><div class="k">Своё производство в отгрузках</div><div class="v">' + pct(pp.own / pp.all) + '</div><div class="s">горшки и кассеты ' + num(pp.own / 1e6) + ' млн · сопутка ' + num(pp.sop / 1e6) + ' млн</div></a>' : '') +
            '</div>';
        }
        html += factStatusLine(f.status) + '</div>';
      }
      var acts = h.actions;
      html += '<div class="card"><h2>Ждут подтверждения</h2><div id="acts">' + (acts.length ? acts.map(actionHtml).join('') : '<div class="muted">Сейчас ничего не ждёт подтверждения. Правки в мс готовятся кнопками в разделах (задачи по засыпающим и долгам, передача клиента, цены по конкурентам) — и появляются здесь и в Telegram.</div>') +
        ((h.recent || []).length ? '<details style="margin-top:8px"><summary style="cursor:pointer" class="small">Недавние правки за неделю · ' + h.recent.length + '</summary><div style="margin-top:8px">' + h.recent.map(actionHtml).join('') + '</div></details>' : '') + '</div></div>';
      html += '<div id="homejobs"></div>';
      html += '<div class="card fold"><h3>Лента обновлений</h3><ul class="feed">' + feed.slice(0, 40).map(function (e) {
        var t = String(e.t || ''), when = t.slice(8, 10) + '.' + t.slice(5, 7) + ' ' + t.slice(11, 16);
        var title = e.file ? '<a href="#view/' + encodeURIComponent(e.file) + '">' + esc(e.title) + '</a>' : esc(e.title);
        return '<li><span class="when">' + esc(when) + '</span><span class="what">' + title + '<span class="tag">' + esc(SECTION_TAG[e.section] || e.section || '') + '</span>' + (e.text ? '<div class="small muted">' + esc(e.text) + '</div>' : '') + '</span></li>';
      }).join('') + '</ul></div>';
      main.innerHTML = html;
      var ab = document.getElementById('acts'); if (ab) bindActions(ab, home);
      jobButtons(document.getElementById('homejobs'), ['data', 'bot', 'prices', 'comp', 'grad', 'pages'], 'Обновить по запросу', true);
    }).catch(fail);
  }
  function factStatusLine(st) {
    if (!st) return '';
    if (STATIC) return st.updated ? '<div class="note">Данные из МойСклад на ' + esc(st.updated.slice(8, 10) + '.' + st.updated.slice(5, 7) + ' ' + st.updated.slice(11, 16)) + ' · копия для телефона от ' + esc(DATA.built.slice(8, 10) + '.' + DATA.built.slice(5, 7) + ' ' + DATA.built.slice(11, 16)) + ', обновляется каждые 2 часа</div>' : '';
    if (st.state === 'running') return '<div class="note">⏳ Обновляю данные из МойСклад…</div>';
    if (st.state === 'error') return '<div class="note err">Последнее обновление из мс не прошло (' + esc(st.updated) + '): ' + esc(st.error) + '</div>';
    if (st.updated) return '<div class="note">Данные из МойСклад на ' + esc(st.updated.slice(8, 10) + '.' + st.updated.slice(5, 7) + ' ' + st.updated.slice(11, 16)) + ' · обновляются каждые 2 часа</div>';
    return '<div class="note">Данные из мс ещё не загружены.</div>';
  }

  // ---------- разделы ----------
  function section(id) {
    getSections().then(function (all) {
      var s = null; for (var i = 0; i < all.length; i++) if (all[i].id === id) s = all[i];
      if (!s) { main.innerHTML = '<div class="card">Раздел не найден</div>'; return; }
      main.innerHTML = '<h2>' + esc(s.title) + '</h2><div id="widget"></div>' +
        (s.links.length ? '<div class="card"><h3>Ссылки</h3>' + s.links.map(function (l) { return '<div><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + ' ↗</a></div>'; }).join('') + '</div>' : '') +
        (s.groups.length ? filesHtml(s.groups) : (s.widget ? '' : '<div class="card muted">Пока пусто.</div>'));
      var w = document.getElementById('widget');
      var sj = { maneuver: ['data'], debts: ['data'], sleeping: ['data'], managers: ['data'], clients: ['grad', 'data'], money: ['data', 'bot'] }[s.id];
      if (sj) { var jb = document.createElement('div'); main.appendChild(jb); jobButtons(jb, sj, 'Обновить по запросу', true); }
      if (s.widget === 'fact') factWidget(w);
      if (s.widget === 'plans') plansWidget(w);
      if (s.widget === 'grading') gradingWidget(w);
      if (s.widget === 'money') moneyWidget(w);
      if (s.widget === 'pricing') pricingWidget(w);
      if (s.widget === 'redaction') redactionWidget(w);
      if (s.widget === 'training') trainingWidget(w);
      if (s.widget === 'forecast') forecastWidget(w);
      if (s.widget === 'debts') debtsWidget(w);
      if (s.widget === 'managers') managersWidget(w);
      if (s.widget === 'sleeping') sleepingWidget(w);
    }).catch(fail);
  }

  // ---------- выполнение планов ----------
  var factYm = '';
  function factWidget(w, ym) {
    w.innerHTML = '<div class="loading">Считаю план/факт…</div>';
    api('/api/fact' + (ym ? '?ym=' + ym : '')).then(function (f) {
      if (!f.reg) { w.innerHTML = '<div class="card">Данных из мс пока нет.' + factStatusLine(f.status) + '<div style="margin-top:10px"><button class="btn pri" id="rf" type="button">Загрузить из МойСклад</button></div></div>'; bindRefresh(w); return; }
      factYm = f.ym;
      var vk = f.plans ? Object.keys(f.plans) : [], pace = f.isCur && f.wdAll ? f.wdDone / f.wdAll : 1, closed = !f.isCur;
      var vn = function (k) { return k === 'plan' ? 'План' : k === 'plan1' ? 'План 1' : 'План 2'; };
      var html = '<div class="card"><div class="row" style="justify-content:space-between"><div class="row"><select id="ym">' + f.months.slice().reverse().map(function (m) { return '<option value="' + m + '"' + (m === f.ym ? ' selected' : '') + '>' + cap(ymName(m)) + '</option>'; }).join('') + '</select>' +
        '<span class="small muted">' + (f.isCur ? 'на ' + f.day + ' ' + MONTHS_GEN[+f.ym.slice(5) - 1] + ', прошло ' + f.wdDone + ' из ' + f.wdAll + ' раб. дней (' + pct(pace) + ')' : 'месяц закрыт') + '</span></div>' +
        (STATIC ? '' : '<button class="btn" id="rf" type="button">↻ Обновить из мс</button>') + '</div>' + factStatusLine(f.status);
      // прогресс по регионам
      if (vk.length) {
        html += '<div style="margin-top:12px">' + ['Отдел', 'Ц', 'Ю', 'С'].map(function (z) {
          var fa = f.reg[z], p0 = f.plans[vk[0]][z], r0 = fa / p0;
          return '<div class="prog"><div class="lbl"><span><b>' + ZN[z] + '</b> · факт <b>' + u(fa) + '</b></span><span>' + vk.map(function (k) { var p = f.plans[k][z]; return vn(k) + ' ' + u(p) + ' — <b>' + pct(fa / p) + '</b>'; }).join(' · ') + ' ' + statusOf(closed ? r0 : r0 / pace, closed) + '</span></div>' +
            '<div class="bar" title="Чёрная риска — где нужно быть сегодня"><i style="width:' + Math.min(100, r0 * 100).toFixed(1) + '%"></i>' + (closed ? '' : '<u style="left:' + (pace * 100).toFixed(1) + '%"></u>') + '</div></div>';
        }).join('') + '<div class="note">Полоса — выполнение ' + (vk.length > 1 ? 'плана 1' : 'плана') + '; чёрная риска — где нужно быть сегодня по рабочим дням. «Без региона» (' + u(f.reg['Б']) + ') входит только в отдел.</div></div>';
      } else html += '<div class="note">На ' + esc(ymName(f.ym)) + ' плана нет — показан только факт.</div>';
      html += '</div>';
      // таблица регионов
      html += '<div class="card fold"><h3>Регионы</h3><div class="tw"><table class="t"><thead><tr><th>Регион</th><th>Факт</th>' + vk.map(function (k) { return '<th>' + vn(k) + '</th><th>%</th>'; }).join('') + (f.isCur && vk.length ? '<th>Нужно в день</th>' : '') + '<th>Год назад</th><th>к году</th></tr></thead><tbody>' +
        ['Ц', 'Ю', 'С', 'Б', 'Отдел'].map(function (z) {
          var fa = f.reg[z], ly = f.lyReg ? f.lyReg[z] : null, left = f.wdAll - f.wdDone;
          return '<tr class="' + (z === 'Отдел' ? 'tot' : '') + '"><td>' + ZN[z] + '</td><td>' + num(fa) + '</td>' + vk.map(function (k) { var p = f.plans[k][z]; return '<td>' + (p == null ? '—' : num(p)) + '</td><td>' + (p ? pct(fa / p) : '—') + '</td>'; }).join('') +
            (f.isCur && vk.length ? '<td>' + (f.plans[vk[0]][z] != null && left > 0 ? num(Math.max(0, f.plans[vk[0]][z] - fa) / left, 2) : '—') + '</td>' : '') +
            '<td>' + num(ly) + '</td><td class="' + (ly && fa >= ly ? 'pos' : 'neg') + '">' + (ly ? (fa >= ly ? '+' : '') + Math.round((fa / ly - 1) * 100) + '%' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="note">ю = млн ₽, приход денег (банк + касса), ООО «АМИНАТРЕЙД», без РВБ, Нике/Евростандарт и «Интернет Решений». Регион — по текущему владельцу клиента, как в «Отчёте Десант».' + (f.isCur && vk.length ? ' «Нужно в день» — по ' + (vk.length > 1 ? 'плану 1' : 'плану') + ' на оставшиеся рабочие дни.' : '') + '</div></div>';
      // график
      html += '<div id="prodblock"></div>';
      html += '<div class="card fold"><h3>Отдел: накопительно по дням</h3><div id="chart"></div></div>';
      // менеджеры
      var zones = ['Ц', 'Ю', 'С', 'Б'];
      html += '<div class="card fold"><h3>Менеджеры</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Факт</th><th>Доля в регионе</th><th>Год назад</th><th>к году</th></tr></thead><tbody>' +
        zones.map(function (z) {
          var ms = f.mgrs.filter(function (m) { return m.zone === z && isMgr(m.name); }); if (!ms.length) return '';
          var tot = ms.reduce(function (s, m) { return s + m.fact; }, 0);
          return '<tr class="grp"><td colspan="5">' + ZN[z] + ' · ' + u(tot) + '</td></tr>' + ms.map(function (m) {
            return '<tr><td>' + esc(m.name) + (m.top ? ' <span class="small muted">топ</span>' : '') + '</td><td>' + num(m.fact, 2) + '</td><td>' + pct(m.share) + '</td><td>' + num(m.ly, 2) + '</td><td class="' + (m.ly && m.fact >= m.ly ? 'pos' : 'neg') + '">' + (m.ly ? (m.fact >= m.ly ? '+' : '') + Math.round((m.fact / m.ly - 1) * 100) + '%' : '—') + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div><div class="note">Менеджер — по полю «Менеджер ОП» в платеже, поэтому суммы по менеджерам могут немного отличаться от суммы региона (там клиент считается по текущему владельцу). Личных планов нет — только факт и доля.</div></div>';
      // история
      if (f.hist.length) {
        html += '<div class="card fold"><h3>План/факт по месяцам</h3><div class="tw"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Отдел</th></tr></thead><tbody>' +
          f.hist.map(function (h) {
            var k = Object.keys(h.plans)[0];
            return '<tr><td>' + cap(ymName(h.ym)) + '<div class="small muted">' + vn(k) + '</div></td>' + ['Ц', 'Ю', 'С', 'Отдел'].map(function (z) { var p = h.plans[k][z]; return '<td>' + num(h.fact[z]) + ' / ' + num(p) + '<div class="small">' + pct(h.fact[z] / p) + '</div></td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div><div class="note">факт / план, ю. Для месяцев с двумя вариантами показан план 1.</div></div>';
      }
      html += '<div class="card fold"><h3>Приход по месяцам</h3><div class="tw"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Без рег.</th><th>Отдел</th></tr></thead><tbody>' +
        f.byMonth.slice().reverse().map(function (m) { return '<tr><td>' + cap(ymName(m.ym)) + '</td><td>' + num(m['Ц']) + '</td><td>' + num(m['Ю']) + '</td><td>' + num(m['С']) + '</td><td>' + num(m['Б']) + '</td><td><b>' + num(m['Отдел']) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
      w.innerHTML = html;
      productsBlock(document.getElementById('prodblock'), f.ym);
      document.getElementById('ym').addEventListener('change', function () { factWidget(w, this.value); });
      bindRefresh(w);
      // данные графика
      var series = [{ name: 'Факт', color: 'var(--s1)', values: f.cum, width: 2.5 }];
      if (f.lyCum && f.lyCum.length) series.push({ name: 'Год назад', color: 'var(--s2)', values: f.lyCum, width: 2 });
      var wdIdx = []; var y = +f.ym.slice(0, 4), mo = +f.ym.slice(5), c = 0;
      for (var d = 1; d <= f.last; d++) { var wd = new Date(y, mo - 1, d).getDay(); if (wd && wd < 6) c++; wdIdx.push(c); }
      vk.forEach(function (k, i) { var p = f.plans[k]['Отдел']; series.push({ name: vn(k) + ' (темп)', color: 'var(--plan)', dash: i ? '2 4' : '6 4', values: wdIdx.map(function (n) { return +(p * n / f.wdAll).toFixed(3); }), width: 1.5 }); });
      lineChart(document.getElementById('chart'), f.last, series, f.ym);
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }
  function bindRefresh(w) {
    var b = document.getElementById('rf'); if (!b) return;
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = '⏳ Обновляю…';
      api('/api/jobs/fact', { json: {} }).then(function () {
        var n = 0, t = setInterval(function () {
          api('/api/fact?ym=' + factYm).then(function (f) { n++; if ((f.status && f.status.state !== 'running') || n > 60) { clearInterval(t); factWidget(w, factYm); } });
        }, 5000);
      }).catch(function (e) { b.textContent = 'Ошибка: ' + e.message; });
    });
  }

  // ---------- линейный график с подсказкой ----------
  function lineChart(box, days, series, ym) {
    var W = Math.max(300, box.clientWidth || 600), H = W < 500 ? 220 : 260, L = 40, R = 86, T = 12, B = 26;
    var max = 0; series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && v > max) max = v; }); });
    max = niceMax(max || 1);
    var x = function (d) { return L + (d - 1) * (W - L - R) / Math.max(1, days - 1); }, y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Приход денег отдела накопительно по дням">';
    for (var i = 0; i <= 4; i++) { var v = max * i / 4; svg += '<line class="grid-l" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + num(v, 0) + '</text>'; }
    var step = days > 20 && W < 500 ? 5 : days > 20 ? 3 : 1;
    for (var d = 1; d <= days; d += step) svg += '<text class="ax" x="' + x(d) + '" y="' + (H - 8) + '" text-anchor="middle">' + d + '</text>';
    var labels = [];
    series.forEach(function (s) {
      var pts = [], lastI = -1;
      s.values.forEach(function (v, i) { if (v != null) { pts.push((pts.length ? 'L' : 'M') + x(i + 1).toFixed(1) + ' ' + y(v).toFixed(1)); lastI = i; } });
      svg += '<path d="' + pts.join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="' + s.width + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>';
      if (lastI >= 0) labels.push({ y: y(s.values[lastI]), x: x(lastI + 1), t: s.name.replace(' (темп)', '') + ' ' + num(s.values[lastI], 1), c: s.color, dot: !s.dash });
    });
    // подписи справа без наложений
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 14) labels[k].y = labels[k - 1].y + 14;
    labels.forEach(function (l) { if (l.dot) svg += '<circle cx="' + l.x + '" cy="' + l.y + '" r="4" fill="' + l.c + '" stroke="var(--surface)" stroke-width="2"/>'; });
    labels.forEach(function (l) { svg += '<text class="lab" x="' + (W - R + 6) + '" y="' + (l.y + 4) + '">' + esc(l.t) + '</text>'; });
    svg += '<line id="cx" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--text-2)" stroke-width="1" style="display:none"/><g id="cdots"></g><rect x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent" id="hit"/></svg>';
    box.innerHTML = '<div class="legend">' + series.map(function (s) { return '<span><i class="' + (s.dash ? 'dash' : '') + '" style="border-color:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div><div class="chart">' + svg + '<div class="tip"></div></div>';
    var chart = box.querySelector('.chart'), sv = chart.querySelector('svg'), tip = chart.querySelector('.tip'), cx = sv.querySelector('#cx'), dots = sv.querySelector('#cdots');
    var mName = MONTHS_GEN[+ym.slice(5) - 1];
    function show(clientX) {
      var r = sv.getBoundingClientRect(), sx = (clientX - r.left) * W / r.width;
      var d = Math.round((sx - L) / (W - L - R) * (days - 1)) + 1; d = Math.max(1, Math.min(days, d));
      var X = x(d); cx.setAttribute('x1', X); cx.setAttribute('x2', X); cx.style.display = '';
      var rows = '', ds = '';
      series.forEach(function (s) { var v = s.values[d - 1]; if (v == null) return; rows += '<div><span style="color:' + s.color + '">●</span> ' + esc(s.name) + ': <b>' + num(v, 1) + ' ю</b></div>'; ds += '<circle cx="' + X + '" cy="' + y(v) + '" r="4" fill="' + s.color + '" stroke="var(--surface)" stroke-width="2"/>'; });
      dots.innerHTML = ds;
      tip.innerHTML = '<div class="small muted">' + d + ' ' + mName + '</div>' + rows; tip.style.display = 'block';
      var px = X * r.width / W, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - tw, px + 12 > r.width - tw ? px - tw - 12 : px + 12)) + 'px'; tip.style.top = '8px';
    }
    function hide() { cx.style.display = 'none'; dots.innerHTML = ''; tip.style.display = 'none'; }
    var hit = sv.querySelector('#hit');
    hit.addEventListener('mousemove', function (e) { show(e.clientX); });
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('touchstart', function (e) { show(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener('touchmove', function (e) { show(e.touches[0].clientX); }, { passive: true });
  }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

  // ---------- деньги: план поступлений и поступления ----------
  var moneyState = { tab: 'plan', pp: 'week', ip: 'month' };
  function rub(x) { return x == null || !isFinite(x) ? '—' : Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayLabel(s) { var d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); return s.slice(8, 10) + '.' + s.slice(5, 7) + ' ' + ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()]; }
  function periods() {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var add = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
    var mon = add(t, -((t.getDay() + 6) % 7)), m1 = new Date(t.getFullYear(), t.getMonth(), 1), mEnd = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    var n1 = new Date(t.getFullYear(), t.getMonth() + 1, 1), nEnd = new Date(t.getFullYear(), t.getMonth() + 2, 0), p1 = new Date(t.getFullYear(), t.getMonth() - 1, 1), pEnd = new Date(t.getFullYear(), t.getMonth(), 0);
    var y1 = add(t, -1), y2 = add(t, -1); if (t.getDay() === 1) y1 = add(t, -3); else if (t.getDay() === 0) { y1 = add(t, -2); y2 = add(t, -2); }
    return {
      plan: [['today', 'Сегодня', t, t], ['tomorrow', 'Завтра', add(t, 1), add(t, 1)], ['week', 'Эта неделя', mon, add(mon, 6)], ['rest', 'Остаток месяца', t, mEnd], ['month', 'Весь месяц', m1, mEnd], ['next', cap(MONTHS[n1.getMonth()]), n1, nEnd]],
      inc: [['yday', 'Вчера', y1, y2], ['today', 'Сегодня', t, t], ['week', 'Эта неделя', mon, t], ['month', cap(MONTHS[t.getMonth()]), m1, t], ['prev', cap(MONTHS[p1.getMonth()]), p1, pEnd]], today: iso(t), m1: iso(m1)
    };
  }
  function byZoneMgr(rows, val) {
    var Z = {}; rows.forEach(function (r) { var z = Z[r.zone] = Z[r.zone] || { s: 0, n: 0, m: {} }; z.s += val(r); z.n++; var m = z.m[r.mgr] = z.m[r.mgr] || { s: 0, n: 0 }; m.s += val(r); m.n++; });
    var tot = rows.reduce(function (s, r) { return s + val(r); }, 0);
    return '<div class="tw"><table class="t"><thead><tr><th>Регион / менеджер</th><th>Сумма</th><th>Шт.</th><th>Доля</th></tr></thead><tbody>' +
      ['Центр', 'Юг', 'Север'].map(function (zn) { var z = Z[zn]; if (!z) return ''; return '<tr class="grp"><td colspan="4">' + zn + ' · ' + rub(z.s) + '</td></tr>' +
        Object.keys(z.m).filter(isMgr).sort(function (a, b) { return z.m[b].s - z.m[a].s; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + rub(z.m[k].s) + '</td><td>' + z.m[k].n + '</td><td>' + pct(tot ? z.m[k].s / tot : 0) + '</td></tr>'; }).join(''); }).join('') +
      '<tr class="tot"><td>Итого</td><td>' + rub(tot) + '</td><td>' + rows.length + '</td><td></td></tr></tbody></table></div>';
  }
  function byDayTable(rows, key, val) {
    var D = {}; rows.forEach(function (r) { var d = r[key]; if (!d) return; D[d] = D[d] || { s: 0, n: 0 }; D[d].s += val(r); D[d].n++; });
    var ks = Object.keys(D).sort(), max = 0; ks.forEach(function (k) { if (D[k].s > max) max = D[k].s; });
    if (!ks.length) return '<div class="muted">Нет данных за период.</div>';
    return '<div class="tw"><table class="t"><thead><tr><th>День</th><th class="l" style="width:45%"></th><th>Сумма</th><th>Шт.</th></tr></thead><tbody>' + ks.map(function (k) {
      return '<tr><td>' + dayLabel(k) + '</td><td class="l"><div class="bar" style="margin:0;height:8px"><i style="width:' + (max ? D[k].s / max * 100 : 0).toFixed(1) + '%"></i></div></td><td>' + rub(D[k].s) + '</td><td>' + D[k].n + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function tgHtml(s) { return esc(s).replace(/&lt;(\/?)(b|i|pre|code)&gt;/g, '<$1$2>').replace(/&amp;(lt|gt|amp|quot);/g, '&$1;'); }
  function moneyWidget(w) {
    w.innerHTML = '<div class="loading">Загружаю…</div>';
    api('/api/money').then(function (j) {
      if (j.none) { w.innerHTML = '<div class="card">Данных пока нет — первая выгрузка из мс идёт.' + (STATIC ? '' : '<div style="margin-top:10px"><button class="btn pri" id="mrf" type="button">Загрузить из МойСклад</button></div>') + '</div>'; bindMoneyRefresh(w); return; }
      var P = periods(), st = moneyState;
      var upd = j.updated ? j.updated.slice(8, 10) + '.' + j.updated.slice(5, 7) + ' ' + j.updated.slice(11, 16) : '';
      var html = '<div class="card"><div class="row" style="justify-content:space-between"><div class="seg" id="mtab"><button type="button" data-t="plan" class="' + (st.tab === 'plan' ? 'on' : '') + '">План поступлений</button><button type="button" data-t="inc" class="' + (st.tab === 'inc' ? 'on' : '') + '">Поступления</button><button type="button" data-t="bot" class="' + (st.tab === 'bot' ? 'on' : '') + '">Как в боте</button></div>' +
        (STATIC ? '' : '<button class="btn" id="mrf" type="button">' + (j.running ? '⏳ Обновляю…' : '↻ Обновить из мс') + '</button>') + '</div>' +
        '<div class="note">Данные МойСклад на ' + esc(upd) + (STATIC ? ' · копия обновляется каждые 2 часа' : ' · обновляются каждый час с 8 до 20') + '</div></div>';
      if (st.tab === 'plan') {
        var per = P.plan.filter(function (x) { return x[0] === st.pp; })[0] || P.plan[2], a = iso(per[2]), b = iso(per[3]);
        var ok = j.plan.filter(function (r) { return r.ok && r.date && r.date >= a && r.date <= b; });
        var noSum = ok.filter(function (r) { return !r.pay; });
        var val = function (r) { return r.pay || 0; };
        var tot = ok.reduce(function (s, r) { return s + val(r); }, 0);
        html += '<div class="card"><div class="seg" id="mper">' + P.plan.map(function (x) { return '<button type="button" data-p="' + x[0] + '" class="' + (x[0] === per[0] ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
          '<div class="tiles" style="margin-top:12px"><div class="tile"><div class="k">Ожидается по «Дате оплаты»</div><div class="v">' + rub(tot) + '</div><div class="s">' + ok.length + ' заказ(ов) · ' + dayLabel(a) + (a !== b ? ' – ' + dayLabel(b) : '') + '</div></div>' +
          ['Центр', 'Юг', 'Север'].map(function (z) { var s = ok.filter(function (r) { return r.zone === z; }).reduce(function (x, r) { return x + val(r); }, 0); return '<div class="tile"><div class="k">' + z + '</div><div class="v">' + rub(s) + '</div><div class="s">' + pct(tot ? s / tot : 0) + '</div></div>'; }).join('') + '</div>' +
          (noSum.length ? '<div class="note err">⚠️ Не заполнена «Сумма оплаты»: ' + noSum.length + ' — ' + noSum.map(function (r) { return esc(r.num); }).join(', ') + '</div>' : '') + '</div>';
        html += '<div class="grid"><div class="card fold"><h3>По дням</h3>' + byDayTable(ok, 'date', val) + '</div><div class="card fold"><h3>По регионам и менеджерам</h3>' + byZoneMgr(ok, val) + '</div></div>';
        html += '<div class="card fold"><h3>Заказы</h3><div class="tw" style="max-height:70vh"><table class="t"><thead><tr><th>Дата оплаты</th><th class="l">Клиент</th><th class="l">Менеджер</th><th>Заказ</th><th>Сумма оплаты</th><th>Сумма заказа</th><th>Уже оплачено</th></tr></thead><tbody>' +
          ok.slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (y.pay || 0) - (x.pay || 0); }).map(function (r) {
            return '<tr><td>' + dayLabel(r.date) + '</td><td class="l">' + esc(r.client || '—') + '</td><td class="l">' + esc(r.mgr) + '</td><td>' + esc(r.num) + '</td><td><b>' + rub(r.pay) + '</b></td><td>' + rub(r.osum) + '</td><td>' + (r.payed ? rub(r.payed) : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
        // ожидались в этом месяце до сегодняшнего дня, а заказ оплачен не полностью
        var late = j.plan.filter(function (r) { return r.ok && r.date && r.date >= P.m1 && r.date < P.today && r.payed < r.osum - 1; });
        if (late.length) html += '<div class="card"><h3>Дата оплаты прошла, заказ оплачен не полностью · ' + late.length + '</h3><div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Дата оплаты</th><th class="l">Клиент</th><th class="l">Менеджер</th><th>Заказ</th><th>Ждали</th><th>Осталось по заказу</th></tr></thead><tbody>' +
          late.sort(function (x, y) { return (y.osum - y.payed) - (x.osum - x.payed); }).map(function (r) { return '<tr><td>' + dayLabel(r.date) + '</td><td class="l">' + esc(r.client || '—') + '</td><td class="l">' + esc(r.mgr) + '</td><td>' + esc(r.num) + '</td><td>' + rub(r.pay) + '</td><td class="neg">' + rub(r.osum - r.payed) + '</td></tr>'; }).join('') +
          '</tbody></table></div><div class="note">Текущий месяц: заказы, у которых «Дата оплаты» уже прошла, а оплачено меньше суммы заказа. Повод позвонить клиенту.</div></div>';
      } else if (st.tab === 'inc') {
        var pi = P.inc.filter(function (x) { return x[0] === st.ip; })[0] || P.inc[3], a2 = iso(pi[2]), b2 = iso(pi[3]);
        var rows = j.inc.filter(function (r) { return r.day >= a2 && r.day <= b2; }), v2 = function (r) { return r.sum; };
        var tot2 = rows.reduce(function (s, r) { return s + r.sum; }, 0), cash = rows.filter(function (r) { return r.kind === 'cashin'; }).reduce(function (s, r) { return s + r.sum; }, 0);
        var C = {}; rows.forEach(function (r) { var k = r.client || '—'; C[k] = C[k] || { s: 0, n: 0, m: r.mgr }; C[k].s += r.sum; C[k].n++; });
        var top = Object.keys(C).sort(function (x, y) { return C[y].s - C[x].s; }).slice(0, 25);
        html += '<div class="card"><div class="seg" id="mper">' + P.inc.map(function (x) { return '<button type="button" data-p="' + x[0] + '" class="' + (x[0] === pi[0] ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
          '<div class="tiles" style="margin-top:12px"><div class="tile"><div class="k">Поступило</div><div class="v">' + rub(tot2) + '</div><div class="s">' + rows.length + ' платеж(ей) · ' + dayLabel(a2) + (a2 !== b2 ? ' – ' + dayLabel(b2) : '') + '</div></div>' +
          ['Центр', 'Юг', 'Север'].map(function (z) { var s = rows.filter(function (r) { return r.zone === z; }).reduce(function (x, r) { return x + r.sum; }, 0); return '<div class="tile"><div class="k">' + z + '</div><div class="v">' + rub(s) + '</div><div class="s">' + pct(tot2 ? s / tot2 : 0) + '</div></div>'; }).join('') +
          '<div class="tile"><div class="k">Из них касса</div><div class="v">' + rub(cash) + '</div></div></div></div>';
        html += '<div class="grid"><div class="card fold"><h3>По дням</h3>' + byDayTable(rows, 'day', v2) + '</div><div class="card fold"><h3>По регионам и менеджерам</h3>' + byZoneMgr(rows, v2) + '</div></div>';
        html += '<div class="card fold"><h3>Крупнейшие плательщики</h3><div class="tw"><table class="t"><thead><tr><th class="l">Клиент</th><th class="l">Менеджер</th><th>Сумма</th><th>Платежей</th></tr></thead><tbody>' +
          top.map(function (k) { return '<tr><td class="l">' + esc(k) + '</td><td class="l">' + esc(C[k].m) + '</td><td>' + rub(C[k].s) + '</td><td>' + C[k].n + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="note">Методика Десанта, как в «Выполнении»: входящие платежи + касса ООО «АМИНАТРЕЙД», без РВБ, Нике/Евростандарт и «Интернет Решений»; менеджер — «Менеджер ОП», регион — по владельцу клиента.</div></div>';
      } else {
        var names = { today: 'Оплаты на сегодня', week: 'Оплаты на неделю', month: 'Остаток месяца', in_days: 'Поступило вчера и сегодня', in_month: 'Поступило за месяц' };
        html += '<div class="card note" style="margin-top:0">Это сообщения бота как есть. Бот считает по своей методике (все юрлица, регион — по менеджеру), поэтому его цифры могут немного отличаться от вкладок «План поступлений» и «Поступления», которые считаются как в Десанте.' + (j.botUpdated ? ' Бот обновлял ' + esc(j.botUpdated.slice(8, 10) + '.' + j.botUpdated.slice(5, 7) + ' ' + j.botUpdated.slice(11, 16)) + '.' : '') + '</div>';
        html += '<div class="grid">' + ['today', 'week', 'month', 'in_days', 'in_month'].map(function (k) { return j.texts[k] ? '<div class="card"><div class="small muted" style="margin-bottom:6px">' + names[k] + '</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + tgHtml(j.texts[k]) + '</div></div>' : ''; }).join('') + '</div>';
      }
      w.innerHTML = html;
      w.querySelector('#mtab').addEventListener('click', function (e) { var t = e.target.getAttribute('data-t'); if (t) { moneyState.tab = t; moneyWidget(w); } });
      var mp = w.querySelector('#mper'); if (mp) mp.addEventListener('click', function (e) { var p = e.target.getAttribute('data-p'); if (!p) return; if (moneyState.tab === 'plan') moneyState.pp = p; else moneyState.ip = p; moneyWidget(w); });
      bindMoneyRefresh(w);
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }
  function bindMoneyRefresh(w) {
    var b = document.getElementById('mrf'); if (!b) return;
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = '⏳ Обновляю… (~1 мин)';
      api('/api/jobs/money', { json: {} }).then(function () {
        var n = 0, t = setInterval(function () { api('/api/money').then(function (j) { n++; if (!j.running || n > 40) { clearInterval(t); moneyWidget(w); } }); }, 5000);
      }).catch(function (e) { b.textContent = 'Ошибка: ' + e.message; });
    });
  }

  // ---------- кнопки обновлений (на компе — сразу, на телефоне — через бота) ----------
  var MGRS = ['Пронткилевич', 'Станевская', 'Удальцова', 'Дворин', 'Кузьмич', 'Гоголюк', 'Филимонова', 'Прохорович'];
  function botLink(cmd) { return BOT + '?start=' + cmd; }
  var JOB_TITLES = { data: 'Данные из мс', bot: 'Отчёты бота', prices: 'Прайсы по МС', comp: 'Конкурентный анализ', grad: 'Градация клиентов', pages: 'Копия для телефона' };
  function jobLine(j) {
    if (j.running) return '<span class="st idle">⏳ идёт</span>';
    if (!j.state) return '';
    var t = j.finished || j.started || '';
    var when = t ? t.slice(8, 10) + '.' + t.slice(5, 7) + ' ' + t.slice(11, 16) : '';
    return j.state === 'ok' ? '<span class="small muted">обновлено ' + when + '</span>' : j.state === 'error' ? '<span class="st bad">ошибка ' + when + '</span>' : '';
  }
  // ids — какие обновления показать; box — куда
  function jobButtons(box, ids, title, fold) {
    if (!box) return;
    if (STATIC) {
      box.innerHTML = '<div class="card' + (fold ? ' fold' : '') + '"><h3>' + esc(title || 'Обновить') + '</h3><div class="row" style="justify-content:space-between"><b></b><span class="small muted">через бота в Telegram</span></div><div class="row" style="margin-top:10px">' +
        ids.map(function (id) { return '<a class="btn" href="' + botLink('upd_' + id) + '" target="_blank" rel="noopener">↻ ' + esc(JOB_TITLES[id]) + '</a>'; }).join('') +
        '</div><div class="note">Откроется бот — нажмите «Start/Запустить». Бот запустит обновление на компе и пришлёт итог; копия для телефона обновится сама.</div></div>';
      return;
    }
    var lastMsg = null;
    function draw() {
      api('/api/jobs').then(function (list) {
        var by = {}; list.forEach(function (j) { by[j.id] = j; });
        box.innerHTML = '<div class="card' + (fold ? ' fold' : '') + '"><h3>' + esc(title || 'Обновить') + '</h3><div class="row" style="justify-content:space-between"><b></b></div><div style="margin-top:6px">' + ids.map(function (id) {
          var j = by[id] || { id: id, title: JOB_TITLES[id] };
          return '<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><div style="min-width:0"><div>' + esc(j.title) + '</div><div class="small muted">' + esc(j.hint || '') + '</div></div><div class="row">' + jobLine(j) +
            '<button class="btn" type="button" data-job="' + id + '"' + (j.running ? ' disabled' : '') + '>↻ Обновить</button></div></div>';
        }).join('') + '</div><div class="note jmsg' + (lastMsg && !lastMsg.ok ? ' err' : '') + '">' + (lastMsg ? esc(lastMsg.msg) : '') + '</div></div>';
        if (list.some(function (j) { return j.running && ids.indexOf(j.id) >= 0; })) setTimeout(function () { if (document.body.contains(box)) draw(); }, 15000);
      }).catch(function () {});
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-job]') : null; if (!b) return;
      b.disabled = true;
      api('/api/jobs/run', { json: { job: b.getAttribute('data-job') }, soft: true }).then(function (r) {
        lastMsg = r;
        var m = box.querySelector('.jmsg'); if (m) { m.textContent = r.msg; m.className = 'note jmsg ' + (r.ok ? '' : 'err'); }
        setTimeout(draw, 1500);
      });
    });
    draw();
  }
  // правка в мс: подготовить (план + предпросмотр) → ждёт «Подтвердить» на главной и в Telegram
  function propose(payload, msgEl, btn) {
    if (btn) btn.disabled = true;
    if (msgEl) { msgEl.className = 'note'; msgEl.textContent = '⏳ Готовлю правку…'; }
    return api('/api/propose', { json: payload, soft: true }).then(function (r) {
      if (msgEl) { msgEl.className = 'note ' + (r.ok ? '' : 'err'); msgEl.innerHTML = esc(r.msg) + (r.ok ? ' <a href="#home">Открыть «Ждут подтверждения» →</a>' : ''); }
      if (r.ok) { pendingCount++; drawNav((location.hash || '#home').slice(1).split('/')[0]); }
      if (btn) btn.disabled = false;
      return r;
    }).catch(function (e) { if (msgEl) { msgEl.className = 'note err'; msgEl.textContent = e.message; } if (btn) btn.disabled = false; });
  }
  function mgrSelect(cls, exclude) { return '<select class="' + cls + '"><option value="">Кому передать…</option>' + MGRS.filter(function (m) { return m !== exclude; }).map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select>'; }

  // ---------- «Цены → в мс» по конкурентному анализу ----------
  var priceState = { seg: 'pots', mode: 'prop' };
  function pricingWidget(w) {
    w.innerHTML = '<div id="pjobs"></div><div id="pprop"><div class="loading">Загружаю предложения…</div></div>';
    jobButtons(w.querySelector('#pjobs'), ['prices', 'comp'], 'Обновить прайсы и конкурентный анализ');
    var box = w.querySelector('#pprop');
    api('/api/competitors').then(function (c) {
      if (c.none || !c.segments) { box.innerHTML = '<div class="card">Предложений по ценам пока нет — нажмите «Обновить» у конкурентного анализа.</div>'; return; }
      function draw() {
        var seg = c.segments.filter(function (s) { return s.key === priceState.seg; })[0] || c.segments[0];
        var rows = seg.rows.filter(function (r) { return priceState.mode === 'all' || r.newPrice; });
        var good = function (r) { return /Снизить|Можно поднять/.test(r.prio); };
        var html = '<div class="card"><h3>Цены → в мс <span class="small muted">анализ от ' + esc((c.date || '').slice(8, 10) + '.' + (c.date || '').slice(5, 7)) + '</span></h3>' +
          '<div class="seg" id="psg">' + c.segments.map(function (s) { return '<button type="button" data-s="' + s.key + '" class="' + (s.key === seg.key ? 'on' : '') + '">' + esc(s.title) + (s.key === 'pots' ? ' ★' : '') + '</button>'; }).join('') + '</div> ' +
          '<div class="seg" id="pmd" style="margin-top:8px"><button type="button" data-m="prop" class="' + (priceState.mode === 'prop' ? 'on' : '') + '">Есть предложение</button><button type="button" data-m="all" class="' + (priceState.mode === 'all' ? 'on' : '') + '">Все сравнённые</button></div>' +
          '<div class="note">Наша цена — «' + esc(seg.store) + ' Дистр А» (= «от 500 тыс.» оптового прайса), сравнение с минимальной ценой конкурента. Новая цена ставится в Дистр А, <b>вся лесенка склада ' + esc(seg.store) + ' меняется на тот же %</b>. Перед записью — предпросмотр с текущими ценами из мс и «Подтвердить». ★ — своё производство.</div>' +
          (STATIC ? '<div class="note err">Менять цены можно на компе (окно «Рабочий стол ОП»): здесь только просмотр.</div>' : '') +
          '<div class="tw" style="max-height:70vh;margin-top:8px"><table class="t"><thead><tr>' + (STATIC ? '' : '<th></th>') + '<th class="l">Позиция</th><th>Наша</th><th>Мин. конкурент</th><th>Разница</th><th class="l">Предложение</th>' + (STATIC ? '' : '<th>Новая цена</th>') + '</tr></thead><tbody>' +
          rows.map(function (r, i) {
            var cls = r.diff > 0.03 ? 'neg' : r.diff < -0.03 ? 'pos' : '';
            return '<tr>' + (STATIC ? '' : '<td><input type="checkbox" class="pc" data-i="' + i + '"' + (r.newPrice && good(r) && priceState.checked && priceState.checked[seg.key + r.code] ? ' checked' : '') + '></td>') +
              '<td class="l"><b>' + esc(r.art || r.code) + '</b> ' + esc(r.name) + '<div class="small muted">' + esc(r.sub || r.sec || '') + '</div></td><td>' + num(r.our, 2) + '</td><td>' + num(r.min, 2) + ' <span class="small muted">' + esc(r.minWho) + '</span></td>' +
              '<td class="' + cls + '">' + (r.diff > 0 ? '+' : '') + Math.round(r.diff * 100) + '%</td><td class="l small">' + esc(r.prio || r.status) + (r.why ? '<div class="muted">' + esc(r.why) + '</div>' : '') + '</td>' +
              (STATIC ? '' : '<td><input type="text" inputmode="decimal" class="pn" data-i="' + i + '" value="' + (r.newPrice ? String(r.newPrice).replace('.', ',') : '') + '" style="width:80px;font-size:16px;padding:4px 6px"></td>') + '</tr>';
          }).join('') + '</tbody></table></div>' +
          (STATIC ? '' : '<div class="row" style="margin-top:12px"><button class="btn pri" type="button" id="pgo">Внести выбранные в мс…</button><span class="small muted" id="pcnt"></span></div><div class="note" id="pmsg"></div>') + '</div>';
        box.innerHTML = html;
        box.querySelector('#psg').addEventListener('click', function (e) { var s = e.target.getAttribute('data-s'); if (s) { priceState.seg = s; draw(); } });
        box.querySelector('#pmd').addEventListener('click', function (e) { var m = e.target.getAttribute('data-m'); if (m) { priceState.mode = m; draw(); } });
        if (STATIC) return;
        var cnt = function () { box.querySelector('#pcnt').textContent = 'выбрано: ' + box.querySelectorAll('.pc:checked').length; };
        box.addEventListener('change', function (e) { if (e.target.classList && e.target.classList.contains('pc')) cnt(); });
        box.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('pn')) { var cb = box.querySelector('.pc[data-i="' + e.target.getAttribute('data-i') + '"]'); if (cb && e.target.value) cb.checked = true; cnt(); } });
        cnt();
        box.querySelector('#pgo').addEventListener('click', function () {
          var items = [], bad = [];
          var cbs = box.querySelectorAll('.pc:checked');
          for (var k = 0; k < cbs.length; k++) {
            var i = +cbs[k].getAttribute('data-i'), r = rows[i], v = parseFloat(String(box.querySelector('.pn[data-i="' + i + '"]').value).replace(',', '.').replace(/\s/g, ''));
            if (!(v > 0)) { bad.push(r.art || r.code); continue; }
            if (Math.abs(v / r.our - 1) > 0.4) { bad.push((r.art || r.code) + ' (изменение больше 40%)'); continue; }
            items.push({ code: r.code, newA: v });
          }
          var msg = box.querySelector('#pmsg');
          if (bad.length) { msg.className = 'note err'; msg.textContent = 'Проверьте новую цену: ' + bad.join(', '); return; }
          if (!items.length) { msg.className = 'note err'; msg.textContent = 'Отметьте позиции галочкой.'; return; }
          if (!window.confirm('Подготовить изменение цен в мс по ' + items.length + ' поз. (' + seg.store + ')?\nСначала будет предпросмотр, записи — только после «Подтвердить».')) return;
          propose({ type: 'prices', seg: seg.key, items: items }, msg, this);
        });
      }
      draw();
    }).catch(function (e) { box.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // предпросмотр правки в карточке «Ждут подтверждения»
  function showPreview(card, id) {
    var box = card.querySelector('.lst');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="loading">Загружаю…</div>';
    api('/api/actionpreview?id=' + encodeURIComponent(id)).then(function (p) {
      var h = '';
      if (p.items) h += '<div class="tw" style="max-height:55vh;margin-top:8px"><table class="t"><thead><tr><th class="l">Клиент</th><th class="l">Кому</th><th class="l">Текст задачи</th></tr></thead><tbody>' +
        p.items.map(function (i) { return '<tr><td class="l">' + esc(i.client) + '</td><td class="l">' + esc(i.who) + '</td><td class="l small">' + esc(i.desc) + '<div class="muted">срок ' + esc((i.due || '').slice(0, 10)) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
      if (p.prices) {
        var L = p.prices.ladder || [];
        h += '<div class="tw" style="max-height:55vh;margin-top:8px"><table class="t"><thead><tr><th class="l">Позиция</th>' + L.map(function (n) { return '<th>' + esc(n.replace(/^(Подольск|КРД) /, '')) + '</th>'; }).join('') + '<th>%</th></tr></thead><tbody>' +
          p.prices.items.map(function (x) {
            if (!x.after) return '<tr><td class="l">' + esc(x.code) + ' ' + esc(x.name) + '</td><td colspan="' + (L.length + 1) + '" class="l err small">' + esc(x.warn) + '</td></tr>';
            return '<tr><td class="l">' + esc(x.code) + ' ' + esc(x.name) + (x.warn ? '<div class="small err">' + esc(x.warn) + '</div>' : '') + '</td>' + L.map(function (n) { return '<td>' + num(x.before[n], 2) + '<br><b>' + num(x.after[n], 2) + '</b></td>'; }).join('') + '<td class="' + (x.factor < 1 ? 'neg' : 'pos') + '">' + (x.factor > 1 ? '+' : '') + num((x.factor - 1) * 100, 1) + '%</td></tr>';
          }).join('') + '</tbody></table></div><div class="note">Сверху — сейчас в мс, снизу жирным — после правки.</div>';
      }
      if (p.csv) h += '<div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th class="l">Карточка</th><th class="l">Что</th><th class="l">От</th><th class="l">Кому</th></tr></thead><tbody>' +
        p.csv.map(function (r) { return '<tr><td class="l">' + esc(r.name) + (r.inn ? '<div class="small muted">ИНН ' + esc(r.inn) + '</div>' : '') + '</td><td class="l small">' + esc(r.kind) + '</td><td class="l">' + esc(r.from) + '</td><td class="l">' + esc(r.to) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      if (p.log && p.log.length) h += '<div class="note">Журнал: ' + p.log.filter(function (l) { return l.result === 'ok'; }).length + ' выполнено, ' + p.log.filter(function (l) { return l.result === 'skip'; }).length + ' пропущено, ' + p.log.filter(function (l) { return l.result === 'error'; }).length + ' ошибок.</div>';
      if (p.pricesLog && p.pricesLog.length) h += '<div class="note">Журнал цен: ' + p.pricesLog.filter(function (l) { return l.result === 'ok'; }).length + ' изменено, ' + p.pricesLog.filter(function (l) { return l.result !== 'ok'; }).length + ' пропущено/ошибок.</div>';
      if (p.error) h += '<div class="note err">' + esc(p.error) + '</div>';
      box.innerHTML = h || '<div class="muted small">Нет деталей.</div>';
    }).catch(function (e) { box.innerHTML = '<div class="err small">' + esc(e.message) + '</div>'; });
  }

  // ---------- «Редакция»: файлы для правки ----------
  var redState = { sub: 'prices' };
  var RED_OPS = { prices: [['prices_ms', '💲 Обновить цены по мс', 'Цены в прайсе заменяются текущими из мс (как ежемесячное обновление). Получится новая версия.']],
    managers: [['clients_inn', '🔎 Сверить клиентов по ИНН с мс', 'По ИНН из файла найду карточки в мс: чей клиент, статус, последняя отгрузка, сколько взял горшков и кассет. Результат — новый файл.']],
    competitors: [['to_competitors', '📁 В материалы конкурентов', 'Файл появится в «Прайсы и конкуренты» → «Материалы конкурентов».']], other: [] };
  function redactionWidget(w) {
    if (STATIC) { w.innerHTML = '<div class="card">Редакция работает на компе — в окне «Рабочий стол ОП»: туда загружаются файлы, там же правятся и обрабатываются.</div>'; return; }
    w.innerHTML = '<div class="loading">Загружаю…</div>';
    api('/api/redaction').then(function (r) {
      var subs = r.subs, docs = r.docs.filter(function (d) { return d.sub === redState.sub; });
      var html = '<div class="card"><div class="seg" id="rsub">' + Object.keys(subs).map(function (k) { var n = r.docs.filter(function (d) { return d.sub === k; }).length; return '<button type="button" data-s="' + k + '" class="' + (k === redState.sub ? 'on' : '') + '">' + esc(subs[k]) + (n ? ' · ' + n : '') + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:12px"><input type="file" id="rfile" accept=".xlsx,.xlsm,.xls,.csv,.docx,.pdf,.txt,.md" style="max-width:100%"><button class="btn pri" type="button" id="rup">⬆ Загрузить в «' + esc(subs[redState.sub]) + '»</button></div>' +
        '<div class="note" id="rmsg">Загружаете файл → правите таблицу прямо здесь или запускаете обработку → каждая правка сохраняется новой версией, любую можно вернуть. Оформление и картинки сохраняются (правки вносит Excel).' +
        (RED_OPS[redState.sub].length ? ' Обработки здесь: ' + RED_OPS[redState.sub].map(function (o) { return o[1]; }).join(', ') + '.' : '') + '</div></div>';
      html += '<div class="card"><h3>Файлы</h3>' + (docs.length ? '<ul class="files">' + docs.map(function (d) {
        return '<li><span class="ext ' + esc(d.ext.slice(1)) + '">' + esc(d.ext.slice(1)) + '</span><div class="fmeta"><a class="fname" href="#red/' + esc(d.id) + '">' + esc(d.name) + '</a><span class="fsub">версия ' + d.v + ' · ' + esc(d.updated) + ' · ' + esc(d.note || '') + '</span></div></li>';
      }).join('') + '</ul>' : '<div class="muted">Пока пусто — загрузите файл.</div>') + '</div>';
      w.innerHTML = html;
      w.querySelector('#rsub').addEventListener('click', function (e) { var s = e.target.getAttribute('data-s'); if (s) { redState.sub = s; redactionWidget(w); } });
      w.querySelector('#rup').addEventListener('click', function () {
        var f = w.querySelector('#rfile').files[0], msg = w.querySelector('#rmsg'), btn = this;
        if (!f) { msg.className = 'note err'; msg.textContent = 'Выберите файл.'; return; }
        if (f.size > 28e6) { msg.className = 'note err'; msg.textContent = 'Файл больше 28 МБ.'; return; }
        btn.disabled = true; msg.className = 'note'; msg.textContent = '⏳ Загружаю…';
        var rd = new FileReader();
        rd.onload = function () {
          var b64 = bytesToB64(new Uint8Array(rd.result));
          api('/api/redaction/upload', { json: { sub: redState.sub, name: f.name, b64: b64 }, soft: true }).then(function (x) {
            btn.disabled = false; msg.className = 'note ' + (x.ok ? '' : 'err'); msg.textContent = x.msg;
            if (x.ok) location.hash = '#red/' + x.id;
          });
        };
        rd.readAsArrayBuffer(f);
      });
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }
  function redPage(id, ver) {
    main.innerHTML = '<div class="loading">Открываю…</div>';
    api('/api/redaction/info?id=' + encodeURIComponent(id)).then(function (m) {
      var last = m.versions[m.versions.length - 1].v, v = ver ? +ver : last, isLast = v === last, isXl = ['.xlsx', '.xlsm', '.xls', '.csv'].indexOf(m.ext) >= 0;
      var src = '/api/redaction/file?id=' + encodeURIComponent(id) + '&v=' + v;
      var ops = (RED_OPS[m.sub] || []).concat([['diff', '⇄ Что изменилось', 'Сравнить последнюю версию с предыдущей.']]);
      var html = '<div class="viewer-head"><a class="btn" href="#redaction">← Редакция</a><span class="nm">' + esc(m.versions[v - 1] ? (m.versions.filter(function (x) { return x.v === v; })[0].name || m.name) : m.name) + '</span>' +
        '<select id="rver">' + m.versions.slice().reverse().map(function (x) { return '<option value="' + x.v + '"' + (x.v === v ? ' selected' : '') + '>версия ' + x.v + ' · ' + esc(x.at) + '</option>'; }).join('') + '</select>' +
        '<a class="btn pri" href="' + src + '&dl=1">Скачать</a></div>';
      html += '<div class="card"><div class="row">' + ops.map(function (o) { return '<button class="btn" type="button" data-op="' + o[0] + '" title="' + esc(o[2]) + '">' + esc(o[1]) + '</button>'; }).join('') +
        (!isLast ? '<button class="btn" type="button" data-op="restore">↩ Вернуть эту версию</button>' : '') + '<button class="btn no" type="button" data-op="remove">Убрать</button></div><div class="note" id="rmsg"></div><div id="rres"></div></div>';
      html += details('История версий · ' + m.versions.length, '<div class="tw"><table class="t"><tbody>' + m.versions.slice().reverse().map(function (x) { return '<tr><td>' + x.v + '</td><td>' + esc(x.at) + '</td><td class="l">' + esc(x.note) + '</td><td><a href="#red/' + esc(id) + '/' + x.v + '">открыть</a></td></tr>'; }).join('') + '</tbody></table></div>', false);
      html += '<div id="redit"></div>';
      main.innerHTML = html;
      main.querySelector('#rver').addEventListener('change', function () { location.hash = '#red/' + id + '/' + this.value; });
      var msg = main.querySelector('#rmsg'), res = main.querySelector('#rres');
      main.querySelector('.card .row').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-op]') : null; if (!b) return; var op = b.getAttribute('data-op');
        if (op === 'remove' && !window.confirm('Убрать файл из Редакции? (уйдёт в корзину Редакции)')) return;
        if (op === 'prices_ms' && !window.confirm('Обновить цены в этом прайсе по мс? Будет новая версия, старая останется в истории.')) return;
        b.disabled = true; msg.className = 'note'; msg.textContent = '⏳ Выполняю…'; res.innerHTML = '';
        api('/api/redaction/process', { json: { id: id, op: op, v: v }, soft: true }).then(function (x) {
          b.disabled = false; msg.className = 'note ' + (x.ok ? '' : 'err'); msg.textContent = x.msg;
          if (x.changes && x.changes.length) res.innerHTML = '<div class="tw" style="max-height:50vh;margin-top:8px"><table class="t"><thead><tr><th>Лист</th><th>Ячейка</th><th class="l">Было</th><th class="l">Стало</th></tr></thead><tbody>' + x.changes.map(function (c) { return '<tr><td>' + esc(c.sheet) + '</td><td>' + esc(c.addr) + '</td><td class="l neg">' + esc(c.was) + '</td><td class="l pos">' + esc(c.now) + '</td></tr>'; }).join('') + '</tbody></table></div>';
          if (x.ok && op === 'remove') location.hash = '#redaction';
          else if (x.ok && x.id && x.id !== id) setTimeout(function () { location.hash = '#red/' + x.id; }, 1200);
          else if (x.ok && x.v) setTimeout(function () { redPage(id); }, 1200);
        });
      });
      if (!isXl) { main.querySelector('#redit').innerHTML = '<div class="card">Этот файл правится после скачивания; здесь — хранение версий и обработки.</div>'; return; }
      loadScript('XLSX', BASE + 'vendor/xlsx.full.min.js').then(function () { return fetch(src, { credentials: 'same-origin' }); }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        redEditor(main.querySelector('#redit'), id, window.XLSX.read(new Uint8Array(buf), { type: 'array' }), isLast && m.ext !== '.csv');
      }).catch(function (e) { main.querySelector('#redit').innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
    }).catch(fail);
  }
  function redEditor(box, id, wb, editable) {
    var names = wb.SheetNames.filter(function (n) { return wb.Sheets[n] && wb.Sheets[n]['!ref']; }), cur = 0, ops = [];
    function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
    function draw() {
      if (ops.length && !window.confirm('Есть несохранённые правки на этом листе — сбросить их?')) return false;
      ops = [];
      var ws = wb.Sheets[names[cur]], rg = window.XLSX.utils.decode_range(ws['!ref']);
      var r1 = rg.s.r, r2 = Math.min(rg.e.r, rg.s.r + 600), c1 = rg.s.c, c2 = Math.min(rg.e.c, rg.s.c + 30);
      var h = '<div class="card"><div class="sheets">' + names.map(function (n, i) { return '<button type="button" data-i="' + i + '"' + (i === cur ? ' class="on"' : '') + '>' + esc(n) + '</button>'; }).join('') + '</div>' +
        (editable ? '<div class="row" style="margin-bottom:8px"><button class="btn pri" type="button" id="rsave" disabled>💾 Сохранить правки</button><span class="small muted" id="rcnt">Кликните ячейку, чтобы изменить. ＋ — строка ниже, × — удалить строку.</span></div>' : '<div class="note" style="margin-top:0">Это не последняя версия — только просмотр. Чтобы править, откройте последнюю или верните эту.</div>') +
        '<div class="xl" style="max-height:72vh"><table class="redt"><thead><tr><th></th>';
      for (var c = c1; c <= c2; c++) h += '<th>' + colName(c) + '</th>';
      h += '</tr></thead><tbody>';
      for (var r = r1; r <= r2; r++) {
        h += '<tr><th class="rn" data-r="' + (r + 1) + '"><span>' + (r + 1) + '</span>' + (editable ? ' <a href="#" class="rins" title="Вставить строку ниже">＋</a><a href="#" class="rdel" title="Удалить строку">×</a>' : '') + '</th>';
        for (var c = c1; c <= c2; c++) {
          var cell = ws[window.XLSX.utils.encode_cell({ r: r, c: c })], txt = cell ? String(cell.w != null ? cell.w : cell.v) : '';
          h += '<td' + (editable ? ' contenteditable="true"' : '') + ' data-c="' + (c + 1) + '" data-t="' + (cell ? cell.t : '') + '" data-o="' + esc(txt) + '">' + esc(txt) + '</td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div><div class="note">' + (rg.e.r > r2 || rg.e.c > c2 ? 'Показаны первые 600 строк и 30 столбцов. ' : '') + 'Картинки и оформление здесь не видны, но в файле сохраняются: правки вносит Excel. Числа вводите как в Excel (через запятую).</div><div class="note" id="rsmsg"></div></div>';
      box.innerHTML = h; return true;
    }
    function renumber() { var trs = box.querySelectorAll('tbody tr'); for (var i = 0; i < trs.length; i++) { var th = trs[i].firstChild, rr = +trs[0].firstChild.getAttribute('data-r') + i; th.setAttribute('data-r', rr); th.firstChild.textContent = rr; } }
    function upd() { var b = box.querySelector('#rsave'); if (b) { b.disabled = !ops.length; box.querySelector('#rcnt').textContent = ops.length ? 'Несохранённых правок: ' + ops.length : 'Кликните ячейку, чтобы изменить.'; } }
    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('.sheets button')) { var i = +t.closest('button').getAttribute('data-i'); var keep = cur; cur = i; if (!draw()) cur = keep; return; }
      if (t.classList && (t.classList.contains('rins') || t.classList.contains('rdel'))) {
        e.preventDefault(); var tr = t.closest('tr'), r = +tr.firstChild.getAttribute('data-r');
        if (t.classList.contains('rins')) {
          var nt = tr.cloneNode(true); var tds = nt.querySelectorAll('td'); for (var k = 0; k < tds.length; k++) { tds[k].textContent = ''; tds[k].setAttribute('data-o', ''); tds[k].setAttribute('data-t', ''); }
          tr.parentNode.insertBefore(nt, tr.nextSibling); ops.push({ op: 'ins', r: r + 1 });
        } else { if (!window.confirm('Удалить строку ' + r + '?')) return; tr.parentNode.removeChild(tr); ops.push({ op: 'del', r: r }); }
        renumber(); upd(); return;
      }
      if (t.id === 'rsave') {
        var note = window.prompt('Коротко, что поменяли (для истории версий):', '') || '';
        t.disabled = true; var sm = box.querySelector('#rsmsg'); sm.className = 'note'; sm.textContent = '⏳ Excel сохраняет…';
        api('/api/redaction/edit', { json: { id: id, sheet: names[cur], ops: ops, note: note }, soft: true }).then(function (x) {
          sm.className = 'note ' + (x.ok ? '' : 'err'); sm.textContent = x.msg; if (x.ok) { ops = []; setTimeout(function () { redPage(id); }, 1000); } else t.disabled = false;
        });
      }
    });
    box.addEventListener('focusout', function (e) {
      var td = e.target; if (!td || td.tagName !== 'TD' || !td.isContentEditable) return;
      var v = td.textContent.replace(/ /g, ' ').trim(), o = td.getAttribute('data-o');
      if (v === o) return;
      var t = td.getAttribute('data-t'); var num = /^-?[\d\s]+([.,]\d+)?$/.test(v);
      ops.push({ op: 'set', r: +td.parentNode.firstChild.getAttribute('data-r'), c: +td.getAttribute('data-c'), v: v, t: (t === 'n' || (!t && num)) && num ? 'n' : 's' });
      td.setAttribute('data-o', v); td.style.background = 'var(--accent-soft)'; upd();
    });
    draw();
  }

  // ---------- «Обучение»: уроки по блокам, отправка менеджерам, ответы ----------
  function trainingWidget(w) {
    w.innerHTML = '<div class="loading">Загружаю…</div>';
    api('/api/training').then(function (t) {
      var L = t.lessons, M = t.managers;
      var nextFor = function (k) { for (var i = 0; i < L.length; i++) { var r = t.results[k][L[i].id]; if (!r || !r.doneAt) return L[i]; } return null; };
      var html = '<div class="card"><h3 style="margin-top:0">Уроки: ' + L.length + ' по 10–15 минут</h3><div class="note" style="margin-top:0">Урок — страница по ссылке (без пароля), тест — кнопками в боте @ms_alex_bot, нужно 80%. Вы отправляете урок отсюда, ответы видите в таблице ниже и в Telegram.</div>' +
        '<div class="row" style="margin-top:8px"><a class="btn" href="' + esc(t.site) + '" target="_blank" rel="noopener">📚 Все уроки на сайте</a>' + (STATIC ? '' : '<button class="btn" type="button" id="tpub">⬆ Опубликовать уроки</button>') + '</div><div class="note" id="tpmsg"></div></div>';
      if (!STATIC) {
        html += '<div class="card"><h3 style="margin-top:0">Отправить урок</h3><div class="row"><select id="tles">' + t.blocks.map(function (b) { return '<optgroup label="' + esc(b.title) + '">' + L.filter(function (l) { return l.block === b.id; }).map(function (l) { return '<option value="' + l.id + '">' + l.id.replace('_', '.') + ' ' + esc(l.title) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div>' +
          '<div class="row" style="margin-top:8px">' + M.map(function (m) { var n = nextFor(m.key); return '<label class="small" style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 8px' + (m.connected ? '' : ';opacity:.5') + '"><input type="checkbox" class="tm" value="' + esc(m.key) + '"' + (m.connected ? '' : ' disabled') + '> ' + esc(m.key) + (n ? ' <span class="muted">· след. ' + n.id.replace('_', '.') + '</span>' : ' <span class="pos">· всё пройдено</span>') + '</label>'; }).join('') + '</div>' +
          '<div class="row" style="margin-top:10px"><button class="btn pri" type="button" id="tsend">📘 Отправить выбранным</button><button class="btn" type="button" id="tnext">Каждому — его следующий урок</button></div><div class="note" id="tsmsg"></div></div>';
      }
      // таблица результатов
      html += '<div class="card"><h3 style="margin-top:0">Результаты</h3><div class="tw" style="max-height:70vh"><table class="t"><thead><tr><th>Менеджер</th>' + L.map(function (l) { return '<th title="' + esc(l.title) + '">' + l.id.replace('_', '.') + '</th>'; }).join('') + '<th>Итог</th></tr></thead><tbody>' +
        M.map(function (m) {
          var done = 0, sum = 0, tot = 0;
          var cells = L.map(function (l) {
            var r = t.results[m.key][l.id];
            if (!r) return '<td class="muted">—</td>';
            if (r.doneAt) { done++; sum += r.score; tot += r.total; var ok = r.score / r.total >= 0.8; return '<td><a href="#" class="tans ' + (ok ? 'pos' : 'neg') + '" data-m="' + esc(m.key) + '" data-l="' + l.id + '" title="' + esc(r.doneAt) + '">' + r.score + '/' + r.total + '</a></td>'; }
            if (r.startedAt) return '<td class="small" title="начат ' + esc(r.startedAt) + '">⏳ ' + r.answered + '/' + r.total + '</td>';
            return '<td class="small muted" title="отправлен ' + esc(r.sentAt) + '">📨</td>';
          }).join('');
          return '<tr><td>' + esc(m.key) + (m.connected ? '' : ' <span class="small muted">не подключён</span>') + '</td>' + cells + '<td><b>' + done + '/' + L.length + '</b>' + (tot ? ' <span class="small muted">' + Math.round(sum / tot * 100) + '%</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="note">📨 — отправлен, ⏳ — отвечает, 4/4 — пройден (зелёным — зачёт от 80%). Нажмите на результат — увидите ответы.</div><div id="tdet"></div></div>';
      // подключение
      html += '<div class="card fold"><h3>Подключение менеджеров к боту</h3><div class="note" style="margin-top:0">Отправьте менеджеру его личную ссылку (в WhatsApp, Telegram). Он откроет её, нажмёт «Старт» — и бот будет присылать ему уроки. Ссылка личная: по ней бот понимает, кто отвечает.</div><div class="tw"><table class="t"><tbody>' +
        M.map(function (m) { return '<tr><td>' + esc(m.key) + '</td><td class="l">' + (m.connected ? '<span class="pos">✓ подключён</span> <span class="small muted">' + esc(m.tgName) + ' · ' + esc(m.regAt) + '</span>' : '<span class="small">' + esc(m.invite) + '</span>') + '</td>' + (m.connected || STATIC ? '<td></td>' : '<td><button class="btn" type="button" data-copy="' + esc(m.invite) + '" style="min-height:32px;padding:4px 10px">Копировать</button></td>') + '</tr>'; }).join('') + '</tbody></table></div></div>';
      w.innerHTML = html;
      w.addEventListener('click', function (e) {
        var c = e.target.closest ? e.target.closest('[data-copy]') : null;
        if (c) { var v = c.getAttribute('data-copy'); try { navigator.clipboard.writeText(v).then(function () { c.textContent = 'Скопировано'; }); } catch (x) { window.prompt('Скопируйте ссылку:', v); } return; }
        var a = e.target.closest ? e.target.closest('a.tans') : null;
        if (a) { e.preventDefault(); var det = w.querySelector('#tdet'); det.innerHTML = '<div class="loading">…</div>';
          api('/api/training/answers?mgr=' + encodeURIComponent(a.getAttribute('data-m')) + '&lesson=' + a.getAttribute('data-l')).then(function (x) {
            det.innerHTML = '<h3>' + esc(a.getAttribute('data-m')) + ' · ' + esc(x.title) + ': ' + x.score + ' из ' + x.total + '</h3><ol>' + x.items.map(function (i) { var ok = i.given === i.correct; return '<li style="margin:6px 0">' + esc(i.q) + '<div class="small ' + (ok ? 'pos' : 'neg') + '">' + (ok ? '✓ ' : '✗ ') + esc(i.given == null ? 'нет ответа' : i.options[i.given]) + (ok ? '' : ' · правильно: ' + esc(i.options[i.correct])) + '</div></li>'; }).join('') + '</ol>' +
              (STATIC ? '' : '<button class="btn" type="button" id="treset">↺ Разрешить пересдачу</button>');
            var rb = det.querySelector('#treset'); if (rb) rb.addEventListener('click', function () { api('/api/training/reset', { json: { mgr: a.getAttribute('data-m'), lesson: a.getAttribute('data-l') } }).then(function (r) { det.innerHTML = '<div class="note">' + esc(r.msg) + '</div>'; }); });
          }); }
      });
      if (STATIC) return;
      w.querySelector('#tpub').addEventListener('click', function () { var b = this, m = w.querySelector('#tpmsg'); b.disabled = true; m.textContent = '⏳ Публикую…'; api('/api/training/publish', { json: {}, soft: true }).then(function (r) { b.disabled = false; m.className = 'note ' + (r.ok ? '' : 'err'); m.textContent = r.msg; }); });
      var sendTo = function (pairs, btn) {
        var m = w.querySelector('#tsmsg'); btn.disabled = true; m.textContent = '⏳ Отправляю…';
        var out = [], i = 0;
        (function next() {
          if (i >= pairs.length) { btn.disabled = false; m.textContent = out.join(' '); setTimeout(function () { trainingWidget(w); }, 2500); return; }
          var p = pairs[i++]; api('/api/training/send', { json: { lesson: p[0], mgrs: p[1] }, soft: true }).then(function (r) { out.push(r.msg); next(); });
        })();
      };
      w.querySelector('#tsend').addEventListener('click', function () {
        var ms = [], cs = w.querySelectorAll('.tm:checked'); for (var i = 0; i < cs.length; i++) ms.push(cs[i].value);
        if (!ms.length) { w.querySelector('#tsmsg').textContent = 'Отметьте менеджеров (подключённых к боту).'; return; }
        var l = w.querySelector('#tles').value; if (!window.confirm('Отправить урок ' + l.replace('_', '.') + ': ' + ms.join(', ') + '?')) return;
        sendTo([[l, ms]], this);
      });
      w.querySelector('#tnext').addEventListener('click', function () {
        var by = {}; M.forEach(function (m) { if (!m.connected) return; var n = nextFor(m.key); if (n) (by[n.id] = by[n.id] || []).push(m.key); });
        var pairs = Object.keys(by).map(function (k) { return [k, by[k]]; });
        if (!pairs.length) { w.querySelector('#tsmsg').textContent = 'Нет подключённых менеджеров с непройденными уроками.'; return; }
        if (!window.confirm('Отправить каждому подключённому его следующий урок?\n' + pairs.map(function (p) { return p[0].replace('_', '.') + ': ' + p[1].join(', '); }).join('\n'))) return;
        sendTo(pairs, this);
      });
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // ---------- передать базу менеджера (уход, перераспределение) ----------
  function baseTool(box) {
    if (STATIC) { box.innerHTML = '<div class="card fold"><h3>Передать базу менеджера</h3><div class="note">Готовится на компе (окно «Рабочий стол ОП»), подтверждение — здесь или в Telegram.</div></div>'; return; }
    var from = '';
    function draw() {
      api('/api/basestats' + (from ? '?from=' + encodeURIComponent(from) : '')).then(function (s) {
        var h = '<div class="card"><h3 style="margin-top:0">Передать базу менеджера</h3><div class="note" style="margin-top:0">Уволился, ушёл в другой отдел или нужно разгрузить — выберите, чью базу, какие группы клиентов и кому. Будет предпросмотр, перевод в мс — только после «Подтвердить». Можно в несколько шагов: например, активных — одному, пассив — другим.</div>' +
          '<div class="row" style="margin-top:8px"><b>Чью базу:</b><select id="bfrom"><option value="">— выберите —</option>' + s.owners.map(function (o) { return '<option value="' + esc(o.key) + '"' + (o.key === from ? ' selected' : '') + '>' + esc(o.key) + ' · ' + o.n + (o.active ? '' : ' · не в ОП') + '</option>'; }).join('') + '</select></div>';
        if (s.stats) {
          h += '<div style="margin-top:10px"><b>Какие клиенты:</b>' + Object.keys(s.cats).map(function (k) { var x = s.stats[k]; return '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" class="bcat" value="' + k + '"' + (x.n ? '' : ' disabled') + '> ' + esc(s.cats[k]) + ' — <b>' + x.n + '</b> <span class="small muted">(A/B: ' + x.ab + (x.own24 ? ', горшков и кассет за 2 года на ' + mln(x.own24, 1) + ' млн' : '') + ')</span></label>'; }).join('') +
            '<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bab"> только A/B (крупные и средние)</label>' +
            '<label class="small" style="display:flex;gap:8px;align-items:center;margin-top:4px"><input type="checkbox" id="bdub" checked> дублеры без основной карточки в ОП — тоже раздать (' + s.dubs + ' дублеров всего; у кого основная у менеджера ОП — уйдут к нему)</label></div>' +
            '<div style="margin-top:10px"><b>Кому:</b><div class="row" style="margin-top:6px">' + s.owners.filter(function (o) { return o.active && o.key !== from; }).map(function (o) { return '<label class="small" style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 8px"><input type="checkbox" class="bto" value="' + esc(o.key) + '"> ' + esc(o.key) + ' <span class="muted">· ' + o.n + '</span></label>'; }).join('') + '</div></div>' +
            '<div class="seg" id="bmode" style="margin-top:10px"><button type="button" data-m="load" class="on">Выравнивать по нагрузке</button><button type="button" data-m="even">Поровну</button></div>' +
            '<div class="row" style="margin-top:12px"><button class="btn pri" type="button" id="bgo">Подготовить передачу…</button></div><div class="note" id="bmsg"></div>';
        }
        h += '</div>';
        box.innerHTML = h;
        box.querySelector('#bfrom').addEventListener('change', function () { from = this.value; draw(); });
        var mode = 'load', mb = box.querySelector('#bmode');
        if (mb) mb.addEventListener('click', function (e) { var m = e.target.getAttribute('data-m'); if (!m) return; mode = m; var bs = this.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute('data-m') === m ? 'on' : ''; });
        var go = box.querySelector('#bgo');
        if (go) go.addEventListener('click', function () {
          var pick = function (cls) { var r = [], cs = box.querySelectorAll(cls + ':checked'); for (var i = 0; i < cs.length; i++) r.push(cs[i].value); return r; };
          var cats = pick('.bcat'), to = pick('.bto'), msg = box.querySelector('#bmsg');
          if (!cats.length || !to.length) { msg.className = 'note err'; msg.textContent = 'Отметьте группы клиентов и кому передать.'; return; }
          if (!window.confirm('Подготовить передачу базы ' + from + ' → ' + to.join(', ') + '?\nБудет предпросмотр, запись в мс — только после «Подтвердить».')) return;
          propose({ type: 'base', from: from, cats: cats, to: to, mode: mode, abOnly: box.querySelector('#bab').checked, withDubs: box.querySelector('#bdub').checked }, msg, this);
        });
      }).catch(function (e) { box.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
    }
    draw();
  }

  // ---------- общие кусочки для новых разделов ----------
  function mln(x, d) { return x == null || !isFinite(x) ? '—' : num(x / 1e6, d == null ? 1 : d); }
  function mgrLink(n) { return '<a href="#mgr/' + encodeURIComponent(n) + '">' + esc(n) + '</a>'; }
  function isMgr(n) { return ['Пронткилевич', 'Станевская', 'Удальцова', 'Дворин', 'Кузьмич', 'Гоголюк', 'Филимонова', 'Прохорович'].indexOf(n) >= 0; }
  function mName(n) { return isMgr(n) ? mgrLink(n) : esc(n) + ' <span class="small muted">не в ОП</span>'; }
  function details(title, inner, open) { return '<details class="card"' + (open ? ' open' : '') + '><summary style="cursor:pointer;font-weight:650">' + title + '</summary><div style="margin-top:10px">' + inner + '</div></details>'; }
  function updLine(st, label) { if (!st || !st.updated) return ''; return esc(label) + ' ' + st.updated.slice(8, 10) + '.' + st.updated.slice(5, 7) + ' ' + st.updated.slice(11, 16); }
  // товарные группы: сначала своё производство (главное), потом под заказ и сопутка
  function groupBars(tot, cls, own) {
    tot = tot || {};
    var all = 0, ownSum = 0, k; for (k in tot) if (k !== 'service' && k !== 'other') all += tot[k];
    own.forEach(function (c) { ownSum += tot[c] || 0; });
    var max = 0; own.concat(['order', 'sop']).forEach(function (c) { if ((tot[c] || 0) > max) max = tot[c]; });
    var row = function (c, strong, muted) {
      var v = tot[c] || 0;
      return '<tr' + (muted ? ' class="muted"' : '') + '><td class="l">' + (strong ? '<b>' : '') + esc(cls[c]) + (strong ? '</b>' : '') + '</td><td class="l" style="width:40%"><div class="bar" style="margin:0;height:8px"><i style="width:' + (max ? v / max * 100 : 0).toFixed(1) + '%;' + (muted ? 'background:var(--plan)' : '') + '"></i></div></td><td>' + mln(v, 1) + '</td><td>' + pct(all ? v / all : 0) + '</td></tr>';
    };
    return '<div class="tw"><table class="t"><thead><tr><th class="l">Группа</th><th></th><th>млн ₽</th><th>Доля</th></tr></thead><tbody>' +
      '<tr class="grp"><td colspan="2">Своё производство — горшки и кассеты</td><td>' + mln(ownSum, 1) + '</td><td>' + pct(all ? ownSum / all : 0) + '</td></tr>' +
      own.map(function (c) { return row(c, false, false); }).join('') +
      '<tr class="grp"><td colspan="4">Прочее</td></tr>' + row('order', false, true) + row('sop', false, true) +
      '</tbody></table></div>';
  }
  function ownShare(tot, own) { var a = 0, o = 0, k; tot = tot || {}; for (k in tot) if (k !== 'service' && k !== 'other') a += tot[k]; own.forEach(function (c) { o += tot[c] || 0; }); return { own: o, all: a, share: a ? o / a : 0, sop: tot.sop || 0 }; }
  function orderTable(rows, cols) {
    if (!rows.length) return '<div class="muted">Нет.</div>';
    return '<div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Дата оплаты</th><th class="l">Клиент</th><th class="l">Менеджер</th><th>Заказ</th><th>' + (cols || 'Ожидается') + '</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + dayLabel(r.date) + '</td><td class="l">' + esc(r.client || '—') + '</td><td class="l">' + esc(r.mgr) + '</td><td>' + esc(r.num) + '</td><td><b>' + rub(r.exp) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  // товарные группы в «Выполнении»: месяц, к прошлому году, по менеджерам, динамика доли своего производства
  function productsBlock(box, ym) {
    if (!box) return;
    api('/api/products?ym=' + ym).then(function (p) {
      if (p.none || p.ym !== ym) { box.innerHTML = ''; return; }
      var cur = ownShare(p.cur.tot, p.own), ly = p.ly ? ownShare(p.ly.tot, p.own) : null;
      var mg = Object.keys(p.cur.byMgr).filter(isMgr).map(function (k) { var s = ownShare(p.cur.byMgr[k], p.own); s.name = k; return s; }).sort(function (a, b) { return b.own - a.own; });
      var maxT = 0; p.trend.forEach(function (t) { if (t.own + t.sop + t.order > maxT) maxT = t.own + t.sop + t.order; });
      box.innerHTML = '<div class="grid"><div class="card"><h3>Отгрузки: своё производство — главное</h3><div class="tiles" style="margin-bottom:12px">' +
        '<div class="tile"><div class="k">Горшки и кассеты</div><div class="v">' + mln(cur.own) + '</div><div class="s">' + pct(cur.share) + ' отгрузок' + (ly ? ' · год назад ' + mln(ly.own) + (ly.own ? ' (' + (cur.own >= ly.own ? '+' : '') + Math.round((cur.own / ly.own - 1) * 100) + '%)' : '') : '') + '</div></div>' +
        '<div class="tile"><div class="k">Сопутка</div><div class="v" style="color:var(--text-2)">' + mln(cur.sop) + '</div><div class="s">' + pct(cur.all ? cur.sop / cur.all : 0) + (ly ? ' · год назад ' + mln(ly.sop) : '') + '</div></div></div>' +
        groupBars(p.cur.tot, p.cls, p.own) + '<div class="note">Отгрузки клиентам ОП РФ (все юрлица), млн ₽. ' + (p.ym === p.months[p.months.length - 1] ? 'Месяц ещё идёт.' : '') + '</div></div>' +
        '<div class="card fold"><h3>Своё производство по менеджерам</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Своё, млн</th><th>Доля своего</th><th>Сопутка, млн</th></tr></thead><tbody>' +
        mg.map(function (s) { return '<tr><td>' + mgrLink(s.name) + '</td><td><b>' + mln(s.own, 2) + '</b></td><td class="' + (s.share < 0.7 ? 'neg' : '') + '">' + pct(s.share) + '</td><td class="muted">' + mln(s.sop, 2) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<h3 style="margin-top:14px">13 месяцев</h3><div class="tw"><table class="t"><tbody>' + p.trend.slice().reverse().map(function (t) {
          var tot = t.own + t.sop + t.order;
          return '<tr><td>' + cap(ymName(t.ym)) + '</td><td class="l" style="width:45%"><div class="bar" style="margin:0;height:10px;display:flex;overflow:hidden"><i style="position:static;width:' + (maxT ? t.own / maxT * 100 : 0).toFixed(1) + '%"></i><i style="position:static;border-radius:0;background:var(--plan);width:' + (maxT ? (t.sop + t.order) / maxT * 100 : 0).toFixed(1) + '%"></i></div></td><td>' + mln(t.own) + '</td><td>' + pct(tot ? t.own / tot : 0) + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="note">Синее — своё производство, серое — сопутка и под заказ. Колонки: своё, млн ₽ и его доля.</div></div></div>';
    }).catch(function () { box.innerHTML = ''; });
  }

  // ---------- «Манёвр»: прогноз месяца ----------
  function forecastWidget(w) {
    w.innerHTML = '<div class="loading">Считаю прогноз…</div>';
    api('/api/forecast').then(function (f) {
      if (f.none) { w.innerHTML = '<div class="card">' + esc(f.msg || 'Данных пока нет — идёт первая выгрузка из мс.') + '</div>'; return; }
      var vk = f.variants, k0 = vk[0], dept = f.regions[3];
      var vn = function (k) { return k === 'plan' ? 'План' : k === 'plan1' ? 'План 1' : 'План 2'; };
      var pl = function (r, k) { var x = r.plans.filter(function (p) { return p.k === k; })[0]; return x ? x.plan : null; };
      var chip = function (r) { var p = pl(r, k0); if (!p) return ''; var x = r.byDates / p; return x >= 1 ? '<span class="st good">дотягиваем</span>' : x >= 0.9 ? '<span class="st warn">на грани</span>' : '<span class="st bad">недобор</span>'; };
      var p0 = pl(dept, k0), gap = p0 != null ? p0 - dept.byDates : null;
      var t = f.today;
      var html = '<div class="card"><h3>' + cap(ymName(f.ym)) + ': куда приходим</h3><div class="note" style="margin-top:0">Сегодня ' + t.slice(8, 10) + '.' + t.slice(5, 7) + ' · до конца месяца ' + f.remIncl + ' раб. дн. (включая сегодня) из ' + f.wdAll + '</div>' +
        '<div class="tiles" style="margin-top:12px">' +
        '<div class="tile"><div class="k">Факт отдела</div><div class="v">' + mln(dept.fact) + ' ю</div><div class="s">' + (p0 ? pct(dept.fact / p0) + ' плана' : '') + '</div></div>' +
        '<div class="tile"><div class="k">Прогноз по датам оплаты</div><div class="v">' + mln(dept.byDates) + ' ю</div><div class="s">' + (p0 ? pct(dept.byDates / p0) + ' плана ' : '') + chip(dept) + '</div></div>' +
        '<div class="tile"><div class="k">Прогноз по прошлым месяцам</div><div class="v">' + mln(dept.bySeason) + ' ю</div><div class="s">' + (p0 && dept.bySeason ? pct(dept.bySeason / p0) + ' плана' : '') + '</div></div>' +
        (gap != null ? '<div class="tile"><div class="k">' + (gap > 0 ? 'Не хватает до плана' : 'Запас над планом') + '</div><div class="v ' + (gap > 0 ? 'neg' : 'pos') + '">' + mln(Math.abs(gap)) + ' ю</div><div class="s">' + (gap > 0 && f.remIncl ? 'нужно ' + mln(gap / f.remIncl, 1) + ' ю в день сверх ожидаемого' : 'по датам оплаты') + '</div></div>' : '') +
        '<div class="tile"><div class="k">Резерв: долги клиентов</div><div class="v">' + mln(dept.debt) + ' ю</div><div class="s">отгружено, не оплачено</div></div>' +
        '</div>' + (vk.length > 1 ? '<div class="note">Недобор и проценты — к плану 1 (' + mln(pl(dept, 'plan1')) + ' ю); план 2 — ' + mln(pl(dept, 'plan2')) + ' ю.</div>' : '') +
        '<div class="note">' + [updLine(f.status.fact, 'Факт из мс:'), updLine(f.status.crm, 'заказы:')].filter(Boolean).join(' · ') + '</div></div>';
      // регионы
      html += '<div class="card"><h3>Регионы</h3><div class="tw"><table class="t"><thead><tr><th>Регион</th>' + vk.map(function (k) { return '<th>' + vn(k) + '</th>'; }).join('') + '<th>Факт</th><th>+ ожидается</th><th>= прогноз</th><th>% плана</th><th>По прошлым мес.</th><th>По темпу</th><th>Не хватает</th><th>Долги</th></tr></thead><tbody>' +
        f.regions.map(function (r) {
          var p = pl(r, k0), g = p != null ? p - r.byDates : null;
          return '<tr class="' + (r.z === 'Отдел' ? 'tot' : '') + '"><td>' + esc(r.name) + '</td>' + vk.map(function (k) { return '<td>' + mln(pl(r, k)) + '</td>'; }).join('') + '<td>' + mln(r.fact) + '</td><td>' + mln(r.exp) + '</td><td><b>' + mln(r.byDates) + '</b></td><td>' + (p ? pct(r.byDates / p) + ' ' + chip(r) : '—') + '</td><td>' + mln(r.bySeason) + '</td><td>' + mln(r.byRate) + '</td><td class="' + (g > 0 ? 'neg' : 'pos') + '">' + (g == null ? '—' : (g > 0 ? mln(g) : '+' + mln(-g))) + '</td><td>' + mln(r.debt) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="note"><b>Прогноз по датам оплаты</b> = факт + заказы с «Датой оплаты» до конца месяца (не больше неоплаченного остатка заказа). <b>По прошлым месяцам</b> — сколько обычно приходит в оставшиеся дни (медиана за 12 месяцев). <b>По темпу</b> — нынешний темп в день × все рабочие дни. Если «по прошлым месяцам» заметно выше «по датам» — у менеджеров не проставлены даты оплаты, деньги придут «без предупреждения» или их надо дожимать. Всё в ю (млн ₽), методика Десанта.</div></div>';
      // кто может закрыть разрыв
      html += '<div class="card fold"><h3>Где взять недостающее: резерв по менеджерам</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Факт</th><th>Ожидается до конца мес.</th><th>Обещали, не пришло</th><th>Оплаты 1–15 след. мес.</th><th>Долги</th></tr></thead><tbody>' +
        ['Ц', 'Ю', 'С'].map(function (z) {
          var ms = f.mgrs.filter(function (m) { return m.zone === z && isMgr(m.name); }); if (!ms.length) return '';
          return '<tr class="grp"><td colspan="6">' + ZN[z] + '</td></tr>' + ms.map(function (m) {
            return '<tr><td>' + mgrLink(m.name) + (m.top ? ' <span class="small muted">топ</span>' : '') + '</td><td>' + mln(m.fact, 2) + '</td><td>' + mln(m.exp, 2) + (m.expN ? ' <span class="small muted">(' + m.expN + ')</span>' : '') + '</td><td>' + (m.late ? '<span class="neg">' + mln(m.late, 2) + '</span>' : '—') + '</td><td>' + (m.nextEarly ? mln(m.nextEarly, 2) : '—') + '</td><td>' + (m.debt ? mln(m.debt, 2) : '—') + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div><div class="note">«Оплаты 1–15 след. месяца» — заказы, которые можно попробовать перенести в этот месяц. «Долги» — отгружено, но не оплачено (подробно — раздел «Дебиторка»). млн ₽.</div></div>';
      // товарные группы месяца
      var os = ownShare(f.products.tot, f.products.own);
      html += '<div class="grid"><div class="card fold"><h3>Что отгружаем в ' + MONTHS[+f.ym.slice(5) - 1].replace(/ь$/, 'е').replace(/й$/, 'е').replace(/т$/, 'те') + '</h3>' + groupBars(f.products.tot, f.products.cls, f.products.own) +
        '<div class="note">Отгрузки клиентам ОП РФ по всем юрлицам, млн ₽. Своё производство — ' + pct(os.share) + ' отгрузок.</div></div>' +
        '<div class="card fold"><h3>Своё производство по регионам</h3><div class="tw"><table class="t"><thead><tr><th>Регион</th><th>Своё, млн</th><th>Доля своего</th><th>Сопутка, млн</th></tr></thead><tbody>' +
        ['Ц', 'Ю', 'С'].map(function (z) { var s = ownShare(f.products.byZone[z], f.products.own); return '<tr><td>' + ZN[z] + '</td><td>' + mln(s.own, 1) + '</td><td>' + pct(s.share) + '</td><td class="muted">' + mln(s.sop, 1) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (f.next && f.next.plans ? '<h3 style="margin-top:16px">' + cap(ymName(f.next.ym)) + ' — задел</h3><div class="note" style="margin-top:0">План: ' + Object.keys(f.next.plans).map(function (k) { return vn(k) + ' ' + num(f.next.plans[k]['Отдел']) + ' ю'; }).join(' · ') + '. Уже стоят даты оплаты на <b>' + mln(f.next.exp) + ' ю</b>.</div>' : '') + '</div></div>';
      // списки
      html += details('Ожидаемые оплаты до конца месяца · ' + f.expList.length + ' · ' + mln(f.expList.reduce(function (s, r) { return s + r.exp; }, 0)) + ' ю', orderTable(f.expList), false);
      if (f.lateList.length) html += details('<span class="neg">Обещали в этом месяце, но не пришло · ' + f.lateList.length + '</span>', orderTable(f.lateList, 'Не пришло'), true);
      if (f.nextList.length) html += details('Можно ускорить: оплаты 1–15 ' + MONTHS_GEN[+f.next.ym.slice(5) - 1] + ' · ' + f.nextList.length, orderTable(f.nextList), false);
      if (f.noSum.length) html += details('<span class="neg">⚠️ Дата оплаты есть, «Сумма оплаты» не заполнена · ' + f.noSum.length + '</span>', orderTable(f.noSum, 'Остаток'), false);
      w.innerHTML = html;
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // ---------- «Дебиторка» ----------
  var debtState = { mgr: '', q: '', kind: 'debt' };
  function debtsWidget(w) {
    w.innerHTML = '<div class="loading">Считаю…</div>';
    api('/api/debts').then(function (d) {
      if (d.none || d.total == null) { w.innerHTML = '<div class="card">Данных пока нет — идёт выгрузка заказов из мс.</div>'; return; }
      var old30 = d.totalB[2] + d.totalB[3] + d.totalB[4];
      var html = '<div class="card"><div class="tiles">' +
        '<div class="tile"><div class="k">Отгружено без оплаты</div><div class="v ' + (old30 ? 'neg' : '') + '">' + mln(d.total, 1) + ' млн</div><div class="s">' + d.n + ' заказ(ов) · старше 30 дн. ' + mln(old30, 1) + '</div></div>' +
        '<div class="tile"><div class="k">Резерв без оплаты</div><div class="v">' + mln(d.reserveTotal, 1) + ' млн</div><div class="s">товар отложен, денег нет</div></div>' +
        '<div class="tile"><div class="k">Подтверждено, ждёт оплаты</div><div class="v">' + mln(d.waitTotal - d.reserveTotal, 1) + ' млн</div></div>' +
        '<div class="tile"><div class="k">Авансы: оплачено, не отгружено</div><div class="v">' + mln(d.prepay, 1) + ' млн</div><div class="s">' + d.prepayN + ' заказ(ов)</div></div>' +
        '</div><div class="note">Долг — только в статусах «' + d.rules.debt.join('», «') + '». «Выполнен», «Закрыть по отгрузке» и отменённые не считаются (там расхождения мс). Заказы неработающих менеджеров — на текущем владельце клиента. ' + updLine(d.status, 'Данные мс на') + '</div></div>';
      html += details('Разбивка по статусам заказов', '<div class="tw"><table class="t"><thead><tr><th class="l">Статус</th><th>Заказов</th><th>Сумма</th><th>Оплачено</th><th>Отгружено</th><th>Отгружено без оплаты</th><th>Не оплачено всего</th></tr></thead><tbody>' +
        d.statuses.map(function (x) { return '<tr' + (x.live ? '' : ' class="muted"') + '><td class="l">' + (x.debt ? '<b>' + esc(x.name) + '</b> <span class="st warn">долг</span>' : x.live ? esc(x.name) + ' <span class="st idle">ждёт оплаты</span>' : esc(x.name)) + '</td><td>' + x.n + '</td><td>' + mln(x.sum, 2) + '</td><td>' + mln(x.payed, 2) + '</td><td>' + mln(x.shipped, 2) + '</td><td>' + mln(x.unpaidShipped, 2) + '</td><td>' + mln(x.unpaid, 2) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="note">Незавершённые заказы, млн ₽. Серым — статусы, которые в долги не идут.</div>', false);
      var wm = {}; (d.waitByMgr || []).forEach(function (x) { wm[x.name] = x; });
      var bm = {}; d.byMgr.forEach(function (m) { bm[m.name] = m; });
      var names = MGRS.filter(function (n) { return bm[n] || wm[n]; });
      html += details('По менеджерам', '<div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Отгружено без оплаты</th><th>из них старше 30 дн.</th><th>Резерв без оплаты</th><th>Подтверждено, ждёт оплаты</th></tr></thead><tbody>' +
        names.map(function (n) { var m = bm[n] || { total: 0, b: [0, 0, 0, 0, 0] }, x = wm[n] || { reserve: 0, confirmed: 0 }; var o30 = m.b[2] + m.b[3] + m.b[4];
          return '<tr><td>' + mgrLink(n) + '</td><td><b>' + (m.total ? mln(m.total, 2) : '—') + '</b></td><td class="' + (o30 ? 'neg' : '') + '">' + (o30 ? mln(o30, 2) : '—') + '</td><td>' + (x.reserve ? mln(x.reserve, 2) : '—') + '</td><td>' + (x.confirmed ? mln(x.confirmed, 2) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="note">млн ₽, только работающие менеджеры ОП.</div>', false);
      html += '<div class="card"><h3>Заказы</h3><div class="seg" id="dk" style="margin-bottom:8px"><button type="button" data-k="debt" class="' + (debtState.kind !== 'wait' ? 'on' : '') + '">Отгружено без оплаты · ' + d.rows.length + '</button><button type="button" data-k="wait" class="' + (debtState.kind === 'wait' ? 'on' : '') + '">Ждут оплаты · ' + d.waits.length + '</button></div>' +
        '<div class="row" style="margin-bottom:10px"><select id="dm"><option value="">Все менеджеры</option>' + MGRS.map(function (m) { return '<option' + (m === debtState.mgr ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select><input type="search" id="dq" placeholder="Клиент или № заказа" value="' + esc(debtState.q) + '" style="flex:1;min-width:0"></div>' +
        '<div class="row" id="dact" style="margin-bottom:10px"></div><div class="note" id="dmsg" style="margin-top:0"></div><div id="dl"></div></div>';
      w.innerHTML = html;
      var dl = w.querySelector('#dl'), dact = w.querySelector('#dact'), dmsg = w.querySelector('#dmsg');
      function drawActs() {
        if (debtState.kind === 'wait') { dact.innerHTML = ''; return; }
        var mg = debtState.mgr, idx = mg ? MGRS.indexOf(mg) : 'all';
        dact.innerHTML = STATIC
          ? '<a class="btn pri" href="' + botLink('tdb_' + idx) + '" target="_blank" rel="noopener">📝 Задачи: дожать 31–90 дн.' + (mg ? ' (' + esc(mg) + ')' : '') + '</a>'
          : '<button class="btn pri" type="button" id="dall">📝 Задачи: дожать 31–90 дн.' + (mg ? ' (' + esc(mg) + ')' : '') + '</button><button class="btn" type="button" id="dold">📝 Сверить старше 90 дн.</button><button class="btn" type="button" id="dsel">📝 По отмеченным</button>';
        if (STATIC) return;
        dact.querySelector('#dall').addEventListener('click', function () { if (window.confirm('Подготовить задачи «дожать оплату» по долгам 31–90 дней' + (mg ? ' (' + mg + ')' : '') + '? Запись в мс — после «Подтвердить».')) propose({ type: 'tasks_debt', mgr: mg || '', minAge: 31, maxAge: 90 }, dmsg, this); });
        dact.querySelector('#dold').addEventListener('click', function () { if (window.confirm('Подготовить задачи «сверить долг» по долгам старше 90 дней' + (mg ? ' (' + mg + ')' : '') + '? Запись в мс — после «Подтвердить».')) propose({ type: 'tasks_debt', mgr: mg || '', minAge: 91 }, dmsg, this); });
        dact.querySelector('#dsel').addEventListener('click', function () {
          var cs = dl.querySelectorAll('.dc:checked'), nums = []; for (var i = 0; i < cs.length; i++) nums.push(cs[i].getAttribute('data-num'));
          if (!nums.length) { dmsg.className = 'note err'; dmsg.textContent = 'Отметьте заказы галочкой.'; return; }
          if (window.confirm('Подготовить задачи по ' + nums.length + ' заказам? Запись в мс — после «Подтвердить».')) propose({ type: 'tasks_debt', nums: nums }, dmsg, this);
        });
      }
      function draw() {
        var q = debtState.q.toLowerCase(), wait = debtState.kind === 'wait', src = wait ? d.waits : d.rows;
        var rs = src.filter(function (r) { return (!debtState.mgr || r.mgr === debtState.mgr) && (!q || (r.client + ' ' + r.num).toLowerCase().indexOf(q) >= 0); });
        var tot = rs.reduce(function (s, r) { return s + (wait ? r.wait : r.debt); }, 0);
        dl.innerHTML = '<div class="small muted" style="margin-bottom:6px">' + rs.length + ' заказ(ов) · ' + rub(tot) + '</div><div class="tw" style="max-height:65vh"><table class="t"><thead><tr>' + (STATIC || wait ? '' : '<th></th>') + '<th class="l">Клиент</th><th class="l">Менеджер</th><th>Заказ</th><th class="l">Статус</th>' +
          (wait ? '<th>Сумма</th><th>Оплачено</th><th>Ждём</th><th>Дата заказа</th><th>Дата оплаты</th>' : '<th>Долг</th><th>Отгружено</th><th>Дней с отгрузки</th><th>Дата оплаты</th>') + '</tr></thead><tbody>' +
          rs.slice(0, 300).map(function (r) {
            return '<tr>' + (STATIC || wait ? '' : '<td><input type="checkbox" class="dc" data-num="' + esc(r.num) + '"></td>') + '<td class="l">' + esc(r.client) + '</td><td class="l">' + esc(r.mgr) + '</td><td>' + esc(r.num) + '</td><td class="l small">' + esc(r.st) + '</td>' +
              (wait ? '<td>' + rub(r.sum) + '</td><td>' + (r.payed ? rub(r.payed) : '—') + '</td><td><b>' + rub(r.wait) + '</b></td><td>' + dayLabel(r.date) + '</td><td>' + (r.payDate ? dayLabel(r.payDate) : '—') + '</td>'
                : '<td><b>' + rub(r.debt) + '</b></td><td>' + rub(r.shipped) + '</td><td class="' + (r.age > 30 ? 'neg' : '') + '">' + r.age + '</td><td>' + (r.payDate ? dayLabel(r.payDate) + (r.overdue ? ' <span class="neg">+' + r.overdue + ' дн.</span>' : '') : '—') + '</td>') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }
      w.querySelector('#dk').addEventListener('click', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; debtState.kind = k; var bs = this.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute('data-k') === k ? 'on' : ''; draw(); drawActs(); });
      w.querySelector('#dm').addEventListener('change', function () { debtState.mgr = this.value; draw(); drawActs(); });
      w.querySelector('#dq').addEventListener('input', function () { debtState.q = this.value; draw(); });
      drawActs(); draw();
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  function insightList(ins) {
    if (!ins.length) return '';
    var ic = { bad: '🔴', warn: '🟡', good: '🟢' };
    return '<ul style="list-style:none;margin:8px 0 0;padding:0">' + ins.map(function (i) { return '<li style="margin:6px 0;display:flex;gap:8px"><span>' + ic[i.lvl] + '</span><span>' + esc(i.text) + '</span></li>'; }).join('') + '</ul>';
  }
  // ---------- «Менеджеры»: список и карточка ----------
  function managersWidget(w) {
    w.innerHTML = '<div class="loading">Загружаю…</div>';
    Promise.all([api('/api/managers'), api('/api/forecast'), api('/api/debts'), api('/api/sleeping')]).then(function (x) {
      var list = x[0], f = x[1], d = x[2], s = x[3];
      var fm = {}; (f.mgrs || []).forEach(function (m) { fm[m.name] = m; });
      var dm = {}; (d.byMgr || []).forEach(function (m) { dm[m.name] = m; });
      var sm = {}; (s.byMgr || []).forEach(function (m) { sm[m.name] = m; });
      w.innerHTML = '<div class="grid">' + ['Центр', 'Юг', 'Север'].map(function (z) {
        return list.filter(function (m) { return m.zone === z; }).map(function (m) {
          var a = fm[m.name] || {}, b = dm[m.name] || {}, c = sm[m.name] || {};
          return '<a class="card" href="#mgr/' + encodeURIComponent(m.name) + '" style="display:block;color:inherit">' +
            '<div class="row" style="justify-content:space-between"><b>' + esc(m.name) + '</b><span class="small muted">' + esc(z) + (m.top ? ' · топ' : '') + '</span></div>' +
            '<div class="tiles" style="margin-top:10px;grid-template-columns:repeat(2,1fr)">' +
            '<div class="tile"><div class="k">Факт месяца</div><div class="v" style="font-size:19px">' + mln(a.fact, 2) + '</div></div>' +
            '<div class="tile"><div class="k">Ожидается</div><div class="v" style="font-size:19px">' + mln(a.exp, 2) + '</div></div>' +
            '<div class="tile"><div class="k">Долги</div><div class="v" style="font-size:19px">' + mln(b.total, 2) + '</div></div>' +
            '<div class="tile"><div class="k">Засыпают / без задач</div><div class="v" style="font-size:19px">' + ((c.s1 || 0) + (c.s2 || 0)) + ' / <span class="' + (c.noTask ? 'neg' : '') + '">' + (c.noTask || 0) + '</span></div></div>' +
            '</div>' + insightList(m.insights || []) + '<div class="note">млн ₽ · подробнее в карточке →</div></a>';
        }).join('');
      }).join('') + '</div>';
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }
  function managerPage(name) {
    main.innerHTML = '<div class="loading">Собираю карточку…</div>';
    api('/api/manager?m=' + encodeURIComponent(name)).then(function (m) {
      if (m.error) { main.innerHTML = '<div class="card">' + esc(m.error) + '</div>'; return; }
      var os = ownShare(m.products.cur, m.products.own), o12 = ownShare(m.products.y12, m.products.own);
      var html = '<div class="viewer-head"><a class="btn" href="#managers">← Менеджеры</a><span class="nm" style="font-size:18px">' + esc(m.name) + ' <span class="small muted">' + esc(m.zone) + (m.top ? ' · топ' : '') + '</span></span></div>';
      html += '<div class="card"><h3>На что обратить внимание</h3>' + insightList(m.insights || []) +
        (m.questions && m.questions.length ? '<h3 style="margin-top:14px">Вопросы на планёрку</h3><ol style="margin:0;padding-left:20px">' + m.questions.map(function (q) { return '<li style="margin:4px 0">' + esc(q) + '</li>'; }).join('') + '</ol>' : '') + '</div>';
      html += '<div class="card"><div class="tiles">' +
        '<div class="tile"><div class="k">Факт ' + MONTHS[+m.ym.slice(5) - 1] + '</div><div class="v">' + mln(m.fact, 2) + '</div><div class="s">' + pct(m.share) + ' региона' + (m.ly != null ? ' · год назад ' + mln(m.ly, 2) : '') + '</div></div>' +
        '<div class="tile"><div class="k">Ожидается до конца месяца</div><div class="v">' + mln(m.forecast ? m.forecast.exp : 0, 2) + '</div><div class="s">' + (m.forecast && m.forecast.late ? '<span class="neg">не пришло ' + mln(m.forecast.late, 2) + '</span>' : 'по датам оплаты') + '</div></div>' +
        '<div class="tile"><div class="k">Долги клиентов</div><div class="v">' + mln(m.debts ? m.debts.total : 0, 2) + '</div><div class="s">' + (m.debts ? 'старше 30 дн.: ' + mln(m.debts.b[2] + m.debts.b[3] + m.debts.b[4], 2) : '') + '</div></div>' +
        '<div class="tile"><div class="k">Задачи в мс</div><div class="v">' + m.tasks.open + '</div><div class="s ' + (m.tasks.overdue ? 'neg' : '') + '">просрочено ' + m.tasks.overdue + '</div></div>' +
        (m.base ? '<div class="tile"><div class="k">Клиентов на ' + m.base.date.slice(8, 10) + '.' + m.base.date.slice(5, 7) + '</div><div class="v">' + m.base.n + '</div><div class="s">активных ' + pct(m.base.a / m.base.n) + ' · VIP ' + m.base.vip + '</div></div>' : '') +
        '<div class="tile"><div class="k">Своё производство в отгрузках</div><div class="v">' + pct(os.share) + '</div><div class="s">за 12 мес.: ' + pct(o12.share) + '</div></div>' +
        '</div><div class="note">млн ₽. Факт — приход денег по «Менеджеру ОП» (Десант); отгрузки — клиентам, которыми он владеет.</div></div>';
      var mi = MGRS.indexOf(m.name);
      html += '<div class="card"><b>Правки в мс</b><div class="row" style="margin-top:8px">' + (STATIC
        ? '<a class="btn" href="' + botLink('tsl_' + mi) + '" target="_blank" rel="noopener">📝 Задачи по засыпающим без задач</a><a class="btn" href="' + botLink('tdb_' + mi) + '" target="_blank" rel="noopener">📝 Задачи: дожать долги 31–90 дн.</a>'
        : '<button class="btn" type="button" id="mts">📝 Задачи по засыпающим без задач</button><button class="btn" type="button" id="mtd">📝 Задачи: дожать долги 31–90 дн.</button>') +
        '</div><div class="note" id="mmsg">' + (STATIC ? 'Через бота: он подготовит правку и пришлёт «Подтвердить».' : 'Каждая правка — с предпросмотром и только после «Подтвердить». Передать клиента — кнопка «→» в списках ниже.') + '</div></div>';
      var max = 0; m.trend.forEach(function (x) { if (x.fact > max) max = x.fact; });
      html += details('Приход денег по месяцам', '<div class="tw"><table class="t"><tbody>' + m.trend.slice().reverse().map(function (x) {
        return '<tr><td>' + cap(ymName(x.ym)) + '</td><td class="l" style="width:50%"><div class="bar" style="margin:0;height:8px"><i style="width:' + (max ? x.fact / max * 100 : 0).toFixed(1) + '%"></i></div></td><td>' + mln(x.fact, 2) + '</td></tr>'; }).join('') + '</tbody></table></div>', false);
      html += details('Что отгружает: своё производство и сопутка', '<h3>12 месяцев</h3>' + groupBars(m.products.y12, m.products.cls, m.products.own) + '<h3 style="margin-top:14px">Этот месяц</h3>' + groupBars(m.products.cur, m.products.cls, m.products.own), false);
      html += details('Лучшие клиенты по своему производству (12 мес.)', '<div class="tw"><table class="t"><thead><tr><th class="l">Клиент</th><th>Своё, млн</th><th>Всего, млн</th><th>Последняя отгрузка</th>' + (STATIC ? '' : '<th class="l">Передать</th>') + '</tr></thead><tbody>' +
        m.topClients.map(function (c) { return '<tr><td class="l">' + esc(c.client) + '</td><td><b>' + mln(c.own12, 2) + '</b></td><td>' + mln(c.all12, 2) + '</td><td>' + dayLabel(c.last) + '</td>' +
          (STATIC ? '' : '<td class="l"><div class="row" style="flex-wrap:nowrap">' + mgrSelect('trs', m.name) + '<button class="btn" type="button" data-tr="' + esc(c.agent) + '" style="min-height:34px;padding:4px 10px">→</button></div></td>') + '</tr>'; }).join('') + '</tbody></table></div>', false);
      html += details('Ожидаемые оплаты до конца месяца · ' + m.expList.length, orderTable(m.expList), m.expList.length > 0 && m.expList.length < 15);
      if (m.lateList.length) html += details('<span class="neg">Обещали, но не пришло · ' + m.lateList.length + '</span>', orderTable(m.lateList, 'Не пришло'), true);
      if (m.nextList.length) html += details('Оплаты 1–15 следующего месяца · ' + m.nextList.length, orderTable(m.nextList), false);
      html += details('Долги по заказам · ' + m.debtRows.length, m.debtRows.length ? '<div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th class="l">Клиент</th><th>Заказ</th><th>Долг</th><th>Дней с отгрузки</th></tr></thead><tbody>' +
        m.debtRows.map(function (r) { return '<tr><td class="l">' + esc(r.client) + '</td><td>' + esc(r.num) + '</td><td><b>' + rub(r.debt) + '</b></td><td class="' + (r.age > 30 ? 'neg' : '') + '">' + r.age + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="muted">Нет.</div>', false);
      html += details('<span class="' + (m.tasks.overdue ? 'neg' : '') + '">Просроченные задачи · ' + m.tasks.overdue + '</span>', m.tasks.list.length ? '<div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Срок</th><th class="l">Клиент</th><th class="l">Задача</th></tr></thead><tbody>' +
        m.tasks.list.map(function (t) { return '<tr><td>' + dayLabel(t.due) + '</td><td class="l">' + esc(t.client || '—') + '</td><td class="l small">' + esc(t.desc) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (m.tasks.overdue > m.tasks.list.length ? '<div class="note">Показаны 40 самых старых.</div>' : '') : '<div class="muted">Нет.</div>', false);
      html += details('Засыпающие клиенты · ' + m.sleeping.length, sleepTable(m.sleeping, true), false);
      main.innerHTML = html;
      if (!STATIC) {
        var mmsg = document.getElementById('mmsg');
        bindTransfer(main, mmsg);
        document.getElementById('mts').addEventListener('click', function () { if (window.confirm('Подготовить задачи по засыпающим клиентам ' + m.name + ' без задач? Запись в мс — после «Подтвердить».')) { propose({ type: 'tasks_sleep', mgr: m.name }, mmsg, this); window.scrollTo(0, 0); } });
        document.getElementById('mtd').addEventListener('click', function () { if (window.confirm('Подготовить задачи «дожать оплату» по долгам ' + m.name + ' 31–90 дней? Запись в мс — после «Подтвердить».')) { propose({ type: 'tasks_debt', mgr: m.name, minAge: 31, maxAge: 90 }, mmsg, this); window.scrollTo(0, 0); } });
      }
    }).catch(fail);
  }

  // ---------- «Засыпающие клиенты» ----------
  var sleepState = { mgr: '', st: 'all12', noTask: false };
  function sleepTable(rows, noMgr) {
    if (!rows.length) return '<div class="muted">Нет.</div>';
    var edit = !STATIC;
    return '<div class="tw" style="max-height:70vh"><table class="t"><thead><tr>' + (edit ? '<th></th>' : '') + '<th class="l">Клиент</th>' + (noMgr ? '' : '<th class="l">Менеджер</th>') + '<th>Последняя отгрузка</th><th>Мес. тишины</th><th>Своё за 24 мес.</th><th>Сопутка</th><th>Задачи</th>' + (edit ? '<th class="l">Передать</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + (edit ? '<td><input type="checkbox" class="sc" data-agent="' + esc(r.agent) + '"></td>' : '') + '<td class="l">' + esc(r.client) + '<div class="small muted">' + esc(r.cstate || '') + (r.inn ? ' · ИНН ' + esc(r.inn) : '') + '</div></td>' + (noMgr ? '' : '<td class="l">' + mgrLink(r.mgr) + '</td>') +
          '<td>' + dayLabel(r.last) + '</td><td>' + num(r.months, 1) + '</td><td><b>' + rub(r.own24) + '</b></td><td class="muted">' + rub(r.sop24) + '</td><td>' + (r.tasks ? r.tasks + (r.nextTask ? '<div class="small muted">до ' + dayLabel(r.nextTask) + '</div>' : '') : '<span class="st bad">нет задач</span>') + '</td>' +
          (edit ? '<td class="l"><div class="row" style="flex-wrap:nowrap">' + mgrSelect('trs', r.mgr) + '<button class="btn" type="button" data-tr="' + esc(r.agent) + '" style="min-height:34px;padding:4px 10px">→</button></div></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  // общие обработчики: передача клиента (кнопка «→» рядом с выбором менеджера)
  function bindTransfer(root, msgEl) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-tr]') : null; if (!b) return;
      var sel = b.parentNode.querySelector('select'), to = sel && sel.value;
      if (!to) { sel && sel.focus(); return; }
      var client = b.closest('tr').querySelector('td.l').firstChild.textContent;
      if (!window.confirm('Подготовить передачу клиента «' + client + '» менеджеру ' + to + '?\nВместе с дублями по ИНН и открытыми задачами. Запись в мс — только после «Подтвердить».')) return;
      propose({ type: 'transfer', agent: b.getAttribute('data-tr'), to: to }, msgEl, b);
    });
  }
  function checkedAgents(root) { var out = [], cs = root.querySelectorAll('.sc:checked'); for (var i = 0; i < cs.length; i++) out.push(cs[i].getAttribute('data-agent')); return out; }
  function sleepingWidget(w) {
    w.innerHTML = '<div class="loading">Ищу засыпающих…</div>';
    api('/api/sleeping').then(function (s) {
      if (s.none) { w.innerHTML = '<div class="card">Данных пока нет — идёт выгрузка отгрузок из мс.</div>'; return; }
      var html = '<div class="card"><div class="note" style="margin-top:0">Клиенты ОП РФ, которые раньше покупали, а последняя отгрузка была 3+ месяца назад. Порядок — по объёму <b>своего производства (горшки и кассеты) за 24 месяца</b>: сверху те, кого страшнее всего потерять. «Нет задач» — по клиенту в мс нет ни одной открытой задачи, его никто не ведёт. Дублеры исключены. ' + updLine(s.status, 'Отгрузки из мс на') + '</div></div>';
      html += '<div class="card"><h3>По менеджерам</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Засыпает 3–6 мес.</th><th>Уснул 6–12 мес.</th><th>Своё производство под риском</th><th>Без задач</th><th>…их своё производство</th></tr></thead><tbody>' +
        s.byMgr.map(function (m) { return '<tr><td>' + mgrLink(m.name) + '</td><td>' + m.s1 + '</td><td>' + m.s2 + '</td><td><b>' + mln(m.own, 1) + '</b></td><td class="' + (m.noTask ? 'neg' : '') + '">' + m.noTask + '</td><td>' + mln(m.noTaskOwn, 1) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="note">«Под риском» — что эти клиенты (3–12 мес. тишины) взяли горшков и кассет за последние 24 месяца, млн ₽.</div></div>';
      var mgrs = s.byMgr.map(function (m) { return m.name; });
      html += '<div class="card"><div class="row" style="margin-bottom:10px"><select id="sm"><option value="">Все менеджеры</option>' + mgrs.map(function (m) { return '<option' + (m === sleepState.mgr ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
        '<div class="seg" id="ss">' + [['all12', '3–12 мес.'], ['s1', 'Засыпает 3–6'], ['s2', 'Уснул 6–12'], ['s3', 'Отвалился > 12']].map(function (x) { return '<button type="button" data-s="' + x[0] + '" class="' + (sleepState.st === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<label class="small" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="snt"' + (sleepState.noTask ? ' checked' : '') + '> только без задач</label></div>' +
        '<div class="row" id="sact" style="margin-bottom:10px"></div><div class="note" id="smsg" style="margin-top:0"></div><div id="sl"></div></div>';
      w.innerHTML = html;
      var sl = w.querySelector('#sl'), sact = w.querySelector('#sact'), smsg = w.querySelector('#smsg');
      function drawActs() {
        var idx = sleepState.mgr ? MGRS.indexOf(sleepState.mgr) : 'all';
        sact.innerHTML = STATIC
          ? '<a class="btn pri" href="' + botLink('tsl_' + idx) + '" target="_blank" rel="noopener">📝 Задачи в мс: всем без задач' + (sleepState.mgr ? ' (' + esc(sleepState.mgr) + ')' : '') + '</a><span class="small muted">через бота, с подтверждением</span>'
          : '<button class="btn pri" type="button" id="sall">📝 Задачи в мс: всем без задач' + (sleepState.mgr ? ' (' + esc(sleepState.mgr) + ')' : '') + '</button><button class="btn" type="button" id="ssel">📝 По отмеченным</button>';
        if (STATIC) return;
        sact.querySelector('#sall').addEventListener('click', function () {
          if (!window.confirm('Подготовить задачи по засыпающим клиентам без задач' + (sleepState.mgr ? ' у ' + sleepState.mgr : ' у всех менеджеров') + ' (3–12 мес. тишины)?\nЗапись в мс — только после «Подтвердить».')) return;
          propose({ type: 'tasks_sleep', mgr: sleepState.mgr || '' }, smsg, this);
        });
        sact.querySelector('#ssel').addEventListener('click', function () {
          var ag = checkedAgents(sl); if (!ag.length) { smsg.className = 'note err'; smsg.textContent = 'Отметьте клиентов галочкой.'; return; }
          if (!window.confirm('Подготовить задачи по ' + ag.length + ' отмеченным клиентам? Запись в мс — только после «Подтвердить».')) return;
          propose({ type: 'tasks_sleep', agents: ag }, smsg, this);
        });
      }
      bindTransfer(sl, smsg);
      function draw() {
        var rs = s.rows.filter(function (r) {
          var okS = sleepState.st === 'all12' ? r.months < 12 : sleepState.st === 's1' ? r.months < 6 : sleepState.st === 's2' ? (r.months >= 6 && r.months < 12) : r.months >= 12;
          return okS && (!sleepState.mgr || r.mgr === sleepState.mgr) && (!sleepState.noTask || !r.tasks);
        });
        sl.innerHTML = '<div class="small muted" style="margin-bottom:6px">' + rs.length + ' клиент(ов) · своё производство за 24 мес. ' + rub(rs.reduce(function (a, r) { return a + r.own24; }, 0)) + (rs.length > 300 ? ' · показаны первые 300' : '') + '</div>' + sleepTable(rs.slice(0, 300), false);
      }
      w.querySelector('#sm').addEventListener('change', function () { sleepState.mgr = this.value; draw(); drawActs(); });
      drawActs();
      w.querySelector('#snt').addEventListener('change', function () { sleepState.noTask = this.checked; draw(); });
      w.querySelector('#ss').addEventListener('click', function (e) { var v = e.target.getAttribute('data-s'); if (!v) return; sleepState.st = v; var bs = this.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute('data-s') === v ? 'on' : ''; draw(); });
      draw();
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // ---------- планы ----------
  function plansWidget(w) {
    api('/api/plans').then(function (j) {
      var keys = Object.keys(j.months).sort(), variant = 'plan1', best = j.best || {};
      var V = [['plan1', 'Рекорды регионов +5%'], ['plan2', 'Рекорды регионов +10%'], ['plan1d', 'Лучший месяц отдела +5%'], ['plan2d', 'Лучший месяц отдела +10%']];
      var pOf = function (k) { var m = j.months[k]; if (variant === 'plan1d' || variant === 'plan2d') return best[k] ? best[k][variant] : null; return m[variant] || m.plan; };
      function draw() {
        var dv = variant.slice(-1) === 'd';
        var html = '<div class="card"><h3>План прихода денег, ю</h3><div class="seg" id="vs">' + V.map(function (v) { return '<button type="button" data-v="' + v[0] + '" class="' + (variant === v[0] ? 'on' : '') + '">' + v[1] + '</button>'; }).join('') + '</div>' +
          '<div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Отдел</th>' + (dv ? '<th>Рекорд отдела</th>' : '<th>Другой способ</th>') + '<th>Факт</th><th>%</th></tr></thead><tbody>';
        var year = '';
        keys.forEach(function (k) {
          var m = j.months[k], p = pOf(k), fa = j.fact[k], bk = best[k];
          if (!p) return;
          if (k.slice(0, 4) !== year) { year = k.slice(0, 4); html += '<tr class="grp"><td colspan="8">' + year + '</td></tr>'; }
          var other = dv ? (m[variant.slice(0, 5)] || m.plan || {})['Отдел'] : (bk ? bk[variant === 'plan2' ? 'plan2d' : 'plan1d']['Отдел'] : null);
          html += '<tr><td>' + cap(MONTHS[+k.slice(5) - 1]) + (m.plan && !dv ? ' <span class="small muted">утв.</span>' : '') + '</td><td>' + num(p['Ц']) + '</td><td>' + num(p['Ю']) + '</td><td>' + num(p['С']) + '</td><td><b>' + num(p['Отдел']) + '</b></td>' +
            (dv ? '<td class="small">' + num(bk.dept) + ' <span class="muted">' + bk.src.slice(0, 4) + '</span></td>' : '<td class="small muted">' + (other != null ? num(other) : '—') + '</td>') +
            '<td>' + (fa ? num(fa['Отдел']) : '—') + '</td><td>' + (fa ? pct(fa['Отдел'] / p['Отдел']) : '') + '</td></tr>';
        });
        var y27 = keys.filter(function (k) { return k.slice(0, 4) === '2027' && pOf(k); });
        if (y27.length) { var t = { 'Ц': 0, 'Ю': 0, 'С': 0, 'Отдел': 0 }; y27.forEach(function (k) { var p = pOf(k); for (var z in t) t[z] += p[z]; }); html += '<tr class="tot"><td>Итого 2027</td><td>' + num(t['Ц']) + '</td><td>' + num(t['Ю']) + '</td><td>' + num(t['С']) + '</td><td>' + num(t['Отдел']) + '</td><td></td><td></td><td></td></tr>'; }
        html += '</tbody></table></div><div class="note">' + (dv
          ? '<b>Лучший месяц отдела:</b> отдел = лучший такой же месяц отдела за прошлые годы + надбавка; регионы — в тех долях, какие у них были в том рекордном месяце. «Рекорд отдела» — сам рекорд и его год. Это вариант для сравнения; в «Выполнении» и «Манёвре» пока считаются планы по рекордам регионов.'
          : '<b>Рекорды регионов:</b> план региона = рекорд этого же месяца за прошлые годы + надбавка; отдел = большее из суммы регионов и рекорда отдела + надбавка. «Другой способ» — отдел по лучшему месяцу отдела с той же надбавкой. Ноябрь 2026 — утверждённый план.') + ' Округление до 0,5 ю.</div></div>';
        w.innerHTML = html;
        w.querySelector('#vs').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (v) { variant = v; draw(); } });
      }
      draw();
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // ---------- клиентская база ----------
  function gradingWidget(w) {
    api('/api/grading').then(function (g) {
      var html = '';
      html += '<div class="card"><h3>Распределение клиентов — подтверждение</h3><div id="sc">' + (g.scenarios.length ? g.scenarios.map(actionHtml).join('') : '<div class="muted">Сценариев пока нет. Ежемесячный расчёт — 1-го числа в 08:00.</div>') + '</div></div>';
      if (g.latest) {
        var prev = {}; if (g.prev) g.prev.rows.forEach(function (r) { prev[r.mgrId] = r; });
        var zs = ['Центр', 'Юг', 'Север'];
        html += '<div class="card fold"><h3>База по менеджерам на ' + esc(g.latest.date.split('-').reverse().join('.')) + '</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Клиентов</th><th>Активных</th><th>% акт.</th><th>Спящих</th><th>Пассив</th><th>VIP</th><th>Отгрузки в год, млн</th>' + (g.prev ? '<th>Акт. к ' + esc(g.prev.date.slice(8, 10) + '.' + g.prev.date.slice(5, 7)) + '</th>' : '') + '</tr></thead><tbody>';
        var T = { n: 0, a: 0, sl: 0, p: 0, vip: 0, yr: 0 };
        zs.forEach(function (z) {
          var rs = g.latest.rows.filter(function (r) { return r.zone === z; }); if (!rs.length) return;
          html += '<tr class="grp"><td colspan="' + (g.prev ? 9 : 8) + '">' + z + '</td></tr>';
          rs.forEach(function (r) {
            for (var k in T) T[k] += +r[k] || 0;
            var p = prev[r.mgrId], dA = p ? (+r.a) - (+p.a) : null;
            html += '<tr><td>' + esc(r.mgr.replace(' (ТОП)', '')) + (/ТОП/.test(r.mgr) ? ' <span class="small muted">топ</span>' : '') + '</td><td>' + r.n + '</td><td>' + r.a + '</td><td>' + pct(r.a / r.n) + '</td><td>' + r.sl + '</td><td>' + r.p + '</td><td>' + r.vip + '</td><td>' + num(r.yr / 1e6, 1) + '</td>' +
              (g.prev ? '<td class="' + (dA > 0 ? 'pos' : dA < 0 ? 'neg' : '') + '">' + (dA == null ? '—' : (dA > 0 ? '+' : '') + dA) + '</td>' : '') + '</tr>';
          });
        });
        html += '<tr class="tot"><td>Итого</td><td>' + T.n + '</td><td>' + T.a + '</td><td>' + pct(T.a / T.n) + '</td><td>' + T.sl + '</td><td>' + T.p + '</td><td>' + T.vip + '</td><td>' + num(T.yr / 1e6, 1) + '</td>' + (g.prev ? '<td></td>' : '') + '</tr>';
        html += '</tbody></table></div><div class="note">Активный — есть заказы/отгрузки за 3 мес., спящий — 3–12 мес., пассив — дольше или без продаж. Отгрузки в год — в среднем за всю историю клиента. Снимок обновляется 1-го числа.</div></div>';
      }
      w.innerHTML = html;
      bindActions(w.querySelector('#sc'), function () { gradingWidget(w); });
      var bt = document.createElement('div'); w.insertBefore(bt, w.children[1] || null); baseTool(bt);
    }).catch(function (e) { w.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  // ---------- просмотр файла ----------
  function viewFile(id) {
    api('/api/fileinfo?f=' + encodeURIComponent(id)).then(function (fi) {
      var src = '/api/file?f=' + encodeURIComponent(id);
      main.innerHTML = '<div class="viewer-head"><button class="btn" type="button" id="back">← Назад</button><span class="nm">' + esc(fi.name) + '</span>' +
        (STATIC ? (fi.view === 'pdf' || fi.view === 'img' ? '<a class="btn" id="sep" href="#" target="_blank" rel="noopener" style="display:none">Открыть отдельно</a>' : '') + '<a class="btn pri" href="#" data-dl="' + esc(id) + '">Скачать</a>'
          : '<a class="btn" href="' + src + '" target="_blank" rel="noopener">Открыть отдельно</a><a class="btn pri" href="' + src + '&dl=1">Скачать</a>') +
        '</div><div id="vw"><div class="loading">Открываю…</div></div>';
      document.getElementById('back').addEventListener('click', function () { if (history.length > 1) history.back(); else location.hash = '#home'; });
      var vw = document.getElementById('vw');
      if (fi.view === 'file') { vw.innerHTML = '<div class="card">Этот формат (' + esc(fi.ext) + ') в браузере не показывается — скачайте файл.</div>'; return; }
      if (!STATIC) {
        if (fi.view === 'html' || fi.view === 'pdf') { vw.innerHTML = '<iframe class="frame" src="' + src + '" title="' + esc(fi.name) + '"></iframe>' + (fi.view === 'pdf' ? '<div class="note">Если на телефоне видна только первая страница — нажмите «Открыть отдельно».</div>' : ''); return; }
        if (fi.view === 'img') { vw.innerHTML = '<img src="' + src + '" alt="' + esc(fi.name) + '" style="max-width:100%">'; return; }
      }
      var lib = { xlsx: ['XLSX', BASE + 'vendor/xlsx.full.min.js'], docx: ['mammoth', BASE + 'vendor/mammoth.browser.min.js'], md: ['marked', BASE + 'vendor/marked.min.js'] }[fi.view];
      (lib ? loadScript(lib[0], lib[1]) : Promise.resolve()).then(function () { return fileBuffer(id); }).then(function (buf) {
        var data = fi.view === 'md' || fi.view === 'text' || fi.view === 'html' ? new TextDecoder('utf-8').decode(buf) : buf;
        if (STATIC && (fi.view === 'pdf' || fi.view === 'img')) {
          var url = URL.createObjectURL(new Blob([buf], { type: MIMES[fi.ext] || 'application/octet-stream' }));
          var sep = document.getElementById('sep'); if (sep) { sep.href = url; sep.style.display = ''; }
          vw.innerHTML = fi.view === 'img' ? '<img src="' + url + '" alt="" style="max-width:100%">' : '<iframe class="frame" src="' + url + '" title="PDF"></iframe><div class="note">Если на телефоне видна только первая страница — нажмите «Открыть отдельно».</div>';
          return;
        }
        if (fi.view === 'html') { var fr = document.createElement('iframe'); fr.className = 'frame'; fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals'); fr.srcdoc = data; vw.innerHTML = ''; vw.appendChild(fr); return; }
        if (fi.view === 'md') { vw.innerHTML = '<div class="card doc">' + window.marked.parse(data) + '</div>'; return; }
        if (fi.view === 'text') { vw.innerHTML = '<div class="card doc"><pre style="white-space:pre-wrap">' + esc(data) + '</pre></div>'; return; }
        if (fi.view === 'docx') { window.mammoth.convertToHtml({ arrayBuffer: data }).then(function (r) { vw.innerHTML = '<div class="card doc">' + r.value + '</div>'; }).catch(function (e) { vw.innerHTML = '<div class="card err">Не удалось открыть: ' + esc(e.message) + '</div>'; }); return; }
        if (fi.view === 'xlsx') return showXlsx(vw, data, fi.ext);
      }).catch(function (e) { vw.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
    }).catch(fail);
  }
  function loadScript(global, src) {
    if (window[global]) return Promise.resolve();
    return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('Не загрузилась библиотека просмотра')); }; document.head.appendChild(s); });
  }
  function showXlsx(vw, data, ext) {
    var wb;
    try { wb = window.XLSX.read(new Uint8Array(data), { type: 'array', cellStyles: false, cellNF: true, dense: false, codepage: ext === 'csv' ? 65001 : undefined }); }
    catch (e) { vw.innerHTML = '<div class="card err">Не удалось прочитать таблицу: ' + esc(e.message) + '</div>'; return; }
    var names = wb.SheetNames.filter(function (n) { var s = wb.Sheets[n]; return s && s['!ref']; });
    vw.innerHTML = '<div class="sheets">' + names.map(function (n, i) { return '<button type="button" data-i="' + i + '"' + (i ? '' : ' class="on"') + '>' + esc(n) + '</button>'; }).join('') + '</div><div class="xl"></div><div class="note lim"></div>';
    var xl = vw.querySelector('.xl'), lim = vw.querySelector('.lim');
    function draw(i) {
      var ws = wb.Sheets[names[i]], rg = window.XLSX.utils.decode_range(ws['!ref']), MAXR = 3000, MAXC = 40, cut = false;
      if (rg.e.r - rg.s.r > MAXR) { rg.e.r = rg.s.r + MAXR; cut = true; } if (rg.e.c - rg.s.c > MAXC) { rg.e.c = rg.s.c + MAXC; cut = true; }
      var html = window.XLSX.utils.sheet_to_html(ws, { editable: false, header: '', footer: '', range: rg });
      xl.innerHTML = html.replace(/^[\s\S]*?<table/i, '<table').replace(/<\/table>[\s\S]*$/i, '</table>');
      xl.scrollTop = 0; xl.scrollLeft = 0;
      lim.textContent = cut ? 'Показаны первые ' + MAXR + ' строк и ' + MAXC + ' столбцов. Полностью — в скачанном файле.' : 'Картинки и оформление Excel здесь не показываются — для них скачайте файл.';
    }
    vw.querySelector('.sheets').addEventListener('click', function (e) { var i = e.target.getAttribute('data-i'); if (i == null) return; var bs = vw.querySelectorAll('.sheets button'); for (var k = 0; k < bs.length; k++) bs[k].className = k == i ? 'on' : ''; draw(+i); });
    if (names.length) draw(0); else xl.innerHTML = '<div style="padding:12px">Пустая книга</div>';
  }

  // старт: счётчик правок для бейджа
  function start() {
    api('/api/actions').then(function (a) { pendingCount = a.filter(function (x) { return x.status === 'pending' || x.status === 'error'; }).length; drawNav((location.hash || '#home').slice(1).split('/')[0]); }).catch(function () {});
    route();
  }
  if (STATIC) unlock().then(start).catch(function (e) { if (e && e.message !== 'old') fail(e); });
  else start();
})();
