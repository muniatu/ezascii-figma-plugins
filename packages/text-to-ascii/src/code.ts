figma.showUI(__html__, { width: 480, height: 600, title: 'ASCII Text Art Generator' });

type IncomingMsg = {
  type: 'insert-text';
  ascii: string;
  fontSize: number;
  align: 'LEFT' | 'CENTER' | 'RIGHT';
};

figma.ui.onmessage = async (msg: IncomingMsg) => {
  if (msg.type !== 'insert-text') return;

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
};
