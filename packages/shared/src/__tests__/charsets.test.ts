import { describe, it, expect } from 'vitest';
import { CHARSETS, getCharset } from '../charsets';

describe('charsets', () => {
  it('exposes the three plugin charsets', () => {
    expect(Object.keys(CHARSETS).sort()).toEqual(['detailed', 'simple', 'standard']);
  });

  it('returns the standard set by default', () => {
    expect(getCharset('standard')).toBe(' .:-=+*#%@');
  });

  it('falls back to standard for unknown keys', () => {
    expect(getCharset('unknown' as never)).toBe(' .:-=+*#%@');
  });
});
