// figlet 1.11 ships its own types that conflict with @types/figlet.
// We don't need a narrow literal union — parseFont + textSync accept string
// names, and we control which ones are registered. Plain string keeps this
// portable across figlet version bumps.
type FigletFontName = string;

// 20 hand-picked fonts, imported individually so esbuild/vite only bundles these.
// Default export from each module is the raw .flf content as a string.
import Standard from 'figlet/importable-fonts/Standard.js';
import Big from 'figlet/importable-fonts/Big.js';
import Banner from 'figlet/importable-fonts/Banner.js';
import Slant from 'figlet/importable-fonts/Slant.js';
import Block from 'figlet/importable-fonts/Block.js';
import Doom from 'figlet/importable-fonts/Doom.js';
import Small from 'figlet/importable-fonts/Small.js';
import Mini from 'figlet/importable-fonts/Mini.js';
import ThreeD from 'figlet/importable-fonts/3-D.js';
import Graffiti from 'figlet/importable-fonts/Graffiti.js';
import Shadow from 'figlet/importable-fonts/Shadow.js';
import Speed from 'figlet/importable-fonts/Speed.js';
import StarWars from 'figlet/importable-fonts/Star Wars.js';
import AnsiShadow from 'figlet/importable-fonts/ANSI Shadow.js';
import Bloody from 'figlet/importable-fonts/Bloody.js';
import Electronic from 'figlet/importable-fonts/Electronic.js';
import Isometric1 from 'figlet/importable-fonts/Isometric1.js';
import Larry3D from 'figlet/importable-fonts/Larry 3D.js';
import Rounded from 'figlet/importable-fonts/Rounded.js';
import Thin from 'figlet/importable-fonts/Thin.js';

export interface FontEntry {
  label: string; // human-facing picker label
  figletName: FigletFontName; // name figlet.parseFont expects
  data: string; // raw .flf contents
}

export const FONTS: FontEntry[] = [
  { label: 'Standard', figletName: 'Standard', data: Standard },
  { label: 'Big', figletName: 'Big', data: Big },
  { label: 'Banner', figletName: 'Banner', data: Banner },
  { label: 'Slant', figletName: 'Slant', data: Slant },
  { label: 'Block', figletName: 'Block', data: Block },
  { label: 'Doom', figletName: 'Doom', data: Doom },
  { label: 'Small', figletName: 'Small', data: Small },
  { label: 'Mini', figletName: 'Mini', data: Mini },
  { label: '3-D', figletName: '3-D', data: ThreeD },
  { label: 'Graffiti', figletName: 'Graffiti', data: Graffiti },
  { label: 'Shadow', figletName: 'Shadow', data: Shadow },
  { label: 'Speed', figletName: 'Speed', data: Speed },
  { label: 'Star Wars', figletName: 'Star Wars', data: StarWars },
  { label: 'ANSI Shadow', figletName: 'ANSI Shadow', data: AnsiShadow },
  { label: 'Bloody', figletName: 'Bloody', data: Bloody },
  { label: 'Electronic', figletName: 'Electronic', data: Electronic },
  { label: 'Isometric', figletName: 'Isometric1', data: Isometric1 },
  { label: 'Larry 3D', figletName: 'Larry 3D', data: Larry3D },
  { label: 'Rounded', figletName: 'Rounded', data: Rounded },
  { label: 'Thin', figletName: 'Thin', data: Thin },
];

export const DEFAULT_FONT: FontEntry = FONTS[0];
