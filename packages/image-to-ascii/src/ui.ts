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
 * Coarser than the preview but the layered-nodes strategy keeps cost tied to
 * *distinct* colors, not characters — typical images quantize down to 30-80
 * unique colors at this precision, well inside a snappy insert budget.
 */
function quantize(v: number): number {
  return v & 0xf0;
}

/**
 * Fast color strategy: split the ASCII into one "layer" per unique color.
 * Each layer is the same grid, but only the cells matching that color keep
 * their character — the rest are spaces. In Figma we create one TextNode
 * per layer (all stacked at the same origin inside a group). Each node
 * has a single fill — no setRangeFills needed, so cost scales with number
 * of distinct colors, not number of characters. Much faster.
 */
interface ColorLayer {
  hex: string;
  text: string;
}

function buildColorLayers(
  grid: AsciiGrid,
  src: ImageData,
): { fullText: string; layers: ColorLayer[] } {
  const fullText = grid.lines.map((l) => l.padEnd(grid.cols, ' ')).join('\n');

  // Per-color 2D array of chars, initialized lazily. Rows are kept at
  // grid.cols length so the layer preserves the same grid bounding box.
  const layerMap = new Map<string, string[][]>();

  const getLayer = (hex: string): string[][] => {
    let layer = layerMap.get(hex);
    if (!layer) {
      layer = [];
      for (let i = 0; i < grid.rows; i++) {
        layer.push(Array.from({ length: grid.cols }, () => ' '));
      }
      layerMap.set(hex, layer);
    }
    return layer;
  };

  for (let r = 0; r < grid.rows; r++) {
    const line = grid.lines[r] ?? '';
    for (let c = 0; c < grid.cols; c++) {
      const ch = line[c] ?? ' ';
      if (ch === ' ') continue;

      const color = sampleBlockColor(src, grid, r, c);
      if (!color) continue;

      const hex = `#${toHex(quantize(color.r))}${toHex(quantize(color.g))}${toHex(quantize(color.b))}`;
      const layer = getLayer(hex);
      layer[r][c] = ch;
    }
  }

  const layers: ColorLayer[] = Array.from(layerMap.entries()).map(([hex, rows]) => ({
    hex,
    text: rows.map((r) => r.join('')).join('\n'),
  }));

  return { fullText, layers };
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

  function buildColoredSpans(src: ImageData, grid: AsciiGrid): DocumentFragment {
    // Per-row build of <span> elements — changing color midline creates a
    // new span, same-color neighbors stay in one span. Purely a preview
    // optimization; the inserted Figma output uses the layer strategy instead.
    const frag = document.createDocumentFragment();
    let currentHex = '';
    let currentSpan: HTMLSpanElement | null = null;

    const flushSpan = () => {
      if (currentSpan) frag.appendChild(currentSpan);
      currentSpan = null;
      currentHex = '';
    };

    for (let r = 0; r < grid.rows; r++) {
      const line = grid.lines[r] ?? '';
      for (let c = 0; c < grid.cols; c++) {
        const ch = line[c] ?? ' ';
        if (ch === ' ') {
          flushSpan();
          frag.appendChild(document.createTextNode(' '));
          continue;
        }
        const color = sampleBlockColor(src, grid, r, c);
        if (!color) {
          flushSpan();
          frag.appendChild(document.createTextNode(ch));
          continue;
        }
        const hex = `#${toHex(quantize(color.r))}${toHex(quantize(color.g))}${toHex(quantize(color.b))}`;
        if (hex !== currentHex) {
          flushSpan();
          currentSpan = document.createElement('span');
          currentSpan.style.color = hex;
          currentHex = hex;
        }
        currentSpan!.appendChild(document.createTextNode(ch));
      }
      flushSpan();
      if (r < grid.rows - 1) frag.appendChild(document.createTextNode('\n'));
    }
    return frag;
  }

  function refreshPreview() {
    if (!currentImageData) return;
    const grid = buildGrid(currentImageData);
    emptyEl.style.display = 'none';
    previewEl.style.display = '';
    previewEl.innerHTML = '';

    if (colorEl.checked) {
      previewEl.appendChild(buildColoredSpans(currentImageData, grid));
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

  // Cap on layer count as a safety net — with 4-bit quant this caps at
  // ~80 layers on real-world images, but very noisy photos could exceed.
  const MAX_COLOR_LAYERS = 200;

  const DEFAULT_CONVERT_LABEL = convertEl.textContent ?? 'Paste in Figma';

  function setConverting(active: boolean) {
    convertEl.disabled = active;
    convertEl.textContent = active ? 'Converting…' : DEFAULT_CONVERT_LABEL;
  }

  convertEl.addEventListener('click', () => {
    if (!currentImageData) return;
    try {
      const grid = buildGrid(currentImageData);
      setConverting(true);

      if (colorEl.checked) {
        const { fullText, layers } = buildColorLayers(grid, currentImageData);
        const safeLayers = layers.slice(0, MAX_COLOR_LAYERS);
        if (layers.length > MAX_COLOR_LAYERS) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ezascii-image] color layers capped at ${MAX_COLOR_LAYERS} (had ${layers.length}).`,
          );
        }
        parent.postMessage(
          {
            pluginMessage: { type: 'insert-layered', fullText, layers: safeLayers },
          },
          '*',
        );
      } else {
        parent.postMessage(
          { pluginMessage: { type: 'insert-text', text: grid.lines.join('\n') } },
          '*',
        );
      }
    } catch (err) {
      setConverting(false);
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
    } else if (m.type === 'insert-done') {
      setConverting(false);
    }
  });

  setEmpty('Select an image or frame in Figma to preview its ASCII version here.');
} catch (err) {
  showFatalError(err, 'bootstrap');
}
