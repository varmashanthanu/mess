import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <div class="sidebar-brand">
        <span class="brand-icon">🚛</span>
        <span class="brand-name" *ngIf="!collapsed()">Mess</span>
      </div>

      <nav class="sidebar-nav">
        <ng-container *ngFor="let item of visibleItems()">
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="nav-item"
            [title]="collapsed() ? (item.labelKey | translate) : ''"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.labelKey | translate }}</span>
            <span class="nav-badge" *ngIf="item.route === '/notifications' && notifSvc.unreadCount() > 0">
              {{ notifSvc.unreadCount() }}
            </span>
          </a>
        </ng-container>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" *ngIf="!collapsed()">
          <div class="user-avatar">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ auth.user()?.full_name }}</div>
            <div class="user-role">{{ auth.user()?.role }}</div>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()" [title]="collapsed() ? ('NAV.LOGOUT' | translate) : ''">
          <span>🚪</span>
          <span *ngIf="!collapsed()">{{ 'NAV.LOGOUT' | translate }}</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar { width: var(--sidebar-width); height: 100vh; background: #1A1A2E; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; z-index: 100; transition: width .25s ease; overflow: hidden; }
    .sidebar.collapsed { width: 64px; }
    .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); min-height: 64px; }
    .brand-icon { font-size: 24px; }
    .brand-name { font-size: 20px; font-weight: 800; color: #FF6B35; letter-spacing: -0.5px; white-space: nowrap; }
    .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; overflow-x: hidden; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 2px; transition: all .15s; white-space: nowrap; position: relative; }
    .nav-item:hover { background: rgba(255,255,255,0.08); color: white; text-decoration: none; }
    .nav-item.active { background: #FF6B35; color: white; }
    .nav-icon { font-size: 18px; flex-shrink: 0; width: 20px; text-align: center; }
    .nav-label { flex: 1; }
    .nav-badge { background: #F44336; color: white; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px; min-width: 18px; text-align: center; }
    .sidebar-footer { padding: 12px 8px; border-top: 1px solid rgba(255,255,255,0.08); }
    .user-info { display: flex; align-items: center; gap: 10px; padding: 8px 12px; margin-bottom: 4px; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #FF6B35; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
    .user-details { overflow: hidden; }
    .user-name { font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
    .logout-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; border-radius: 8px; font-size: 14px; transition: all .15s; white-space: nowrap; }
    .logout-btn:hover { background: rgba(255,255,255,0.08); color: white; }
  `]
})
export class SidebarComponent {
  collapsed = input(false);
  auth = inject(AuthService);
  notifSvc = inject(NotificationService);

  initials = computed(() => {
    const name = this.auth.user()?.full_name ?? '';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  });

  private allItems: NavItem[] = [
    { labelKey: 'NAV.DASHBOARD',    icon: '📊', route: '/dashboard' },
    { labelKey: 'NAV.ORDERS',       icon: '📦', route: '/orders',       roles: ['SHIPPER', 'BROKER', 'ADMIN'] },
    { labelKey: 'NAV.MY_MISSIONS',  icon: '🚛', route: '/orders',       roles: ['DRIVER'] },
    { labelKey: 'NAV.TRACKING',     icon: '📍', route: '/tracking',     roles: ['SHIPPER', 'BROKER', 'DRIVER', 'FLEET_MANAGER', 'ADMIN'] },
    { labelKey: 'NAV.FLEET',        icon: '🚚', route: '/fleet',        roles: ['DRIVER', 'FLEET_MANAGER', 'ADMIN'] },
    { labelKey: 'NAV.MESSAGES',     icon: '💬', route: '/messaging' },
    { labelKey: 'NAV.NOTIFICATIONS',icon: '🔔', route: '/notifications' },
    { labelKey: 'NAV.PROFILE',      icon: '👤', route: '/profile' },
    { labelKey: 'NAV.ADMIN',        icon: '⚙️', route: '/admin',        roles: ['ADMIN'] },
  ];

  visibleItems = computed(() => {
    const role = this.auth.role();
    return this.allItems.filter(item => !item.roles || (role && item.roles.includes(role)));
  });
}
