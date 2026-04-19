import { FONTS, DEFAULT_FONT, renderFigletText, buildCtaUrl } from '@ezascii/shared';

function showFatalError(err: unknown, stage: string) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  // eslint-disable-next-line no-console
  console.error(`[ezascii-text] ${stage}:`, err);
  const pre = document.createElement('pre');
  pre.style.cssText =
    'margin:0;padding:16px;color:#f87171;font-family:monospace;font-size:11px;white-space:pre-wrap;background:#0a0a0a;min-height:100vh;';
  pre.textContent = `⚠ Plugin error (${stage})\n\n${msg}`;
  document.body.innerHTML = '';
  document.body.appendChild(pre);
}

window.addEventListener('error', (e) => showFatalError(e.error ?? e.message, 'runtime'));
window.addEventListener('unhandledrejection', (e) => showFatalError(e.reason, 'promise'));

try {
  const textEl = document.getElementById('text') as HTMLTextAreaElement;
  const fontEl = document.getElementById('font') as HTMLSelectElement;
  const sizeEl = document.getElementById('size') as HTMLSelectElement;
  const alignEl = document.getElementById('align') as HTMLSelectElement;
  const previewEl = document.getElementById('preview') as HTMLPreElement;
  const insertEl = document.getElementById('insert') as HTMLButtonElement;
  const upgradeEl = document.getElementById('upgrade') as HTMLButtonElement;

  for (const f of FONTS) {
    const opt = document.createElement('option');
    opt.value = f.label;
    opt.textContent = f.label;
    fontEl.appendChild(opt);
  }
  fontEl.value = DEFAULT_FONT.label;

  const refreshPreview = () => {
    try {
      previewEl.textContent = renderFigletText(textEl.value || 'EZASCII', fontEl.value);
    } catch (err) {
      previewEl.textContent = `(render error: ${err instanceof Error ? err.message : 'unknown'})`;
    }
  };

  let previewTimer: number | null = null;
  const schedulePreview = () => {
    if (previewTimer != null) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(refreshPreview, 80);
  };

  textEl.addEventListener('input', schedulePreview);
  fontEl.addEventListener('change', refreshPreview);

  insertEl.addEventListener('click', () => {
    try {
      const ascii = renderFigletText(textEl.value || 'EZASCII', fontEl.value);
      parent.postMessage(
        {
          pluginMessage: {
            type: 'insert-text',
            ascii,
            fontSize: parseInt(sizeEl.value, 10),
            align: alignEl.value,
          },
        },
        '*',
      );
    } catch (err) {
      showFatalError(err, 'insert');
    }
  });

  upgradeEl.addEventListener('click', () => {
    window.open(buildCtaUrl('/text-to-ascii-art', 'text-plugin'), '_blank', 'noopener');
  });

  refreshPreview();
} catch (err) {
  showFatalError(err, 'bootstrap');
}
