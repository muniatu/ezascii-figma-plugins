/** Buy Me a Coffee link — small, subtle support link shown at the bottom of plugin UIs. */

const BMC_URL = 'https://buymeacoffee.com/ezascii';

export function mountBmcLink(host: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'ezascii-bmc-wrap';

  const link = document.createElement('a');
  link.href = BMC_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = '☕ Support EZASCII on Buy Me a Coffee';
  link.className = 'ezascii-bmc-link';

  wrap.appendChild(link);
  host.appendChild(wrap);
}
