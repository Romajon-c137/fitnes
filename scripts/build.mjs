// Builds the single-file app: src/js/*.js + src/styles.css inlined into src/index.html -> docs/index.html
// Usage: node scripts/build.mjs [--dev]   (--dev skips minification)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
// Order matters: later files use globals declared by earlier ones.
const parts = ['engine.js', 'anims.js', 'anim3d.js', 'exercises.js', 'core.js', 'ui.js', 'screens1.js', 'screens2.js'];

let js = parts
  .map((f) => readFileSync(join(root, 'src/js', f), 'utf8')
    .replace(/^if \(typeof module !== 'undefined'\).*$/m, '') // Node test exports
    .replace(/^'use strict';\n/m, ''))
  .join('\n');
js = `'use strict';\n${js}`;
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
console.log(`docs/index.html  ${(html.length / 1024).toFixed(1)} KB${dev ? ' (dev, not minified)' : ''}`);
