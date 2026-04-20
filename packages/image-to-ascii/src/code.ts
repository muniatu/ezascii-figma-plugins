figma.showUI(__html__, { width: 960, height: 540, title: 'Image to ASCII Art' });

type ColorLayer = { hex: string; text: string };

type InsertTextMsg = { type: 'insert-text'; text: string };
type InsertLayeredMsg = {
  type: 'insert-layered';
  fullText: string;
  layers: ColorLayer[];
};
type InsertMsg = InsertTextMsg | InsertLayeredMsg;

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

function makeTextNode(text: string, hex?: string): TextNode {
  const node = figma.createText();
  node.fontName = { family: 'Courier New', style: 'Regular' };
  node.fontSize = 10;
  node.characters = text;
  if (hex) node.fills = [hexToSolidPaint(hex)];
  return node;
}

figma.ui.onmessage = async (msg: InsertMsg) => {
  try {
    await figma.loadFontAsync({ family: 'Courier New', style: 'Regular' });

    if (msg.type === 'insert-text') {
      const node = makeTextNode(msg.text);
      positionNextToSelection(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.notify('ASCII text inserted');
      figma.ui.postMessage({ type: 'insert-done' });
      return;
    }

    if (msg.type === 'insert-layered') {
      // Build one TextNode per color. Stack them at the same origin inside
      // a group so the composite renders identically to the preview. Each
      // node has exactly one fill — no setRangeFills. Cost scales with
      // unique colors (tens), not characters (thousands).
      const { fullText, layers } = msg;

      // Anchor node: same character positions as every layer, default fill.
      // Gives the group a consistent bounding box and fills cells that
      // don't belong to any quantized color.
      const anchor = makeTextNode(fullText);
      positionNextToSelection(anchor);

      const nodes: TextNode[] = [anchor];
      const { x: ax, y: ay } = anchor;

      for (const layer of layers) {
        const node = makeTextNode(layer.text, layer.hex);
        node.x = ax;
        node.y = ay;
        figma.currentPage.appendChild(node);
        nodes.push(node);
      }

      // Group everything so the stack moves as one. User can ungroup to
      // edit individual color layers (or change the font across all of
      // them with a single cross-layer selection).
      const group = figma.group(nodes, figma.currentPage);
      group.name = 'ASCII art (color)';

      figma.currentPage.selection = [group];
      figma.viewport.scrollAndZoomIntoView([group]);
      figma.notify(`ASCII art inserted · ${layers.length} color layers`);
      figma.ui.postMessage({ type: 'insert-done' });
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.notify(`Insert failed: ${message}`, { error: true });
    figma.ui.postMessage({ type: 'insert-done' });
  }
};
