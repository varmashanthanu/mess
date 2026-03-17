import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, CommonModule],
  template: `
    <div class="app-layout">
      <app-sidebar
        [collapsed]="sidebarCollapsed()"
        [mobileOpen]="mobileSidebarOpen()"
        (close)="mobileSidebarOpen.set(false)"
        (navClick)="mobileSidebarOpen.set(false)" />

      <!-- Mobile backdrop: sits over content, under sidebar -->
      <div class="sidebar-backdrop" *ngIf="mobileSidebarOpen()" (click)="mobileSidebarOpen.set(false)"></div>

      <div class="app-main" [style.margin-left]="desktopMargin()">
        <app-topbar (toggleSidebar)="toggleSidebar()" />
        <main class="app-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout { display: flex; height: 100vh; overflow: hidden; position: relative; }
    .app-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; transition: margin-left .25s ease; }
    .app-content { flex: 1; overflow-y: auto; padding: 24px; background: var(--background); }
    .sidebar-backdrop { display: none; }
    @media (max-width: 768px) {
      .app-main { margin-left: 0 !important; }
      .sidebar-backdrop {
        display: block;
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 149;
      }
    }
  `]
})
export class ShellComponent implements OnInit {
  private notifSvc = inject(NotificationService);
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  ngOnInit(): void {
    this.notifSvc.connectWebSocket();
  }

  desktopMargin(): string {
    return this.sidebarCollapsed() ? '64px' : 'var(--sidebar-width)';
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      this.mobileSidebarOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }
}
