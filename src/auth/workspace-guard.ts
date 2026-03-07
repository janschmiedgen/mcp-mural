/**
 * Workspace allowlist guard.
 * If MURAL_ALLOWED_WORKSPACES is set (comma-separated IDs), only those workspaces are accessible.
 * If not set, all workspaces are accessible.
 */

let allowedWorkspaces: Set<string> | null = null;

export function initWorkspaceGuard(): void {
  const raw = process.env.MURAL_ALLOWED_WORKSPACES;
  if (raw && raw.trim()) {
    allowedWorkspaces = new Set(
      raw.split(",").map((id) => id.trim()).filter(Boolean)
    );
  }
}

export function isWorkspaceAllowed(workspaceId: string): boolean {
  if (!allowedWorkspaces) return true; // no restriction
  return allowedWorkspaces.has(workspaceId);
}

export function getWorkspaceGuardError(workspaceId: string): string {
  return `Access denied: workspace "${workspaceId}" is not in MURAL_ALLOWED_WORKSPACES. Allowed: ${[...(allowedWorkspaces || [])].join(", ")}`;
}

export function filterAllowedWorkspaces<T extends { id: string }>(workspaces: T[]): T[] {
  if (!allowedWorkspaces) return workspaces;
  return workspaces.filter((w) => allowedWorkspaces!.has(w.id));
}

export function isGuardEnabled(): boolean {
  return allowedWorkspaces !== null;
}

export function getAllowedWorkspaces(): Set<string> | null {
  return allowedWorkspaces;
}
