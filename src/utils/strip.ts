import type { Widget, Workspace, Room, Mural } from "../types.js";

/**
 * Strip a Mural widget object to only the fields an LLM needs for decisions.
 * Drops all internal/meta fields that waste tokens.
 */
export function stripWidget(w: Widget): Record<string, unknown> {
  const out: Record<string, unknown> = { id: w.id };

  // Core identity & position
  if (w.type) out.type = w.type;
  if (w.x !== undefined) out.x = w.x;
  if (w.y !== undefined) out.y = w.y;
  if (w.width !== undefined) out.w = w.width;
  if (w.height !== undefined) out.h = w.height;

  // Content
  if (w.text) out.text = w.text;
  if (w.title) out.title = w.title;

  // Shape-specific
  if (w.shape) out.shape = w.shape;
  if (w.parentId) out.parentId = w.parentId;

  // Style — only the fields that matter
  if (w.style) {
    const s: Record<string, unknown> = {};
    if (w.style.backgroundColor) s.bg = w.style.backgroundColor;
    if (w.style.strokeColor) s.stroke = w.style.strokeColor;
    if (w.style.strokeWidth) s.strokeW = w.style.strokeWidth;
    if (w.style.fontColor) s.color = w.style.fontColor;
    if (Object.keys(s).length > 0) out.style = s;
  }

  // Arrow-specific
  if (w.arrowType) out.arrowType = w.arrowType;
  if (w.startRefId) out.startRefId = w.startRefId;
  if (w.endRefId) out.endRefId = w.endRefId;

  // Image-specific
  if (w.type === "image" && w.url) out.url = w.url;

  return out;
}

/**
 * Strip an array of widgets; return stripped array.
 */
export function stripWidgets(widgets: Widget[]): Record<string, unknown>[] {
  return widgets.map(stripWidget);
}

/**
 * Build a compact summary + IDs response for batch-create tools.
 * Returns at most `previewCount` stripped widgets for spot-checking.
 */
export function batchResponse(
  action: string,
  widgets: Widget[],
  previewCount = 3
): string {
  const ids = widgets.map((w) => w.id);
  const preview = stripWidgets(widgets.slice(0, previewCount));
  return JSON.stringify({ summary: action, count: widgets.length, ids, preview });
}

/**
 * Build a compact response for single-widget write tools.
 */
export function singleResponse(action: string, widget: Widget): string {
  return JSON.stringify({ summary: action, ...stripWidget(widget) });
}

// --- Navigation strippers ---

export function stripWorkspace(w: Workspace): { id: string; name: string } {
  return { id: w.id, name: w.name };
}

export function stripRoom(r: Room): { id: number; name: string; type?: string } {
  return { id: r.id, name: r.name, ...(r.type ? { type: r.type } : {}) };
}

export function stripMural(m: Mural): { id: string; title?: string; roomId?: number } {
  return { id: m.id, ...(m.title ? { title: m.title } : {}), ...(m.roomId !== undefined ? { roomId: m.roomId } : {}) };
}
