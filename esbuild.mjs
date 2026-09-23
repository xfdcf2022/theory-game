import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const serve = args.includes('--serve');

const common = {
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'dist/game.js',
  format: 'esm',
  target: ['es2020'],
  sourcemap: watch || serve,
  logLevel: 'info',
  legalComments: 'none',
};

async function copyHtml() {
  const html = readFileSync('index.html', 'utf8');
  writeFileSync('dist/index.html', html);
}

if (serve) {
  const ctx = await esbuild.context(common);
  await ctx.serve({ servedir: '.', port: 4173 });
  console.log('dev server: http://localhost:4173');
} else if (watch) {
  const ctx = await esbuild.context(common);
  await ctx.watch();
  copyHtml();
  console.log('watching…');
} else {
  await esbuild.build(common);
  copyHtml();
  console.log('built dist/');
}