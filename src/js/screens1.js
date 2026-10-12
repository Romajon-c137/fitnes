// ================= profile form (shared by onboarding and profile editing) =================
function fAbout(d) {
  const name = h('input', { class: 'inp', type: 'text', value: d.name || '', maxlength: '40', autocomplete: 'given-name', oninput: (e) => { d.name = e.target.value; } });
  const age = numInput(d.age || '', { inputmode: 'numeric', oninput: (e) => { d.age = num(e.target.value); } });
  return h('div', { class: 'stack' },
    field('Имя', name),
    field('Возраст', age),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Пол'), h('p', { class: 'hint top' }, 'Нужен, чтобы оценить расход энергии.'),
      chips([['female', 'Женский'], ['male', 'Мужской']], d.sex, (v) => { d.sex = v; })));
}
function fBody(d) {
  const wrap = h('div', { class: 'stack' });
  const draw = () => {
    const imp = d.units === 'imperial';
    const wu = imp ? 'фнт' : 'кг';
    const toDisp = (kg) => (kg == null ? '' : imp ? round(kg * 2.20462, 1) : round(kg, 1));
    const fromDisp = (v) => { const n = num(v); return n == null ? null : imp ? n / 2.20462 : n; };
    let heightEl;
    if (imp) {
      const tin = d.heightCm ? d.heightCm / 2.54 : null;
      let ft = tin ? Math.floor(tin / 12) : '', inch = tin ? Math.round(tin - Math.floor(tin / 12) * 12) : '';
      const upd = () => { const f = num(ft), i = num(inch) || 0; d.heightCm = f ? (f * 12 + i) * 2.54 : null; };
      heightEl = h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Рост'),
        h('div', { class: 'row gap' },
          h('label', { class: 'unitbox' }, numInput(ft, { inputmode: 'numeric', 'aria-label': 'Футы', oninput: (e) => { ft = e.target.value; upd(); } }), h('span', null, 'фт')),
          h('label', { class: 'unitbox' }, numInput(inch, { inputmode: 'numeric', 'aria-label': 'Дюймы', oninput: (e) => { inch = e.target.value; upd(); } }), h('span', null, 'дюйм'))));
    } else {
      heightEl = h('div', { class: 'field' }, h('label', { for: 'f-h' }, 'Рост'),
        h('label', { class: 'unitbox' }, numInput(d.heightCm ? round(d.heightCm) : '', { id: 'f-h', inputmode: 'numeric', oninput: (e) => { d.heightCm = num(e.target.value); } }), h('span', null, 'см')));
    }
    const wIn = (key, label, hint) => h('div', { class: 'field' }, h('label', { for: 'f-' + key }, label),
      h('label', { class: 'unitbox' }, numInput(toDisp(d[key]), { id: 'f-' + key, oninput: (e) => { d[key] = fromDisp(e.target.value); } }), h('span', null, wu)),
      hint ? h('div', { class: 'hint' }, hint) : null);
    wrap.replaceChildren(...[
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Единицы'), chips([['metric', 'кг, см'], ['imperial', 'фунты, футы']], d.units || 'metric', (v) => { d.units = v; draw(); })),
      heightEl,
      d.isEdit ? null : wIn('startKg', 'Текущий вес'),
      wIn('targetKg', 'Целевой вес')].filter(Boolean));
  };
  draw();
  return wrap;
}
function fGoal(d) {
  return h('div', { class: 'stack' }, choiceList(Object.entries(GOALS).map(([k, v]) => [k, v.label, v.hint]), d.goal, (v) => { d.goal = v; }));
}
function fActivity(d) {
  return h('div', { class: 'stack' },
    h('h3', { class: 'sub' }, 'Активность вне тренировок'),
    choiceList(Object.entries(ACTIVITY).map(([k, v]) => [k, v.label, v.hint]), d.activity, (v) => { d.activity = v; }),
    h('h3', { class: 'sub' }, 'Опыт тренировок'),
    choiceList(Object.entries(EXP).map(([k, v]) => [k, v.label, v.hint]), d.exp, (v) => { d.exp = v; }));
}
function fTraining(d) {
  const eqWrap = h('div');
  const drawEq = () => eqWrap.replaceChildren(chips(Object.entries(EQUIP), d.equip, (v) => { d.equip = v; }, { multi: true }));
  drawEq();
  const preset = (list) => () => { d.equip = list; drawEq(); };
  return h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Дни тренировок'), h('p', { class: 'hint top' }, 'Выберите дни, когда можете тренироваться. Большинству подходит 3–5 дней.'),
      chips(DOW3.map((x, i) => [i, x]), d.days, (v) => { d.days = v.sort((a, b) => a - b); }, { multi: true })),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Доступное оборудование'),
      h('div', { class: 'row wrap gap-s presets' },
        h('button', { type: 'button', class: 'link', onclick: preset(Object.keys(EQUIP)) }, 'Полный зал'),
        h('button', { type: 'button', class: 'link', onclick: preset(['dumbbells', 'bench']) }, 'Дом с гантелями'),
        h('button', { type: 'button', class: 'link', onclick: preset([]) }, 'Без инвентаря')),
      eqWrap,
      h('div', { class: 'hint' }, 'Упражнения с собственным весом добавляются всегда.')));
}
function validateProfile(d, parts) {
  if (parts.includes('about')) {
    if (!d.name || !d.name.trim()) return 'Введите имя.';
    if (!d.age || d.age < 13 || d.age > 100 || !Number.isInteger(d.age)) return 'Введите возраст от 13 до 100 лет.';
    if (!d.sex) return 'Выберите пол: он нужен для расчёта расхода энергии.';
  }
  if (parts.includes('body')) {
    if (!d.heightCm || d.heightCm < 120 || d.heightCm > 230) return 'Введите рост от 120 до 230 см.';
    if (!d.isEdit && (!d.startKg || d.startKg < 30 || d.startKg > 300)) return 'Введите текущий вес.';
    if (!d.targetKg || d.targetKg < 30 || d.targetKg > 300) return 'Введите целевой вес.';
    const min = healthyMinKg(d.heightCm);
    if (d.targetKg < min - 0.05) return `Целевой вес должен быть не меньше ${fmtWd(min, d)}: это нижняя граница здорового веса для вашего роста.`;
  }
  if (parts.includes('goal') && !d.goal) return 'Выберите главную цель.';
  if (parts.includes('activity')) { if (!d.activity) return 'Выберите уровень активности.'; if (!d.exp) return 'Выберите опыт тренировок.'; }
  if (parts.includes('training')) {
    if (!d.days || !d.days.length) return 'Выберите хотя бы один день тренировок.';
    if (d.days.length > 6) return 'Выберите не больше 6 дней. Хотя бы один день отдыха в неделю нужен для восстановления.';
  }
  return null;
}
const fmtWd = (kg, d) => (d.units === 'imperial' ? `${dc(round(kg * 2.20462, 1))} фнт` : `${dc(round(kg, 1))} кг`);

