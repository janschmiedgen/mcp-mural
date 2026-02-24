import { z } from "zod";
import { muralApi } from "../client/mural-api.js";
import type { Mural, SingleResponse } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripMural } from "../utils/strip.js";

export function registerMuralManageTools(server: McpServer) {
  server.tool(
    "create_mural",
    "Create a new mural in a room. Returns mural ID + title.",
    {
      roomId: z.number().describe("Room ID to create the mural in"),
      title: z.string().optional().describe("Mural title"),
      backgroundColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6,8}$/)
        .optional()
        .describe("Background color (hex, e.g. #FAFAFAFF)"),
      width: z
        .number()
        .min(3000)
        .max(60000)
        .optional()
        .describe("Width in px (3000–60000, default 9216)"),
      height: z
        .number()
        .min(3000)
        .max(60000)
        .optional()
        .describe("Height in px (3000–60000, default 6237)"),
      infinite: z
        .boolean()
        .optional()
        .describe("Borderless canvas that grows as you add widgets"),
    },
    async ({ roomId, title, backgroundColor, width, height, infinite }) => {
      const body: Record<string, unknown> = { roomId };
      if (title) body.title = title;
      body.backgroundColor = backgroundColor ?? "#F0F0F0FF";
      if (width !== undefined) body.width = width;
      if (height !== undefined) body.height = height;
      body.infinite = infinite ?? true;

      const data = await muralApi.post<SingleResponse<Mural>>(
        "/murals",
        body
      );

      const slim = stripMural(data.value);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ summary: `Created mural "${data.value.title || '(untitled)'}"`, ...slim }),
          },
        ],
      };
    }
  );
}
