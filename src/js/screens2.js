// ================= Claude (sample) =================
const AI = { fn: null, images: false, off: false, ready: false };
async function initAI() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') { AI.ready = true; return; }
  try {
    AI.fn = await c.use('sample');
    if (AI.fn) { const lim = await AI.fn.limits().catch(() => null); AI.images = !!(lim && lim.images); }
  } catch { AI.fn = null; }
  AI.ready = true;
  if (S.profile && S.tab === 'nutrition' && !currentSheet) render({ keepScroll: true });
}
const aiOk = () => !!AI.fn && !AI.off;
const aiPhotoOk = () => aiOk() && AI.images;
function aiError(e) {
  switch (e && e.code) {
    case 'cancelled': return null;
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed':
      AI.off = true; return 'Распознавание выключено: доступ к Claude здесь не разрешён. Добавьте еду вручную.';
    case 'images_unavailable': AI.images = false; return 'Отсюда нельзя отправить фото в Claude. Добавьте еду вручную.';
    case 'image_rejected': return 'Не удалось прочитать фото. Попробуйте другое фото в формате JPEG или PNG.';
    case 'rate_limited': return 'Слишком много запросов. Подождите минуту и попробуйте снова.';
    case 'invalid_json': return 'Оценка пришла в неожиданном формате. Попробуйте ещё раз.';
    case 'refused': return 'Claude не смог это проанализировать. Добавьте еду вручную.';
    default: return 'Распознавание не завершилось. Проверьте подключение и попробуйте снова.';
  }
}
const n0 = (v) => Math.max(0, num(v) ?? 0);

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
async function prepImage(file, max, q) {
  const { img, url } = await loadImage(file);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  return { blob, canvas: c };
}
function pickFile(capture, onFile) {
  const inp = h('input', { type: 'file', accept: 'image/*', style: 'position:fixed;left:-9999px;opacity:0' });
  if (capture) inp.setAttribute('capture', 'environment');
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) onFile(f); });
  document.body.append(inp);
  inp.click();
}

const FOOD_PROMPT = (note) => `Look at this meal photo and estimate its nutrition.
1. List each distinct food or drink you can see.
2. Estimate each portion in grams (ml for drinks) from visual cues such as plate size (a dinner plate is about 26 cm), cutlery, hands and packaging.
3. Estimate calories, protein, fat and carbohydrates for that portion, using typical values for how it appears to be prepared (count visible oil, sauces and frying).
Be honest about uncertainty: use confidence "low" when the food or the portion is unclear, and ask one short question if the answer would change the estimate a lot.
If the photo shows no food, return an empty items list and "notFood": true.${note ? `\nThe person adds this detail: ${note}` : ''}
Write the title, food names, portions and the question in Russian. Recognise dishes common in Central Asia and Russia (plov, lagman, manti, samsa, shashlik, borscht, pelmeni and so on) by their usual names.
Reply with only JSON in exactly this shape:
{"title":"короткое название блюда","items":[{"name":"Куриная грудка на гриле","portion":"1 средний кусок","grams":150,"kcal":248,"protein":46,"fat":5,"carbs":0,"confidence":"high"}],"question":"","notFood":false}
Number fields contain numbers only.`;
const LABEL_PROMPT = `This photo shows packaged food: a barcode, a nutrition label, the front of the pack, or several of these.
Read what is visible. Prefer printed nutrition label values. If no nutrition label is visible but you recognise the exact product, give typical values for it and set "source" to "estimate"; when values come from the label set "source" to "label".
If the label only gives values per serving, convert them to per 100 g (or 100 ml) using the serving size.
Keep the product name as printed on the pack. Write the serving label and the note in Russian.
Reply with only JSON in exactly this shape:
{"name":"название продукта и бренд","barcode":"digits if legible, else empty","unit":"g","per100":{"kcal":0,"protein":0,"fat":0,"carbs":0},"serving":{"amount":0,"label":"1 батончик"},"package":{"amount":0},"source":"label","note":""}
If nothing useful is readable, reply {"name":"","error":"одна короткая подсказка по-русски, как сделать фото лучше"}.`;
const TEXT_PROMPT = (desc, grams) => `Estimate the nutrition of this food portion (the description may be in Russian): "${desc}"${grams ? `, about ${grams} g` : ''}.
Use typical values. Write "name" in Russian. Reply with only JSON: {"name":"короткое название","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"confidence":"high"}
Use "medium" or "low" confidence when the description is vague.`;
const unitRu = (u) => (u === 'ml' ? 'мл' : 'г');

