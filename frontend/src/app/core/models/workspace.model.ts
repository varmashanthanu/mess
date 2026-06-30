export type WorkspaceType = 'PERSONAL' | 'SHIPPER' | 'DRIVER' | 'CARRIER' | 'BROKER' | 'ADMIN' | 'SUPERADMIN';

export interface Workspace {
  id: WorkspaceType;
  type: WorkspaceType;
  name: string;
}

export interface WorkspaceListResponse {
  active_workspace: WorkspaceType;
  workspaces: Workspace[];
}

export interface WorkspaceSwitchResponse {
  workspace: Workspace;
  role: WorkspaceType;
  permissions: string[];
  nav: string[];
  access: string;
  refresh: string;
}
