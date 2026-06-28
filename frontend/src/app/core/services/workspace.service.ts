import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Workspace, WorkspaceType, WorkspaceListResponse, WorkspaceSwitchResponse } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly ACCESS_KEY    = 'mess_access';
  private readonly REFRESH_KEY   = 'mess_refresh';
  private readonly WS_LIST_KEY   = 'mess_workspaces';

  private _workspaces      = signal<Workspace[]>(this._loadCached());
  private _activeWorkspace = signal<Workspace | null>(null);
  private _loading         = signal(false);

  readonly workspaces      = this._workspaces.asReadonly();
  readonly activeWorkspace = this._activeWorkspace.asReadonly();
  readonly loading         = this._loading.asReadonly();
  readonly hasMultiple     = computed(() => this._workspaces().length > 1);

  private _loadCached(): Workspace[] {
    try {
      const raw = localStorage.getItem(this.WS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  loadWorkspaces(): Observable<WorkspaceListResponse> {
    return this.http.get<WorkspaceListResponse>(`${this.apiUrl}/me/workspaces/`).pipe(
      tap((res) => {
        this._workspaces.set(res.workspaces);
        localStorage.setItem(this.WS_LIST_KEY, JSON.stringify(res.workspaces));

        const active = res.workspaces.find(w => w.id === res.active_workspace)
          ?? res.workspaces[0];
        this._activeWorkspace.set(active ?? null);
      })
    );
  }

  switchWorkspace(workspaceId: WorkspaceType): Observable<WorkspaceSwitchResponse> {
    const current = this._activeWorkspace()?.id;
    this._loading.set(true);
    return this.http.post<WorkspaceSwitchResponse>(`${this.apiUrl}/workspaces/switch/`, {
      workspaceId,
      currentWorkspace: current,
    }).pipe(
      tap((res) => {
        localStorage.setItem(this.ACCESS_KEY, res.access);
        localStorage.setItem(this.REFRESH_KEY, res.refresh);
        this._activeWorkspace.set(res.workspace);
        this._loading.set(false);
        this.router.navigate(['/']).then(() => window.location.reload());
      })
    );
  }

  setFromJwt(workspaceType: string, workspaceName: string): void {
    if (!workspaceType) return;

    const cached = this._workspaces();
    const found  = cached.find(w => w.id === workspaceType);

    this._activeWorkspace.set(found ?? {
      id:   workspaceType as WorkspaceType,
      type: workspaceType as WorkspaceType,
      name: workspaceName || workspaceType,
    });
  }

  reset(): void {
    this._workspaces.set([]);
    this._activeWorkspace.set(null);
    localStorage.removeItem(this.WS_LIST_KEY);
  }
}
