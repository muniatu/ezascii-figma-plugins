import {
  renderAsciiTextGrid,
  getCharset,
  type CharsetKey,
  type AsciiGrid,
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

/**
 * Sample the average RGB of the source-image block that corresponds to the
 * given grid cell. Returns null if the cell has no pixels (shouldn't happen
 * in practice unless grid dimensions don't match source).
 */
function sampleBlockColor(
  src: ImageData,
  grid: AsciiGrid,
  row: number,
  col: number,
): { r: number; g: number; b: number } | null {
  const sampleW = src.width / grid.cols;
  const sampleH = src.height / grid.rows;
  const startX = Math.floor(col * sampleW);
  const startY = Math.floor(row * sampleH);
  const endX = Math.min(Math.floor((col + 1) * sampleW), src.width);
  const endY = Math.min(Math.floor((row + 1) * sampleH), src.height);
  let tr = 0;
  let tg = 0;
  let tb = 0;
  let n = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const i = (y * src.width + x) * 4;
      tr += src.data[i];
      tg += src.data[i + 1];
      tb += src.data[i + 2];
      n++;
    }
  }
  if (n === 0) return null;
  return { r: Math.floor(tr / n), g: Math.floor(tg / n), b: Math.floor(tb / n) };
}

function toHex(v: number): string {
  return v.toString(16).padStart(2, '0');
}

/**
 * Snap RGB to 4-bit-per-channel resolution (16 steps per channel, 4096 colors).
 * Visually indistinguishable for character-level ASCII but collapses adjacent
 * similar-color cells into longer runs — huge reduction in range count, which
 * is what makes setRangeFills cheap enough to not crash the sandbox.
 */
function quantize(v: number): number {
  return v & 0xf0;
}

/**
 * Build groups of consecutive characters sharing the same color (for
 * compactly applying range fills in the Figma sandbox). `hex` is null for
 * whitespace/empty ranges where we don't apply a fill.
 */
interface ColorRange {
  start: number;
  end: number;
  hex: string;
}

function buildColorRanges(
  grid: AsciiGrid,
  src: ImageData,
): { text: string; ranges: ColorRange[] } {
  let text = '';
  const ranges: ColorRange[] = [];
  let runStart = -1;
  let runHex = '';

  const flush = (end: number) => {
    if (runStart >= 0 && runHex) {
      ranges.push({ start: runStart, end, hex: runHex });
    }
    runStart = -1;
    runHex = '';
  };

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const ch = grid.lines[r][c] ?? ' ';
      const charIdx = text.length;
      text += ch;

      if (ch === ' ') {
        flush(charIdx);
        continue;
      }

      const color = sampleBlockColor(src, grid, r, c);
      if (!color) {
        flush(charIdx);
        continue;
      }

      // Quantize before building the hex so similar-color neighbors merge
      // into a single range — keeps setRangeFills count manageable.
      const qr = quantize(color.r);
      const qg = quantize(color.g);
      const qb = quantize(color.b);
      const hex = `#${toHex(qr)}${toHex(qg)}${toHex(qb)}`;
      if (hex === runHex) {
        // extend the current run
        continue;
      }
      flush(charIdx);
      runStart = charIdx;
      runHex = hex;
    }
    // newline break — flush any open run, then append \n
    flush(text.length);
    text += '\n';
  }
  flush(text.length);
  // Drop the trailing newline the loop leaves behind
  if (text.endsWith('\n')) text = text.slice(0, -1);

  return { text, ranges };
}

