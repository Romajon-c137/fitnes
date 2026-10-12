// ================= icons =================
const ICON = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V20a.8.8 0 0 1-.8.8H15v-6.3H9v6.3H4.3a.8.8 0 0 1-.8-.8z"/>',
  workouts: '<path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11"/>',
  nutrition: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0zM9 3.5c-1 1.2-1 2.6 0 3.8M13 3.5c-1 1.2-1 2.6 0 3.8"/>',
  progress: '<path d="M3.5 17.5 9 12l4 4 7.5-7.5M15 8.5h5.5V14"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5a8 8 0 0 1 16 0"/>',
  camera: '<path d="M4 7.5h3.2l1.8-2.7h6l1.8 2.7H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.7"/>',
  barcode: '<path d="M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  pencil: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/>',
  photo: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9" r="1.5"/>',
  swap: '<path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="1.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
};
const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const ib = (name, label, onclick, cls = 'iconbtn') => h('button', { class: cls, type: 'button', 'aria-label': label, title: label, onclick, html: icon(name) });

// ================= render dispatch =================
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SCREENS = {};
function render(opts = {}) {
  const v = $('#view');
  if (!S.profile) { document.body.classList.add('onb'); v.replaceChildren(renderOnboarding()); return; }
  document.body.classList.remove('onb');
  const keep = opts.keepScroll ? window.scrollY : 0;
  v.replaceChildren(SCREENS[S.tab]());
  updateNav();
  Live.tick();
  if (opts.keepScroll) window.scrollTo(0, keep);
}
function go(tab, route = null) {
  const same = S.tab === tab && S.route === route;
  S.tab = tab; S.route = route;
  render();
  if (!same) {
    window.scrollTo(0, 0);
    const v = $('#view');
    v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  }
}
function updateNav() {
  for (const b of $$('#tabs button')) {
    const on = b.dataset.tab === S.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
}
function buildNav() {
  const tabs = [['home', 'Главная'], ['workouts', 'Тренировки'], ['nutrition', 'Питание'], ['progress', 'Прогресс'], ['profile', 'Профиль']];
  $('#tabs').replaceChildren(...tabs.map(([k, label]) => h('button', { type: 'button', 'data-tab': k, onclick: () => go(k) }, h('span', { html: icon(k) }), h('span', { class: 'tl' }, label))));
}

// ================= sheets =================
let currentSheet = null;
function openSheet(title, body, opts = {}) {
  if (currentSheet) currentSheet.close(true);
  const closeBtn = ib('close', 'Закрыть', () => api.close());
  const sheet = h('section', { class: 'sheet' + (opts.tall ? ' tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'sheet-h' }, h('h2', null, title), closeBtn),
    h('div', { class: 'sheet-b' }, body));
  const wrap = h('div', { class: 'sheet-wrap' }, h('div', { class: 'scrim', onclick: () => api.close() }), sheet);
  const prevFocus = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') api.close(); };
  const api = {
    el: sheet, body: sheet.querySelector('.sheet-b'),
    setBody(n) { api.body.replaceChildren(n); },
    close(silent) {
      if (api.closed) return; api.closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), reduceMotion ? 0 : 180);
      document.body.classList.remove('locked');
      if (currentSheet === api) currentSheet = null;
      if (opts.onClose) opts.onClose(silent);
      if (prevFocus && prevFocus.focus && !silent) try { prevFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    },
  };
  document.addEventListener('keydown', onKey);
  $('#sheets').append(wrap);
  document.body.classList.add('locked');
  currentSheet = api;
  requestAnimationFrame(() => { wrap.classList.add('in'); closeBtn.focus({ preventScroll: true }); });
  return api;
}
function confirmSheet(title, text, okLabel, onOk, danger) {
  const s = openSheet(title, h('div', null,
    h('p', { class: 'lead' }, text),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => s.close() }, 'Отмена'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => { s.close(true); onOk(); } }, okLabel))));
  return s;
}

// ================= toast =================
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

