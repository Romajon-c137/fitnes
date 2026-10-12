// Supabase sync test against a mocked Supabase (auth + PostgREST for public.docs). Runs offline.
// Usage: npm run test:supabase   (builds docs/index.html against a fake Supabase URL, then rebuilds the normal one)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPA = 'https://mock-project.supabase.co';
const build = (env) => execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { cwd: root, env: env ? { ...process.env, ...env } : process.env, stdio: 'inherit' });
build({ SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: 'test-anon-key' });

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// In-memory public.docs, keyed by user_id + key.
const rows = new Map();
const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'test@example.com', aud: 'authenticated', role: 'authenticated' };
const session = () => ({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'ref', user: USER });
const filters = (url) => {
  const f = [];
  for (const [k, v] of url.searchParams) {
    const m = v.match(/^(eq|gte)\.(.*)$/);
    if (m && k !== 'select') f.push([k, m[1], decodeURIComponent(m[2])]);
  }
  return (r) => f.every(([k, op, v]) => (op === 'eq' ? String(r[k]) === v : r[k] != null && r[k] >= v));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/fonts.googleapis.com/**', (r) => r.abort());
await ctx.route('**/fonts.gstatic.com/**', (r) => r.abort());
let rejectWrongPassword = true, googleOn = false, authorizeUrl = null;
await ctx.route(SUPA + '/auth/v1/**', async (r) => {
  const url = new URL(r.request().url());
  const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  if (url.pathname.endsWith('/token')) {
    const body = r.request().postDataJSON();
    if (rejectWrongPassword && body.password !== 'secret1') return json(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return json(200, session());
  }
  if (url.pathname.endsWith('/settings')) return json(200, { external: { email: true, google: googleOn } });
  if (url.pathname.endsWith('/authorize')) { authorizeUrl = url; return r.fulfill({ status: 200, contentType: 'text/html', body: 'google' }); }
  if (url.pathname.endsWith('/logout')) return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  if (url.pathname.endsWith('/user')) return json(200, USER);
  return json(404, {});
});
await ctx.route(SUPA + '/rest/v1/docs**', async (r) => {
  const req = r.request(), url = new URL(req.url()), method = req.method();
  const send = (status, body) => r.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  if (req.headers().authorization !== 'Bearer tok') return send(401, { code: 'PGRST301', message: 'JWT required' });
  if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (method === 'GET') {
    const sel = (url.searchParams.get('select') || '*').split(',').map((s) => s.trim());
    const out = [...rows.values()].filter(filters(url)).map((x) => (sel[0] === '*' ? x : Object.fromEntries(sel.map((k) => [k, x[k]]))));
    if ((req.headers().accept || '').includes('vnd.pgrst.object')) return out.length === 1 ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'not one row' });
    return send(200, out);
  }
  if (method === 'POST') {
    const body = req.postDataJSON();
    for (const x of [].concat(body)) {
      if (x.user_id !== USER.id) return send(403, { code: '42501', message: 'row-level security' });
      rows.set(x.user_id + '/' + x.key, x);
    }
    return send(201);
  }
  if (method === 'DELETE') { for (const [k, x] of rows) if (filters(url)(x)) rows.delete(k); return send(204); }
  return send(405, {});
});

const APP = pathToFileURL(join(root, 'docs/index.html')).href;
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  // Device data created before the account exists.
  await page.goto(APP);
  await page.waitForSelector('text=Вход');
  check('sign-in screen is shown first', await page.isVisible('text=Продолжить без аккаунта'));
  await page.click('text=Продолжить без аккаунта');
  await page.fill('input[autocomplete=given-name]', 'Локал');
  check('"without account" leads to onboarding', await page.isVisible('text=О вас'));
  await page.evaluate(() => { S.profile = { name: 'Локал', age: 30, sex: 'male', units: 'metric', heightCm: 180, startKg: 80, targetKg: 80, goal: 'maintain', activity: 'moderate', exp: 'intermediate', days: [0, 2, 4], equip: [] }; saveProfile(); saveWeights(); });
  await page.reload();
  await page.waitForSelector('text=Привет, Локал');
  check('offline choice is remembered', true);

  // Sign in from the profile: device data moves into the empty account.
  await page.click('#tabs button[data-tab=profile]');
  await page.click('text=Войти или создать аккаунт');
  await page.waitForSelector('text=Вход');
  await page.fill('input[type=email]', USER.email);
  await page.fill('input[type=password]', 'wrong12');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Неверная почта или пароль.');
  check('wrong password shows a readable error', true);
  await page.fill('input[type=password]', 'secret1');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Привет, Локал');
  check('local data is adopted by the new account', rows.has(USER.id + '/profile') && rows.get(USER.id + '/profile').data.name === 'Локал', `${rows.size} rows`);

  // Writes go to Supabase with kind/date columns.
  await page.evaluate(() => { dayDoc(iso()).food.push({ id: 'x', name: 'Яблоко', kcal: 52, p: 0, c: 14, f: 0 }); saveDay(iso()); });
  await page.waitForTimeout(300);
  const today = await page.evaluate(() => iso());
  const day = rows.get(USER.id + '/day-' + today);
  check('day document is upserted with kind and date', day && day.kind === 'day' && day.date === today && day.data.food.length === 1);

  // A fresh device (no localStorage) loads everything from the account after reload.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('fitapp:local:')) localStorage.removeItem(k); });
  await page.reload();
  await page.waitForSelector('text=Привет, Локал');
  check('session survives reload and data loads from Supabase', await page.evaluate((d) => !!S.days[d] && S.days[d].food.length === 1 && Store.mode === 'supabase', today));
  await page.click('#tabs button[data-tab=profile]');
  check('profile shows the signed-in account', await page.isVisible('text=' + USER.email));

  // Server down on load: an error screen instead of onboarding over real data.
  await ctx.unroute(SUPA + '/rest/v1/docs**');
  await ctx.route(SUPA + '/rest/v1/docs**', (r) => r.abort());
  await page.reload();
  await page.waitForSelector('text=Не удалось загрузить данные');
  check('load failure does not show onboarding', !(await page.isVisible('text=О вас')));

  // Sign out returns to the sign-in screen.
  await ctx.unroute(SUPA + '/rest/v1/docs**');
  await ctx.route(SUPA + '/rest/v1/docs**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'access-control-allow-origin': '*' } }));
  await page.evaluate(() => Store.sb.auth.signOut());
  await page.reload();
  await page.waitForSelector('text=Вход');
  check('sign-out returns to the sign-in screen', true);

  // Google: a disabled provider is explained in the app, an enabled one redirects to Supabase /authorize.
  await page.click('text=Войти через Google');
  await page.waitForSelector('text=Вход через Google ещё не включён');
  check('disabled Google provider shows a hint', true);
  googleOn = true;
  await page.click('text=Войти через Google');
  await page.waitForURL(/\/auth\/v1\/authorize/);
  check('Google button redirects to Supabase OAuth', authorizeUrl && authorizeUrl.searchParams.get('provider') === 'google' && /index\.html$/.test(authorizeUrl.searchParams.get('redirect_to') || ''), String(authorizeUrl && authorizeUrl.searchParams.get('redirect_to')));
  await page.goto(APP + '#error=access_denied&error_description=User+cancelled');
  await page.waitForSelector('text=Вход не удался: User cancelled');
  check('OAuth error from the URL is shown and cleared', !(await page.evaluate(() => location.hash)));

  check('no runtime errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  failed++;
  console.error('✗ test crashed:', e.message);
} finally {
  await browser.close();
  build(null); // back to the normal build (supabase.config.json)
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll Supabase checks passed');
process.exit(failed ? 1 : 0);
