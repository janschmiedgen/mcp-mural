#!/usr/bin/env tsx
import { performOAuthFlow } from "../src/auth/oauth.js";

async function main() {
  console.log("🔐 Mural MCP — OAuth2 Setup\n");

  if (!process.env.MURAL_CLIENT_ID || !process.env.MURAL_CLIENT_SECRET) {
    console.error(
      "Error: MURAL_CLIENT_ID and MURAL_CLIENT_SECRET must be set.\n\n" +
      "  export MURAL_CLIENT_ID=your_client_id\n" +
      "  export MURAL_CLIENT_SECRET=your_client_secret\n"
    );
    process.exit(1);
  }

  try {
    const tokens = await performOAuthFlow();
    console.log("\n✅ Authentication successful!");
    console.log(`   Scopes: ${tokens.scope}`);
    console.log(`   Tokens saved to ~/.mural-mcp/tokens.json`);
    console.log(`   Expires at: ${new Date(tokens.expires_at).toLocaleString()}\n`);
  } catch (error) {
    console.error("\n❌ Authentication failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
