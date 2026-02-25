import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LanguageService } from '../../../core/services/language.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <header class="topbar">
      <button class="menu-toggle" (click)="toggleSidebar.emit()">☰</button>

      <div class="topbar-right">

        <!-- Driver availability toggle -->
        <div class="availability-toggle" *ngIf="auth.role() === 'DRIVER'">
          <span class="status-dot"
            [class.status-dot--online]="isAvailable"
            [class.status-dot--offline]="!isAvailable"></span>
          <span class="avail-label">
            {{ (isAvailable ? 'TOPBAR.AVAILABLE' : 'TOPBAR.UNAVAILABLE') | translate }}
          </span>
          <label class="toggle-switch">
            <input type="checkbox" [checked]="isAvailable" (change)="toggleAvailability()">
            <span class="slider"></span>
          </label>
        </div>

        <!-- Language picker -->
        <div class="lang-picker">
          <button class="lang-btn" (click)="langOpen = !langOpen">
            <span>{{ langSvc.currentLang().flag }}</span>
            <span class="lang-code">{{ langSvc.currentLang().code | uppercase }}</span>
            <span class="lang-chevron">▾</span>
          </button>
          <div class="lang-dropdown" *ngIf="langOpen">
            <button
              *ngFor="let lang of langSvc.languages"
              class="lang-option"
              [class.active]="lang.code === langSvc.current()"
              (click)="selectLang(lang.code)">
              <span>{{ lang.flag }}</span>
              <span>{{ lang.label }}</span>
            </button>
          </div>
        </div>

        <!-- Notifications -->
        <a class="notif-btn" routerLink="/notifications">
          <span>🔔</span>
          <span class="notif-badge" *ngIf="notifSvc.unreadCount() > 0">
            {{ notifSvc.unreadCount() > 9 ? '9+' : notifSvc.unreadCount() }}
          </span>
        </a>

        <!-- User chip -->
        <div class="user-chip">
          <span class="user-chip-avatar">{{ initials }}</span>
          <span class="user-chip-name">{{ (auth.user()?.full_name || '').split(' ')[0] }}</span>
        </div>

      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: var(--topbar-height); background: white;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; border-bottom: 1px solid #E0E0E0;
      position: sticky; top: 0; z-index: 50;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .menu-toggle { background: none; border: none; font-size: 22px; cursor: pointer; color: #424242; padding: 8px; border-radius: 8px; transition: background .15s; }
    .menu-toggle:hover { background: #F5F5F5; }
    .topbar-right { display: flex; align-items: center; gap: 12px; }
    .availability-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .avail-label { color: #757575; font-weight: 500; }
    .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: #BDBDBD; border-radius: 22px; transition: .3s; }
    .slider:before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background: #00C896; }
    input:checked + .slider:before { transform: translateX(18px); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .status-dot--online { background: #00C896; }
    .status-dot--offline { background: #9E9E9E; }
    .lang-picker { position: relative; }
    .lang-btn { display: flex; align-items: center; gap: 5px; padding: 7px 10px; border: 1.5px solid #E0E0E0; background: white; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #424242; transition: border-color .15s; }
    .lang-btn:hover { border-color: #FF6B35; }
    .lang-chevron { font-size: 10px; color: #757575; }
    .lang-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: white; border: 1px solid #E0E0E0; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden; min-width: 140px; z-index: 200; }
    .lang-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; cursor: pointer; font-size: 13px; text-align: left; transition: background .1s; }
    .lang-option:hover { background: #F5F5F5; }
    .lang-option.active { background: #FFF3F0; color: #FF6B35; font-weight: 700; }
    .notif-btn { position: relative; text-decoration: none; font-size: 20px; padding: 8px; border-radius: 8px; display: flex; align-items: center; }
    .notif-btn:hover { background: #F5F5F5; }
    .notif-badge { position: absolute; top: 2px; right: 2px; background: #F44336; color: white; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 10px; min-width: 16px; text-align: center; }
    .user-chip { display: flex; align-items: center; gap: 8px; }
    .user-chip-avatar { width: 34px; height: 34px; border-radius: 50%; background: #FF6B35; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .user-chip-name { font-size: 14px; font-weight: 600; color: #212121; }
  `]
})
export class TopbarComponent {
  toggleSidebar = output<void>();
  auth = inject(AuthService);
  notifSvc = inject(NotificationService);
  langSvc = inject(LanguageService);
  private api = inject(ApiService);

  isAvailable = false;
  langOpen = false;

  get initials(): string {
    return (this.auth.user()?.full_name ?? '')
      .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  selectLang(code: string): void {
    this.langSvc.use(code);
    this.langOpen = false;
  }

  toggleAvailability(): void {
    this.api.updateDriverAvailability(!this.isAvailable).subscribe({
      next: (res) => (this.isAvailable = res.is_available),
    });
  }
}