// ================= nutrition =================
SCREENS.nutrition = () => {
  const today = iso(), date = S.nutDate && S.nutDate <= today ? S.nutDate : today;
  S.nutDate = date;
  const T = targets(), tot = dayTotals(date);
  const food = (S.days[date] && S.days[date].food) || [];
  const left = T.kcal - tot.kcal;
  const groups = Object.keys(MEALS).map((m) => [m, food.filter((f) => (f.meal || 'snack') === m)]).filter(([, l]) => l.length);
  return h('div', { class: 'screen nut' },
    h('header', { class: 'top row between' },
      h('h1', { class: 'title' }, 'Питание'),
      h('div', { class: 'datenav' },
        ib('back', 'Предыдущий день', () => { S.nutDate = addDays(date, -1); render(); }),
        h('span', null, relDay(date)),
        ib('next', 'Следующий день', () => { if (date < today) { S.nutDate = addDays(date, 1); render(); } }, 'iconbtn' + (date >= today ? ' dim' : '')))),
    h('section', { class: 'blk' },
      h('div', { class: 'kcal' }, h('span', { class: 'big' }, fmtN(tot.kcal)), h('span', { class: 'muted kcal-of' }, `из ${fmtN(T.kcal)} ккал`),
        h('span', { class: 'kcal-left muted small' }, left >= 0 ? `осталось ${fmtN(left)}` : `больше на ${fmtN(-left)}`)),
      bar(tot.kcal, T.kcal, 'red'),
      h('div', { class: 'macros' },
        macroRow('Белки', tot.protein, T.protein, 'blue'), macroRow('Углеводы', tot.carbs, T.carbs, 'green'), macroRow('Жиры', tot.fat, T.fat, 'yellow'))),
    h('button', { class: 'cam', type: 'button', onclick: () => (aiPhotoOk() ? pickFile(true, (f) => photoMeal(f, date)) : openManual(date, null, AI.ready ? 'Распознавание по фото здесь недоступно, поэтому введите еду вручную.' : null)) },
      h('span', { html: icon('camera', 'ic l') }),
      h('span', { class: 'cam-t' }, h('b', null, 'Сфотографировать еду'), h('span', null, aiPhotoOk() ? 'Калории и БЖУ рассчитаются автоматически' : AI.ready ? 'Распознавание недоступно, нажмите для ручного ввода' : 'Готовим распознавание…'))),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn soft', type: 'button', onclick: () => openScan(date) }, h('span', { html: icon('barcode') }), 'Упаковка'),
      h('button', { class: 'btn soft', type: 'button', onclick: () => openManual(date) }, h('span', { html: icon('plus') }), 'Вручную')),
    aiPhotoOk() ? h('button', { class: 'link small center', type: 'button', onclick: () => pickFile(false, (f) => photoMeal(f, date)) }, 'Выбрать фото из галереи') : null,
    groups.length ? groups.map(([m, list]) => {
      const mt = list.reduce((s, f) => s + (f.kcal || 0), 0);
      return h('section', { class: 'meal' },
        h('div', { class: 'row between meal-h' }, h('h2', null, MEALS[m]), h('span', { class: 'muted' }, `${fmtN(mt)} ккал`)),
        h('ul', { class: 'foods' }, list.map((f) => h('li', null, h('button', { type: 'button', class: 'food', onclick: () => openManual(date, f) },
          h('span', { class: 'food-t' }, h('span', { class: 'food-n' }, f.name), h('span', { class: 'muted small' }, `${fmtN(f.grams || 0)} г, Б ${fmtN(f.protein)} У ${fmtN(f.carbs)} Ж ${fmtN(f.fat)}`)),
          h('span', { class: 'food-k' }, fmtN(f.kcal)))))));
    }) : h('p', { class: 'empty' }, date === today ? 'Сегодня пока ничего не записано. Сфотографируйте следующий приём пищи.' : 'В этот день ничего не записано.'));
};
function macroRow(label, v, max, color) {
  return h('div', { class: 'mrow' }, h('div', { class: 'row between' }, h('span', null, label), h('span', { class: 'muted small' }, `${fmtN(v)} / ${fmtN(max)} г`)), bar(v, max, color));
}
function addFoods(date, items, meal, src) {
  const dd = dayDoc(date);
  for (const it of items) {
    const f = { id: uid(), name: it.name.trim() || 'Еда', grams: round(n0(it.grams)), kcal: round(n0(it.kcal)), protein: round(n0(it.protein), 1), fat: round(n0(it.fat), 1), carbs: round(n0(it.carbs), 1), meal, src };
    dd.food.push(f);
    S.foods.recent = [{ name: f.name, grams: f.grams, kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs }, ...S.foods.recent.filter((r) => r.name.toLowerCase() !== f.name.toLowerCase())].slice(0, 24);
  }
  saveDay(date); saveFoods();
}
function mealChips(meal, onPick) { return chips(Object.entries(MEALS), meal, onPick); }

