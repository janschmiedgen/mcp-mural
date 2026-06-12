import { z } from "zod";
import { muralApi } from "../client/mural-api.js";
import type { Widget, ListResponse, SingleResponse } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripWidget, stripWidgets } from "../utils/strip.js";
import { muralIdSchema } from "../utils/normalize.js";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export function registerWidgetReadTools(server: McpServer) {
  // --- get_widgets (paginated, stripped) ---
  server.tool(
    "get_widgets",
    "List widgets on a mural (stripped to key fields). Default limit 50. Use 'next' cursor to paginate.",
    {
      muralId: muralIdSchema,
      type: z
        .enum([
          "sticky note",
          "text",
          "shape",
          "area",
          "image",
          "connector",
          "icon",
          "file",
          "framework",
        ])
        .optional()
        .describe("Filter by widget type"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max widgets per page (1–100, default 50)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ muralId, type, limit, next }) => {
      const effectiveLimit = limit ?? 50;
      const params: Record<string, string> = { limit: String(effectiveLimit) };
      if (type) params.type = type;
      if (next) params.next = next;

      const data = await muralApi.get<ListResponse<Widget>>(
        `/murals/${muralId}/widgets`,
        params
      );

      const stripped = stripWidgets(data.value);
      const result: Record<string, unknown> = {
        count: stripped.length,
        widgets: stripped,
      };
      if (data.next) result.next = data.next;

      return text(JSON.stringify(result));
    }
  );

  // --- get_widget (single by ID, stripped) ---
  server.tool(
    "get_widget",
    "Get a single widget by ID (stripped to key fields).",
    {
      muralId: muralIdSchema,
      widgetId: z.string().describe("Widget ID"),
    },
    async ({ muralId, widgetId }) => {
      const data = await muralApi.get<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/${widgetId}`
      );

      return text(JSON.stringify(stripWidget(data.value)));
    }
  );
}
