// esbuild pipeline for the Figma Text-to-ASCII plugin.
// Produces: dist/code.js, dist/ui.html (with inlined JS+CSS), dist/manifest.json
import { build, context } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outDir = 'dist';

await mkdir(outDir, { recursive: true });

async function buildCode() {
  const opts = {
    entryPoints: ['src/code.ts'],
    bundle: true,
    outfile: `${outDir}/code.js`,
    target: 'es2017',
    platform: 'browser',
    format: 'iife',
    logLevel: 'info',
  };
  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
  } else {
    await build(opts);
  }
}

async function buildUi() {
  const opts = {
    entryPoints: ['src/ui.ts'],
    bundle: true,
    outfile: `${outDir}/ui.js`,
    target: 'es2017',
    platform: 'browser',
    format: 'iife',
    logLevel: 'info',
  };
  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
  } else {
    await build(opts);
  }
}

async function bundleHtml() {
  // Inline UI script + shared branding CSS into a single ui.html.
  const html = await readFile('src/ui.html', 'utf8');
  const js = await readFile(`${outDir}/ui.js`, 'utf8').catch(() => '');
  const css = await readFile('../shared/src/branding.css', 'utf8');
  const inlined = html
    .replace('/*__BRANDING_CSS__*/', css)
    .replace('/*__UI_JS__*/', js);
  await writeFile(`${outDir}/ui.html`, inlined);
}

async function copyManifest() {
  await copyFile('manifest.json', `${outDir}/manifest.json`);
}

await Promise.all([buildCode(), buildUi()]);
await bundleHtml();
await copyManifest();

if (watch) {
  console.log('Watching for changes…');
}
