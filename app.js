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
  function bytesToB64(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
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
        var pass = document.getElementById('pp').value;
        fetch('meta.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
          return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']).then(function (pk) {
            return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64ToBytes(m.salt), iterations: m.iter, hash: 'SHA-256' }, pk, 256);
          });
        }).then(function (bits) {
          return importRaw(bits).then(function (key) { return loadData(key).then(function () { try { localStorage.setItem(LS, bytesToB64(bits)); } catch (x) {} }); });
        }).then(function () { document.querySelector('.nav').style.display = ''; ok(); })
          .catch(function () { e.textContent = 'Неверный пароль'; b.disabled = false; });
      });
    });
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
  document.addEventListener('click', function (ev) { var a = ev.target.closest ? ev.target.closest('[data-dl]') : null; if (a && STATIC) { ev.preventDefault(); saveFile(a.getAttribute('data-dl')); } });

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
  var ROUTES = [['home', 'Главная'], ['prices', 'Прайсы и конкуренты'], ['clients', 'Клиентская база'], ['plans', 'Планы продаж'], ['fact', 'Выполнение планов'], ['training', 'Обучение']];
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
    if (r === 'home') return home();
    return section(r);
  }
  window.addEventListener('hashchange', route);

  function getSections() { return SECTIONS ? Promise.resolve(SECTIONS) : api('/api/sections').then(function (s) { SECTIONS = s; return s; }); }

  // ---------- файлы ----------
  function filesHtml(groups) {
    return groups.map(function (g) {
      return '<div class="card"><h3>' + esc(g.title) + '</h3><ul class="files">' + g.files.map(function (f) {
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
      '</div><div class="msg small" style="margin-top:8px"></div><div class="lst"></div></div>';
  }
  function bindActions(root, after) {
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button[data-do]') : null; if (!b) return;
      var card = b.closest('.act'), kind = card.getAttribute('data-kind'), key = card.getAttribute('data-key'), what = b.getAttribute('data-do');
      var msg = card.querySelector('.msg');
      if (what === 'list') return toggleList(card, key);
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
          '</div>' + factStatusLine(f.status) + '</div>';
      }
      var acts = h.actions;
      html += '<div class="card"><h2>Ждут подтверждения</h2><div id="acts">' + (acts.length ? acts.map(actionHtml).join('') : '<div class="muted">Сейчас ничего не ждёт подтверждения. Когда скрипт подготовит правку в МойСклад, она появится здесь и в Telegram.</div>') + '</div></div>';
      html += '<div class="card"><h2>Лента обновлений</h2><ul class="feed">' + feed.slice(0, 40).map(function (e) {
        var t = String(e.t || ''), when = t.slice(8, 10) + '.' + t.slice(5, 7) + ' ' + t.slice(11, 16);
        var title = e.file ? '<a href="#view/' + encodeURIComponent(e.file) + '">' + esc(e.title) + '</a>' : esc(e.title);
        return '<li><span class="when">' + esc(when) + '</span><span class="what">' + title + '<span class="tag">' + esc(SECTION_TAG[e.section] || e.section || '') + '</span>' + (e.text ? '<div class="small muted">' + esc(e.text) + '</div>' : '') + '</span></li>';
      }).join('') + '</ul></div>';
      main.innerHTML = html;
      var ab = document.getElementById('acts'); if (ab) bindActions(ab, home);
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
      if (s.widget === 'fact') factWidget(w);
      if (s.widget === 'plans') plansWidget(w);
      if (s.widget === 'grading') gradingWidget(w);
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
      html += '<div class="card"><h3>Регионы</h3><div class="tw"><table class="t"><thead><tr><th>Регион</th><th>Факт</th>' + vk.map(function (k) { return '<th>' + vn(k) + '</th><th>%</th>'; }).join('') + (f.isCur && vk.length ? '<th>Нужно в день</th>' : '') + '<th>Год назад</th><th>к году</th></tr></thead><tbody>' +
        ['Ц', 'Ю', 'С', 'Б', 'Отдел'].map(function (z) {
          var fa = f.reg[z], ly = f.lyReg ? f.lyReg[z] : null, left = f.wdAll - f.wdDone;
          return '<tr class="' + (z === 'Отдел' ? 'tot' : '') + '"><td>' + ZN[z] + '</td><td>' + num(fa) + '</td>' + vk.map(function (k) { var p = f.plans[k][z]; return '<td>' + (p == null ? '—' : num(p)) + '</td><td>' + (p ? pct(fa / p) : '—') + '</td>'; }).join('') +
            (f.isCur && vk.length ? '<td>' + (f.plans[vk[0]][z] != null && left > 0 ? num(Math.max(0, f.plans[vk[0]][z] - fa) / left, 2) : '—') + '</td>' : '') +
            '<td>' + num(ly) + '</td><td class="' + (ly && fa >= ly ? 'pos' : 'neg') + '">' + (ly ? (fa >= ly ? '+' : '') + Math.round((fa / ly - 1) * 100) + '%' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="note">ю = млн ₽, приход денег (банк + касса), ООО «АМИНАТРЕЙД», без РВБ, Нике/Евростандарт и «Интернет Решений». Регион — по текущему владельцу клиента, как в «Отчёте Десант».' + (f.isCur && vk.length ? ' «Нужно в день» — по ' + (vk.length > 1 ? 'плану 1' : 'плану') + ' на оставшиеся рабочие дни.' : '') + '</div></div>';
      // график
      html += '<div class="card"><h3>Отдел: накопительно по дням</h3><div id="chart"></div></div>';
      // менеджеры
      var zones = ['Ц', 'Ю', 'С', 'Б'];
      html += '<div class="card"><h3>Менеджеры</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Факт</th><th>Доля в регионе</th><th>Год назад</th><th>к году</th></tr></thead><tbody>' +
        zones.map(function (z) {
          var ms = f.mgrs.filter(function (m) { return m.zone === z; }); if (!ms.length) return '';
          var tot = ms.reduce(function (s, m) { return s + m.fact; }, 0);
          return '<tr class="grp"><td colspan="5">' + ZN[z] + ' · ' + u(tot) + '</td></tr>' + ms.map(function (m) {
            return '<tr><td>' + esc(m.name) + (m.top ? ' <span class="small muted">топ</span>' : '') + '</td><td>' + num(m.fact, 2) + '</td><td>' + pct(m.share) + '</td><td>' + num(m.ly, 2) + '</td><td class="' + (m.ly && m.fact >= m.ly ? 'pos' : 'neg') + '">' + (m.ly ? (m.fact >= m.ly ? '+' : '') + Math.round((m.fact / m.ly - 1) * 100) + '%' : '—') + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div><div class="note">Менеджер — по полю «Менеджер ОП» в платеже, поэтому суммы по менеджерам могут немного отличаться от суммы региона (там клиент считается по текущему владельцу). Личных планов нет — только факт и доля.</div></div>';
      // история
      if (f.hist.length) {
        html += '<div class="card"><h3>План/факт по месяцам</h3><div class="tw"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Отдел</th></tr></thead><tbody>' +
          f.hist.map(function (h) {
            var k = Object.keys(h.plans)[0];
            return '<tr><td>' + cap(ymName(h.ym)) + '<div class="small muted">' + vn(k) + '</div></td>' + ['Ц', 'Ю', 'С', 'Отдел'].map(function (z) { var p = h.plans[k][z]; return '<td>' + num(h.fact[z]) + ' / ' + num(p) + '<div class="small">' + pct(h.fact[z] / p) + '</div></td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div><div class="note">факт / план, ю. Для месяцев с двумя вариантами показан план 1.</div></div>';
      }
      html += '<div class="card"><h3>Приход по месяцам</h3><div class="tw"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Без рег.</th><th>Отдел</th></tr></thead><tbody>' +
        f.byMonth.slice().reverse().map(function (m) { return '<tr><td>' + cap(ymName(m.ym)) + '</td><td>' + num(m['Ц']) + '</td><td>' + num(m['Ю']) + '</td><td>' + num(m['С']) + '</td><td>' + num(m['Б']) + '</td><td><b>' + num(m['Отдел']) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
      w.innerHTML = html;
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

  // ---------- планы ----------
  function plansWidget(w) {
    api('/api/plans').then(function (j) {
      var keys = Object.keys(j.months).sort(), variant = 'plan1';
      function draw() {
        var html = '<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">План прихода денег, ю</h3><div class="seg" id="vs"><button type="button" data-v="plan1" class="' + (variant === 'plan1' ? 'on' : '') + '">План 1 · рекорд +5%</button><button type="button" data-v="plan2" class="' + (variant === 'plan2' ? 'on' : '') + '">План 2 · рекорд +10%</button></div></div>' +
          '<div class="tw" style="margin-top:10px"><table class="t"><thead><tr><th>Месяц</th><th>Центр</th><th>Юг</th><th>Север</th><th>Отдел</th><th>Факт</th><th>%</th></tr></thead><tbody>';
        var year = '', sum = null;
        keys.forEach(function (k) {
          var m = j.months[k], p = m[variant] || m.plan, fa = j.fact[k];
          if (k.slice(0, 4) !== year) { year = k.slice(0, 4); html += '<tr class="grp"><td colspan="7">' + year + '</td></tr>'; }
          html += '<tr><td>' + cap(MONTHS[+k.slice(5) - 1]) + (m.plan ? ' <span class="small muted">утв.</span>' : '') + '</td><td>' + num(p['Ц']) + '</td><td>' + num(p['Ю']) + '</td><td>' + num(p['С']) + '</td><td><b>' + num(p['Отдел']) + '</b></td><td>' + (fa ? num(fa['Отдел']) : '—') + '</td><td>' + (fa ? pct(fa['Отдел'] / p['Отдел']) : '') + '</td></tr>';
        });
        var y27 = keys.filter(function (k) { return k.slice(0, 4) === '2027'; });
        if (y27.length) { var t = { 'Ц': 0, 'Ю': 0, 'С': 0, 'Отдел': 0 }; y27.forEach(function (k) { var p = j.months[k][variant]; for (var z in t) t[z] += p[z]; }); html += '<tr class="tot"><td>Итого 2027</td><td>' + num(t['Ц']) + '</td><td>' + num(t['Ю']) + '</td><td>' + num(t['С']) + '</td><td>' + num(t['Отдел']) + '</td><td></td><td></td></tr>'; }
        html += '</tbody></table></div><div class="note">Методика: план региона = рекорд этого же месяца за прошлые годы + надбавка, округление до 0,5 ю; отдел = большее из суммы регионов и рекорда отдела + надбавка. Ноябрь 2026 — утверждённый план (рекорд +10%). Источник — «План продаж Десант 2027.xlsx».</div></div>';
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
        html += '<div class="card"><h3>База по менеджерам на ' + esc(g.latest.date.split('-').reverse().join('.')) + '</h3><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th>Клиентов</th><th>Активных</th><th>% акт.</th><th>Спящих</th><th>Пассив</th><th>VIP</th><th>Отгрузки в год, млн</th>' + (g.prev ? '<th>Акт. к ' + esc(g.prev.date.slice(8, 10) + '.' + g.prev.date.slice(5, 7)) + '</th>' : '') + '</tr></thead><tbody>';
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
