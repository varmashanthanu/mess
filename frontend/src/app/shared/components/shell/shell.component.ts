import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="app-layout">
      <app-sidebar [collapsed]="sidebarCollapsed()" />
      <div class="app-main" [style.margin-left]="sidebarCollapsed() ? '64px' : 'var(--sidebar-width)'">
        <app-topbar (toggleSidebar)="toggleSidebar()" />
        <main class="app-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout { display: flex; height: 100vh; overflow: hidden; }
    .app-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; transition: margin-left .25s ease; }
    .app-content { flex: 1; overflow-y: auto; padding: 24px; background: var(--background); }
    @media (max-width: 768px) {
      .app-main { margin-left: 0 !important; }
    }
  `]
})
export class ShellComponent {
  sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }
}