// ================= onboarding =================
const OB = { step: 0, err: '', d: { name: '', age: null, sex: '', units: 'metric', heightCm: null, startKg: null, targetKg: null, goal: '', activity: '', exp: '', days: [0, 2, 4], equip: ['dumbbells', 'bench'] } };
function renderOnboarding() {
  const d = OB.d;
  const steps = [
    { t: 'О вас', p: 'По этим данным составятся тренировки и дневные нормы питания.', b: () => fAbout(d), v: ['about'] },
    { t: 'Параметры тела', p: 'Их можно изменить в любой момент в профиле.', b: () => fBody(d), v: ['body'] },
    { t: 'Главная цель', p: 'От неё зависят калории, белок и объём тренировок.', b: () => fGoal(d), v: ['goal'] },
    { t: 'Активность и опыт', p: null, b: () => fActivity(d), v: ['activity'] },
    { t: 'Тренировки', p: null, b: () => fTraining(d), v: ['training'] },
    { t: 'Ваш план', p: null, b: () => obSummary(d), v: [] },
  ];
  const st = steps[OB.step];
  const next = () => {
    const e = validateProfile(d, st.v);
    if (e) { OB.err = e; rerender(); return; }
    OB.err = '';
    if (OB.step === steps.length - 1) return finishOnboarding();
    OB.step++; rerender(); window.scrollTo(0, 0);
  };
  const rerender = () => $('#view').replaceChildren(renderOnboarding());
  return h('div', { class: 'onb-wrap' },
    h('div', { class: 'onb-top' },
      OB.step > 0 ? ib('back', 'Назад', () => { OB.step--; OB.err = ''; rerender(); }) : h('span', { class: 'brand' }, 'Rep'),
      h('div', { class: 'steps', 'aria-label': `Шаг ${OB.step + 1} из ${steps.length}` }, steps.map((_, i) => h('span', { class: i <= OB.step ? 'on' : '' })))),
    h('h1', { class: 'title' }, st.t),
    st.p ? h('p', { class: 'lead' }, st.p) : null,
    st.b(),
    OB.err ? errorText(OB.err) : null,
    h('div', { class: 'onb-foot' }, h('button', { class: 'btn primary wide', type: 'button', onclick: next }, OB.step === steps.length - 1 ? 'Создать план' : 'Продолжить')));
}
function obSummary(d) {
  const p = Object.assign({}, d, { units: d.units });
  const T = targets(p, d.startKg);
  const plan = generatePlan(p);
  OB.preview = plan;
  const notes = [];
  if (d.goal === 'lose' && d.targetKg >= d.startKg) notes.push('Целевой вес не ниже текущего. Нормы для снижения веса всё равно применятся; цель или целевой вес можно поменять позже.');
  if (d.goal === 'gain' && d.targetKg < d.startKg) notes.push('Целевой вес ниже текущего, а цель — набор массы. Одно из двух можно поменять в профиле.');
  if (T.teen) notes.push('До 18 лет нормы калорий мягче обычных. Прежде чем менять питание, посоветуйтесь с врачом или тренером.');
    return h('div', { class: 'stack' },
    h('div', { class: 'summary-k' },
      h('div', null, h('span', { class: 'big' }, fmtN(T.kcal)), h('span', { class: 'unit' }, 'ккал в день')),
      h('div', { class: 'macros3' },
        macroMini('Белки', T.protein, 'blue'), macroMini('Углеводы', T.carbs, 'green'), macroMini('Жиры', T.fat, 'yellow'))),
    h('p', { class: 'muted small' }, T.change === 0 ? 'Это ваш расчётный уровень поддержания веса.' : T.change > 0 ? `Примерно на ${fmtN(T.change)} ккал выше расчётного поддержания (${fmtN(T.tdee)} ккал).` : `Примерно на ${fmtN(-T.change)} ккал ниже расчётного поддержания (${fmtN(T.tdee)} ккал).`),
    h('h3', { class: 'sub' }, `План на неделю: ${pln(plan.days.length, 'день', 'дня', 'дней')}`),
    h('ul', { class: 'plainlist' }, plan.days.map((x) => h('li', null, h('span', { class: 'dow' }, DOW3[x.dow]), h('span', null, x.title), h('span', { class: 'muted' }, pln(x.items.length, 'упражнение', 'упражнения', 'упражнений'))))),
    notes.map((n) => h('p', { class: 'note' }, n)),
    h('p', { class: 'muted small' }, `Вес указывается в ${d.units === 'imperial' ? 'фунтах' : 'килограммах'}. Расчёты — отправная точка, а не медицинская рекомендация.`));
}
function macroMini(label, g, color) {
  return h('div', { class: 'mm', style: `--c:var(--${color})` }, h('span', { class: 'mm-v' }, fmtN(g), h('small', null, ' г')), h('span', { class: 'mm-l' }, label));
}
function finishOnboarding() {
  const d = OB.d;
  S.profile = { kind: 'profile', name: d.name.trim(), age: d.age, sex: d.sex, units: d.units, heightCm: round(d.heightCm, 1), startKg: round(d.startKg, 2), targetKg: round(d.targetKg, 2), goal: d.goal, activity: d.activity, exp: d.exp, days: d.days, equip: d.equip, created: iso() };
  S.plan = OB.preview || generatePlan(S.profile);
  S.weights.entries = [{ d: iso(), kg: S.profile.startKg }];
  saveProfile(); savePlan(); saveWeights();
  S.tab = 'home';
  render();
}

