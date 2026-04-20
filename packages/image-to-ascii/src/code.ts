figma.showUI(__html__, { width: 960, height: 540, title: 'Image to ASCII Art' });

type ColorRange = { start: number; end: number; hex: string };

type InsertMsg = {
  type: 'insert-text';
  text: string;
  ranges?: ColorRange[];
};

// Nodes we can export as a PNG so the iframe can read their pixels.
type ExportableNode =
  | FrameNode
  | RectangleNode
  | InstanceNode
  | ComponentNode
  | GroupNode
  | EllipseNode
  | PolygonNode
  | StarNode
  | VectorNode
  | BooleanOperationNode
  | LineNode;

function isExportable(node: SceneNode): node is ExportableNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'RECTANGLE' ||
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'GROUP' ||
    node.type === 'ELLIPSE' ||
    node.type === 'POLYGON' ||
    node.type === 'STAR' ||
    node.type === 'VECTOR' ||
    node.type === 'BOOLEAN_OPERATION' ||
    node.type === 'LINE'
  );
}

async function postSelection() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1 || !isExportable(sel[0])) {
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }
  try {
    const bytes = await (sel[0] as ExportableNode).exportAsync({ format: 'PNG' });
    figma.ui.postMessage({ type: 'image-bytes', bytes });
  } catch (err) {
    figma.notify(
      `Could not export selection: ${err instanceof Error ? err.message : 'unknown'}`,
      { error: true },
    );
    figma.ui.postMessage({ type: 'no-selection' });
  }
}

figma.on('selectionchange', () => {
  void postSelection();
});
void postSelection();

function positionNextToSelection(node: SceneNode) {
  const sel = figma.currentPage.selection[0];
  if (sel && 'x' in sel && 'width' in sel) {
    node.x = Math.round(sel.x + sel.width + 40);
    node.y = Math.round(sel.y);
  } else {
    const c = figma.viewport.center;
    node.x = Math.round(c.x);
    node.y = Math.round(c.y);
  }
  figma.currentPage.appendChild(node);
}

function hexToSolidPaint(hex: string): SolidPaint {
  // hex is always `#rrggbb` coming from the UI
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { type: 'SOLID', color: { r, g, b } };
}

figma.ui.onmessage = async (msg: InsertMsg) => {
  if (msg.type !== 'insert-text') return;

  try {
    await figma.loadFontAsync({ family: 'Courier New', style: 'Regular' });
    const node = figma.createText();
    node.fontName = { family: 'Courier New', style: 'Regular' };
    node.fontSize = 10;
    node.characters = msg.text;

    if (msg.ranges && msg.ranges.length > 0) {
      const len = node.characters.length;
      for (const range of msg.ranges) {
        const start = Math.max(0, Math.min(range.start, len));
        const end = Math.max(0, Math.min(range.end, len));
        if (start >= end) continue;
        node.setRangeFills(start, end, [hexToSolidPaint(range.hex)]);
      }
    }

    positionNextToSelection(node);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.notify('ASCII text inserted');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.notify(`Insert failed: ${message}`, { error: true });
  }
};
