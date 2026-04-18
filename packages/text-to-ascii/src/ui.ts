import { FONTS, DEFAULT_FONT, renderFigletText, mountCtaFooter } from '@ezascii/shared';

const textEl = document.getElementById('text') as HTMLTextAreaElement;
const fontEl = document.getElementById('font') as HTMLSelectElement;
const sizeEl = document.getElementById('size') as HTMLSelectElement;
const alignEl = document.getElementById('align') as HTMLSelectElement;
const previewEl = document.getElementById('preview') as HTMLPreElement;
const insertEl = document.getElementById('insert') as HTMLButtonElement;
const footerSlot = document.getElementById('footer-slot') as HTMLDivElement;

// Populate font dropdown
for (const f of FONTS) {
  const opt = document.createElement('option');
  opt.value = f.label;
  opt.textContent = f.label;
  fontEl.appendChild(opt);
}
fontEl.value = DEFAULT_FONT.label;

function refreshPreview() {
  try {
    previewEl.textContent = renderFigletText(textEl.value || 'EZASCII', fontEl.value);
  } catch (err) {
    previewEl.textContent = `(error: ${err instanceof Error ? err.message : 'unknown'})`;
  }
}

let previewTimer: number | null = null;
function schedulePreview() {
  if (previewTimer != null) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 80);
}

textEl.addEventListener('input', schedulePreview);
fontEl.addEventListener('change', refreshPreview);

insertEl.addEventListener('click', () => {
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
});

mountCtaFooter(footerSlot, {
  label: 'Need more fonts?',
  linkText: 'All 300 on ezascii.com →',
  targetPath: '/text-to-ascii-art',
  campaign: 'text-plugin',
});

refreshPreview();
