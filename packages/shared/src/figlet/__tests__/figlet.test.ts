import { describe, it, expect } from 'vitest';
import { renderFigletText, FONTS } from '../index';

describe('renderFigletText', () => {
  it('produces multi-line ASCII for the Standard font', () => {
    const out = renderFigletText('Hi', 'Standard');
    const lines = out.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(2);
  });

  it('falls back to the default font for unknown labels', () => {
    const out = renderFigletText('Hi', 'NotARealFont');
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('ships 20 fonts', () => {
    expect(FONTS.length).toBe(20);
  });

  it('each font renders without throwing', () => {
    for (const font of FONTS) {
      const out = renderFigletText('Ab', font.label);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
