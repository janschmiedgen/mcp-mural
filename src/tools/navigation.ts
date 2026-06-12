import { z } from "zod";
import { muralApi } from "../client/mural-api.js";
import { filterAllowedWorkspaces, isWorkspaceAllowed, getWorkspaceGuardError } from "../auth/workspace-guard.js";
import type { Workspace, Room, Mural, ListResponse, SingleResponse } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripWorkspace, stripRoom, stripMural } from "../utils/strip.js";
import { muralIdSchema } from "../utils/normalize.js";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function registerNavigationTools(server: McpServer) {
  // --- list_workspaces ---
  server.tool(
    "list_workspaces",
    "List Mural workspaces (stripped to id+name)",
    {},
    async () => {
      const data = await muralApi.get<ListResponse<Workspace>>("/workspaces");
      const filtered = filterAllowedWorkspaces(data.value).map(stripWorkspace);
      return text(JSON.stringify(filtered));
    }
  );

  // --- list_rooms ---
  server.tool(
    "list_rooms",
    "List rooms in a workspace (stripped to id+name+type). Default limit 50.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      limit: z.number().min(1).max(200).optional().describe("Max rooms (default 50)"),
    },
    async ({ workspaceId, limit }) => {
      if (!isWorkspaceAllowed(workspaceId)) {
        return textErr(getWorkspaceGuardError(workspaceId));
      }
      const data = await muralApi.get<ListResponse<Room>>(
        `/workspaces/${workspaceId}/rooms`
      );
      const rooms = data.value.slice(0, limit ?? 50).map(stripRoom);
      return text(JSON.stringify(rooms));
    }
  );

  // --- list_murals ---
  server.tool(
    "list_murals",
    "List murals in a room or workspace (stripped to id+title+roomId). Default limit 50.",
    {
      roomId: z.number().optional().describe("Room ID (preferred — more specific)"),
      workspaceId: z.string().optional().describe("Workspace ID (lists all murals in workspace)"),
      limit: z.number().min(1).max(200).optional().describe("Max murals (default 50)"),
    },
    async ({ roomId, workspaceId, limit }) => {
      let path: string;
      if (roomId !== undefined) {
        path = `/rooms/${roomId}/murals`;
      } else if (workspaceId) {
        if (!isWorkspaceAllowed(workspaceId)) {
          return textErr(getWorkspaceGuardError(workspaceId));
        }
        path = `/workspaces/${workspaceId}/murals`;
      } else {
        return textErr("Error: Provide either roomId or workspaceId");
      }
      const data = await muralApi.get<ListResponse<Mural>>(path);
      const murals = data.value.slice(0, limit ?? 50).map(stripMural);
      return text(JSON.stringify(murals));
    }
  );

  // --- get_mural ---
  server.tool(
    "get_mural",
    "Get metadata for a specific mural (stripped to key fields)",
    {
      muralId: muralIdSchema,
    },
    async ({ muralId }) => {
      const data = await muralApi.get<SingleResponse<Mural>>(
        `/murals/${muralId}`
      );
      const m = data.value;
      const slim: Record<string, unknown> = { id: m.id };
      if (m.title) slim.title = m.title;
      if (m.width) slim.width = m.width;
      if (m.height) slim.height = m.height;
      if (m.backgroundColor) slim.bg = m.backgroundColor;
      if (m.roomId) slim.roomId = m.roomId;
      if (m.infinite !== undefined) slim.infinite = m.infinite;
      return text(JSON.stringify(slim));
    }
  );
}