// ================= rest timer =================
const Rest = {
  end: 0, total: 0, iv: null, ctx: null,
  start(sec) {
    this.total = sec; this.end = Date.now() + sec * 1000;
    const bar = $('#restbar'); bar.hidden = false; bar.classList.remove('over');
    document.body.classList.add('resting');
    clearInterval(this.iv); this.iv = setInterval(() => this.tick(), 250); this.tick();
    this.prime();
  },
  add(s) { this.end = Math.max(Date.now(), this.end + s * 1000); this.total = Math.max(this.total, (this.end - Date.now()) / 1000); this.tick(); },
  stop() { clearInterval(this.iv); $('#restbar').hidden = true; document.body.classList.remove('resting'); },
  tick() {
    const left = Math.max(0, (this.end - Date.now()) / 1000);
    $('#rest-t').textContent = fmtSec(Math.ceil(left));
    $('#rest-p').style.transform = `scaleX(${this.total ? left / this.total : 0})`;
    if (left <= 0) {
      clearInterval(this.iv);
      $('#restbar').classList.add('over');
      $('#rest-l').textContent = 'Отдых окончен';
      this.beep();
      try { navigator.vibrate && navigator.vibrate([180, 80, 180]); } catch { /* ignore */ }
      setTimeout(() => { if (Date.now() >= this.end) this.stop(); $('#rest-l').textContent = 'Отдых'; }, 2500);
    }
  },
  prime() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch { this.ctx = null; } },
  beep() {
    const c = this.ctx; if (!c) return;
    try {
      [0, 0.22].forEach((d) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = 880; g.gain.setValueAtTime(0.0001, c.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d + 0.16);
        o.connect(g).connect(c.destination); o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.18);
      });
    } catch { /* ignore */ }
  },
};
function buildRestbar() {
  $('#restbar').replaceChildren(
    h('div', { class: 'rest-track' }, h('div', { id: 'rest-p', class: 'rest-fill' })),
    h('div', { class: 'rest-in' },
      h('span', { id: 'rest-l', class: 'rest-l' }, 'Отдых'),
      h('span', { id: 'rest-t', class: 'rest-t', 'aria-live': 'polite' }, '0:00'),
      h('div', { class: 'rest-act' },
        h('button', { type: 'button', class: 'rb', onclick: () => Rest.add(-15), 'aria-label': 'Минус 15 секунд' }, '−15'),
        h('button', { type: 'button', class: 'rb', onclick: () => Rest.add(15), 'aria-label': 'Плюс 15 секунд' }, '+15'),
        h('button', { type: 'button', class: 'rb skip', onclick: () => Rest.stop() }, 'Дальше'))));
}

// ================= live workout bar =================
const Live = {
  iv: null,
  ensure() { if (!this.iv) this.iv = setInterval(() => this.tick(), 1000); this.tick(); },
  tick() {
    const bar = $('#livebar');
    if (!bar) return;
    const a = activeSession();
    if (!a) { bar.hidden = true; document.body.classList.remove('live'); if (this.iv) { clearInterval(this.iv); this.iv = null; } return; }
    if (!this.iv) this.iv = setInterval(() => this.tick(), 1000);
    const sec = sessElapsed(a.log);
    const clk = $('#sess-clock');
    if (clk) clk.textContent = fmtDur(sec);
    const inSess = S.profile && S.tab === 'workouts' && S.route && S.route.session === a.key;
    bar.hidden = !!inSess || !S.profile;
    document.body.classList.toggle('live', !bar.hidden);
    $('#live-clock').textContent = fmtDur(sec);
    $('#live-t').textContent = a.title;
    $('#live-s').textContent = a.log.pausedAt ? 'Тренировка на паузе' : 'Идёт тренировка';
    bar.classList.toggle('paused', !!a.log.pausedAt);
  },
};
function buildLivebar() {
  $('#livebar').replaceChildren(h('button', { class: 'live-in', type: 'button', 'aria-label': 'Открыть текущую тренировку', onclick: () => { const a = activeSession(); if (a) go('workouts', { session: a.key, date: a.date }); } },
    h('span', { class: 'live-dot', 'aria-hidden': 'true' }),
    h('span', { class: 'live-tx' }, h('span', { id: 'live-s', class: 'live-s' }, 'Идёт тренировка'), h('span', { id: 'live-t', class: 'live-t' })),
    h('span', { id: 'live-clock', class: 'live-clock' }, '00:00')));
}