// ---------- photo of a meal ----------
function photoMeal(file, date) {
  const ctl = new AbortController();
  const url = URL.createObjectURL(file);
  const img = h('img', { class: 'shot', src: url, alt: 'Фото вашей еды' });
  const status = h('div', { class: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', null, 'Определяем блюда и оцениваем порции…'));
  const stop = h('button', { class: 'btn ghost', type: 'button', onclick: () => ctl.abort() }, 'Остановить');
  const sh = openSheet('Фото еды', h('div', { class: 'stack' }, img, status, stop), { tall: true, onClose: () => { ctl.abort(); URL.revokeObjectURL(url); } });
  (async () => {
    let res;
    try {
      const { blob } = await prepImage(file, 1600, 0.85);
      res = await AI.fn.json(FOOD_PROMPT(''), { images: [blob], signal: ctl.signal });
    } catch (e) {
      if (sh.closed) return;
      const msg = e && e.message === 'decode' ? 'Не удалось открыть фото. Попробуйте фото в формате JPEG или PNG.' : aiError(e);
      if (msg === null) { sh.close(); return; }
      sh.setBody(h('div', { class: 'stack' }, img, errorText(msg),
        h('div', { class: 'row gap' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { sh.close(true); openManual(date); } }, 'Ввести вручную'),
          aiPhotoOk() ? h('button', { class: 'btn primary', type: 'button', onclick: () => { sh.close(true); pickFile(true, (f) => photoMeal(f, date)); } }, 'Переснять') : null)));
      return;
    }
    if (sh.closed) return;
    const items = (Array.isArray(res && res.items) ? res.items : []).map((x) => ({ name: String(x.name || 'Еда'), portion: String(x.portion || ''), grams: n0(x.grams), kcal: n0(x.kcal), protein: n0(x.protein), fat: n0(x.fat), carbs: n0(x.carbs), confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'medium' }));
    if (!items.length) {
      sh.setBody(h('div', { class: 'stack' }, img, errorText('На фото не найдена еда. Переснимите так, чтобы тарелка была видна целиком, или введите вручную.'),
        h('div', { class: 'row gap' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { sh.close(true); openManual(date); } }, 'Ввести вручную'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { sh.close(true); pickFile(true, (f) => photoMeal(f, date)); } }, 'Переснять'))));
      return;
    }
    reviewItems(sh, img, items, String((res && res.question) || ''), String((res && res.title) || ''), date, 'photo');
  })();
}
function reviewItems(sh, img, items, question, title, date, src) {
  let meal = mealForNow();
  const list = h('div', { class: 'ritems' });
  const totals = h('div', { class: 'rtot' });
  const drawTot = () => {
    const t = items.reduce((a, x) => ({ k: a.k + x.kcal, p: a.p + x.protein, f: a.f + x.fat, c: a.c + x.carbs }), { k: 0, p: 0, f: 0, c: 0 });
    totals.replaceChildren(h('span', null, h('b', null, fmtN(t.k)), ' ккал'), h('span', { class: 'muted' }, `Б ${fmtN(t.p)} г, У ${fmtN(t.c)} г, Ж ${fmtN(t.f)} г`));
  };
  const draw = () => {
    list.replaceChildren(...items.map((it, i) => {
      const open = it._open;
      const row = h('div', { class: 'ritem' + (it.confidence === 'low' ? ' low' : '') },
        h('button', { type: 'button', class: 'ritem-h', 'aria-expanded': open ? 'true' : 'false', onclick: () => { it._open = !open; draw(); } },
          h('span', { class: 'ritem-t' }, h('span', { class: 'ritem-n' }, it.name), h('span', { class: 'muted small' }, `${fmtN(it.grams)} г${it.portion ? ', ' + it.portion : ''}`)),
          it.confidence === 'low' ? h('span', { class: 'tag warn' }, 'Проверьте') : it.confidence === 'medium' ? h('span', { class: 'tag' }, 'Вероятно') : null,
          h('span', { class: 'ritem-k' }, fmtN(it.kcal))));
      if (open) row.append(itemEditor(it, () => { drawTot(); }, () => { items.splice(i, 1); draw(); }));
      return row;
    }));
    drawTot();
  };
  draw();
  const anyLow = items.some((x) => x.confidence === 'low');
  sh.setBody(h('div', { class: 'stack' },
    h('div', { class: 'row gap rhead' }, img, h('div', null, h('h3', { class: 'sub flush' }, title || 'Ваша еда'), h('p', { class: 'muted small' }, 'Оценка по фото. Нажмите на позицию, чтобы исправить.'))),
    question ? h('p', { class: 'note' }, h('b', null, 'Уточните: '), question) : null,
    anyLow ? h('p', { class: 'note' }, 'Некоторые позиции определены неуверенно. Проверьте блюдо и порцию перед сохранением.') : null,
    list,
    h('button', { class: 'link', type: 'button', onclick: () => { items.push({ name: '', grams: 100, kcal: 0, protein: 0, fat: 0, carbs: 0, confidence: 'high', _open: true }); draw(); } }, '+ Добавить недостающую позицию'),
    totals,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Приём пищи'), mealChips(meal, (v) => { meal = v; })),
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => {
      const ok = items.filter((x) => x.name.trim());
      if (!ok.length) { toast('Добавьте хотя бы одну позицию.'); return; }
      addFoods(date, ok, meal, src); sh.close(true); toast(`Добавлено ${MEALS_TO[meal]}: ${pln(ok.length, 'позиция', 'позиции', 'позиций')}`); render({ keepScroll: true });
    } }, 'Сохранить в дневник'),
    h('p', { class: 'muted small' }, 'Оценка по фото может ошибаться на 20% и больше. Если знаете точный вес порции, исправьте его.')));
}
function itemEditor(it, onChange, onRemove) {
  const fields = {};
  const mk = (key, label, unit) => {
    const inp = numInput(key === 'name' ? it.name : fmtN(it[key]), key === 'name' ? { type: 'text', inputmode: 'text' } : {});
    if (key === 'name') inp.setAttribute('inputmode', 'text');
    fields[key] = inp;
    inp.addEventListener('input', () => {
      if (key === 'name') { it.name = inp.value; return; }
      const v = n0(inp.value);
      if (key === 'grams' && it.grams > 0) {
        const f = v / it.grams;
        for (const k of ['kcal', 'protein', 'fat', 'carbs']) { it[k] = it[k] * f; fields[k].value = fmtN(it[k]); }
      }
      it[key] = v; onChange();
    });
    return h('label', { class: 'mini' + (key === 'name' ? ' grow' : '') }, h('span', null, label + (unit ? ` (${unit})` : '')), inp);
  };
  return h('div', { class: 'ied' },
    h('div', { class: 'row gap' }, mk('name', 'Блюдо'), mk('grams', 'Вес', 'г')),
    h('div', { class: 'row gap' }, mk('kcal', 'Ккал'), mk('protein', 'Белки'), mk('carbs', 'Углев.'), mk('fat', 'Жиры')),
    h('p', { class: 'muted small' }, 'При изменении веса цифры пересчитаются.'),
    h('button', { class: 'link danger', type: 'button', onclick: onRemove }, 'Удалить позицию'));
}

