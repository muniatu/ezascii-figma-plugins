import {
  renderAsciiTextGrid,
  getCharset,
  type CharsetKey,
  buildCtaUrl,
  mountBmcLink,
} from '@ezascii/shared';

function showFatalError(err: unknown, stage: string) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  // eslint-disable-next-line no-console
  console.error(`[ezascii-image] ${stage}:`, err);
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
  const statusEl = document.getElementById('status') as HTMLDivElement;
  const blockSizeEl = document.getElementById('blockSize') as HTMLInputElement;
  const blockSizeValEl = document.getElementById('blockSizeVal') as HTMLSpanElement;
  const charsetEl = document.getElementById('charset') as HTMLSelectElement;
  const outputEl = document.getElementById('output') as HTMLSelectElement;
  const invertEl = document.getElementById('invert') as HTMLInputElement;
  const previewEl = document.getElementById('preview') as HTMLPreElement;
  const emptyEl = document.getElementById('preview-empty') as HTMLDivElement;
  const convertEl = document.getElementById('convert') as HTMLButtonElement;
  const upgradeEl = document.getElementById('upgrade') as HTMLButtonElement;
  const bmcSlot = document.getElementById('bmc-slot') as HTMLDivElement;

  let currentImageData: ImageData | null = null;
  let currentPngBytes: Uint8Array | null = null;

  async function decodeToImageData(bytes: Uint8Array): Promise<ImageData> {
    // copy bytes into a fresh ArrayBuffer to satisfy strict Blob constructor typing
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  function setEmpty(msg: string) {
    emptyEl.textContent = msg;
    emptyEl.style.display = 'block';
    previewEl.style.display = 'none';
    convertEl.disabled = true;
  }

  function refreshPreview() {
    if (!currentImageData) return;
    const grid = renderAsciiTextGrid(currentImageData, {
      charset: getCharset(charsetEl.value as CharsetKey),
      blockSize: parseInt(blockSizeEl.value, 10),
      invert: invertEl.checked,
    });
    previewEl.textContent = grid.lines.join('\n');
    previewEl.style.display = '';
    emptyEl.style.display = 'none';
    convertEl.disabled = false;
  }

  let previewTimer: number | null = null;
  function schedulePreview() {
    if (previewTimer != null) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(refreshPreview, 60);
  }

  blockSizeEl.addEventListener('input', () => {
    blockSizeValEl.textContent = blockSizeEl.value;
    schedulePreview();
  });
  charsetEl.addEventListener('change', refreshPreview);
  invertEl.addEventListener('change', refreshPreview);

  convertEl.addEventListener('click', async () => {
    if (!currentImageData || !currentPngBytes) return;
    try {
      const outputType = outputEl.value as 'text' | 'image';
      const blockSize = parseInt(blockSizeEl.value, 10);
      const grid = renderAsciiTextGrid(currentImageData, {
        charset: getCharset(charsetEl.value as CharsetKey),
        blockSize,
        invert: invertEl.checked,
      });

      if (outputType === 'text') {
        parent.postMessage(
          { pluginMessage: { type: 'insert-text', lines: grid.lines } },
          '*',
        );
        return;
      }

      // Rendered image: paint ASCII onto an OffscreenCanvas and send the PNG bytes.
      const canvas = new OffscreenCanvas(grid.cols * blockSize, grid.rows * blockSize);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = `${blockSize}px "Courier New", monospace`;
      ctx.textBaseline = 'top';
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          ctx.fillText(grid.lines[r][c] ?? ' ', c * blockSize, r * blockSize);
        }
      }
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const outBytes = new Uint8Array(await blob.arrayBuffer());
      parent.postMessage(
        {
          pluginMessage: {
            type: 'insert-image',
            bytes: outBytes,
            width: canvas.width,
            height: canvas.height,
          },
        },
        '*',
      );
    } catch (err) {
      showFatalError(err, 'convert');
    }
  });

  upgradeEl.addEventListener('click', () => {
    window.open(buildCtaUrl('/image-to-ascii', 'image-plugin'), '_blank', 'noopener');
  });

  if (bmcSlot) mountBmcLink(bmcSlot);

  // Listen for image bytes coming from the sandbox
  window.addEventListener('message', async (e) => {
    const msg = (e.data as { pluginMessage?: unknown })?.pluginMessage;
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type: string; bytes?: Uint8Array };

    if (m.type === 'image-bytes' && m.bytes) {
      try {
        currentPngBytes = new Uint8Array(m.bytes);
        currentImageData = await decodeToImageData(currentPngBytes);
        statusEl.classList.add('active');
        statusEl.textContent = `✓ Image loaded — ${currentImageData.width}×${currentImageData.height}`;
        refreshPreview();
      } catch (err) {
        statusEl.classList.remove('active');
        statusEl.textContent = 'Could not decode selected image';
        setEmpty('The selected node could not be exported as an image.');
        // eslint-disable-next-line no-console
        console.error('[ezascii-image] decode error:', err);
      }
    } else if (m.type === 'no-selection') {
      currentImageData = null;
      currentPngBytes = null;
      statusEl.classList.remove('active');
      statusEl.textContent = 'Select an image or frame in Figma';
      setEmpty('Select an image or frame in Figma to preview its ASCII version here.');
    }
  });

  setEmpty('Select an image or frame in Figma to preview its ASCII version here.');
} catch (err) {
  showFatalError(err, 'bootstrap');
}