// ================= home =================
SCREENS.home = () => {
  const p = S.profile, today = iso(), T = targets(), tot = dayTotals(today), kg = currentWeight();
  const startKg = S.weights.entries.length ? S.weights.entries[0].kg : p.startKg;
  const span = startKg - p.targetKg;
  const prog = Math.abs(span) < 0.05 ? 1 : clamp((startKg - kg) / span, 0, 1);
  const left = Math.abs(kg - p.targetKg);
  const reached = left < 0.25 || (span > 0 ? kg <= p.targetKg : span < 0 ? kg >= p.targetKg : true);
  const out = h('div', { class: 'screen home' },
    h('header', { class: 'top' }, h('p', { class: 'muted' }, fmtDate(today)), h('h1', { class: 'title' }, `Привет, ${p.name}`)),
    h('section', { class: 'blk weight' },
      h('button', { class: 'wt', type: 'button', onclick: () => openLogWeight(), 'aria-label': 'Записать вес' },
        h('span', { class: 'wt-now' }, U.ws(kg), h('small', null, U.wu())),
        h('span', { class: 'wt-to' }, h('span', { class: 'muted' }, 'Цель'), ` ${fmtW(p.targetKg)}`)),
      h('div', { class: 'track', role: 'img', 'aria-label': `Путь к цели: ${Math.round(prog * 100)}%` }, h('div', { class: 'track-f', style: `transform:scaleX(${prog})` })),
      h('div', { class: 'row between' },
        h('span', { class: 'muted small' }, reached ? 'Цель достигнута' : `Осталось ${U.ws(left)} ${U.wu()}`),
        h('button', { class: 'link', type: 'button', onclick: () => openLogWeight() }, 'Записать вес'))),
    h('section', { class: 'blk' },
      metricRow('Калории', `${fmtN(tot.kcal)}`, `/ ${fmtN(T.kcal)} ккал`, tot.kcal, T.kcal, 'red'),
      metricRow('Белок', `${fmtN(tot.protein)}`, `/ ${fmtN(T.protein)} г`, tot.protein, T.protein, 'blue')),
    todayWorkoutRow());
  if (!S.askedMissed) {
    S.askedMissed = true;
    const m = missedSessions();
    if (m.length) setTimeout(() => { if (S.tab === 'home' && !currentSheet) openMissed(); }, 450);
  }
  return out;
};
function metricRow(label, v, of, val, max, color) {
  return h('button', { class: 'metric', type: 'button', onclick: () => go('nutrition') },
    h('div', { class: 'row between base' }, h('span', { class: 'm-l' }, label), h('span', { class: 'm-v' }, h('b', null, v), h('span', { class: 'muted' }, ' ' + of))),
    bar(val, max, color));
}
function todayWorkoutRow() {
  const today = iso(), ss = sessionsOn(today);
  const pending = ss.find((s) => !S.done[s.key]);
  let main, sub, act = null;
  if (pending) {
    main = pending.day.title;
    sub = `Сегодня, ${pln(pending.day.items.length, 'упражнение', 'упражнения', 'упражнений')}`;
    act = () => go('workouts', { session: pending.key, date: today });
  } else if (ss.length) {
    main = ss[0].day.title; sub = 'Выполнено сегодня'; act = () => go('workouts', { session: ss[0].key, date: today });
  } else {
    let nx = null;
    for (let i = 1; i <= 7 && !nx; i++) { const d = addDays(today, i); const s = sessionsOn(d)[0]; if (s) nx = { s, d }; }
    main = 'День отдыха'; sub = nx ? `Далее: ${nx.s.day.title}, ${relDay(nx.d).toLowerCase()}` : 'Тренировок не запланировано';
    act = () => go('workouts');
  }
  return h('button', { class: 'today' + (pending ? ' go' : ''), type: 'button', onclick: act },
    h('span', { class: 'today-t' }, h('span', { class: 'today-s' }, sub), h('span', { class: 'today-m' }, main)),
    h('span', { class: 'today-a', html: icon(pending ? 'play' : ss.length ? 'check' : 'next') }));
}

// ================= missed workouts =================
function openMissed() {
  const list = missedSessions();
  if (!list.length) return;
  const s = list[0];
  const opts = suggestDays(s).slice(0, 3);
  let pick = opts[0].date;
  const optWrap = h('div', { class: 'choices' });
  const drawOpts = () => optWrap.replaceChildren(...opts.map((o) => h('button', { type: 'button', class: 'choice' + (o.date === pick ? ' on' : ''), role: 'radio', 'aria-checked': o.date === pick ? 'true' : 'false', onclick: () => { pick = o.date; drawOpts(); } },
    h('span', { class: 'choice-l' }, relDay(o.date) + (o === opts[0] ? ' (рекомендуем)' : '')), h('span', { class: 'choice-h' }, o.note))));
  drawOpts();
  const after = () => { savePlan(); sheet.close(true); render({ keepScroll: true }); if (missedSessions().length) setTimeout(openMissed, 250); };
  const sheet = openSheet('Пропущенная тренировка', h('div', { class: 'stack' },
    h('p', { class: 'lead' }, `Вы пропустили тренировку «${s.day.title}» ${relDay(s.date) === 'Вчера' ? 'вчера' : fmtDate(s.date)}. Перенести её или пропустить?`),
    h('h3', { class: 'sub' }, 'Перенести на'),
    optWrap,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { S.plan.moves[s.key] = { s: 'skip' }; toast('Тренировка пропущена'); after(); } }, 'Пропустить'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { S.plan.moves[s.key] = { s: 'move', to: pick }; toast(`Перенесено на ${relDay(pick) === 'Сегодня' ? 'сегодня' : relDay(pick) === 'Завтра' ? 'завтра' : DOW_ACC[dowOf(pick)]}`); after(); } }, 'Перенести')),
    list.length > 1 ? h('button', { class: 'link center', type: 'button', onclick: () => { for (const x of list) S.plan.moves[x.key] = { s: 'skip' }; toast(`Пропущено тренировок: ${list.length}`); savePlan(); sheet.close(true); render({ keepScroll: true }); } }, `Пропустить все (${list.length})`) : null));
}

