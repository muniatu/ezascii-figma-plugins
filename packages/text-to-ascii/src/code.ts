const SIZE_KEY = 'ezascii-text-ui-size';
const DEFAULT_W = 480;
const DEFAULT_H = 600;

(async () => {
  // Restore the user's last window size if we saved one.
  let width = DEFAULT_W;
  let height = DEFAULT_H;
  try {
    const saved = await figma.clientStorage.getAsync(SIZE_KEY);
    if (saved && typeof saved.width === 'number' && typeof saved.height === 'number') {
      width = saved.width;
      height = saved.height;
    }
  } catch {
    // fall through to defaults
  }

  figma.showUI(__html__, { width, height, title: 'ASCII Text Art Generator' });
})();

type InsertMsg = {
  type: 'insert-text';
  ascii: string;
  fontSize: number;
  align: 'LEFT' | 'CENTER' | 'RIGHT';
};

type ResizeMsg = {
  type: 'resize';
  width: number;
  height: number;
  persist?: boolean;
};

type Msg = InsertMsg | ResizeMsg;

figma.ui.onmessage = async (msg: Msg) => {
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    if (msg.persist) {
      try {
        await figma.clientStorage.setAsync(SIZE_KEY, { width: msg.width, height: msg.height });
      } catch {
        // Non-fatal — size will just reset next session
      }
    }
    return;
  }

  if (msg.type === 'insert-text') {
    try {
      await figma.loadFontAsync({ family: 'Courier New', style: 'Regular' });

      const node = figma.createText();
      node.fontName = { family: 'Courier New', style: 'Regular' };
      node.characters = msg.ascii;
      node.fontSize = msg.fontSize;
      node.textAlignHorizontal = msg.align;

      const { center } = figma.viewport;
      node.x = Math.round(center.x - node.width / 2);
      node.y = Math.round(center.y - node.height / 2);

      figma.currentPage.appendChild(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.notify('ASCII banner inserted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      figma.notify(`Insert failed: ${message}`, { error: true });
    }
  }
};
