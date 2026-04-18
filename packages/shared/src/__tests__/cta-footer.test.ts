import { describe, it, expect } from 'vitest';
import { buildCtaUrl } from '../cta-footer';

describe('buildCtaUrl', () => {
  it('builds a UTM-tagged ezascii.com URL', () => {
    const url = buildCtaUrl('/text-to-ascii-art', 'text-plugin');
    expect(url).toBe(
      'https://ezascii.com/text-to-ascii-art?utm_source=figma&utm_medium=plugin&utm_campaign=text-plugin',
    );
  });

  it('encodes campaign values with special characters', () => {
    const url = buildCtaUrl('/image-to-ascii', 'image plugin');
    expect(url).toContain('utm_campaign=image+plugin');
  });
});