// ================= workouts: week =================
SCREENS.workouts = () => {
  if (S.route && S.route.session) return renderSession(S.route);
  if (S.route === 'edit') return renderEditPlan();
  const today = iso(), off = S.weekOff || 0;
  const ws = addDays(addDays(today, -dowOf(today)), off * 7);
  const p = S.profile, n = S.plan.days.length;
  const missed = missedSessions();
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), ss = sessionsOn(d, true), isToday = d === today, pre = d < S.plan.start;
    const gone = S.plan.days.filter((x) => x.dow === i && S.plan.moves[d + '|' + x.id]).map((x) => ({ day: x, mv: S.plan.moves[d + '|' + x.id] }));
    for (const g of gone) rows.push(h('li', { class: 'wk rest' + (isToday ? ' now' : '') }, h('span', { class: 'wk-d' }, h('b', null, DOW3[i]), h('small', null, parseISO(d).getDate())),
      h('span', { class: 'wk-t muted' }, h('span', null, g.day.title), h('span', { class: 'wk-s' }, g.mv.s === 'skip' ? 'Пропущена' : `Перенесена на ${relDay(g.mv.to) === 'Сегодня' ? 'сегодня' : fmtDate(g.mv.to)}`))));
    if (!ss.length && gone.length) continue;
    if (!ss.length) { rows.push(h('li', { class: 'wk rest' + (isToday ? ' now' : '') }, h('span', { class: 'wk-d' }, h('b', null, DOW3[i]), h('small', null, parseISO(d).getDate())), h('span', { class: 'wk-t muted' }, 'Отдых'))); continue; }
    for (const s of ss) {
      const done = !!S.done[s.key], past = d < today;
      const status = done ? 'done' : past && !pre ? 'missed' : isToday ? 'today' : '';
      const stLabel = { done: 'Готово', missed: 'Пропущена', today: 'Сегодня' }[status];
      rows.push(h('li', { class: 'wk' + (isToday ? ' now' : '') + (done ? ' done' : '') },
        h('button', { type: 'button', class: 'wk-b', onclick: () => go('workouts', { session: s.key, date: d }) },
          h('span', { class: 'wk-d' }, h('b', null, DOW3[i]), h('small', null, parseISO(d).getDate())),
          h('span', { class: 'wk-t' }, h('span', { class: 'wk-n' }, s.day.title), h('span', { class: 'wk-s muted' }, pln(s.day.items.length, 'упражнение', 'упражнения', 'упражнений') + (s.moved ? ', перенесена' : '') + durOf(s.key))),
          status ? h('span', { class: 'tag st-' + status }, done ? h('span', { html: icon('check', 'ic s') }) : null, stLabel) : h('span', { html: icon('next', 'ic s muted') }))));
    }
  }
  const range = `${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}`;
  return h('div', { class: 'screen' },
    h('header', { class: 'top' }, h('h1', { class: 'title' }, 'Тренировки'), h('p', { class: 'muted' }, `${pln(n, 'день', 'дня', 'дней')} в неделю, цель: ${GOALS[p.goal].label.toLowerCase()}`)),
    weekSummary(ws),
    missed.length ? h('button', { class: 'banner', type: 'button', onclick: openMissed }, h('span', null, missed.length === 1 ? `Пропущена тренировка «${missed[0].day.title}».` : `Пропущено тренировок: ${missed.length}.`), h('b', null, 'Перенести или пропустить')) : null,
    h('div', { class: 'weeknav' },
      ib('back', 'Предыдущая неделя', () => { S.weekOff = off - 1; render(); }),
      h('span', null, off === 0 ? 'Эта неделя' : off === 1 ? 'Следующая неделя' : off === -1 ? 'Прошлая неделя' : range),
      ib('next', 'Следующая неделя', () => { S.weekOff = off + 1; render(); })),
    h('ul', { class: 'week' }, rows),
    h('div', { class: 'row gap mt' },
      h('button', { class: 'btn soft', type: 'button', onclick: () => go('workouts', 'edit') }, h('span', { html: icon('edit') }), 'Изменить план'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => confirmSheet('Пересоздать план?', 'Будет составлен новый план на неделю по вашей цели, опыту, дням и оборудованию. Записанные тренировки сохранятся.', 'Пересоздать', () => { S.plan = generatePlan(S.profile); savePlan(); toast('Новый план готов'); render(); }) }, 'Новый план')));
};

function durOf(key) {
  const date = S.done[key], lg = date && S.days[date] && S.days[date].sessions && S.days[date].sessions[key];
  if (lg && lg.startedAt && !lg.endedAt) return ', идёт сейчас';
  return lg && lg.dur ? `, ${fmtDurWords(lg.dur)}` : '';
}
function histTotals(from) {
  const list = (S.records.hist || []).filter((x) => !from || x.d >= from);
  return { n: list.length, sec: list.reduce((a, x) => a + (x.sec || 0), 0) };
}
function weekSummary(ws) {
  if (!(S.records.hist || []).length) return null;
  const t = histTotals(addDays(iso(), -dowOf(iso())));
  return h('button', { class: 'wsum', type: 'button', onclick: openHistory },
    h('span', { class: 'wsum-t' }, h('span', { class: 'muted small' }, 'На этой неделе'),
      h('b', null, t.n ? `${pln(t.n, 'тренировка', 'тренировки', 'тренировок')}${t.sec ? ', ' + fmtDurWords(t.sec) : ''}` : 'Пока без тренировок')),
    h('span', { class: 'link' }, 'История'));
}
function openHistory() {
  const today = iso(), d = parseISO(today);
  const week = histTotals(addDays(today, -dowOf(today))), month = histTotals(iso(new Date(d.getFullYear(), d.getMonth(), 1))), all = histTotals(null);
  const card = (label, t) => h('div', null, h('span', { class: 'muted small' }, label), h('b', null, t.sec ? fmtDurWords(t.sec) : '—'), h('span', { class: 'muted small' }, pln(t.n, 'тренировка', 'тренировки', 'тренировок')));
  const list = (S.records.hist || []).slice().sort((a, b) => b.at - a.at);
  const timed = list.filter((x) => x.sec);
  const avg = timed.length ? Math.round(timed.reduce((a, x) => a + x.sec, 0) / timed.length) : 0;
  openSheet('История тренировок', h('div', { class: 'stack' },
    h('div', { class: 'htot' }, card('Эта неделя', week), card('Этот месяц', month), card('Всего', all)),
    avg ? h('p', { class: 'muted small' }, `Средняя тренировка длится ${fmtDurWords(avg)}.`) : null,
    list.length ? h('ul', { class: 'kv hist' }, list.slice(0, 80).map((x) => h('li', null,
      h('span', { class: 'hist-t' }, h('b', null, x.t), h('span', { class: 'muted small' }, `${fmtDate(x.d)}${x.sets ? ', ' + pln(x.sets, 'подход', 'подхода', 'подходов') : ''}`)),
      h('span', null, x.sec ? fmtDurWords(x.sec) : 'без таймера')))) : h('p', { class: 'muted' }, 'Здесь появятся завершённые тренировки и их длительность.')), { tall: true });
}

