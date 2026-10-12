'use strict';
// ================= utilities =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // trusted static markup only
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const dowOf = (s) => (parseISO(s).getDay() + 6) % 7; // Monday = 0
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const DOW = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const DOW_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
const DOW3 = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MON3 = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function plural(n, one, few, many) { const a = Math.abs(Math.round(n)) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }
const pln = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
const dc = (v) => String(v).replace('.', ',');
const fmtRest = (s) => (s >= 60 ? (s % 60 ? `${Math.floor(s / 60)} мин ${s % 60} с` : `${s / 60} мин`) : `${s} с`);
const fmtDate = (s) => { const d = parseISO(s); return `${DOW3[dowOf(s)]}, ${d.getDate()} ${MON3[d.getMonth()]}`; };
const fmtShort = (s) => { const d = parseISO(s); return `${d.getDate()} ${MON3[d.getMonth()]}`; };
function relDay(s) {
  const t = iso(), n = daysBetween(t, s);
  if (n === 0) return 'Сегодня';
  if (n === -1) return 'Вчера';
  if (n === 1) return 'Завтра';
  if (n > 1 && n < 7) return cap(DOW[dowOf(s)]);
  return fmtDate(s);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
const fmtN = (v) => Math.round(v).toLocaleString('ru-RU');
const fmtSec = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ================= storage =================
// Supabase mode: rows of public.docs (one per key) for the signed-in user; set up when the build has REP_CONFIG.
// Cloud mode: each person's own private subtree data/users/<id>/ in the artifact db.
// Device mode: localStorage (chat preview, signed-out, or no write access).
const Store = {
  mode: 'device', db: null, sb: null, uid: null, email: '', cache: {}, q: {},
  async init() {
    const cfg = window.REP_CONFIG;
    if (cfg && window.supabase) {
      this.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      const { data } = await this.sb.auth.getSession();
      if (data && data.session) this.useSession(data.session);
      return;
    }
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      let canWrite = null;
      try { canWrite = await user.can('data.write'); } catch { canWrite = null; }
      this.db = db; this.uid = id;
      this.mode = canWrite === false ? 'device' : 'cloud';
      if (canWrite === false) this.readOnlyCloud = true;
    } catch { /* stay on device */ }
  },
  useSession(session) { this.mode = 'supabase'; this.uid = session.user.id; this.email = session.user.email || ''; },
  // Supabase is configured but nobody is signed in and they have not chosen to stay on this device.
  get needsAuth() { return !!this.sb && this.mode !== 'supabase' && !this.offline; },
  get offline() { try { return localStorage.getItem('fitapp:offline') === '1'; } catch { return false; } },
  set offline(v) { try { if (v) localStorage.setItem('fitapp:offline', '1'); else localStorage.removeItem('fitapp:offline'); } catch { /* ignore */ } },
  docs() { return this.sb.from('docs'); },
  // First sign-in on a device that already has data: copy it into the empty account.
  async adoptLocal() {
    if (await this.get('profile')) return;
    const pre = 'fitapp:local:', rows = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith(pre)) continue;
        const v = JSON.parse(localStorage.getItem(k));
        if (v) rows.push(this.row(k.slice(pre.length), v));
      }
    } catch { return; }
    for (let i = 0; i < rows.length; i += 20) {
      const { error } = await this.docs().upsert(rows.slice(i, i + 20));
      if (error) throw error;
    }
  },
  row(key, val) { return { user_id: this.uid, key, kind: val.kind || null, date: val.date || null, data: val, updated_at: new Date().toISOString() }; },
  ref(key) { return this.db.doc('data/users/' + this.uid + '/' + key); },
  lsKey(key) { return 'fitapp:' + (this.uid || 'local') + ':' + key; },
  // In Supabase mode reads throw on failure, so a network error is never mistaken for an empty account.
  async get(key) {
    if (this.mode === 'supabase') {
      const { data, error } = await this.docs().select('data').eq('user_id', this.uid).eq('key', key).maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    }
    if (this.mode === 'cloud') {
      try { const s = await this.ref(key).get(); return s.exists ? JSON.parse(JSON.stringify(s.data())) : null; }
      catch (e) { return null; }
    }
    try { const v = localStorage.getItem(this.lsKey(key)); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  async query(kind, since) {
    if (this.mode === 'supabase') {
      let q = this.docs().select('key, data').eq('user_id', this.uid).eq('kind', kind);
      if (since) q = q.gte('date', since);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data.map((r) => ({ id: r.key, data: r.data }));
    }
    if (this.mode === 'cloud') {
      try {
        let q = this.db.collection('data/users/' + this.uid).where('kind', '==', kind);
        if (since) q = q.where('date', '>=', since);
        const snap = await q.limit(1000).get();
        return snap.docs.map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) }));
      } catch { return []; }
    }
    const out = [], pre = this.lsKey('');
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith(pre)) continue;
        const v = JSON.parse(localStorage.getItem(k));
        if (v && v.kind === kind && (!since || (v.date || '') >= since)) out.push({ id: k.slice(pre.length), data: v });
      }
    } catch { /* ignore */ }
    return out;
  },
  // One write at a time per document; the latest value wins.
  set(key, val) {
    const q = this.q[key] || (this.q[key] = { busy: false, next: undefined });
    q.next = val;
    if (!q.busy) this._flush(key);
  },
  async _flush(key) {
    const q = this.q[key];
    q.busy = true;
    while (q.next !== undefined) {
      const val = q.next; q.next = undefined;
      try { await this._write(key, val); }
      catch (e) { this._onError(e, key, val); }
    }
    q.busy = false;
  },
  async _write(key, val) {
    if (this.mode === 'supabase') {
      for (let attempt = 0; ; attempt++) {
        const { error } = val === null
          ? await this.docs().delete().eq('user_id', this.uid).eq('key', key)
          : await this.docs().upsert(this.row(key, val));
        if (!error) return;
        // No code means the request never reached the server: retry once after a short pause.
        if (error.code || attempt) throw error;
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));
      }
    }
    if (this.mode === 'cloud') {
      try { await (val === null ? this.ref(key).delete() : this.ref(key).set(val)); }
      catch (e) {
        if (e && e.code === 'unavailable') { await new Promise((r) => setTimeout(r, 600 + Math.random() * 900)); await (val === null ? this.ref(key).delete() : this.ref(key).set(val)); }
        else throw e;
      }
      return;
    }
    if (val === null) localStorage.removeItem(this.lsKey(key));
    else localStorage.setItem(this.lsKey(key), JSON.stringify(val));
  },
  _onError(e, key, val) {
    const code = e && e.code;
    if (this.mode === 'cloud' && (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted') && JSON.stringify(val || {}).length < 200000) {
      // No write access to the account store here: keep working on this device.
      this.mode = 'device';
      this.readOnlyCloud = true;
      try { for (const k in S.docsForMigration()) localStorage.setItem(this.lsKey(k), JSON.stringify(S.docsForMigration()[k])); } catch { /* ignore */ }
      toast('Данные сохраняются только на этом устройстве. Чтобы синхронизировать их с аккаунтом, попросите владельца приложения дать вам доступ Contributor.');
      return;
    }
    if (code === 'quota_exceeded' || (e && e.name === 'QuotaExceededError')) { toast('Хранилище заполнено. Удалите несколько фото прогресса, чтобы освободить место.'); return; }
    toast('Не удалось сохранить изменение. Проверьте подключение и попробуйте ещё раз.');
  },
};

