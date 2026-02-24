# Mural MCP Server

MCP server for the [Mural](https://mural.co) visual collaboration platform — focused on **board content editing**: sticky notes, shapes, text boxes, areas, images, and connectors.

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) SDK and TypeScript. Runs over **stdio** — compatible with any MCP client (Warp, Cursor, Claude Code, etc.).

## Features

**20 tools** across 4 modules:

### Board Editing — Write (13 tools)
| Tool | Description |
|------|-------------|
| `create_sticky_notes` | Batch-create sticky notes (1–1000) |
| `update_sticky_note` | Update text, position, color, size |
| `create_text_boxes` | Batch-create text boxes (1–1000) |
| `update_text_box` | Update a text box |
| `create_shapes` | Batch-create shapes — rectangle, circle, diamond, triangle, star, hexagon, and 50+ more |
| `update_shape` | Update a shape |
| `create_area` | Create grouping areas |
| `update_area` | Update an area |
| `create_image` | Add image from public URL (auto-detects dimensions, max 10 MB) |
| `connect_widgets` | Draw a connected arrow between two widgets |
| `connect_widgets_batch` | Connect multiple widget pairs in one call (up to 100) |
| `create_arrow` | Draw a freeform arrow (not snapped to widgets) |
| `delete_widget` | Delete any widget by ID |

### Board Editing — Read (2 tools)
| Tool | Description |
|------|-------------|
| `get_widgets` | List widgets (paginated, default 50, stripped to key fields) |
| `get_widget` | Get a single widget by ID |

### Navigation (4 tools)
| Tool | Description |
|------|-------------|
| `list_workspaces` | List accessible workspaces |
| `list_rooms` | List rooms in a workspace (default limit 50) |
| `list_murals` | List murals in a room or workspace (default limit 50) |
| `get_mural` | Get mural metadata |

### Mural Management (1 tool)
| Tool | Description |
|------|-------------|
| `create_mural` | Create a new mural (defaults: infinite canvas, grey background) |

## Token Efficiency

All tool responses are optimized for minimal token usage:

- **Stripped responses** — only decision-relevant fields are returned (id, type, position, text, style essentials)
- **Compact JSON** — no pretty-printing, short keys (`w`/`h`/`bg` instead of `width`/`height`/`backgroundColor`)
- **Batch summaries** — create tools return `{summary, count, ids, preview}` instead of full object dumps
- **Pagination** — `get_widgets` defaults to 50 items with cursor-based pagination
- **Server-side validation** — shape types validated server-side (no bloated enums in schema)

## Prerequisites

### 1. Register a Mural App

1. Go to [app.mural.co](https://app.mural.co) → click your avatar → **"Create and manage apps"**
2. Click **"New app"**
3. Set the redirect URL to: `http://localhost:9876/callback`
4. Note your **Client ID** and **Client Secret**

### 2. Install & Build

```bash
git clone https://github.com/janschmiedgen/mural-mcp.git
cd mural-mcp
npm install
npm run build
```

### 3. One-Time OAuth Authentication

```bash
export MURAL_CLIENT_ID=your_client_id
export MURAL_CLIENT_SECRET=your_client_secret
npm run auth
```

This opens your browser for Mural consent. Tokens are saved to `~/.mural-mcp/tokens.json` and auto-refresh at runtime.

## MCP Client Setup

### Warp

Add as a CLI MCP Server in **Settings → MCP Servers**:

```json
{
  "command": "node",
  "args": ["/path/to/mural-mcp/build/index.js"],
  "env": {
    "MURAL_CLIENT_ID": "your_client_id",
    "MURAL_CLIENT_SECRET": "your_client_secret"
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mural": {
      "command": "node",
      "args": ["/path/to/mural-mcp/build/index.js"],
      "env": {
        "MURAL_CLIENT_ID": "your_client_id",
        "MURAL_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add mural -- node /path/to/mural-mcp/build/index.js
```

Set `MURAL_CLIENT_ID` and `MURAL_CLIENT_SECRET` in your shell environment.

## Configuration

### Workspace Allowlist (optional)

Restrict access to specific workspaces by setting the `MURAL_ALLOWED_WORKSPACES` environment variable:

```bash
export MURAL_ALLOWED_WORKSPACES="workspace_id_1,workspace_id_2"
```

If not set, all workspaces the authenticated user can access are available.

## Development

```bash
npm install
npm run build    # Compile TypeScript → build/
npm run dev      # Run with tsx (hot reload)
npm run auth     # Re-authenticate with Mural
```

## Architecture

```
src/
├── index.ts                  # Entry point, registers tools, starts stdio transport
├── types.ts                  # TypeScript interfaces (Widget, Mural, Room, etc.)
├── auth/
│   ├── oauth.ts              # OAuth2 + PKCE flow, token refresh
│   ├── token-store.ts        # Token persistence (~/.mural-mcp/tokens.json)
│   └── workspace-guard.ts    # Workspace allowlist guard
├── client/
│   └── mural-api.ts          # HTTP client for Mural Public API v1
├── tools/
│   ├── widgets-write.ts      # 13 write tools (create, update, connect, delete)
│   ├── widgets-read.ts       # 2 read tools (get_widgets, get_widget)
│   ├── navigation.ts         # 4 navigation tools (workspaces, rooms, murals)
│   └── mural-manage.ts       # 1 management tool (create_mural)
└── utils/
    └── strip.ts              # Response strippers for token efficiency
```

- **Transport:** stdio (no HTTP server at runtime)
- **Auth:** OAuth2 + PKCE, tokens stored in `~/.mural-mcp/tokens.json`, auto-refresh
- **API:** Mural Public API v1 (`https://app.mural.co/api/public/v1`)

## Mural API Notes

A few quirks discovered during development that may help contributors:

- **Arrow semantics:** In the Mural API, `startRefId` is the widget the arrowhead points TO, and `endRefId` is the tail. The arrowhead renders at the **first point** in the points array.
- **Sticky note styles on creation:** Only `fontSize` and `textAlign` can be set during creation. `backgroundColor` must be set via a subsequent update call.
- **Image upload:** Requires a 3-step process: (1) download image, (2) create an asset URL via the API, (3) PUT the image to blob storage, (4) create the image widget referencing the asset name.
- **Vertical arrows:** `connect_widgets` may fail with `WIDGET_SIZE_INVALID` when source and target are nearly vertically aligned (near-zero arrow width). Use `create_arrow` (freeform) as a fallback.

## License

MIT