// ================= workouts: session =================
function prescriptionText(it) {
  const ex = EXBY[it.ex];
  const rest = fmtRest(it.rest);
  return `${pln(it.sets, 'подход', 'подхода', 'подходов')} по ${it.reps}${ex && ex.time ? '' : ''}, отдых ${rest}`;
}
function perfText(exId, date) {
  const last = lastPerf(exId, date), rec = S.records.ex[exId], ex = EXBY[exId], parts = [];
  if (last) {
    const s = last.s;
    const sameW = s.every((x) => x[0] === s[0][0]);
    if (ex.time) parts.push(`В прошлый раз: ${s.map((x) => x[1] + ' с').join(', ')}`);
    else if (sameW && s[0][0] > 0) parts.push(`В прошлый раз: ${U.lift(s[0][0])} ${U.wu()} × ${s.map((x) => x[1]).join(', ')}`);
    else parts.push(`В прошлый раз: ${s.map((x) => (x[0] > 0 ? `${U.lift(x[0])}×${x[1]}` : `${x[1]}`)).join('; ')}`);
  }
  if (rec && rec.best && !ex.time) parts.push(rec.best.w > 0 ? `Рекорд: ${U.lift(rec.best.w)} ${U.wu()} × ${rec.best.r}` : `Рекорд: ${pln(rec.best.r, 'повтор', 'повтора', 'повторов')}`);
  return parts;
}
function renderSession(route) {
  const today = iso(), date = route.date;
  const s = sessionsOn(date, true).find((x) => x.key === route.session);
  const back = h('div', { class: 'subbar' }, h('button', { class: 'backbtn', type: 'button', onclick: () => go('workouts') }, h('span', { html: icon('back') }), 'Тренировки'));
  if (!s) return h('div', { class: 'screen' }, back, h('p', { class: 'lead' }, 'Этой тренировки больше нет в плане.'));
  const day = s.day, future = date > today;
  const existing = S.days[date] && S.days[date].sessions && S.days[date].sessions[s.key];
  const log = existing || { sets: {}, done: false };
  const ensure = () => { const dd = dayDoc(date); if (!dd.sessions[s.key]) dd.sessions[s.key] = log; return log; };
  const persist = debounce(() => { ensure(); saveDay(date); }, 500);
  const canTime = date === today;
  const startTimer = () => {
    const prev = activeSession();
    if (prev && prev.key !== s.key) { closeLog(prev.date, prev.key, prev.log, prev.log.lastAt || Date.now()); toast(`Тренировка «${prev.title}» завершена автоматически`); }
    ensure(); log.startedAt = Date.now(); log.pausedMs = 0; log.pausedAt = null; delete log.endedAt; delete log.dur;
    saveDay(date); S.active = { date, key: s.key }; Live.ensure();
  };
  const togglePause = () => {
    const now = Date.now();
    if (log.pausedAt) { log.pausedMs = (log.pausedMs || 0) + (now - log.pausedAt); log.pausedAt = null; } else log.pausedAt = now;
    saveDay(date); Live.tick();
  };
  const timerBox = h('div', { class: 'stimer' });
  const drawTimer = () => {
    const running = !!(log.startedAt && !log.endedAt), paused = running && !!log.pausedAt;
    if (!canTime && !log.startedAt) { timerBox.hidden = true; return; }
    timerBox.hidden = false;
    const label = log.endedAt ? `Длительность, ${fmtClock(log.startedAt)}–${fmtClock(log.endedAt)}` : running ? (paused ? 'На паузе' : 'Идёт тренировка') : 'Время тренировки';
    const clock = h('span', { class: 'stimer-c', id: running ? 'sess-clock' : null }, fmtDur(sessElapsed(log)));
    let acts = null;
    if (!log.startedAt && canTime) acts = h('button', { class: 'btn primary', type: 'button', onclick: () => { startTimer(); drawTimer(); } }, h('span', { html: icon('play') }), 'Начать');
    else if (running) acts = h('div', { class: 'row gap-s' },
      h('button', { class: 'btn soft sq', type: 'button', 'aria-label': paused ? 'Продолжить' : 'Пауза', onclick: () => { togglePause(); drawTimer(); }, html: icon(paused ? 'play' : 'pause') }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => finish() }, 'Завершить'));
    timerBox.className = 'stimer' + (running ? ' on' : '') + (paused ? ' paused' : '') + (log.endedAt ? ' ended' : '');
    timerBox.replaceChildren(...[h('div', { class: 'stimer-l' }, h('span', { class: 'stimer-s' }, label), clock), acts,
      !log.startedAt && canTime ? h('p', { class: 'stimer-h' }, 'Таймер запустится и сам, когда вы отметите первый подход.') : null].filter(Boolean));
  };
  const countEl = h('span', { class: 'muted' });
  const updateCount = () => {
    let total = 0, done = 0;
    day.items.forEach((it) => { const arr = log.sets[it.ex] || []; const n = Math.max(it.sets, arr.length); total += n; done += arr.filter((x) => x.done).length; });
    countEl.textContent = `Выполнено подходов: ${done} из ${total}`;
  };
  const blocks = day.items.map((it, idx) => {
    const ex = EXBY[it.ex];
    if (!ex) return null;
    const arr = log.sets[it.ex] || (log.sets[it.ex] = []);
    const last = lastPerf(it.ex, date);
    const lowRep = parseInt(String(it.reps), 10) || '';
    const tbody = h('div', { class: 'sets' });
    const drawRows = () => {
      const n = Math.max(it.sets, arr.length);
      while (arr.length < n) arr.push({ w: '', r: '', done: false });
      tbody.replaceChildren(
        h('div', { class: 'set hd' }, h('span', null, 'Подход'), h('span', null, ex.time ? '' : ex.bw ? `+${U.wu()}` : U.wu()), h('span', null, ex.time ? 'сек' : 'повт.'), h('span', { class: 'sr' }, 'Выполнено')),
        ...arr.map((st, i) => {
          const lw = last && last.s[Math.min(i, last.s.length - 1)];
          const wIn = ex.time ? h('span') : numInput(st.w === '' ? '' : U.lift(st.w), { class: 'inp sm', placeholder: i > 0 && arr[i - 1].w !== '' && arr[i - 1].w != null ? U.lift(arr[i - 1].w) : lw && lw[0] > 0 ? U.lift(lw[0]) : ex.bw ? '0' : '–', 'aria-label': `Вес, подход ${i + 1}`, disabled: future,
            oninput: (e) => { st.w = U.wIn(e.target.value) ?? ''; persist(); const nx = tbody.querySelectorAll('.set:not(.hd)')[i + 1]; if (nx && arr[i + 1] && (arr[i + 1].w === '' || arr[i + 1].w == null)) { const ni = nx.querySelector('input'); if (ni) ni.placeholder = e.target.value || ni.placeholder; } } });
          const rIn = numInput(st.r, { class: 'inp sm', inputmode: 'numeric', placeholder: lw ? String(lw[1]) : String(lowRep), 'aria-label': `${ex.time ? 'Секунды' : 'Повторы'}, подход ${i + 1}`, disabled: future,
            oninput: (e) => { st.r = num(e.target.value) ?? ''; persist(); } });
          const chk = h('button', { type: 'button', class: 'chk' + (st.done ? ' on' : ''), 'aria-pressed': st.done ? 'true' : 'false', 'aria-label': `Отметить подход ${i + 1}`, disabled: future, html: icon('check'),
            onclick: () => {
              st.done = !st.done;
              if (st.done) {
                if (!log.startedAt && canTime) { startTimer(); drawTimer(); }
                log.lastAt = Date.now();
                if (st.r === '' || st.r == null) st.r = num(rIn.placeholder) || lowRep || '';
                if (!ex.time && (st.w === '' || st.w == null)) { if (i > 0 && arr[i - 1].w !== '' && arr[i - 1].w != null) st.w = arr[i - 1].w; else if (lw && lw[0] > 0) st.w = lw[0]; }
                if (!ex.time) wIn.value = st.w === '' ? '' : U.lift(st.w);
                rIn.value = st.r;
                Rest.start(it.rest || 60);
              }
              chk.classList.toggle('on', st.done); chk.setAttribute('aria-pressed', st.done ? 'true' : 'false');
              row.classList.toggle('isdone', st.done);
              ensure(); saveDay(date); S.done[s.key] = date;
              if (!sessionStarted(log)) delete S.done[s.key];
              updateRecords(date, log.sets); updateCount();
            } });
          const row = h('div', { class: 'set' + (st.done ? ' isdone' : '') }, h('span', { class: 'set-n' }, i + 1), wIn, rIn, chk);
          return row;
        }));
    };
    drawRows();
    const perf = perfText(it.ex, date);
    return h('section', { class: 'exb' },
      h('button', { class: 'exh', type: 'button', onclick: () => openExercise(it.ex, it, date) },
        figStill(ex.anim, 1, 'thumb', ex.m),
        h('span', { class: 'exh-t' }, h('span', { class: 'exh-n' }, `${idx + 1}. ${ex.name}`), h('span', { class: 'muted small' }, prescriptionText(it)), perf.map((x) => h('span', { class: 'perf small' }, x))),
        h('span', { class: 'exh-i', html: icon('video', 'ic s') })),
      tbody,
      future ? null : h('button', { class: 'link addset', type: 'button', onclick: () => { arr.push({ w: '', r: '', done: false }); drawRows(); updateCount(); } }, '+ Добавить подход'));
  });
  updateCount();
  const finish = () => {
    const now = Date.now(), running = !!(log.startedAt && !log.endedAt);
    const done = (endAt) => {
      ensure(); log.done = true;
      if (running) closeLog(date, s.key, log, endAt); else { saveDay(date); addHist(date, s.key, day.title, log); }
      S.done[s.key] = date; updateRecords(date, log.sets);
      if (S.active && S.active.key === s.key) S.active = null;
      Rest.stop(); Live.tick();
      const n = doneSetsOf(log);
      toast(log.dur ? `Тренировка завершена за ${fmtDurWords(log.dur)}${n ? ', ' + pln(n, 'подход', 'подхода', 'подходов') : ''}` : n ? `Тренировка сохранена: ${pln(n, 'подход', 'подхода', 'подходов')}` : 'Тренировка отмечена как выполненная');
      go('workouts');
    };
    if (running && log.lastAt && now - log.lastAt > 30 * 60000) {
      const toLast = sessElapsed(Object.assign({}, log, { endedAt: log.lastAt })), toNow = sessElapsed(log, now);
      const sh = openSheet('Когда закончилась тренировка?', h('div', { class: 'stack' },
        h('p', { class: 'lead' }, `Последний подход отмечен в ${fmtClock(log.lastAt)}, с тех пор прошло больше 30 минут. Какое время записать?`),
        h('button', { class: 'btn primary wide', type: 'button', onclick: () => { sh.close(true); done(log.lastAt); } }, `До последнего подхода (${fmtDurWords(toLast)})`),
        h('button', { class: 'btn ghost wide', type: 'button', onclick: () => { sh.close(true); done(now); } }, `До текущего момента (${fmtDurWords(toNow)})`)));
      return;
    }
    done(now);
  };
  drawTimer();
  return h('div', { class: 'screen session' },
    back,
    h('header', { class: 'top' }, h('p', { class: 'muted' }, relDay(date) === 'Сегодня' ? `Сегодня, ${fmtDate(date)}` : fmtDate(date)), h('h1', { class: 'title' }, day.title), countEl),
    timerBox,
    future ? h('div', { class: 'note row between' }, h('span', null, `Запланирована на ${DOW_ACC[dowOf(date)]}.`), h('button', { class: 'link', type: 'button', onclick: () => { S.plan.moves[s.key] = { s: 'move', to: today }; savePlan(); go('workouts', { session: s.key, date: today }); } }, 'Сделать сегодня')) : null,
    blocks,
    future ? null : h('button', { class: 'btn primary wide mt', type: 'button', onclick: finish }, log.done ? 'Сохранить тренировку' : 'Завершить тренировку'));
}

