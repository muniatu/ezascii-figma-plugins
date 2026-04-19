// esbuild pipeline for the Figma Text-to-ASCII plugin.
// Produces: dist/code.js, dist/ui.html (with inlined JS+CSS), dist/manifest.json
import { build, context } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

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
  //
  // Two traps we guard against:
  //   1. `</script>` substrings inside bundled JS (e.g. in FIGlet glyph data)
  //      terminate the wrapping <script> tag when Figma injects via document.write.
  //   2. `String.prototype.replace(pattern, replacementString)` interprets `$'`,
  //      `$&`, `$\``, `$$`, `$n` in the replacement as special patterns. FIGlet
  //      glyphs contain literal `$'` which otherwise gets expanded to "everything
  //      after the match" — injecting phantom `</script></body></html>` chunks.
  //      Solution: pass a FUNCTION as the replacement, which skips pattern processing.
  const html = await readFile('src/ui.html', 'utf8');
  const rawJs = await readFile(`${outDir}/ui.js`, 'utf8').catch(() => '');
  const css = await readFile('../shared/src/branding.css', 'utf8');
  const safeJs = rawJs
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
  const inlined = html
    .replace('/*__BRANDING_CSS__*/', () => css)
    .replace('/*__UI_JS__*/', () => safeJs);
  await writeFile(`${outDir}/ui.html`, inlined);
}

await Promise.all([buildCode(), buildUi()]);
await bundleHtml();

if (watch) {
  console.log('Watching for changes…');
}
