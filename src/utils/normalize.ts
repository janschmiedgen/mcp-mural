/**
 * Normalize a mural ID from various user-supplied formats:
 *  1. Full URL:  https://app.mural.co/t/ws/m/ws/123456/hash  → ws.123456
 *  2. Numeric only:  123456  → <workspace>.123456  (if single allowed workspace)
 *  3. Correct format:  ws.123456  → ws.123456  (passthrough)
 *
 * Returns { id, error } — if error is set, the id could not be resolved.
 */

import { z } from "zod";
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

/**
 * Extract the workspace prefix from a resolved `workspaceId.numericId` mural ID.
 * Returns null if the id has no recognizable `.numericId` suffix (e.g. a bare
 * numeric ID or an unknown passthrough format), in which case the workspace
 * cannot be checked against the allowlist.
 */
export function workspaceOfMuralId(id: string): string | null {
  const lastDot = id.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const ws = id.slice(0, lastDot);
  const numeric = id.slice(lastDot + 1);
  if (!/^\d+$/.test(numeric)) return null;
  return ws;
}

/** Describe text for muralId params — keeps it consistent across tools */
export const MURAL_ID_DESC =
  'Mural ID in format "workspaceId.numericId" (e.g. myworkspace.1234567890). Also accepts full Mural URLs.';

/**
 * Zod schema for a muralId tool parameter. Normalizes the raw input to the
 * canonical `workspaceId.numericId` form and enforces MURAL_ALLOWED_WORKSPACES
 * on the resolved workspace prefix — all before the tool handler runs.
 *
 * Use this in place of `z.string().describe(MURAL_ID_DESC)`; the handler then
 * receives the normalized, allowlist-checked id under `muralId`.
 */
export const muralIdSchema = z
  .string()
  .describe(MURAL_ID_DESC)
  .transform((raw, ctx) => {
    const { id, error } = normalizeMuralId(raw);

    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      return z.NEVER;
    }

    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mural ID is required.",
      });
      return z.NEVER;
    }

    // Enforce the workspace allowlist on the resolved workspace prefix.
    const allowed = getAllowedWorkspaces();
    if (allowed) {
      const ws = workspaceOfMuralId(id);
      if (ws === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Mural ID "${id}" has no recognizable workspace prefix. Expected format: workspaceId.numericId (e.g. myworkspace.1234567890), so it can be checked against MURAL_ALLOWED_WORKSPACES.`,
        });
        return z.NEVER;
      }
      if (!allowed.has(ws)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Access denied: workspace "${ws}" is not in MURAL_ALLOWED_WORKSPACES. Allowed: ${[...allowed].join(", ")}`,
        });
        return z.NEVER;
      }
    }

    return id;
  });
