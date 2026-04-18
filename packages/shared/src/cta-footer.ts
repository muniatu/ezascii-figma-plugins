export interface CTAFooterOptions {
  label: string; // e.g. "Need more fonts?"
  linkText: string; // e.g. "All 300 on ezascii.com →"
  targetPath: string; // e.g. "/text-to-ascii-art"
  campaign: string; // e.g. "text-plugin"
}

const BASE_URL = 'https://ezascii.com';

export function buildCtaUrl(targetPath: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: 'figma',
    utm_medium: 'plugin',
    utm_campaign: campaign,
  });
  return `${BASE_URL}${targetPath}?${params.toString()}`;
}

/** Mounts a CTA footer inside the given host element. */
export function mountCtaFooter(host: HTMLElement, opts: CTAFooterOptions): void {
  const footer = document.createElement('div');
  footer.className = 'ezascii-cta-footer';

  const label = document.createElement('span');
  label.textContent = opts.label;

  const link = document.createElement('a');
  link.href = buildCtaUrl(opts.targetPath, opts.campaign);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = opts.linkText;

  footer.appendChild(label);
  footer.appendChild(link);
  host.appendChild(footer);
}
