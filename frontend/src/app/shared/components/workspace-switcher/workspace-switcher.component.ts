import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceType, Workspace } from '../../../core/models/workspace.model';
import { AuthService } from '../../../core/services/auth.service';
import { WorkspaceOnboardingModalComponent } from '../workspace-onboarding-modal/workspace-onboarding-modal.component';

const WORKSPACE_ICONS: Record<WorkspaceType, string> = {
  PERSONAL:   '👤',
  SHIPPER:    '📦',
  DRIVER:     '🚛',
  CARRIER:    '🏢',
  BROKER:     '🔗',
  ADMIN:      '⚙️',
  SUPERADMIN: '🔑',
};

const WORKSPACE_COLORS: Record<WorkspaceType, string> = {
  PERSONAL:   '#757575',
  SHIPPER:    '#C9A227',
  DRIVER:     '#43A047',
  CARRIER:    '#2196F3',
  BROKER:     '#1565C0',
  ADMIN:      '#1A237E',
  SUPERADMIN: '#4A148C',
};

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [CommonModule, WorkspaceOnboardingModalComponent],
  template: `
    <div class="ws-switcher" *ngIf="ws.activeWorkspace()">

      <button class="ws-current" (click)="toggle($event)" [class.open]="open()">
        <span class="ws-icon" [style.color]="getActiveColor()">{{ getActiveIcon() }}</span>
        <span class="ws-name">{{ ws.activeWorkspace()?.name }}</span>
        <span class="ws-chevron" *ngIf="ws.hasMultiple()">{{ open() ? '▲' : '▼' }}</span>
      </button>

      <div class="ws-dropdown" *ngIf="open() && ws.workspaces().length > 1">
        <div class="ws-dropdown-header">Changer d'espace</div>
        <ng-container *ngFor="let w of ws.workspaces()">
          <button
            class="ws-option"
            [class.ws-option--active]="w.id === ws.activeWorkspace()?.id"
            [disabled]="ws.loading() || w.id === ws.activeWorkspace()?.id"
            (click)="select(w, $event)"
          >
            <span class="ws-opt-icon" [style.color]="getColor(w.type)">{{ getIcon(w.type) }}</span>
            <span class="ws-opt-name">{{ w.name }}</span>
            <span class="ws-opt-check" *ngIf="w.id === ws.activeWorkspace()?.id">✓</span>
          </button>
        </ng-container>
        <div class="ws-loading" *ngIf="ws.loading()">Changement en cours...</div>
      </div>
    </div>

    <!-- Onboarding modal — shown before switching to CARRIER or DRIVER -->
    <app-workspace-onboarding-modal
      *ngIf="pendingWorkspace()"
      [targetWorkspace]="pendingWorkspace()!"
      (confirmed)="onOnboardingConfirmed()"
      (cancelled)="onOnboardingCancelled()"
    ></app-workspace-onboarding-modal>
  `,
  styles: [`
    .ws-switcher { position: relative; padding: 6px 10px; }

    .ws-current {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 8px 10px; background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
      color: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
      transition: background .15s; text-align: left;
    }
    .ws-current:hover, .ws-current.open {
      background: rgba(201,162,39,0.12); border-color: rgba(201,162,39,0.35);
    }

    .ws-icon { font-size: 16px; flex-shrink: 0; }
    .ws-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ws-chevron { font-size: 9px; color: rgba(255,255,255,0.4); flex-shrink: 0; }

    .ws-dropdown {
      position: absolute; left: 10px; right: 10px; top: calc(100% + 4px);
      background: #1A1A1A; border: 1px solid rgba(201,162,39,0.25); border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 999; overflow: hidden;
      animation: dropIn .15s ease;
    }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: none; }
    }

    .ws-dropdown-header {
      padding: 8px 12px 6px; font-size: 10px; font-weight: 700;
      letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.35);
    }

    .ws-option {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 12px; background: none; border: none;
      color: #fff; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s; text-align: left;
    }
    .ws-option:hover:not(:disabled) { background: rgba(255,255,255,0.07); }
    .ws-option--active { background: rgba(201,162,39,0.1); color: #E8C84A; }
    .ws-option:disabled { cursor: default; }

    .ws-opt-icon { font-size: 16px; flex-shrink: 0; }
    .ws-opt-name { flex: 1; }
    .ws-opt-check { color: #C9A227; font-size: 14px; font-weight: 800; }

    .ws-loading {
      padding: 8px 12px; font-size: 12px; color: rgba(255,255,255,0.4);
      text-align: center; border-top: 1px solid rgba(255,255,255,0.06);
    }
  `]
})
export class WorkspaceSwitcherComponent implements OnInit {
  readonly ws:   WorkspaceService = inject(WorkspaceService);
  private  auth: AuthService      = inject(AuthService);

  readonly open            = signal(false);
  readonly pendingWorkspace = signal<WorkspaceType | null>(null);

  private pendingTarget: WorkspaceType | null = null;

  ngOnInit(): void {
    this.ws.loadWorkspaces().subscribe({
      error: () => { /* cached data still in signal */ }
    });
  }

  toggle(e: Event): void {
    e.stopPropagation();
    this.open.update(v => !v);
  }

  select(w: Workspace, e: Event): void {
    e.stopPropagation();
    if (w.id === this.ws.activeWorkspace()?.id) { this.open.set(false); return; }
    this.open.set(false);

    // Check if onboarding is needed for DRIVER or CARRIER
    if (this.needsOnboarding(w.id)) {
      this.pendingTarget = w.id;
      this.pendingWorkspace.set(w.id);
      return;
    }

    this.doSwitch(w.id);
  }

  private needsOnboarding(targetId: WorkspaceType): boolean {
    if (targetId !== 'DRIVER' && targetId !== 'CARRIER') return false;
    const user = this.auth.user() as any;
    if (targetId === 'DRIVER')  return !user?.driver_profile;
    if (targetId === 'CARRIER') return !user?.carrier_profile;
    return false;
  }

  onOnboardingConfirmed(): void {
    const target = this.pendingTarget;
    this.pendingWorkspace.set(null);
    this.pendingTarget = null;
    if (target) this.doSwitch(target);
  }

  onOnboardingCancelled(): void {
    this.pendingWorkspace.set(null);
    this.pendingTarget = null;
  }

  private doSwitch(workspaceId: WorkspaceType): void {
    this.ws.switchWorkspace(workspaceId).subscribe({
      error: (err: unknown) => console.error('Workspace switch failed', err),
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!(e.target as HTMLElement).closest('app-workspace-switcher')) {
      this.open.set(false);
    }
  }

  getIcon(type: WorkspaceType): string  { return WORKSPACE_ICONS[type] ?? '👤'; }
  getColor(type: WorkspaceType): string { return WORKSPACE_COLORS[type] ?? '#757575'; }

  getActiveIcon(): string {
    const type = this.ws.activeWorkspace()?.type;
    return type ? (WORKSPACE_ICONS[type] ?? '👤') : '👤';
  }

  getActiveColor(): string {
    const type = this.ws.activeWorkspace()?.type;
    return type ? (WORKSPACE_COLORS[type] ?? '#757575') : '#757575';
  }
}
