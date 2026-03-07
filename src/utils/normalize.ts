/**
 * Normalize a mural ID from various user-supplied formats:
 *  1. Full URL:  https://app.mural.co/t/ws/m/ws/123456/hash  → ws.123456
 *  2. Numeric only:  123456  → <workspace>.123456  (if single allowed workspace)
 *  3. Correct format:  ws.123456  → ws.123456  (passthrough)
 *
 * Returns { id, error } — if error is set, the id could not be resolved.
 */

import { getAllowedWorkspaces } from "../auth/workspace-guard.js";

// Mural URL pattern:  /t/<workspace>/m/<workspace>/<numericId>/<hash>
const MURAL_URL_RE = /\/m\/([^/]+)\/(\d+)/;

// Already correct: workspaceId.numericId
const DOTTED_RE = /^[a-zA-Z0-9_-]+\.\d+$/;

// Pure numeric
const NUMERIC_RE = /^\d+$/;

export function normalizeMuralId(raw: string): { id: string; error?: string } {
  const trimmed = raw.trim();

  // 1. Full URL
  const urlMatch = trimmed.match(MURAL_URL_RE);
  if (urlMatch) {
    return { id: `${urlMatch[1]}.${urlMatch[2]}` };
  }

  // 2. Already correct format (workspace.numericId)
  if (DOTTED_RE.test(trimmed)) {
    return { id: trimmed };
  }

  // 3. Numeric only — try to prepend workspace
  if (NUMERIC_RE.test(trimmed)) {
    const workspaces = getAllowedWorkspaces();
    if (workspaces && workspaces.size === 1) {
      const ws = [...workspaces][0];
      return { id: `${ws}.${trimmed}` };
    }
    return {
      id: trimmed,
      error: `Mural ID "${trimmed}" looks numeric-only. Expected format: workspaceId.${trimmed} (e.g. myworkspace.${trimmed}). Provide the full ID or set a single MURAL_ALLOWED_WORKSPACES.`,
    };
  }

  // 4. Unknown format — pass through, let API decide
  return { id: trimmed };
}

/** Describe text for muralId params — keeps it consistent across tools */
export const MURAL_ID_DESC =
  'Mural ID in format "workspaceId.numericId" (e.g. myworkspace.1234567890). Also accepts full Mural URLs.';