// ================= exercise detail =================
function openExercise(exId, item, date) {
  const ex = EXBY[exId], an = ANIMS[ex.anim];
  const rx = item || prescribe(ex, S.profile);
  const rec = S.records.ex[exId], last = lastPerf(exId, date || addDays(iso(), 1));
  const eqText = ex.eq[0].length ? 'Нужно: ' + ex.eq.map((s) => s.map((k) => EQUIP[k].toLowerCase()).join(' + ')).join(' или ') : 'Без инвентаря';
  const hist = [];
  if (last) hist.push(h('li', null, h('span', null, `Прошлая тренировка, ${fmtShort(last.d)}`), h('span', null, last.s.map((x) => (ex.time ? `${x[1]} с` : x[0] > 0 ? `${U.lift(x[0])}×${x[1]}` : `${x[1]}`)).join('; '))));
  if (rec && rec.best && !ex.time) hist.push(h('li', null, h('span', null, 'Личный рекорд'), h('span', null, rec.best.w > 0 ? `${U.lift(rec.best.w)} ${U.wu()} × ${rec.best.r}` : pln(rec.best.r, 'повтор', 'повтора', 'повторов'))));
  if (rec && rec.e1 && rec.e1.v > 0 && !ex.bw) hist.push(h('li', null, h('span', null, 'Расчётный разовый максимум'), h('span', null, `${U.lift(round(rec.e1.v, 1))} ${U.wu()}`)));
  const twoStills = an.ill && an.ill[0] !== an.ill[1];
  const mnames = (list) => list.map((k) => MUSCLES[k]).join(', ');
  openSheet(ex.name, h('div', { class: 'stack exd' },
    h('figure', { class: 'demo' }, REP3D.supports(exId) ? player3d(exId, ex) : figPlayer(ex.anim, ex.m), h('figcaption', { class: 'muted small' }, 'Анимация техники. Нажмите, чтобы остановить.')),
    h('div', { class: 'mleg' },
      h('div', null, h('span', { class: 'mdot m1', 'aria-hidden': 'true' }), h('span', null, h('b', null, 'Основная нагрузка: '), mnames(ex.m.p))),
      ex.m.s.length ? h('div', null, h('span', { class: 'mdot m2', 'aria-hidden': 'true' }), h('span', null, h('b', null, 'Помогают: '), mnames(ex.m.s))) : null,
      h('div', { class: 'muted small' }, eqText + '.')),
    twoStills ? h('div', { class: 'stills' },
      h('figure', null, figStill(ex.anim, 0, 'still', ex.m), h('figcaption', null, 'Начало')),
      h('figure', null, figStill(ex.anim, 1, 'still', ex.m), h('figcaption', null, 'Конец'))) : null,
    h('div', { class: 'rx' }, h('div', null, h('span', { class: 'muted small' }, 'Рекомендуем'), h('b', null, `${rx.sets} × ${rx.reps}`)), h('div', null, h('span', { class: 'muted small' }, 'Отдых'), h('b', null, fmtRest(rx.rest)))),
    h('h3', { class: 'sub' }, 'Техника выполнения'),
    h('ol', { class: 'steps-l' }, ex.steps.map((x) => h('li', null, x))),
    h('p', { class: 'tip' }, ex.tip),
    h('h3', { class: 'sub' }, 'Ваша история'),
    hist.length ? h('ul', { class: 'kv' }, hist) : h('p', { class: 'muted' }, 'Подходов пока нет. Здесь появятся прошлые результаты и рекорды.'),
    h('a', { class: 'btn soft wide', href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name + ' техника выполнения'), target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('video') }), 'Найти видео на YouTube'),
    h('p', { class: 'muted small center' }, 'Откроется YouTube в новой вкладке. Встроенного видео в приложении нет.')), { tall: true });
  const pl = $('.sheet .player');
  if (pl) pl.addEventListener('click', (e) => { if (!e.target.closest('.pbtn')) { const b = pl.querySelector('.pbtn'); if (b) b.click(); } });
}
// 3D skinned-model demo; falls back to the 2D animation if WebGL or the library is unavailable
function player3d(exId, ex) {
  const box = h('div', { class: 'player p3d', role: 'img', 'aria-label': `3D-анимация: ${ex.name}` });
  const status = h('div', { class: 'p3d-load' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', null, 'Загружаем 3D-модель…'));
  box.append(status);
  REP3D.mount(box, exId, { autoplay: !reduceMotion }).then((ctl) => {
    status.remove();
    const btn = h('button', { class: 'pbtn', type: 'button' });
    const sync = () => { btn.innerHTML = icon(ctl.playing ? 'pause' : 'play'); btn.setAttribute('aria-label', ctl.playing ? 'Пауза' : 'Воспроизвести'); };
    btn.onclick = (e) => { e.stopPropagation(); ctl.toggle(); sync(); };
    sync(); box.append(btn);
  }).catch(() => {
    if (!box.isConnected) return;
    box.replaceWith(figPlayer(ex.anim, ex.m));
  });
  return box;
}

// ================= plan editor =================
function renderEditPlan() {
  const save = debounce(savePlan, 400);
  const wrap = h('div', { class: 'stack' });
  const drawAll = () => {
    S.plan.days.sort((a, b) => a.dow - b.dow);
    wrap.replaceChildren(...S.plan.days.map((d) => editDay(d)),
      h('button', { class: 'btn soft wide', type: 'button', onclick: () => {
        const used = new Set(S.plan.days.map((x) => x.dow));
        const free = [0, 1, 2, 3, 4, 5, 6].find((x) => !used.has(x));
        if (free === undefined) { toast('На каждый день уже есть тренировка.'); return; }
        S.plan.days.push({ id: 'd' + uid(), title: 'Новая тренировка', dow: free, groups: [], items: [] });
        savePlan(); drawAll();
      } }, h('span', { html: icon('plus') }), 'Добавить день тренировки'));
  };
  const editDay = (d) => {
    const items = h('div', { class: 'eitems' });
    const drawItems = () => items.replaceChildren(...d.items.map((it, i) => {
      const ex = EXBY[it.ex];
      return h('div', { class: 'eitem' },
        h('button', { class: 'eitem-n', type: 'button', onclick: () => pickExercise2(d, (nx) => { d.items[i] = Object.assign({ ex: nx.id }, prescribe(nx, S.profile)); save(); drawItems(); }), 'aria-label': `Заменить: ${ex.name}` },
          figStill(ex.anim, 1, 'thumb sm', ex.m), h('span', null, ex.name, h('span', { class: 'muted small block' }, 'Нажмите, чтобы заменить'))),
        h('div', { class: 'eitem-f' },
          h('label', { class: 'mini' }, h('span', null, 'Подходы'), numInput(it.sets, { class: 'inp xs', inputmode: 'numeric', oninput: (e) => { const n = num(e.target.value); if (n && n > 0 && n <= 10) { it.sets = Math.round(n); save(); } } })),
          h('label', { class: 'mini' }, h('span', null, ex.time ? 'Время' : 'Повторы'), h('input', { class: 'inp xs w', type: 'text', value: it.reps, maxlength: '24', oninput: (e) => { if (e.target.value.trim()) { it.reps = e.target.value.trim(); save(); } } })),
          h('label', { class: 'mini' }, h('span', null, 'Отдых, с'), numInput(it.rest, { class: 'inp xs', inputmode: 'numeric', oninput: (e) => { const n = num(e.target.value); if (n != null && n >= 0 && n <= 600) { it.rest = Math.round(n); save(); } } })),
          ib('trash', `Удалить: ${ex.name}`, () => { d.items.splice(i, 1); save(); drawItems(); })));
    }));
    drawItems();
    const groupsEl = chips(Object.entries(GROUPS), d.groups, (v) => { d.groups = v; save(); }, { multi: true });
    return h('section', { class: 'eday' },
      h('div', { class: 'row gap' },
        h('select', { class: 'inp sel', 'aria-label': 'День тренировки', onchange: (e) => { d.dow = Number(e.target.value); save(); drawAll(); } }, DOW.map((x, i) => h('option', { value: String(i), selected: i === d.dow }, cap(x)))),
        h('input', { class: 'inp grow', type: 'text', value: d.title, maxlength: '40', 'aria-label': 'Название тренировки', oninput: (e) => { d.title = e.target.value || 'Тренировка'; save(); } })),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Группы мышц'), groupsEl,
        h('button', { class: 'link', type: 'button', onclick: () => { if (!d.groups.length) { toast('Сначала выберите хотя бы одну группу мышц.'); return; } rebuildDayFromGroups(d, S.profile); savePlan(); drawItems(); toast('Упражнения подобраны под эти мышцы'); } }, 'Подобрать упражнения под эти мышцы')),
      items,
      h('div', { class: 'row between' },
        h('button', { class: 'link', type: 'button', onclick: () => pickExercise2(d, (nx) => { d.items.push(Object.assign({ ex: nx.id }, prescribe(nx, S.profile))); save(); drawItems(); }) }, '+ Добавить упражнение'),
        h('button', { class: 'link danger', type: 'button', onclick: () => confirmSheet('Удалить этот день?', `Тренировка «${d.title}» будет удалена из плана. Записанные тренировки сохранятся.`, 'Удалить день', () => { S.plan.days = S.plan.days.filter((x) => x !== d); savePlan(); drawAll(); }, true) }, 'Удалить день')));
  };
  drawAll();
  return h('div', { class: 'screen' },
    h('div', { class: 'subbar' }, h('button', { class: 'backbtn', type: 'button', onclick: () => { savePlan(); go('workouts'); } }, h('span', { html: icon('back') }), 'Тренировки')),
    h('header', { class: 'top' }, h('h1', { class: 'title' }, 'Изменить план'), h('p', { class: 'muted' }, 'Изменения сохраняются автоматически.')),
    wrap);
}
function pickExercise2(day, onPick) {
  let all = false, mine = true;
  const list = h('div', { class: 'plist' });
  const draw = () => {
    const eq = S.profile.equip;
    const rows = EXERCISES.filter((e) => (all || !day.groups.length || day.groups.includes(e.g) || e.also.some((g) => day.groups.includes(g))) && (!mine || exAvailable(e, eq)))
      .sort((a, b) => (day.groups.includes(a.g) ? 0 : 1) - (day.groups.includes(b.g) ? 0 : 1));
    list.replaceChildren(...(rows.length ? rows.map((e) => h('button', { class: 'prow', type: 'button', onclick: () => { sh.close(true); onPick(e); } },
      figStill(e.anim, 1, 'thumb sm', e.m), h('span', null, e.name, h('span', { class: 'muted small block' }, GROUPS[e.g] + (exAvailable(e, eq) ? '' : `, нужно: ${e.eq[0].map((k) => EQUIP[k].toLowerCase()).join(' + ')}`))))) : [h('p', { class: 'muted' }, 'Подходящих упражнений нет. Покажите все группы мышц.')]));
  };
  const sh = openSheet('Выберите упражнение', h('div', { class: 'stack' },
    h('div', { class: 'row wrap gap-s' },
      chips([[false, day.groups.length ? 'Мышцы этого дня' : 'Все мышцы'], [true, 'Все мышцы']].slice(day.groups.length ? 0 : 1), all, (v) => { all = v; draw(); }),
      chips([[true, 'Моё оборудование'], [false, 'Любое оборудование']], mine, (v) => { mine = v; draw(); })),
    list), { tall: true });
  draw();
}