// ================= state =================
const S = {
  profile: null, plan: null, weights: { kind: 'weights', entries: [] }, meas: { kind: 'measure', entries: [] },
  foods: { kind: 'foods', products: {}, recent: [] }, records: { kind: 'records', ex: {} },
  days: {}, done: {}, photos: null,
  tab: 'home', route: null, askedMissed: false, active: null,
  docsForMigration() {
    const o = { profile: this.profile, plan: this.plan, weights: this.weights, measure: this.meas, foods: this.foods, records: this.records };
    for (const d in this.days) o['day-' + d] = this.days[d];
    for (const k in o) if (!o[k]) delete o[k];
    return o;
  },
};
const saveProfile = () => Store.set('profile', S.profile);
const savePlan = () => Store.set('plan', S.plan);
const saveWeights = () => Store.set('weights', S.weights);
const saveMeas = () => Store.set('measure', S.meas);
const saveFoods = () => Store.set('foods', S.foods);
const saveRecords = () => Store.set('records', S.records);
function dayDoc(date) { return S.days[date] || (S.days[date] = { kind: 'day', date, food: [], sessions: {} }); }
const saveDay = (date) => Store.set('day-' + date, S.days[date]);

async function loadAll() {
  const [profile, plan, weights, meas, foods, records] = await Promise.all(['profile', 'plan', 'weights', 'measure', 'foods', 'records'].map((k) => Store.get(k)));
  S.profile = profile; S.plan = plan;
  if (weights) S.weights = weights;
  if (meas) S.meas = meas;
  if (foods) S.foods = Object.assign({ products: {}, recent: [] }, foods);
  if (records) S.records = Object.assign({ ex: {} }, records);
  const days = await Store.query('day', addDays(iso(), -70));
  for (const d of days) if (d.data && d.data.date) S.days[d.data.date] = Object.assign({ food: [], sessions: {} }, d.data);
  rebuildDone();
}
function rebuildDone() {
  S.done = {};
  for (const date in S.days) {
    const ss = S.days[date].sessions || {};
    for (const key in ss) if (sessionStarted(ss[key])) S.done[key] = date;
  }
}
const sessionStarted = (s) => !!(s && (s.done || Object.values(s.sets || {}).some((arr) => arr.some((x) => x.done))));