// ---------- packaged food ----------
function openScan(date) {
  const body = h('div', { class: 'stack' },
    h('p', { class: 'lead' }, 'Сфотографируйте штрихкод вместе с таблицей пищевой ценности. Продукты, которые вы уже сканировали, узнаются по одному штрихкоду.'),
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => pickFile(true, (f) => scanPackage(f, date, sh)) }, h('span', { html: icon('camera') }), 'Сделать фото'),
    h('button', { class: 'btn soft wide', type: 'button', onclick: () => pickFile(false, (f) => scanPackage(f, date, sh)) }, h('span', { html: icon('photo') }), 'Выбрать из галереи'),
    Object.keys(S.foods.products).length ? h('div', null, h('h3', { class: 'sub' }, 'Уже сканировали'),
      h('div', { class: 'plist' }, Object.entries(S.foods.products).sort((a, b) => (b[1].used || '').localeCompare(a[1].used || '')).slice(0, 8).map(([code, pr]) =>
        h('button', { class: 'prow', type: 'button', onclick: () => productForm(sh, pr, code, date) }, h('span', null, pr.name, h('span', { class: 'muted small block' }, `${fmtN(pr.per100.kcal)} ккал на 100 ${unitRu(pr.unit)}`)))))) : null,
    !aiPhotoOk() ? h('p', { class: 'muted small' }, 'Чтобы прочитать новую этикетку, нужно распознавание по фото, а здесь оно недоступно. Ранее отсканированные продукты работают, еду можно ввести вручную.') : null);
  const sh = openSheet('Упаковка', body, { tall: true });
}
async function detectBarcode(file) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const det = new window.BarcodeDetector();
    const bmp = await createImageBitmap(file);
    const r = await det.detect(bmp);
    return r && r[0] ? String(r[0].rawValue).replace(/\D/g, '') || null : null;
  } catch { return null; }
}
function scanPackage(file, date, sh) {
  const ctl = new AbortController();
  sh.setBody(h('div', { class: 'stack' }, h('div', { class: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', null, 'Читаем упаковку…')), h('button', { class: 'btn ghost', type: 'button', onclick: () => { ctl.abort(); sh.close(); } }, 'Остановить')));
  (async () => {
    let code = await detectBarcode(file);
    if (code && S.foods.products[code]) { productForm(sh, S.foods.products[code], code, date, 'Узнали по штрихкоду.'); return; }
    if (!aiPhotoOk()) {
      productForm(sh, { name: '', unit: 'g', per100: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, serving: 0 }, code, date, code ? `Штрихкод ${code} новый. Введите данные с этикетки один раз, и в следующий раз продукт узнается сам.` : 'Введите данные с этикетки.');
      return;
    }
    try {
      const { blob } = await prepImage(file, 1800, 0.9);
      const r = await AI.fn.json(LABEL_PROMPT, { images: [blob], signal: ctl.signal });
      if (sh.closed) return;
      if (!r || !r.name) {
        sh.setBody(h('div', { class: 'stack' }, errorText((r && r.error) ? String(r.error) : 'Не удалось прочитать этикетку. Подойдите ближе, чтобы таблица пищевой ценности заняла всё фото.'),
          h('button', { class: 'btn primary wide', type: 'button', onclick: () => pickFile(true, (f) => scanPackage(f, date, sh)) }, 'Переснять')));
        return;
      }
      if (!code && r.barcode) code = String(r.barcode).replace(/\D/g, '') || null;
      if (code && S.foods.products[code]) { productForm(sh, S.foods.products[code], code, date, 'Узнали по штрихкоду.'); return; }
      const per = r.per100 || {};
      const pr = { name: String(r.name), unit: r.unit === 'ml' ? 'ml' : 'g', per100: { kcal: n0(per.kcal), protein: n0(per.protein), fat: n0(per.fat), carbs: n0(per.carbs) }, serving: n0(r.serving && r.serving.amount), servingLabel: String((r.serving && r.serving.label) || ''), pack: n0(r.package && r.package.amount) };
      const msg = (r.source === 'estimate' ? 'Таблицы пищевой ценности на фото не видно, поэтому это типичные значения для продукта. Сверьте их с упаковкой. ' : 'Прочитано с этикетки. ') + (r.note ? String(r.note) : '');
      productForm(sh, pr, code, date, msg.trim());
    } catch (e) {
      if (sh.closed) return;
      const msg = e && e.message === 'decode' ? 'Не удалось открыть фото. Попробуйте фото в формате JPEG или PNG.' : aiError(e);
      if (msg === null) return;
      sh.setBody(h('div', { class: 'stack' }, errorText(msg), h('button', { class: 'btn soft wide', type: 'button', onclick: () => { sh.close(true); openManual(date); } }, 'Ввести вручную')));
    }
  })();
}
function productForm(sh, pr0, code, date, msg) {
  const pr = JSON.parse(JSON.stringify(pr0));
  let amount = pr.serving || 100, meal = mealForNow();
  const out = h('div', { class: 'rtot' });
  const calc = () => { const f = amount / 100; return { kcal: pr.per100.kcal * f, protein: pr.per100.protein * f, fat: pr.per100.fat * f, carbs: pr.per100.carbs * f }; };
  const drawOut = () => { const c = calc(); out.replaceChildren(h('span', null, h('b', null, fmtN(c.kcal)), ' ккал'), h('span', { class: 'muted' }, `Б ${fmtN(c.protein)} г, У ${fmtN(c.carbs)} г, Ж ${fmtN(c.fat)} г`)); };
  const amt = numInput(amount, { id: 'p-amt', oninput: (e) => { amount = n0(e.target.value); drawOut(); } });
  const quick = [];
  if (pr.serving) quick.push([pr.serving, `${pr.servingLabel || '1 порция'} (${fmtN(pr.serving)} ${unitRu(pr.unit)})`]);
  if (pr.pack && pr.pack !== pr.serving) quick.push([pr.pack, `Вся упаковка (${fmtN(pr.pack)} ${unitRu(pr.unit)})`]);
  quick.push([100, `100 ${unitRu(pr.unit)}`]);
  const per = (k, label) => h('label', { class: 'mini' }, h('span', null, label), numInput(fmtN1(pr.per100[k]), { oninput: (e) => { pr.per100[k] = n0(e.target.value); drawOut(); } }));
  drawOut();
  sh.setBody(h('div', { class: 'stack' },
    msg ? h('p', { class: 'note' }, msg) : null,
    field('Продукт', h('input', { class: 'inp', type: 'text', value: pr.name, maxlength: '80', oninput: (e) => { pr.name = e.target.value; } })),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, `На 100 ${unitRu(pr.unit)}`), h('div', { class: 'row gap' }, per('kcal', 'Ккал'), per('protein', 'Белки'), per('carbs', 'Углев.'), per('fat', 'Жиры'))),
    h('div', { class: 'field' }, h('label', { for: 'p-amt' }, `Сколько вы съели? (${unitRu(pr.unit)})`), amt,
      h('div', { class: 'chips' }, quick.map(([v, l]) => h('button', { type: 'button', class: 'chip', onclick: () => { amount = v; amt.value = v; drawOut(); } }, l)))),
    out,
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Приём пищи'), mealChips(meal, (v) => { meal = v; })),
    code ? h('p', { class: 'muted small' }, `Штрихкод ${code}`) : null,
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => {
      if (!pr.name.trim()) { toast('Введите название продукта.'); return; }
      if (!amount) { toast('Укажите, сколько вы съели.'); return; }
      const c = calc();
      addFoods(date, [{ name: pr.name, grams: amount, kcal: c.kcal, protein: c.protein, fat: c.fat, carbs: c.carbs }], meal, 'package');
      const key = code || 'name:' + pr.name.toLowerCase().slice(0, 60);
      pr.used = iso();
      S.foods.products[key] = pr;
      const keys = Object.keys(S.foods.products);
      if (keys.length > 300) { keys.sort((a, b) => (S.foods.products[a].used || '').localeCompare(S.foods.products[b].used || '')); delete S.foods.products[keys[0]]; }
      saveFoods(); sh.close(true); toast(`Добавлено ${MEALS_TO[meal]}`); render({ keepScroll: true });
    } }, 'Сохранить в дневник')));
}
const fmtN1 = (v) => String(round(v || 0, 1));

