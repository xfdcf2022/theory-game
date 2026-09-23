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

async function copyHtml(dev) {
  const html = readFileSync('index.html', 'utf8').replace(
    dev ? /src="\/src\/main\.js"/ : /src="\/src\/main\.js"/,
    dev ? 'src="/src/main.js"' : 'src="game.js"',
  );
  writeFileSync('dist/index.html', html);
  writeFileSync('dist/style.css', readFileSync('style.css', 'utf8'));
}

if (serve) {
  const ctx = await esbuild.context(common);
  await ctx.serve({ servedir: '.', port: 4173 });
  console.log('dev server: http://localhost:4173');
} else if (watch) {
  const ctx = await esbuild.context(common);
  await ctx.watch();
  copyHtml(false);
  console.log('watching…');
} else {
  await esbuild.build(common);
  copyHtml(false);
  console.log('built dist/');
}