// ================= units =================
const U = {
  imp: () => S.profile && S.profile.units === 'imperial',
  w: (kg, d = 1) => (kg == null ? '' : U.imp() ? round(kg * 2.20462, d) : round(kg, d)),
  wu: () => (U.imp() ? 'фнт' : 'кг'),
  ws: (kg, d = 1) => dc(U.w(kg, d)),
  wIn: (v) => { const n = num(v); return n == null ? null : U.imp() ? n / 2.20462 : n; },
  l: (cm, d = 1) => (cm == null ? '' : U.imp() ? round(cm / 2.54, d) : round(cm, d)),
  lu: () => (U.imp() ? 'дюйм' : 'см'),
  lIn: (v) => { const n = num(v); return n == null ? null : U.imp() ? n * 2.54 : n; },
  // lifting weights: show without forced decimals
  lift: (kg) => (kg == null || kg === '' ? '' : dc(U.imp() ? round(kg * 2.20462, 1) : round(kg, 2))),
};
const fmtW = (kg) => `${U.ws(kg)} ${U.wu()}`;
function fmtHeight(cm) {
  if (!U.imp()) return `${round(cm)} см`;
  const inch = cm / 2.54, ft = Math.floor(inch / 12), i = Math.round(inch - ft * 12);
  return i === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${i}″`;
}

// ================= body & nutrition targets =================
const ACTIVITY = {
  sedentary: { f: 1.2, label: 'В основном сидя', hint: 'Сидячая работа, мало ходьбы' },
  light: { f: 1.375, label: 'Небольшая активность', hint: 'Часть дня на ногах' },
  moderate: { f: 1.55, label: 'Умеренная активность', hint: 'Регулярная ходьба или подвижная работа' },
  active: { f: 1.725, label: 'Высокая активность', hint: 'Физическая работа или ежедневный спорт' },
  athlete: { f: 1.9, label: 'Очень высокая активность', hint: 'Тяжёлый физический труд плюс тренировки' },
};
const GOALS = {
  gain: { label: 'Набор мышечной массы', hint: 'Рост мышц при небольшом профиците калорий' },
  lose: { label: 'Снижение веса', hint: 'Сжигание жира при умеренном дефиците калорий' },
  maintain: { label: 'Поддержание веса', hint: 'Сохранить вес и стать сильнее' },
};
const EXP = {
  beginner: { label: 'Новичок', hint: 'Меньше 6 месяцев регулярных тренировок' },
  intermediate: { label: 'Средний уровень', hint: 'От 6 месяцев до 2 лет' },
  advanced: { label: 'Продвинутый', hint: 'Больше 2 лет стабильных тренировок' },
};
const EQUIP = {
  barbell: 'Штанга и стойки', dumbbells: 'Гантели', bench: 'Скамья', machines: 'Блоки и тренажёры', bar: 'Турник', bands: 'Резиновые эспандеры',
};
const GROUPS = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс', triceps: 'Трицепс', legs: 'Ноги', glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс', cardio: 'Кардио' };

function currentWeight() {
  const e = S.weights.entries;
  return e.length ? e[e.length - 1].kg : S.profile ? S.profile.startKg : null;
}
function targets(p = S.profile, kg = currentWeight()) {
  if (!p || !kg) return null;
  const hM = p.heightCm / 100;
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[p.activity] || ACTIVITY.moderate).f;
  let kcal = tdee, change = 0;
  const teen = p.age < 18;
  if (p.goal === 'lose') {
    const deficit = Math.min(500, tdee * 0.2) * (teen ? 0.5 : 1);
    const floor = Math.min(tdee, Math.max(p.sex === 'male' ? 1500 : 1200, bmr));
    kcal = Math.max(tdee - deficit, floor);
  } else if (p.goal === 'gain') {
    kcal = tdee + Math.min(p.exp === 'beginner' ? 350 : 250, tdee * 0.12);
  }
  change = kcal - tdee;
  kcal = Math.round(kcal / 10) * 10;
  const bmi = kg / (hM * hM);
  const refKg = bmi > 30 ? 25 * hM * hM : kg; // avoid inflated protein targets at higher body fat
  const perKg = p.goal === 'lose' ? 2.0 : p.goal === 'gain' ? 1.8 : 1.6;
  const protein = Math.round(refKg * perKg);
  const fat = Math.round(Math.max(0.6 * refKg, (kcal * 0.27) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, change: Math.round(change), teen, bmi };
}
const healthyMinKg = (heightCm) => round(18.5 * (heightCm / 100) ** 2, 1);

// ================= plan generator =================
const EXBY = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
const exAvailable = (ex, equip) => ex.eq.some((set) => set.every((k) => equip.includes(k)));
const MAXLVL = { beginner: 1, intermediate: 2, advanced: 3 };
const NEX = { beginner: 4, intermediate: 5, advanced: 6 };
const SPLITS = {
  fullA: { title: 'Всё тело А', slots: ['squat', 'hpush', 'vpull|hpull', 'vpush', 'hinge', 'core'] },
  fullB: { title: 'Всё тело Б', slots: ['hinge', 'hpull', 'hpush', 'lunge|squat', 'raise|rear', 'core'] },
  fullC: { title: 'Всё тело В', slots: ['lunge|squat', 'vpull|hpull', 'vpush|hpush', 'glute', 'curl', 'ext'] },
  upperA: { title: 'Верх тела А', slots: ['hpush', 'hpull', 'vpush', 'vpull|hpull', 'curl', 'ext'] },
  upperB: { title: 'Верх тела Б', slots: ['vpull|hpull', 'hpush', 'hpull', 'raise', 'ext', 'curl'] },
  lowerA: { title: 'Низ тела А', slots: ['squat', 'hinge', 'lunge', 'calf', 'core', 'legiso'] },
  lowerB: { title: 'Низ тела Б', slots: ['hinge', 'lunge|squat', 'glute', 'legiso', 'core', 'calf'] },
  chestTri: { title: 'Грудь и трицепс', slots: ['hpush', 'hpush', 'fly|hpush', 'ext', 'ext', 'core'] },
  backBi: { title: 'Спина и бицепс', slots: ['vpull|hpull', 'hpull', 'hpull|backiso', 'curl', 'curl', 'rear'] },
  legsAbs: { title: 'Ноги и пресс', slots: ['squat', 'hinge', 'lunge', 'core', 'legiso', 'calf'] },
  shouldersAbs: { title: 'Плечи и пресс', slots: ['vpush', 'raise', 'rear', 'core', 'core', 'vpush|raise'] },
  push: { title: 'Грудь, плечи и трицепс', slots: ['hpush', 'vpush', 'hpush', 'raise', 'ext', 'fly|ext'] },
  pull: { title: 'Спина и бицепс', slots: ['vpull|hpull', 'hpull', 'rear', 'curl', 'hpull|backiso', 'curl'] },
  glutesHams: { title: 'Ягодицы и задняя поверхность бедра', slots: ['hinge', 'glute', 'lunge', 'legiso', 'calf', 'core'] },
};
const GROUP_PATS = { chest: ['hpush', 'hpush', 'fly'], back: ['vpull', 'hpull', 'hpull'], shoulders: ['vpush', 'raise', 'rear'], biceps: ['curl', 'curl'], triceps: ['ext', 'ext'], legs: ['squat', 'hinge', 'lunge', 'legiso'], glutes: ['glute', 'hinge'], calves: ['calf'], abs: ['core', 'core'], cardio: ['cardio'] };

function splitFor(n, p) {
  const limited = !p.equip.some((k) => ['barbell', 'dumbbells', 'machines', 'bar', 'bands'].includes(k));
  if (limited && n >= 3) return [['fullA', 'fullB', 'fullC'], ['upperA', 'lowerA', 'upperB', 'lowerB'], ['upperA', 'lowerA', 'fullB', 'upperB', 'lowerB'], ['upperA', 'lowerA', 'fullC', 'upperB', 'lowerB', 'fullB']][Math.min(n, 6) - 3];
  const beg = p.exp === 'beginner';
  switch (n) {
    case 1: return ['fullA'];
    case 2: return ['fullA', 'fullB'];
    case 3: return beg ? ['fullA', 'fullB', 'fullC'] : ['push', 'pull', 'legsAbs'];
    case 4: return beg || p.goal === 'lose' ? ['upperA', 'lowerA', 'upperB', 'lowerB'] : ['chestTri', 'backBi', 'legsAbs', 'shouldersAbs'];
    case 5: return beg ? ['upperA', 'lowerA', 'fullB', 'upperB', 'lowerB'] : ['chestTri', 'backBi', 'legsAbs', 'shouldersAbs', 'glutesHams'];
    default: return ['push', 'pull', 'legsAbs', 'push', 'pull', 'glutesHams'];
  }
}
function pickExercise(patAlt, p, usedSession, usedWeek, fallback) {
  const maxL = MAXLVL[p.exp] || 1;
  for (const pat of patAlt.split('|')) {
    let cands = EXERCISES.filter((e) => e.pat === pat && exAvailable(e, p.equip) && !usedSession.has(e.id));
    if (!cands.length) continue;
    const score = (e) => {
      let s = 0;
      if (usedWeek.has(e.id)) s -= 4;
      if (e.lvl > maxL) s -= 3 * (e.lvl - maxL);
      if (e.easy && p.exp !== 'beginner') s -= 5;
      if (e.easy && p.exp === 'beginner') s += 0.5;
      const loaded = !e.bw;
      if (loaded) s += 1;
      if (p.exp !== 'beginner' && e.eq.some((q) => q.includes('barbell'))) s += 1;
      if (p.exp === 'beginner' && e.eq.some((q) => q.includes('machines') || q.includes('dumbbells'))) s += 0.5;
      const other = ['barbell', 'dumbbells', 'machines'].some((k) => p.equip.includes(k));
      if (other && e.eq.every((q) => q.includes('bands'))) s -= 1.5;
      if ([...usedSession].some((id) => EXBY[id] && EXBY[id].anim.replace('Band', '') === e.anim.replace('Band', ''))) s -= 2;
      return s;
    };
    cands = cands.map((e, i) => ({ e, s: score(e) - i * 0.01 })).sort((a, b) => b.s - a.s);
    return cands[0].e;
  }
  if (!fallback) {
    const fb = patAlt.split('|').map((x) => FALLBACK[x]).filter(Boolean).join('|');
    if (fb) return pickExercise(fb, p, usedSession, usedWeek, true);
  }
  return null;
}
const FALLBACK = { hinge: 'glute', hpull: 'backiso', vpull: 'hpull|backiso', rear: 'backiso', raise: 'vpush', legiso: 'glute|lunge', fly: 'hpush', backiso: 'hpull' };
function prescribe(ex, p) {
  const goal = p.goal, exp = p.exp;
  if (ex.time) return { sets: 3, reps: ex.g === 'cardio' ? '30 с' : exp === 'beginner' ? '20–30 с' : '30–45 с', rest: ex.g === 'cardio' ? 30 : 45 };
  const c = ex.type === 'c';
  const sets = c && goal === 'gain' && exp !== 'beginner' ? 4 : 3;
  let reps = goal === 'gain' ? (c ? '6–10' : '10–12') : goal === 'lose' ? (c ? '8–12' : '12–15') : (c ? '8–10' : '10–12');
  if (ex.id === 'pullup' || ex.id === 'chinup') reps = exp === 'beginner' ? '3–6' : '5–8';
  else if (ex.bw && ['squat_bw', 'lunge', 'glute_bridge', 'calf_raise', 'crunch', 'superman', 'pushup', 'knee_pushup', 'bench_dip'].includes(ex.id)) reps = goal === 'lose' ? '12–20' : '10–15';
  if (ex.side) reps += ' на сторону';
  const rest = c ? (goal === 'gain' ? 120 : goal === 'lose' ? 75 : 90) : goal === 'lose' ? 45 : 60;
  return { sets, reps, rest };
}
function buildDay(title, slots, p, usedWeek, count) {
  const used = new Set(), items = [];
  for (const slot of slots) {
    if (items.length >= count) break;
    const ex = pickExercise(slot, p, used, usedWeek);
    if (!ex) continue;
    used.add(ex.id); usedWeek.add(ex.id);
    items.push(Object.assign({ ex: ex.id }, prescribe(ex, p)));
  }
  return { id: 'd' + uid(), title, items, groups: groupsOfItems(items) };
}
function groupsOfItems(items) {
  const g = [];
  for (const it of items) { const e = EXBY[it.ex]; if (e && !g.includes(e.g) && e.g !== 'cardio') g.push(e.g); }
  return g;
}
const RECOVER = (g) => !['abs', 'cardio', 'calves'].includes(g);
function overlap(a, b) { return a.filter((g) => RECOVER(g) && b.includes(g)).length; }
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => { for (const r of permutations(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([x].concat(r)); });
  return out;
}
function assignDays(sessions, dows) {
  // Choose the session order that keeps the same muscles away from back-to-back days.
  const n = sessions.length;
  let best = null, bestCost = Infinity;
  for (const perm of permutations([...Array(n).keys()])) {
    let cost = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const diff = dows[j] - dows[i], gap = Math.min(diff, 7 - diff);
      const ov = overlap(sessions[perm[i]].groups, sessions[perm[j]].groups);
      cost += ov * (gap === 1 ? 3 : gap === 2 ? 1 : 0);
    }
    if (cost < bestCost - 1e-9) { bestCost = cost; best = perm; }
  }
  return best.map((si, k) => Object.assign(sessions[si], { dow: dows[k] }));
}
function generatePlan(p) {
  let dows = [...p.days].sort((a, b) => a - b);
  if (dows.length > 6) dows = dows.slice(0, 6);
  if (!dows.length) dows = [0, 2, 4];
  const keys = splitFor(dows.length, p);
  const usedWeek = new Set();
  const seen = {};
  const sessions = keys.map((k) => {
    seen[k] = (seen[k] || 0) + 1;
    const sp = SPLITS[k];
    const title = seen[k] > 1 ? sp.title + ' (Б)' : sp.title;
    const d = buildDay(title, sp.slots, p, usedWeek, NEX[p.exp] || 5);
    if (p.goal === 'lose') {
      const fin = usedWeek.has('mountain') ? EXBY.jacks : EXBY.mountain;
      d.items.push(Object.assign({ ex: fin.id }, prescribe(fin, p)));
      usedWeek.add(fin.id);
    }
    return d;
  });
  const days = assignDays(sessions, dows).sort((a, b) => a.dow - b.dow);
  return { kind: 'plan', days, moves: {}, start: iso(), basis: { goal: p.goal, exp: p.exp, equip: [...p.equip], days: [...p.days] } };
}
function rebuildDayFromGroups(day, p) {
  const n = NEX[p.exp] || 5;
  const lists = day.groups.map((g) => [...(GROUP_PATS[g] || [])]);
  const slots = [];
  while (slots.length < n * 2 && lists.some((l) => l.length)) for (const l of lists) if (l.length) slots.push(l.shift());
  const usedWeek = new Set(S.plan.days.filter((d) => d !== day).flatMap((d) => d.items.map((i) => i.ex)));
  const nd = buildDay(day.title, slots, p, usedWeek, n);
  day.items = nd.items;
}

// ================= schedule =================
const planDay = (id) => S.plan && S.plan.days.find((d) => d.id === id);
function sessionsOn(date, all) {
  const out = [];
  if (!S.plan) return out;
  if (all || date >= S.plan.start) {
    for (const d of S.plan.days) if (d.dow === dowOf(date)) {
      const key = date + '|' + d.id;
      if (!S.plan.moves[key]) out.push({ key, day: d, orig: date, date });
    }
  }
  for (const key in S.plan.moves) {
    const mv = S.plan.moves[key];
    if (mv.s === 'move' && mv.to === date) {
      const d = planDay(key.split('|')[1]);
      if (d) out.push({ key, day: d, orig: key.split('|')[0], date, moved: true });
    }
  }
  return out;
}
function missedSessions() {
  const t = iso(), out = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, -i);
    for (const s of sessionsOn(d)) if (!S.done[s.key]) out.push(s);
  }
  return out;
}
function groupsDoneOn(date) {
  const ss = (S.days[date] && S.days[date].sessions) || {};
  const g = [];
  for (const key in ss) if (sessionStarted(ss[key])) { const d = planDay(key.split('|')[1]); if (d) g.push(...d.groups); }
  return g;
}
function suggestDays(sess) {
  const t = iso(), G = sess.day.groups, opts = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, i);
    const same = sessionsOn(d).filter((s) => s.key !== sess.key);
    let cost = i * 0.35, note = '';
    if (same.length) { cost += 10 + overlap(G, same.flatMap((s) => s.day.groups)) * 4; note = `В этот день уже «${same[0].day.title}»`; }
    let near = 0;
    for (const nd of [addDays(d, -1), addDays(d, 1)]) {
      const gs = nd < t ? groupsDoneOn(nd) : sessionsOn(nd).filter((s) => s.key !== sess.key).flatMap((s) => s.day.groups);
      near += overlap(G, gs);
    }
    cost += near * 2.5;
    if (!note) note = near ? 'Те же мышцы накануне или на следующий день' : 'День отдыха, мышцы успеют восстановиться';
    opts.push({ date: d, cost, note, good: !same.length && !near });
  }
  return opts.sort((a, b) => a.cost - b.cost);
}

// ================= workout records =================
const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);
function updateRecords(date, sets) {
  // sets: { exId: [{w, r, done}] } for one session
  let changed = false;
  for (const exId in sets) {
    const done = sets[exId].filter((x) => x.done && (num(x.r) > 0 || num(x.w) > 0));
    if (!done.length) continue;
    const rec = S.records.ex[exId] || (S.records.ex[exId] = {});
    const list = done.map((x) => [num(x.w) || 0, num(x.r) || 0]);
    if (!rec.last || rec.last.d < date) { if (rec.last) rec.prev = rec.last; rec.last = { d: date, s: list }; }
    else if (rec.last.d === date) rec.last.s = list;
    for (const [w, r] of list) {
      if (!rec.best || w > rec.best.w || (w === rec.best.w && r > rec.best.r)) rec.best = { w, r, d: date };
      const e = e1rm(w, r);
      if (!rec.e1 || e > rec.e1.v) rec.e1 = { v: round(e, 1), d: date };
    }
    changed = true;
  }
  if (changed) saveRecords();
}
function lastPerf(exId, beforeDate) {
  const r = S.records.ex[exId];
  if (!r) return null;
  if (r.last && r.last.d < beforeDate) return r.last;
  if (r.prev && r.prev.d < beforeDate) return r.prev;
  return null;
}

// ================= workout timer & history =================
function sessElapsed(log, now = Date.now()) {
  if (!log || !log.startedAt) return 0;
  const end = log.endedAt || now;
  const paused = (log.pausedMs || 0) + (log.pausedAt && !log.endedAt ? Math.max(0, now - log.pausedAt) : 0);
  return Math.max(0, Math.round((end - log.startedAt - paused) / 1000));
}
const fmtDur = (sec) => { const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60; return hh ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`; };
const fmtDurWords = (sec) => { let hh = Math.floor(sec / 3600), mm = Math.round((sec % 3600) / 60); if (mm === 60) { hh++; mm = 0; } return hh ? (mm ? `${hh} ч ${mm} мин` : `${hh} ч`) : `${Math.max(1, mm)} мин`; };
const fmtClock = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const doneSetsOf = (log) => Object.values((log && log.sets) || {}).flat().filter((x) => x.done).length;
function addHist(date, key, title, log) {
  const h0 = (S.records.hist || []).filter((x) => x.k !== key);
  h0.push({ k: key, d: date, t: title, sec: log.dur || 0, sets: doneSetsOf(log), at: log.endedAt || Date.now() });
  h0.sort((a, b) => a.at - b.at);
  S.records.hist = h0.slice(-400);
  saveRecords();
}
function closeLog(date, key, log, endAt) {
  if (log.pausedAt) { log.pausedMs = (log.pausedMs || 0) + Math.max(0, Math.min(endAt, Date.now()) - log.pausedAt); log.pausedAt = null; }
  log.endedAt = Math.max(endAt, log.startedAt || endAt);
  log.dur = sessElapsed(log);
  if (doneSetsOf(log) || log.done) {
    log.done = true;
    const d = planDay(key.split('|')[1]);
    addHist(date, key, d ? d.title : 'Тренировка', log);
  }
  saveDay(date);
}
function findActive() {
  const open = [];
  for (const date in S.days) for (const key in S.days[date].sessions || {}) {
    const lg = S.days[date].sessions[key];
    if (lg && lg.startedAt && !lg.endedAt) open.push({ date, key, log: lg });
  }
  open.sort((a, b) => b.log.startedAt - a.log.startedAt);
  let closed = 0;
  open.forEach((o, i) => {
    const stale = Date.now() - (o.log.lastAt || o.log.startedAt) > 6 * 3600 * 1000;
    if (i > 0 || stale) { closeLog(o.date, o.key, o.log, o.log.lastAt || o.log.startedAt); closed++; }
  });
  const a = open[0];
  S.active = a && !a.log.endedAt ? { date: a.date, key: a.key } : null;
  return closed;
}
function activeSession() {
  if (!S.active) return null;
  const dd = S.days[S.active.date], log = dd && dd.sessions && dd.sessions[S.active.key];
  if (!log || !log.startedAt || log.endedAt) { S.active = null; return null; }
  const d = planDay(S.active.key.split('|')[1]);
  return { date: S.active.date, key: S.active.key, log, title: d ? d.title : 'Тренировка' };
}

// ================= food totals =================
function dayTotals(date) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const f of (S.days[date] && S.days[date].food) || []) { t.kcal += f.kcal || 0; t.protein += f.protein || 0; t.fat += f.fat || 0; t.carbs += f.carbs || 0; }
  return t;
}
function mealForNow() {
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
}
const MEALS = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекусы' };
const MEALS_TO = { breakfast: 'к завтраку', lunch: 'к обеду', dinner: 'к ужину', snack: 'к перекусам' };