// ---------- manual entry / edit ----------
function openManual(date, existing, notice) {
  const it = existing ? Object.assign({}, existing) : { name: '', grams: 100, kcal: '', protein: '', fat: '', carbs: '', meal: mealForNow() };
  const inputs = {};
  const mk = (k, label, attrs = {}) => { const el = k === 'name' ? h('input', Object.assign({ class: 'inp', type: 'text', value: it.name, maxlength: '80' }, attrs)) : numInput(it[k] === '' ? '' : fmtN1(it[k]), attrs); inputs[k] = el; el.addEventListener('input', () => { it[k] = k === 'name' ? el.value : el.value; }); return el; };
  const estBtn = aiOk() && !existing ? h('button', { class: 'btn soft', type: 'button' }, 'Оценить с Claude') : null;
  const estStatus = h('div');
  if (estBtn) estBtn.onclick = async () => {
    const desc = (it.name || '').trim();
    if (!desc) { estStatus.replaceChildren(errorText('Сначала опишите еду, например «2 жареных яйца с хлебом».')); return; }
    estBtn.disabled = true; estStatus.replaceChildren(h('div', { class: 'status' }, h('span', { class: 'spin' }), h('span', null, 'Оцениваем…')));
    try {
      const r = await AI.fn.json(TEXT_PROMPT(desc, num(it.grams)), { modelTier: 'quick' });
      for (const k of ['grams', 'kcal', 'protein', 'fat', 'carbs']) { it[k] = n0(r[k]); inputs[k].value = fmtN1(it[k]); }
      estStatus.replaceChildren(h('p', { class: 'note' }, r.confidence === 'low' ? 'Приблизительно: описание слишком общее. Поправьте цифры, если можете.' : 'Оценка по типичным значениям. Поправьте, если знаете точнее.'));
    } catch (e) { const m = aiError(e); estStatus.replaceChildren(m ? errorText(m) : h('span')); }
    estBtn.disabled = false;
  };
  const recent = !existing && S.foods.recent.length ? h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Недавние'),
    h('div', { class: 'chips' }, S.foods.recent.slice(0, 10).map((r) => h('button', { type: 'button', class: 'chip', onclick: () => { Object.assign(it, r); for (const k in inputs) inputs[k].value = k === 'name' ? r.name : fmtN1(r[k]); } }, r.name)))) : null;
  const save = () => {
    if (!String(it.name).trim()) { toast('Введите название блюда.'); return; }
    const vals = { name: String(it.name), grams: n0(it.grams), kcal: n0(it.kcal), protein: n0(it.protein), fat: n0(it.fat), carbs: n0(it.carbs) };
    if (existing) {
      const dd = dayDoc(date), f = dd.food.find((x) => x.id === existing.id);
      if (f) Object.assign(f, { name: vals.name.trim(), grams: round(vals.grams), kcal: round(vals.kcal), protein: round(vals.protein, 1), fat: round(vals.fat, 1), carbs: round(vals.carbs, 1), meal: it.meal });
      saveDay(date); toast('Сохранено');
    } else { addFoods(date, [vals], it.meal, 'manual'); toast(`Добавлено ${MEALS_TO[it.meal]}`); }
    sh.close(true); render({ keepScroll: true });
  };
  const sh = openSheet(existing ? 'Изменить запись' : 'Добавить еду', h('div', { class: 'stack' },
    notice ? h('p', { class: 'note' }, notice) : null,
    recent,
    field('Блюдо', mk('name', 'Блюдо', { placeholder: 'Например, плов с говядиной' })),
    h('div', { class: 'row gap end' }, h('label', { class: 'mini grow' }, h('span', null, 'Вес (г)'), mk('grams')), estBtn),
    estStatus,
    h('div', { class: 'row gap' },
      h('label', { class: 'mini' }, h('span', null, 'Ккал'), mk('kcal')),
      h('label', { class: 'mini' }, h('span', null, 'Белки, г'), mk('protein')),
      h('label', { class: 'mini' }, h('span', null, 'Углев., г'), mk('carbs')),
      h('label', { class: 'mini' }, h('span', null, 'Жиры, г'), mk('fat'))),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Приём пищи'), mealChips(it.meal, (v) => { it.meal = v; })),
    h('button', { class: 'btn primary wide', type: 'button', onclick: save }, existing ? 'Сохранить изменения' : 'Добавить в дневник'),
    existing ? h('button', { class: 'btn ghost danger wide', type: 'button', onclick: () => { const dd = dayDoc(date); dd.food = dd.food.filter((x) => x.id !== existing.id); saveDay(date); sh.close(true); toast('Удалено'); render({ keepScroll: true }); } }, 'Удалить из дневника') : null), { tall: true });
}

