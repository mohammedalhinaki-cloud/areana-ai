// GitHub Pages has no SPA rewrite rules: any deep link such as /<repo>/reader
// is answered with the site's 404.html. Shipping a copy of the built
// index.html as 404.html lets React Router (mounted on the same base) render
// the requested route in the browser.
import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(projectRoot, 'dist');
const source = resolve(distDir, 'index.html');
const target = resolve(distDir, '404.html');

try {
  await access(source, constants.R_OK);
} catch {
  console.error('make-pages-404: dist/index.html is missing — run "npm run build" first.');
  process.exit(1);
}

await copyFile(source, target);
console.log('make-pages-404: wrote dist/404.html');
