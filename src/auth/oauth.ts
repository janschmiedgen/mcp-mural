import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { loadTokens, saveTokens, isTokenExpired, tokensFromResponse, type StoredTokens } from "./token-store.js";

const AUTH_URL = "https://app.mural.co/api/public/v1/authorization/oauth2";
const TOKEN_URL = "https://app.mural.co/api/public/v1/authorization/oauth2/token";
const REDIRECT_URI = "http://localhost:9876/callback";
const SCOPES = "murals:read murals:write rooms:read workspaces:read users:read identity:read templates:read";

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MURAL_CLIENT_ID;
  const clientSecret = process.env.MURAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "MURAL_CLIENT_ID and MURAL_CLIENT_SECRET must be set as environment variables"
    );
  }
  return { clientId, clientSecret };
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Interactive OAuth flow: opens browser, waits for callback, exchanges code.
 * Used by scripts/auth.ts for one-time setup.
 */
export async function performOAuthFlow(): Promise<StoredTokens> {
  const { clientId, clientSecret } = getCredentials();
  const { verifier, challenge } = generatePKCE();

  const authorizationCode = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:9876`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400);
        res.end(`Authorization failed: ${error}`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received");
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>✅ Mural MCP authorized!</h2>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>
      `);
      server.close();
      resolve(code);
    });

    server.listen(9876, () => {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });

      const url = `${AUTH_URL}?${params.toString()}`;
      console.log(`\nOpening browser for Mural authorization...\n`);
      console.log(`If the browser doesn't open, visit:\n${url}\n`);

      import("open").then((mod) => mod.default(url)).catch(() => {
        console.log("Could not open browser automatically. Please visit the URL above.");
      });
    });

    server.on("error", reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const tokens = tokensFromResponse(data);
  await saveTokens(tokens);
  return tokens;
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens> {
  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token refresh failed (${response.status}): ${text}. Re-run 'npm run auth' to re-authenticate.`
    );
  }

  const data = await response.json();
  const newTokens = tokensFromResponse(data);
  await saveTokens(newTokens);
  return newTokens;
}

/**
 * Get a valid access token, refreshing if necessary.
 * This is the main entry point used by the MCP server at runtime.
 */
export async function getValidAccessToken(): Promise<string> {
  let tokens = await loadTokens();
  if (!tokens) {
    throw new Error(
      "No stored tokens found. Run 'npm run auth' in the mural-mcp directory first."
    );
  }

  if (isTokenExpired(tokens)) {
    tokens = await refreshAccessToken(tokens);
  }

  return tokens.access_token;
}
