import { z } from "zod";
import { muralApi } from "../client/mural-api.js";
import type { Widget, SingleResponse, ListResponse } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { imageSize } from "image-size";
import { batchResponse, singleResponse } from "../utils/strip.js";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize.js";

// --- Constants ---

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Server-side shape validation — keeps schema small, avoids runtime enum mismatches
const VALID_SHAPES = new Set([
  "circle", "diamond", "hexagon", "pentagon", "square", "triangle",
  "document_shape", "event_shape", "loop_limit", "off_page_reference",
  "off_page_reference_incoming", "arrow_down", "arrow_left_right",
  "arrow_left", "arrow_right", "arrow_top", "badge", "brace_left",
  "brace_right", "chonk_unicorn", "cloud", "connector", "cross", "data",
  "database", "decision", "delay", "direct_data", "display", "document",
  "ellipse", "end", "hexagon_smart", "internal_storage", "manual_input",
  "manual_loop", "merge", "multiple_documents", "note_left", "note_right",
  "octagon", "off_page_connector", "or", "papertape", "pentagon_smart",
  "porongo", "predefined_process", "preparation", "process", "rectangle",
  "rhombus_smart", "ribbon", "right_triangle", "rounded_square",
  "simple_ribbon", "speech_bubble_center", "speech_bubble_left",
  "speech_bubble_right", "star", "start", "step", "stored_data",
  "summing_junction", "teardrop_bubble", "terminator",
  "thinking_bubble_left", "thinking_bubble_right", "trapezoid",
  "triangle_smart",
]);

// --- Shared schemas ---

const positionSchema = {
  x: z.number().describe("Horizontal position in px from left of mural"),
  y: z.number().describe("Vertical position in px from top of mural"),
};

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6,8}$/)
  .optional()
  .describe("Color hex, e.g. #FF0000FF");

