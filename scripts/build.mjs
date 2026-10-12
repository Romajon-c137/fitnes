// Builds the single-file app: src/js/*.js + src/styles.css inlined into src/index.html -> docs/index.html
// Usage: node scripts/build.mjs [--dev]   (--dev skips minification)
// Optional cloud sync: set SUPABASE_URL and SUPABASE_ANON_KEY (env vars or .env) to bundle the Supabase client.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
// Order matters: later files use globals declared by earlier ones.
const parts = ['engine.js', 'anims.js', 'anim3d.js', 'exercises.js', 'core.js', 'ui.js', 'screens1.js', 'screens2.js'];

// .env is for local builds only; on Vercel the same names come from Project Settings → Environment Variables.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
// Fallback: supabase.config.json in the repo (the publishable key is public by design; never put a secret key here).
const cfgFile = join(root, 'supabase.config.json');
const fileCfg = existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {};
const pick = (name, fallback) => (process.env[name] !== undefined ? process.env[name] : fallback || '');
const supaUrl = pick('SUPABASE_URL', fileCfg.url).trim().replace(/\/(rest\/v1\/?)?$/, '').replace(/\/+$/, '');
const supaKey = pick('SUPABASE_ANON_KEY', fileCfg.publishableKey).trim();
if (/^sb_secret_|service_role/.test(supaKey)) throw new Error('Use the publishable/anon key, not a secret key');
if (!!supaUrl !== !!supaKey) throw new Error('Set both SUPABASE_URL and SUPABASE_ANON_KEY, or neither');
if (supaUrl && !/^https:\/\/\S+$/.test(supaUrl)) throw new Error(`SUPABASE_URL must start with https:// (got "${supaUrl}")`);

let js = parts
  .map((f) => readFileSync(join(root, 'src/js', f), 'utf8')
    .replace(/^if \(typeof module !== 'undefined'\).*$/m, '') // Node test exports
    .replace(/^'use strict';\n/m, ''))
  .join('\n');
js = `'use strict';\n${js}`;
if (supaUrl) {
  const lib = await build({
    stdin: { contents: "import { createClient } from '@supabase/supabase-js'; window.supabase = { createClient };", resolveDir: root },
    bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: !dev, write: false, legalComments: 'none', charset: 'utf8',
  });
  const cfg = `window.REP_CONFIG = ${JSON.stringify({ supabaseUrl: supaUrl, supabaseKey: supaKey })};`;
  js = `${lib.outputFiles[0].text}\n${cfg}\n${js}`;
}
let css = readFileSync(join(root, 'src/styles.css'), 'utf8');

if (!dev) {
  js = (await transform(js, { loader: 'js', minify: true, target: 'es2020', charset: 'utf8', legalComments: 'none' })).code;
  css = (await transform(css, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' })).code;
}
if (/<\/script/i.test(js)) throw new Error('Inline script must not contain "</script"');

const html = readFileSync(join(root, 'src/index.html'), 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs/index.html'), html);
console.log(`docs/index.html  ${(html.length / 1024).toFixed(1)} KB${dev ? ' (dev, not minified)' : ''}${supaUrl ? ' + Supabase sync' : ''}`);
