figma.showUI(__html__, { width: 960, height: 540, title: 'Image to ASCII Art' });

type InsertTextMsg = { type: 'insert-text'; lines: string[] };
type InsertImageMsg = {
  type: 'insert-image';
  bytes: Uint8Array;
  width: number;
  height: number;
};
type Msg = InsertTextMsg | InsertImageMsg;

// Nodes we can export as a PNG for the ASCII preview.
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

// Export the current selection on plugin start and whenever it changes.
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

figma.ui.onmessage = async (msg: Msg) => {
  try {
    if (msg.type === 'insert-text') {
      // Bold weight matches the PNG output and stays visible against most
      // Figma backgrounds. Fall back to Regular if Bold isn't installed.
      let style: 'Bold' | 'Regular' = 'Bold';
      try {
        await figma.loadFontAsync({ family: 'Courier New', style: 'Bold' });
      } catch {
        style = 'Regular';
        await figma.loadFontAsync({ family: 'Courier New', style: 'Regular' });
      }
      const node = figma.createText();
      node.fontName = { family: 'Courier New', style };
      node.fontSize = 10;
      node.characters = msg.lines.join('\n');
      positionNextToSelection(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.notify('ASCII text inserted');
      return;
    }

    if (msg.type === 'insert-image') {
      const image = figma.createImage(msg.bytes);
      const rect = figma.createRectangle();
      rect.resize(msg.width, msg.height);
      rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
      positionNextToSelection(rect);
      figma.currentPage.selection = [rect];
      figma.viewport.scrollAndZoomIntoView([rect]);
      figma.notify('ASCII image inserted');
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    figma.notify(`Insert failed: ${message}`, { error: true });
  }
};
