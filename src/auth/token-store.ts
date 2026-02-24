import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
  token_type: string;
  scope: string;
}

const TOKEN_DIR = join(homedir(), ".mural-mcp");
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
}

export function isTokenExpired(tokens: StoredTokens): boolean {
  // Consider expired 60 seconds before actual expiry to avoid edge cases
  return Date.now() >= tokens.expires_at - 60_000;
}

export function tokensFromResponse(response: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}): StoredTokens {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + response.expires_in * 1000,
    token_type: response.token_type,
    scope: response.scope,
  };
}