try {
  const statusEl = document.getElementById('status') as HTMLDivElement;
  const blockSizeEl = document.getElementById('blockSize') as HTMLInputElement;
  const blockSizeValEl = document.getElementById('blockSizeVal') as HTMLSpanElement;
  const charsetEl = document.getElementById('charset') as HTMLSelectElement;
  const colorEl = document.getElementById('color') as HTMLInputElement;
  const invertEl = document.getElementById('invert') as HTMLInputElement;
  const previewEl = document.getElementById('preview') as HTMLPreElement;
  const emptyEl = document.getElementById('preview-empty') as HTMLDivElement;
  const convertEl = document.getElementById('convert') as HTMLButtonElement;
  const upgradeEl = document.getElementById('upgrade') as HTMLButtonElement;
  const bmcSlot = document.getElementById('bmc-slot') as HTMLDivElement;

  let currentImageData: ImageData | null = null;

  // Courier New in Figma: char cell ≈ 0.6 × fontSize wide, ~1.0 tall.
  // Correcting row count preserves source aspect in the rendered text layer.
  const MONO_CHAR_ASPECT = 0.6;

  async function decodeToImageData(bytes: Uint8Array): Promise<ImageData> {
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

  function buildGrid(src: ImageData): AsciiGrid {
    return renderAsciiTextGrid(src, {
      charset: getCharset(charsetEl.value as CharsetKey),
      blockSize: parseInt(blockSizeEl.value, 10),
      invert: invertEl.checked,
      charAspectRatio: MONO_CHAR_ASPECT,
    });
  }

  function refreshPreview() {
    if (!currentImageData) return;
    const grid = buildGrid(currentImageData);
    emptyEl.style.display = 'none';
    previewEl.style.display = '';
    previewEl.innerHTML = '';

    if (colorEl.checked) {
      // Colored preview: one <span> per colored run.
      const { text, ranges } = buildColorRanges(grid, currentImageData);
      let cursor = 0;
      for (const range of ranges) {
        if (range.start > cursor) {
          previewEl.appendChild(document.createTextNode(text.slice(cursor, range.start)));
        }
        const span = document.createElement('span');
        span.style.color = range.hex;
        span.textContent = text.slice(range.start, range.end);
        previewEl.appendChild(span);
        cursor = range.end;
      }
      if (cursor < text.length) {
        previewEl.appendChild(document.createTextNode(text.slice(cursor)));
      }
    } else {
      previewEl.textContent = grid.lines.join('\n');
    }

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
  colorEl.addEventListener('change', refreshPreview);
  invertEl.addEventListener('change', refreshPreview);

  // Hard cap on color ranges to protect the sandbox. In practice quantization
  // keeps us well under this, but very noisy images can still blow past it.
  const MAX_COLOR_RANGES = 2000;

  convertEl.addEventListener('click', () => {
    if (!currentImageData) return;
    try {
      const grid = buildGrid(currentImageData);
      if (colorEl.checked) {
        const { text, ranges } = buildColorRanges(grid, currentImageData);
        const safeRanges = ranges.slice(0, MAX_COLOR_RANGES);
        if (ranges.length > MAX_COLOR_RANGES) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ezascii-image] color ranges capped at ${MAX_COLOR_RANGES} (had ${ranges.length}) — try a bigger block size or turn off Color for this image.`,
          );
        }
        parent.postMessage(
          { pluginMessage: { type: 'insert-text', text, ranges: safeRanges } },
          '*',
        );
      } else {
        parent.postMessage(
          { pluginMessage: { type: 'insert-text', text: grid.lines.join('\n') } },
          '*',
        );
      }
    } catch (err) {
      showFatalError(err, 'convert');
    }
  });

  upgradeEl.addEventListener('click', () => {
    window.open(buildCtaUrl('/image-to-ascii', 'image-plugin'), '_blank', 'noopener');
  });

  if (bmcSlot) mountBmcLink(bmcSlot);

  window.addEventListener('message', async (e) => {
    const msg = (e.data as { pluginMessage?: unknown })?.pluginMessage;
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type: string; bytes?: Uint8Array };

    if (m.type === 'image-bytes' && m.bytes) {
      try {
        currentImageData = await decodeToImageData(new Uint8Array(m.bytes));
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
      statusEl.classList.remove('active');
      statusEl.textContent = 'Select an image or frame in Figma';
      setEmpty('Select an image or frame in Figma to preview its ASCII version here.');
    }
  });

  setEmpty('Select an image or frame in Figma to preview its ASCII version here.');
} catch (err) {
  showFatalError(err, 'bootstrap');
}