// --- Helpers ---

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function registerWidgetWriteTools(server: McpServer) {
  // ============================
  // STICKY NOTES
  // ============================

  server.tool(
    "create_sticky_notes",
    "Create sticky notes on a mural (batch, up to 1000). Returns IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      stickies: z
        .array(
          z.object({
            ...positionSchema,
            text: z.string().describe("Sticky note text"),
            width: z.number().optional(),
            height: z.number().optional(),
            shape: z.enum(["rectangle", "circle"]).optional(),
            style: z
              .object({
                fontSize: z.number().optional(),
                textAlign: z.enum(["left", "center", "right"]).optional(),
              })
              .optional()
              .describe("Only fontSize/textAlign on creation"),
          })
        )
        .min(1)
        .max(1000),
    },
    async ({ muralId: rawMuralId, stickies }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body = stickies.map((s) => ({
        x: s.x,
        y: s.y,
        text: s.text,
        shape: s.shape || "rectangle",
        ...(s.width !== undefined && { width: s.width }),
        ...(s.height !== undefined && { height: s.height }),
        style: { textAlign: "left", ...s.style },
      }));

      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/sticky-note`,
        body
      );

      return text(batchResponse(`Created ${data.value.length} sticky note(s)`, data.value));
    }
  );

  server.tool(
    "update_sticky_note",
    "Update a sticky note (text, position, color, size)",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      backgroundColor: colorSchema,
    },
    async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      if (changes.text !== undefined) body.text = changes.text;
      if (changes.x !== undefined) body.x = changes.x;
      if (changes.y !== undefined) body.y = changes.y;
      if (changes.width !== undefined) body.width = changes.width;
      if (changes.height !== undefined) body.height = changes.height;
      if (changes.backgroundColor)
        body.style = { backgroundColor: changes.backgroundColor };

      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/sticky-note/${widgetId}`,
        body
      );

      return text(singleResponse(`Updated sticky ${widgetId}`, data.value));
    }
  );

  // ============================
  // TEXT BOXES
  // ============================

  server.tool(
    "create_text_boxes",
    "Create text boxes on a mural (batch, up to 1000). Returns IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      textBoxes: z
        .array(
          z.object({
            ...positionSchema,
            text: z.string().describe("Text content"),
            width: z.number().optional(),
            height: z.number().optional(),
            style: z
              .object({
                fontSize: z.number().optional(),
                textAlign: z.enum(["left", "center", "right"]).optional(),
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    async ({ muralId: rawMuralId, textBoxes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/textbox`,
        textBoxes
      );

      return text(batchResponse(`Created ${data.value.length} text box(es)`, data.value));
    }
  );

  server.tool(
    "update_text_box",
    "Update a text box on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    },
    async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) body[key] = value;
      }

      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/textbox/${widgetId}`,
        body
      );

      return text(singleResponse(`Updated text box ${widgetId}`, data.value));
    }
  );

  // ============================
  // SHAPES
  // ============================

  server.tool(
    "create_shapes",
    "Create shapes on a mural (batch, up to 1000). Common shapes: rectangle, circle, diamond, triangle, star, hexagon. Full list validated server-side.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      shapes: z
        .array(
          z.object({
            ...positionSchema,
            width: z.number().describe("Width in px"),
            height: z.number().describe("Height in px"),
            text: z.string().optional(),
            shape: z.string().optional().describe("Shape type (default: rectangle)"),
            style: z
              .object({
                backgroundColor: colorSchema,
                borderColor: colorSchema,
                fontColor: colorSchema,
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    async ({ muralId: rawMuralId, shapes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      // Server-side shape validation
      for (const s of shapes) {
        if (s.shape && !VALID_SHAPES.has(s.shape)) {
          return textErr(`Invalid shape "${s.shape}". Valid: rectangle, circle, diamond, triangle, star, hexagon, ellipse, rhombus_smart, rounded_square, ...`);
        }
      }

      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/shape`,
        shapes
      );

      return text(batchResponse(`Created ${data.value.length} shape(s)`, data.value));
    }
  );

  server.tool(
    "update_shape",
    "Update a shape on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      backgroundColor: colorSchema,
    },
    async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      if (changes.text !== undefined) body.text = changes.text;
      if (changes.x !== undefined) body.x = changes.x;
      if (changes.y !== undefined) body.y = changes.y;
      if (changes.width !== undefined) body.width = changes.width;
      if (changes.height !== undefined) body.height = changes.height;
      if (changes.backgroundColor)
        body.style = { backgroundColor: changes.backgroundColor };

      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/shape/${widgetId}`,
        body
      );

      return text(singleResponse(`Updated shape ${widgetId}`, data.value));
    }
  );

  // ============================
  // AREAS
  // ============================

  server.tool(
    "create_area",
    "Create an area (grouping section) on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      width: z.number().describe("Width in px"),
      height: z.number().describe("Height in px"),
      title: z.string().optional(),
      backgroundColor: colorSchema,
    },
    async ({ muralId: rawMuralId, ...params }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
      };
      if (params.title) body.title = params.title;
      if (params.backgroundColor)
        body.style = { backgroundColor: params.backgroundColor };

      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/area`,
        body
      );

      return text(singleResponse("Created area", data.value));
    }
  );

  server.tool(
    "update_area",
    "Update an area on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      title: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      backgroundColor: colorSchema,
    },
    async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      if (changes.title !== undefined) body.title = changes.title;
      if (changes.x !== undefined) body.x = changes.x;
      if (changes.y !== undefined) body.y = changes.y;
      if (changes.width !== undefined) body.width = changes.width;
      if (changes.height !== undefined) body.height = changes.height;
      if (changes.backgroundColor)
        body.style = { backgroundColor: changes.backgroundColor };

      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/area/${widgetId}`,
        body
      );

      return text(singleResponse(`Updated area ${widgetId}`, data.value));
    }
  );

  // ============================
  // IMAGES
  // ============================

  server.tool(
    "create_image",
    "Add an image to a mural from a public URL. Auto-detects dimensions. Max 10MB.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      url: z.string().url().describe("Public URL of the image"),
      width: z.number().optional().describe("Override width (default: original)"),
      height: z.number().optional().describe("Override height (default: original)"),
    },
    async ({ muralId: rawMuralId, x, y, url, width, height }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      // Step 1: Download
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Size cap
      if (buffer.length > MAX_IMAGE_BYTES) {
        return textErr(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`);
      }

      // Detect dimensions
      const dimensions = imageSize(buffer);
      const imgWidth = width ?? dimensions.width ?? 400;
      const imgHeight = height ?? dimensions.height ?? 300;

      // Detect extension
      const contentType = response.headers.get("content-type") || "";
      let ext = "png";
      if (contentType.includes("jpeg") || contentType.includes("jpg") || url.match(/\.jpe?g$/i)) ext = "jpg";
      else if (contentType.includes("gif") || url.match(/\.gif$/i)) ext = "gif";
      else if (contentType.includes("webp") || url.match(/\.webp$/i)) ext = "webp";
      else if (contentType.includes("svg") || url.match(/\.svg$/i)) ext = "svg";

      // Step 2: Create asset URL
      const assetResponse = await muralApi.post<{ value: { url: string; name: string; headers: Record<string, string> } }>(
        `/murals/${muralId}/assets`,
        { fileExtension: ext }
      );
      const asset = assetResponse.value;

      // Step 3: Upload to blob storage
      const uploadResponse = await fetch(asset.url, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": asset.headers["x-ms-blob-type"],
          "Content-Type": contentType || `image/${ext}`,
        },
        body: buffer,
      });
      if (!uploadResponse.ok) throw new Error(`Failed to upload to Mural storage: ${uploadResponse.status}`);

      // Step 4: Create image widget
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/image`,
        { name: asset.name, x, y, width: imgWidth, height: imgHeight }
      );

      return text(singleResponse(`Added image (${imgWidth}×${imgHeight})`, data.value));
    }
  );

  // ============================
  // ARROWS — single
  // ============================

  server.tool(
    "connect_widgets",
    "Draw a connected arrow between two widgets. Provide source/target IDs and positions.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      sourceWidgetId: z.string().describe("Widget ID arrow starts FROM (tail)"),
      targetWidgetId: z.string().describe("Widget ID arrow points TO (head)"),
      sourceX: z.number(), sourceY: z.number(),
      sourceWidth: z.number(), sourceHeight: z.number(),
      targetX: z.number(), targetY: z.number(),
      arrowType: z.enum(["bezier", "straight"]).optional(),
      style: z
        .object({
          strokeColor: colorSchema,
          strokeWidth: z.number().optional(),
          strokeStyle: z.enum(["solid", "dashed"]).optional(),
        })
        .optional(),
    },
    async ({ muralId: rawMuralId, sourceWidgetId, targetWidgetId, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, arrowType, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const arrowX = sourceX + sourceWidth;
      const arrowY = sourceY + sourceHeight / 2;
      const arrowWidth = targetX - arrowX;
      const arrowHeight = 1;
      const points = [
        { x: arrowWidth, y: 0 },
        { x: 0, y: 0 },
      ];

      const body: Record<string, unknown> = {
        x: arrowX, y: arrowY, width: arrowWidth, height: arrowHeight,
        points, arrowType: arrowType || "bezier",
        startRefId: targetWidgetId, endRefId: sourceWidgetId,
      };
      if (style) body.style = style;

      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/arrow`,
        body
      );

      return text(singleResponse(`Connected ${sourceWidgetId} → ${targetWidgetId}`, data.value));
    }
  );

  // ============================
  // ARROWS — batch connect
  // ============================

  server.tool(
    "connect_widgets_batch",
    "Connect multiple widget pairs with arrows in one call. Returns all arrow IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      connections: z
        .array(
          z.object({
            sourceWidgetId: z.string(),
            targetWidgetId: z.string(),
            sourceX: z.number(), sourceY: z.number(),
            sourceWidth: z.number(), sourceHeight: z.number(),
            targetX: z.number(), targetY: z.number(),
            arrowType: z.enum(["bezier", "straight"]).optional(),
          })
        )
        .min(1)
        .max(100),
      style: z
        .object({
          strokeColor: colorSchema,
          strokeWidth: z.number().optional(),
          strokeStyle: z.enum(["solid", "dashed"]).optional(),
        })
        .optional()
        .describe("Style applied to all arrows"),
    },
    async ({ muralId: rawMuralId, connections, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const results: Widget[] = [];
      const errors: string[] = [];

      for (const c of connections) {
        try {
          const arrowX = c.sourceX + c.sourceWidth;
          const arrowY = c.sourceY + c.sourceHeight / 2;
          const arrowWidth = c.targetX - arrowX;
          const arrowHeight = 1;
          const points = [
            { x: arrowWidth, y: 0 },
            { x: 0, y: 0 },
          ];

          const body: Record<string, unknown> = {
            x: arrowX, y: arrowY, width: arrowWidth, height: arrowHeight,
            points, arrowType: c.arrowType || "bezier",
            startRefId: c.targetWidgetId, endRefId: c.sourceWidgetId,
          };
          if (style) body.style = style;

          const data = await muralApi.post<SingleResponse<Widget>>(
            `/murals/${muralId}/widgets/arrow`,
            body
          );
          results.push(data.value);
        } catch (e: unknown) {
          errors.push(`${c.sourceWidgetId}→${c.targetWidgetId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const summary = `Connected ${results.length}/${connections.length} pairs` +
        (errors.length > 0 ? `\nErrors:\n${errors.join("\n")}` : "");

      return text(batchResponse(summary, results));
    }
  );

  // ============================
  // ARROWS — freeform
  // ============================

  server.tool(
    "create_arrow",
    "Draw a freeform arrow (not snapped to widgets). For connected arrows, use connect_widgets.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      width: z.number().describe("Bounding box width"),
      height: z.number().describe("Bounding box height"),
      points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(2)
        .describe("Arrow path points. Arrowhead at FIRST point."),
      style: z
        .object({
          strokeColor: colorSchema,
          strokeWidth: z.number().optional(),
          strokeStyle: z.enum(["solid", "dashed"]).optional(),
        })
        .optional(),
    },
    async ({ muralId: rawMuralId, x, y, width, height, points, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = { x, y, width, height, points };
      if (style) body.style = style;

      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/arrow`,
        body
      );

      return text(singleResponse("Created arrow", data.value));
    }
  );

  // ============================
  // DELETE
  // ============================

  server.tool(
    "delete_widget",
    "Delete any widget from a mural by ID",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID to delete"),
    },
    async ({ muralId: rawMuralId, widgetId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      await muralApi.delete(`/murals/${muralId}/widgets/${widgetId}`);
      return text(`Deleted widget ${widgetId}`);
    }
  );
}