// ================= exercise figures =================
const Figs = {
  set: new Set(), raf: 0,
  add(box, anim, playing, mus) {
    const o = { box, g: box.querySelector('g'), anim, mus, t: 0, last: performance.now(), playing };
    if (!playing) o.g.innerHTML = FIG.still(anim, anim.ill ? anim.ill[0] : 0, mus);
    this.set.add(o); this.loop(); return o;
  },
  toggle(o, on) { o.playing = on ?? !o.playing; o.last = performance.now(); this.loop(); return o.playing; },
  loop() {
    if (this.raf) return;
    const step = (now) => {
      this.raf = 0; let any = false;
      for (const o of this.set) {
        if (!o.box.isConnected) { this.set.delete(o); continue; }
        if (!o.playing) continue;
        o.t += (now - o.last) / 1000; o.last = now; any = true;
        o.g.innerHTML = FIG.frame(o.anim, o.t, o.mus);
      }
      if (any) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
};
function figStill(animName, which = 0, cls = 'fig', mus) {
  const an = ANIMS[animName];
  const k = an.ill ? an.ill[which] : 0;
  return h('div', { class: cls, html: FIG.svg(an, FIG.still(an, k, mus), 'figsvg') });
}
function figPlayer(animName, mus) {
  const an = ANIMS[animName];
  const box = h('div', { class: 'player', html: `<svg class="figsvg" viewBox="${an.vb || '0 0 200 160'}" role="img" aria-label="Анимация техники"><g></g></svg>` });
  const o = Figs.add(box, an, !reduceMotion, mus);
  const btn = h('button', { class: 'pbtn', type: 'button' });
  const sync = () => { btn.innerHTML = icon(o.playing ? 'pause' : 'play'); btn.setAttribute('aria-label', o.playing ? 'Пауза' : 'Воспроизвести'); };
  btn.onclick = (e) => { e.stopPropagation(); Figs.toggle(o); sync(); };
  sync();
  box.append(btn);
  return box;
}

// ================= small form helpers =================
function field(label, input, hint) {
  const id = input.id || (input.id = 'f' + uid());
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
}
function numInput(value, opts = {}) {
  return h('input', Object.assign({ class: 'inp', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value == null ? '' : dc(value) }, opts));
}
function choiceList(options, value, onPick, opts = {}) {
  // options: [[value, label, hint]]
  const wrap = h('div', { class: 'choices' + (opts.multi ? ' multi' : ''), role: opts.multi ? 'group' : 'radiogroup' });
  const sel = new Set(opts.multi ? value : [value]);
  const draw = () => {
    wrap.replaceChildren(...options.map(([v, label, hint]) => {
      const on = sel.has(v);
      return h('button', { type: 'button', class: 'choice' + (on ? ' on' : ''), role: opts.multi ? 'checkbox' : 'radio', 'aria-checked': on ? 'true' : 'false',
        onclick: () => {
          if (opts.multi) { on ? sel.delete(v) : sel.add(v); onPick([...sel]); }
          else { sel.clear(); sel.add(v); onPick(v); }
          draw();
        } },
        h('span', { class: 'choice-l' }, label), hint ? h('span', { class: 'choice-h' }, hint) : null);
    }));
  };
  draw();
  return wrap;
}
function chips(options, value, onPick, opts = {}) {
  const wrap = h('div', { class: 'chips', role: 'group' });
  const sel = new Set(opts.multi ? value : [value]);
  const draw = () => wrap.replaceChildren(...options.map(([v, label]) => {
    const on = sel.has(v);
    return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false',
      onclick: () => { if (opts.multi) { on ? sel.delete(v) : sel.add(v); onPick([...sel]); } else { sel.clear(); sel.add(v); onPick(v); } draw(); } }, label);
  }));
  draw();
  return wrap;
}
function bar(value, max, color) {
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0;
  const over = max > 0 && value > max * 1.05;
  return h('div', { class: 'bar' + (over ? ' over' : ''), style: `--c:var(--${color})`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(max)), 'aria-valuenow': String(Math.round(value)) },
    h('div', { class: 'bar-f', style: `transform:scaleX(${pct})` }));
}
function errorText(msg) { return h('p', { class: 'err', role: 'alert' }, msg); }
