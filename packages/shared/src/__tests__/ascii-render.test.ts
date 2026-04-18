import { describe, it, expect } from 'vitest';
import { renderAsciiTextGrid } from '../ascii-render';

describe('renderAsciiTextGrid', () => {
  it('produces a grid with the expected dimensions for a uniform image', () => {
    // 40×20 fully-white image, blockSize 4 → 10 cols × 5 rows
    const width = 40;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const img = { width, height, data };

    const grid = renderAsciiTextGrid(img, {
      charset: ' .:-=+*#%@',
      blockSize: 4,
      invert: false,
    });

    expect(grid.rows).toBe(5);
    expect(grid.cols).toBe(10);
    expect(grid.lines).toHaveLength(5);
    expect(grid.lines[0]).toHaveLength(10);
    // White → brightest char (end of ramp)
    expect(grid.lines[0][0]).toBe('@');
  });

  it('inverts brightness when invert=true', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const img = { width, height, data };

    const grid = renderAsciiTextGrid(img, {
      charset: ' .:-=+*#%@',
      blockSize: 4,
      invert: true,
    });

    // White + invert → darkest char (start of ramp, ' ')
    expect(grid.lines[0][0]).toBe(' ');
  });

  it('uses the darkest char for a fully-black image', () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    // RGB stays 0 (black); alpha channel not used for brightness
    const img = { width, height, data };

    const grid = renderAsciiTextGrid(img, {
      charset: ' .:-=+*#%@',
      blockSize: 4,
      invert: false,
    });

    expect(grid.lines[0][0]).toBe(' ');
  });
});
