// End-to-end smoke test of the production build (docs/index.html).
// Runs offline: Google Fonts are blocked and the pinned Three.js build is served from node_modules.
// Usage: npm run build && npm test   (first time: npx playwright install chromium)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_JS = readFileSync(join(root, 'node_modules/three/build/three.min.js')); // devDependency, same file as the CDN build
const APP = pathToFileURL(join(root, 'docs/index.html')).href;
const OUT = join(root, 'tests/output');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push(m.text()); });
await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
await page.route('**/cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js', (r) =>
  r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_JS, headers: { 'access-control-allow-origin': '*' } }));
await page.clock.install();

try {
  await page.goto(APP);
  await page.clock.runFor(800);

  // 1. Onboarding
  await page.fill('input[autocomplete=given-name]', 'Тест');
  await page.locator('input.inp').nth(1).fill('30');
  await page.click('button.chip >> text="Мужской"');
  await page.click('text=Продолжить');
  await page.fill('#f-h', '180');
  await page.fill('#f-startKg', '82,5');
  await page.fill('#f-targetKg', '86');
  await page.click('text=Продолжить');
  await page.click('text=Набор мышечной массы'); await page.click('text=Продолжить');
  await page.click('text=Умеренная активность'); await page.click('text=Средний уровень'); await page.click('text=Продолжить');
  await page.click('button.link:has-text("Полный зал")');
  await page.click('button.chip >> text="Чт"');
  await page.click('text=Продолжить');
  await page.click('text=Создать план');
  await page.clock.runFor(300);
  const plan = await page.evaluate(() => ({ days: S.plan.days.length, kcal: targets().kcal }));
  check('onboarding creates a 4-day plan and targets', plan.days === 4 && plan.kcal > 2000, `${plan.days} days, ${plan.kcal} kcal`);
  check('home greets the user', await page.isVisible('text=Привет, Тест'));

  // 2. Workout with timer
  await page.click('#tabs button[data-tab=workouts]');
  await page.locator('.wk-b:has-text("Спина и бицепс")').first().click();
  await page.clock.runFor(300);
  const sessionDate = await page.evaluate(() => S.route.date);
  const isToday = await page.evaluate(() => S.route.date === iso());
  if (!isToday) { // make the session today's so the timer is available
    await page.click('text=Сделать сегодня');
    await page.clock.runFor(300);
  }
  await page.click('.stimer .btn.primary');
  await page.locator('.set:not(.hd) input').nth(0).fill('40');
  await page.locator('.chk').nth(0).click();
  await page.clock.fastForward(10 * 60 * 1000);
  await page.clock.runFor(1200);
  await page.locator('.chk').nth(1).click();
  await page.clock.runFor(500);
  await page.click('.stimer .btn.primary');
  await page.clock.runFor(500);
  const hist = await page.evaluate(() => S.records.hist || []);
  check('finished workout is saved with its duration', hist.length === 1 && hist[0].sec >= 600 && hist[0].sets === 2, hist[0] ? `${hist[0].sec} s, ${hist[0].sets} sets (planned ${sessionDate})` : 'no history');

  // 3. 3D exercise animation
  await page.evaluate(() => openExercise('row_db'));
  await page.clock.runFor(2500);
  await page.waitForSelector('.sheet .p3d .gl3d', { timeout: 15000 });
  const box = await page.locator('.sheet .p3d').boundingBox();
  const shot = await page.screenshot({ clip: box });
  check('3D model renders in the exercise sheet', shot.length > 20000, `${Math.round(shot.length / 1024)} KB frame`);
  await page.locator('.sheet .p3d .pbtn').dispatchEvent('click'); // fake clock freezes rAF-based actionability checks
  check('3D animation pauses', (await page.getAttribute('.sheet .p3d .pbtn', 'aria-label')) === 'Воспроизвести');
  await page.keyboard.press('Escape');
  await page.clock.runFor(500);
  check('3D canvas is disposed when the sheet closes', await page.evaluate(() => !document.querySelector('.gl3d')));

  // 4. Nutrition: manual entry
  await page.click('#tabs button[data-tab=nutrition]');
  await page.click('text=Вручную');
  await page.locator('.sheet input.inp').first().fill('Плов');
  await page.fill('.sheet .mini:has-text("Ккал") input', '540');
  await page.click('.sheet .btn.primary');
  await page.clock.runFor(300);
  check('food entry is added to the log', await page.isVisible('.food:has-text("Плов")'));

  // 5. Progress: weight entry updates targets
  await page.click('#tabs button[data-tab=progress]');
  await page.click('text=Записать вес');
  await page.fill('#lw', '83,4');
  await page.click('.sheet .btn.primary');
  await page.clock.runFor(300);
  const w = await page.evaluate(() => currentWeight());
  check('weight log updates current weight', Math.abs(w - 83.4) < 0.01, `${w} kg`);

  // 6. Profile editor renders cleanly
  await page.click('#tabs button[data-tab=profile]');
  await page.click('text=Изменить');
  await page.clock.runFor(300);
  check('profile editor has no stray "null" text', !(await page.locator('.sheet').innerText()).includes('null'));

  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  failed++;
  console.error('✗ test aborted:', e.message);
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {});
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
