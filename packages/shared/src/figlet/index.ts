import figlet from 'figlet';
import { FONTS, DEFAULT_FONT, type FontEntry } from './fonts';

export { FONTS, DEFAULT_FONT };
export type { FontEntry };

let registered = false;

function ensureRegistered() {
  if (registered) return;
  for (const font of FONTS) {
    figlet.parseFont(font.figletName, font.data);
  }
  registered = true;
}

/** Synchronous render. figlet.textSync works once parseFont has registered the font. */
export function renderFigletText(input: string, fontLabel: string): string {
  ensureRegistered();
  const font = FONTS.find((f) => f.label === fontLabel) ?? DEFAULT_FONT;
  return figlet.textSync(input, { font: font.figletName });
}