// ================= progress =================
function weeklyChange() {
  const e = S.weights.entries;
  if (e.length < 2) return null;
  const last = e[e.length - 1].d;
  let pts = e.filter((x) => daysBetween(x.d, last) <= 28);
  if (pts.length < 2 || daysBetween(pts[0].d, last) < 6) pts = e;
  if (pts.length < 2 || daysBetween(pts[0].d, last) < 6) return null;
  const xs = pts.map((x) => daysBetween(pts[0].d, x.d)), ys = pts.map((x) => x.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let nu = 0, de = 0;
  xs.forEach((x, i) => { nu += (x - mx) * (ys[i] - my); de += (x - mx) ** 2; });
  return de ? (nu / de) * 7 : null;
}
function weightChart(range) {
  const all = S.weights.entries, last = all.length ? all[all.length - 1].d : iso();
  const from = range === 'all' ? null : addDays(last, range === '1m' ? -31 : -92);
  const pts = from ? all.filter((x) => x.d >= from) : all;
  const W = 340, H = 168, L = 34, R = 8, T = 12, B = 22;
  if (pts.length < 2) return h('div', { class: 'chart-empty muted' }, pts.length ? 'Запишите вес ещё в один день, чтобы увидеть график.' : 'Записей веса пока нет.');
  const tgt = S.profile.targetKg;
  const vals = pts.map((x) => x.kg);
  let lo = Math.min(...vals, tgt), hi = Math.max(...vals, tgt);
  const padv = Math.max(0.5, (hi - lo) * 0.12); lo -= padv; hi += padv;
  const t0 = parseISO(pts[0].d).getTime(), t1 = Math.max(parseISO(pts[pts.length - 1].d).getTime(), t0 + 86400000);
  const X = (d) => L + ((parseISO(d).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const Y = (kg) => T + (1 - (kg - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((x) => `${X(x.d).toFixed(1)},${Y(x.kg).toFixed(1)}`).join(' ');
  const yt = Y(tgt).toFixed(1);
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Вес от ${U.ws(pts[0].kg)} до ${U.ws(pts[pts.length - 1].kg)} ${U.wu()}, цель ${U.ws(tgt)} ${U.wu()}">
    <line class="c-grid" x1="${L}" x2="${W - R}" y1="${T}" y2="${T}"/><line class="c-grid" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
    <text class="c-lab" x="${L - 6}" y="${T + 4}" text-anchor="end">${U.w(hi, 0)}</text><text class="c-lab" x="${L - 6}" y="${H - B + 4}" text-anchor="end">${U.w(lo, 0)}</text>
    <line class="c-tgt" x1="${L}" x2="${W - R}" y1="${yt}" y2="${yt}"/><text class="c-tlab" x="${W - R}" y="${(+yt - 5).toFixed(1)}" text-anchor="end">Цель ${U.ws(tgt)}</text>
    <polyline class="c-line" points="${line}"/>
    ${pts.map((x) => `<circle class="c-pt" cx="${X(x.d).toFixed(1)}" cy="${Y(x.kg).toFixed(1)}" r="${pts.length > 40 ? 1.6 : 2.8}"/>`).join('')}
    <text class="c-lab" x="${L}" y="${H - 5}">${fmtShort(pts[0].d)}</text><text class="c-lab" x="${W - R}" y="${H - 5}" text-anchor="end">${fmtShort(pts[pts.length - 1].d)}</text>
  </svg>`;
  return h('div', { html: svg });
}
SCREENS.progress = () => {
  const p = S.profile, e = S.weights.entries, kg = currentWeight();
  const first = e.length ? e[0].kg : p.startKg;
  const wk = weeklyChange();
  const range = S.wRange || '3m';
  let note = null;
  if (wk != null && p.goal === 'lose' && -wk > kg * 0.01) note = 'Вы теряете больше 1% веса в неделю. Если есть немного больше, вы сохраните мышцы и энергию.';
  if (wk != null && p.goal === 'gain' && wk > kg * 0.005) note = 'Вы набираете больше 0,5% веса в неделю. С меньшим профицитом обычно меньше прибавляется жира.';
  if (S.photos === null) { S.photos = 'loading'; Store.query('photo').then((r) => { S.photos = r.map((x) => Object.assign({ key: x.id }, x.data)).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created)); if (S.tab === 'progress') render({ keepScroll: true }); }); }
  const m = S.meas.entries, mFirst = m[0], mLast = m[m.length - 1];
  const MK = [['chest', 'Грудь'], ['arms', 'Руки'], ['waist', 'Талия'], ['legs', 'Ноги']];
  const sign = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + dc(Math.abs(round(v, d)));
  return h('div', { class: 'screen prog' },
    h('header', { class: 'top' }, h('h1', { class: 'title' }, 'Прогресс')),
    h('section', { class: 'blk' },
      h('div', { class: 'stats3' },
        h('div', null, h('span', { class: 'muted small' }, 'Сейчас'), h('b', null, U.ws(kg)), h('small', null, U.wu())),
        h('div', null, h('span', { class: 'muted small' }, 'С начала'), h('b', null, sign(U.w(kg - first))), h('small', null, U.wu())),
        h('div', null, h('span', { class: 'muted small' }, 'За неделю'), h('b', null, wk == null ? '–' : sign(U.w(wk, 2), 2)), h('small', null, wk == null ? '' : U.wu()))),
      wk == null ? h('p', { class: 'muted small' }, 'Среднее за неделю появится после недели взвешиваний.') : null,
      note ? h('p', { class: 'note' }, note) : null,
      h('div', { class: 'row between' }, h('h2', { class: 'h2' }, 'Вес'), chips([['1m', '1 мес'], ['3m', '3 мес'], ['all', 'Всё']], range, (v) => { S.wRange = v; render({ keepScroll: true }); })),
      weightChart(range),
      h('div', { class: 'row gap' }, h('button', { class: 'btn primary', type: 'button', onclick: () => openLogWeight() }, 'Записать вес'), e.length ? h('button', { class: 'btn ghost', type: 'button', onclick: openWeightHistory }, 'История') : null)),
    h('section', { class: 'blk' },
      h('div', { class: 'row between' }, h('h2', { class: 'h2' }, 'Замеры'), mLast ? h('span', { class: 'muted small' }, fmtShort(mLast.d)) : null),
      mLast ? h('div', { class: 'mgrid' }, MK.map(([k, l]) => h('div', null, h('span', { class: 'muted small' }, l), h('b', null, mLast[k] ? dc(U.l(mLast[k])) : '–', mLast[k] ? h('small', null, ' ' + U.lu()) : null),
        mFirst !== mLast && mFirst[k] && mLast[k] ? h('span', { class: 'small muted' }, `${sign(U.l(mLast[k] - mFirst[k]))} с ${fmtShort(mFirst.d)}`) : null))) : h('p', { class: 'muted' }, 'Измеряйте грудь, руки, талию и ноги раз в несколько недель: так видны изменения, которые не показывают весы.'),
      h('button', { class: 'btn soft', type: 'button', onclick: openMeasure }, 'Записать замеры')),
    h('section', { class: 'blk' },
      h('div', { class: 'row between' }, h('h2', { class: 'h2' }, 'Фото прогресса'), h('button', { class: 'link', type: 'button', onclick: addProgressPhoto }, '+ Добавить фото')),
      S.photos === 'loading' || S.photos === null ? h('p', { class: 'muted small' }, 'Загружаем фото…') :
        S.photos.length ? h('div', { class: 'pgrid' }, S.photos.map((ph) => h('button', { type: 'button', class: 'pthumb', onclick: () => viewPhoto(ph), 'aria-label': `Фото от ${fmtDate(ph.date)}` }, h('img', { src: ph.img, alt: '' }), h('span', null, fmtShort(ph.date)))))
          : h('p', { class: 'muted' }, 'Фотографируйтесь раз в несколько недель в одном месте и при одном свете. Фото видите только вы.')));
};
function openLogWeight() {
  let d = iso(), v = '';
  const err = h('div');
  const inp = numInput(U.w(currentWeight()), { id: 'lw', oninput: (e) => { v = e.target.value; } });
  v = inp.value;
  const sh = openSheet('Записать вес', h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('label', { for: 'lw' }, 'Вес'), h('label', { class: 'unitbox' }, inp, h('span', null, U.wu()))),
    field('Дата', h('input', { class: 'inp', type: 'date', value: d, max: iso(), onchange: (e) => { d = e.target.value || iso(); } })),
    err,
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => {
      const kg = U.wIn(v);
      if (!kg || kg < 30 || kg > 300) { err.replaceChildren(errorText(`Введите вес от ${U.w(30, 0)} до ${U.w(300, 0)} ${U.wu()}.`)); return; }
      upsertWeight(d, kg); sh.close(true); toast('Вес сохранён. Нормы обновлены.'); render({ keepScroll: true });
    } }, 'Сохранить')));
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
}
function upsertWeight(d, kg) {
  const e = S.weights.entries.filter((x) => x.d !== d);
  e.push({ d, kg: round(kg, 2) });
  e.sort((a, b) => a.d.localeCompare(b.d));
  S.weights.entries = e; saveWeights();
}
function openWeightHistory() {
  const list = h('ul', { class: 'kv' });
  const draw = () => list.replaceChildren(...[...S.weights.entries].reverse().slice(0, 60).map((x) => h('li', null, h('span', null, fmtDate(x.d)), h('span', { class: 'row gap-s' }, `${U.ws(x.kg)} ${U.wu()}`,
    S.weights.entries.length > 1 ? ib('trash', `Удалить запись от ${fmtDate(x.d)}`, () => { S.weights.entries = S.weights.entries.filter((y) => y !== x); saveWeights(); draw(); render({ keepScroll: true }); }) : null))));
  draw();
  openSheet('История веса', list, { tall: true });
}
function openMeasure() {
  const last = S.meas.entries[S.meas.entries.length - 1] || {};
  const v = { d: iso() };
  const MK = [['chest', 'Грудь'], ['arms', 'Руки (по бицепсу)'], ['waist', 'Талия (на уровне пупка)'], ['legs', 'Ноги (середина бедра)']];
  const sh = openSheet('Записать замеры', h('div', { class: 'stack' },
    MK.map(([k, l]) => h('div', { class: 'field' }, h('label', { for: 'm-' + k }, l), h('label', { class: 'unitbox' }, numInput(last[k] ? U.l(last[k]) : '', { id: 'm-' + k, placeholder: '', oninput: (e) => { v[k] = U.lIn(e.target.value); } }), h('span', null, U.lu())))),
    field('Дата', h('input', { class: 'inp', type: 'date', value: v.d, max: iso(), onchange: (e) => { v.d = e.target.value || iso(); } })),
    h('p', { class: 'muted small' }, 'Измеряйте утром, в расслабленном состоянии, лента прилегает, но не давит.'),
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => {
      const entry = { d: v.d };
      for (const [k] of MK) { const val = v[k] !== undefined ? v[k] : last[k]; if (val && val > 5 && val < 300) entry[k] = round(val, 1); }
      if (Object.keys(entry).length < 2) { toast('Введите хотя бы один замер.'); return; }
      S.meas.entries = S.meas.entries.filter((x) => x.d !== entry.d).concat([entry]).sort((a, b) => a.d.localeCompare(b.d));
      saveMeas(); sh.close(true); toast('Замеры сохранены'); render({ keepScroll: true });
    } }, 'Сохранить')));
}
function addProgressPhoto() {
  pickFile(false, async (file) => {
    try {
      let { canvas } = await prepImage(file, 760, 0.75);
      let data = canvas.toDataURL('image/jpeg', 0.72);
      if (data.length > 230000) data = canvas.toDataURL('image/jpeg', 0.5);
      const id = uid();
      const doc = { kind: 'photo', date: iso(), created: new Date().toISOString(), img: data };
      Store.set('photo-' + id, doc);
      if (!Array.isArray(S.photos)) S.photos = [];
      S.photos.unshift(Object.assign({ key: 'photo-' + id }, doc));
      toast('Фото добавлено'); render({ keepScroll: true });
    } catch { toast('Не удалось открыть фото. Попробуйте JPEG или PNG.'); }
  });
}
function viewPhoto(ph) {
  const sh = openSheet(fmtDate(ph.date), h('div', { class: 'stack' }, h('img', { class: 'fullphoto', src: ph.img, alt: `Фото прогресса от ${fmtDate(ph.date)}` }),
    h('button', { class: 'btn ghost danger wide', type: 'button', onclick: () => confirmSheet('Удалить это фото?', 'Оно будет удалено без возможности восстановления.', 'Удалить фото', () => { Store.set(ph.key, null); S.photos = S.photos.filter((x) => x !== ph); toast('Фото удалено'); render({ keepScroll: true }); }, true) }, 'Удалить фото')), { tall: true });
}

// ================= profile =================
SCREENS.profile = () => {
  const p = S.profile, T = targets();
  const rows = [
    ['Возраст', pln(p.age, 'год', 'года', 'лет')], ['Пол', p.sex === 'male' ? 'Мужской' : 'Женский'], ['Рост', fmtHeight(p.heightCm)],
    ['Текущий вес', fmtW(currentWeight())], ['Целевой вес', fmtW(p.targetKg)], ['Цель', GOALS[p.goal].label],
    ['Активность', ACTIVITY[p.activity].label], ['Опыт', EXP[p.exp].label],
    ['Дни тренировок', p.days.map((d) => DOW3[d]).join(', ') || 'Нет'], ['Оборудование', p.equip.length ? p.equip.map((k) => EQUIP[k]).join(', ') : 'Только собственный вес'],
    ['Единицы', p.units === 'imperial' ? 'фунты, футы, дюймы' : 'кг, см'],
  ];
  const how = h('details', { class: 'how' }, h('summary', null, 'Как это рассчитано'),
    h('p', null, `Основной обмен (формула Миффлина — Сан Жеора): ${fmtN(T.bmr)} ккал. С учётом вашей активности поддержание веса — около ${fmtN(T.tdee)} ккал.`),
    h('p', null, p.goal === 'lose' ? `Для снижения веса норма до 500 ккал (20%) ниже поддержания и никогда не ниже ${p.sex === 'male' ? '1 500' : '1 200'} ккал или вашего основного обмена.` : p.goal === 'gain' ? 'Для набора массы норма немного выше поддержания (до 12%), чтобы прибавлялось меньше жира.' : 'Для поддержания норма равна расчётной потребности.'),
    h('p', null, `Белок — ${p.goal === 'lose' ? '2,0' : p.goal === 'gain' ? '1,8' : '1,6'} г на кг ${T.bmi > 30 ? 'расчётного веса для вашего роста' : 'массы тела'}, жиры — около 27% калорий, остальное — углеводы. Нормы обновляются после каждого взвешивания.`));
  return h('div', { class: 'screen' },
    h('header', { class: 'top' }, h('h1', { class: 'title' }, p.name), h('p', { class: 'muted' }, GOALS[p.goal].label)),
    h('section', { class: 'blk' }, h('h2', { class: 'h2' }, 'Дневные нормы'),
      h('div', { class: 'summary-k' },
        h('div', null, h('span', { class: 'big' }, fmtN(T.kcal)), h('span', { class: 'unit' }, 'ккал')),
        h('div', { class: 'macros3' }, macroMini('Белки', T.protein, 'blue'), macroMini('Углеводы', T.carbs, 'green'), macroMini('Жиры', T.fat, 'yellow'))),
      T.teen ? h('p', { class: 'note' }, 'До 18 лет нормы калорий мягче обычных. Прежде чем менять питание, посоветуйтесь с врачом или тренером.') : null,
      how),
    h('section', { class: 'blk' },
      h('div', { class: 'row between' }, h('h2', { class: 'h2' }, 'Ваши данные'), h('button', { class: 'link', type: 'button', onclick: openEditProfile }, 'Изменить')),
      h('ul', { class: 'kv' }, rows.map(([k, v]) => h('li', null, h('span', { class: 'muted' }, k), h('span', null, v))))),
    h('section', { class: 'blk' }, h('h2', { class: 'h2' }, 'Хранение'),
      h('p', { class: 'muted' }, Store.mode === 'cloud' ? 'Данные сохраняются в вашем аккаунте Claude. Другие пользователи приложения их не видят.' : Store.readOnlyCloud ? 'Данные сохраняются только на этом устройстве: приложение не может сохранять их в ваш аккаунт. Чтобы синхронизировать устройства, попросите владельца приложения дать вам доступ Contributor.' : 'Данные сохраняются только на этом устройстве.'),
      h('button', { class: 'btn ghost danger', type: 'button', onclick: () => confirmSheet('Удалить все данные?', 'Будут удалены профиль, план, дневник питания, тренировки, замеры и фото. Отменить это нельзя.', 'Удалить всё', resetAll, true) }, 'Удалить все данные')),
    h('p', { class: 'muted small center' }, 'Расчёты и планы — общие рекомендации, а не медицинский совет.'));
};
function openEditProfile() {
  const p = S.profile;
  const d = Object.assign({}, p, { days: [...p.days], equip: [...p.equip], isEdit: true });
  const err = h('div');
  const sh = openSheet('Изменить данные', h('div', { class: 'stack' },
    fAbout(d), fBody(d), h('h3', { class: 'sub' }, 'Главная цель'), fGoal(d), fActivity(d), fTraining(d), err,
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => {
      const e = validateProfile(d, ['about', 'body', 'goal', 'activity', 'training']);
      if (e) { err.replaceChildren(errorText(e)); err.scrollIntoView({ block: 'center' }); return; }
      const trainingChanged = d.goal !== p.goal || d.exp !== p.exp || d.days.join() !== p.days.join() || d.equip.slice().sort().join() !== p.equip.slice().sort().join();
      Object.assign(p, { name: d.name.trim(), age: d.age, sex: d.sex, units: d.units, heightCm: round(d.heightCm, 1), targetKg: round(d.targetKg, 2), goal: d.goal, activity: d.activity, exp: d.exp, days: d.days, equip: d.equip });
      saveProfile(); sh.close(true); render();
      if (trainingChanged) confirmSheet('Обновить план тренировок?', 'Изменились цель, опыт, дни или оборудование. Пересоздать план на неделю под новые данные? Записанные тренировки сохранятся.', 'Пересоздать', () => { S.plan = generatePlan(S.profile); savePlan(); toast('Новый план готов'); render(); });
      else toast('Сохранено. Нормы обновлены.');
    } }, 'Сохранить изменения')), { tall: true });
}
async function resetAll() {
  const keys = ['profile', 'plan', 'weights', 'measure', 'foods', 'records', ...Object.keys(S.days).map((d) => 'day-' + d)];
  const more = await Promise.all([Store.query('day'), Store.query('photo')]);
  for (const list of more) for (const x of list) keys.push(x.id);
  for (const k of new Set(keys)) Store.set(k, null);
  Object.assign(S, { profile: null, plan: null, weights: { kind: 'weights', entries: [] }, meas: { kind: 'measure', entries: [] }, foods: { kind: 'foods', products: {}, recent: [] }, records: { kind: 'records', ex: {} }, days: {}, done: {}, photos: null, tab: 'home', route: null, active: null });
  OB.step = 0; OB.preview = null;
  render(); toast('Все данные удалены');
}

// ================= start =================
async function start() {
  buildNav(); buildRestbar(); buildLivebar();
  $('#view').replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spin' }), h('span', { class: 'muted' }, 'Загружаем ваши данные…')));
  initAI();
  await Store.init();
  await loadAll();
  const closed = findActive();
  render();
  if (closed) toast('Незавершённая тренировка закрыта по времени последнего подхода.');
}
start();
