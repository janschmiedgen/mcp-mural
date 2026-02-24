#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initWorkspaceGuard } from "./auth/workspace-guard.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerWidgetReadTools } from "./tools/widgets-read.js";
import { registerWidgetWriteTools } from "./tools/widgets-write.js";
import { registerMuralManageTools } from "./tools/mural-manage.js";

// Initialize workspace allowlist guard (reads MURAL_ALLOWED_WORKSPACES env var)
initWorkspaceGuard();

const server = new McpServer({
  name: "mural-mcp",
  version: "1.0.0",
  description:
    "Mural MCP Server — read and edit boards, sticky notes, shapes, text boxes, areas, images, and connectors on the Mural visual collaboration platform.",
});

// Register all tool groups
registerNavigationTools(server);
registerWidgetReadTools(server);
registerWidgetWriteTools(server);
registerMuralManageTools(server);

// Start the server over stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting Mural MCP server:", error);
  process.exit(1);
});
