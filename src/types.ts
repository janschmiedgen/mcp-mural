// --- Workspace ---
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  locked?: boolean;
  suspended?: boolean;
  companyId?: string;
  createdOn?: number;
}

// --- Room ---
export interface Room {
  id: number;
  name: string;
  description?: string;
  type: "open" | "private";
  workspaceId: string;
  createdOn?: number;
  updatedOn?: number;
}

// --- Mural ---
export interface Mural {
  id: string;
  title?: string;
  backgroundColor?: string;
  height?: number;
  width?: number;
  roomId?: number;
  workspaceId?: string;
  createdOn?: number;
  updatedOn?: number;
  infinite?: boolean;
}

// --- Widget (generic) ---
export interface Widget {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  title?: string;
  style?: Record<string, unknown>;
  parentId?: string;
  hidden?: boolean;
  createdBy?: UserInfo;
  updatedBy?: UserInfo;
  createdOn?: number;
  updatedOn?: number;
  [key: string]: unknown;
}

export interface UserInfo {
  id: string;
  firstName?: string;
  lastName?: string;
}

// --- Paginated response ---
export interface PaginatedResponse<T> {
  value: T[];
  next?: string;
}

// --- API list response ---
export interface ListResponse<T> {
  value: T[];
  next?: string;
}

// --- Single value response ---
export interface SingleResponse<T> {
  value: T;
}
