export interface RenderInput {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, row-major
}

export interface RenderOptions {
  charset: string;
  blockSize: number;
  invert: boolean;
}

export interface AsciiGrid {
  rows: number;
  cols: number;
  lines: string[]; // length === rows
}

/**
 * Sample an image pixel buffer into an ASCII character grid.
 * Pure function — no DOM dependencies, safe for worker / Figma iframe use.
 */
export function renderAsciiTextGrid(img: RenderInput, opts: RenderOptions): AsciiGrid {
  const { width, height, data } = img;
  const { charset, blockSize, invert } = opts;

  const cols = Math.max(1, Math.floor(width / blockSize));
  const rows = Math.max(1, Math.floor(height / blockSize));

  const sampleW = width / cols;
  const sampleH = height / rows;

  const lines: string[] = new Array(rows);

  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const startX = Math.floor(col * sampleW);
      const startY = Math.floor(row * sampleH);
      const endX = Math.min(Math.floor((col + 1) * sampleW), width);
      const endY = Math.min(Math.floor((row + 1) * sampleH), height);

      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * width + x) * 4;
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          count++;
        }
      }

      if (count === 0) {
        line += charset[0];
        continue;
      }

      const avg = (totalR + totalG + totalB) / (count * 3);
      const brightness = invert ? 255 - avg : avg;
      const idx = Math.floor((brightness / 255) * (charset.length - 1));
      line += charset[idx] ?? charset[0];
    }
    lines[row] = line;
  }

  return { rows, cols, lines };
}
