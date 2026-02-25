import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../core/services/notification.service';
import { Notification } from '../../core/models/notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="notif-page">
      <div class="page-header">
        <h1>{{ 'NOTIFICATIONS.TITLE' | translate }} <span class="badge-count" *ngIf="svc.unreadCount() > 0">{{ svc.unreadCount() }}</span></h1>
        <button class="btn-mark-read" (click)="svc.markAllRead()" *ngIf="svc.unreadCount() > 0">
          {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
        </button>
      </div>

      <div class="card">
        <div class="notif-list" *ngIf="svc.notifications().length; else empty">
          <div class="notif-item"
            *ngFor="let n of svc.notifications()"
            [class.unread]="!n.is_read">
            <div class="notif-icon">{{ getIcon(n.notification_type) }}</div>
            <div class="notif-body">
              <div class="notif-title">{{ n.title }}</div>
              <div class="notif-body-text text-sm text-muted">{{ n.body }}</div>
              <div class="notif-time text-sm text-muted">{{ n.created_at | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
            <div class="unread-dot" *ngIf="!n.is_read"></div>
          </div>
        </div>
        <ng-template #empty>
          <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <h3>{{ 'NOTIFICATIONS.EMPTY_TITLE' | translate }}</h3>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .notif-page { max-width: 700px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .badge-count { background: #FF6B35; color: white; font-size: 12px; padding: 2px 8px; border-radius: 12px; }
    .btn-mark-read { padding: 8px 14px; border: 1px solid #E0E0E0; background: white; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #424242; }
    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
    .notif-list { }
    .notif-item { display: flex; gap: 14px; padding: 16px 20px; border-bottom: 1px solid #F5F5F5; align-items: flex-start; position: relative; }
    .notif-item:last-child { border-bottom: none; }
    .notif-item.unread { background: #FFF9F7; }
    .notif-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
    .notif-body { flex: 1; }
    .notif-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .notif-body-text { margin-bottom: 6px; }
    .notif-time { }
    .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF6B35; flex-shrink: 0; margin-top: 6px; }
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .empty-state { padding: 48px; text-align: center; color: #757575; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; }
  `]
})
export class NotificationsComponent implements OnInit {
  svc = inject(NotificationService);

  ngOnInit(): void { this.svc.load(); }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      ORDER_POSTED: '📦', BID_RECEIVED: '💰', BID_ACCEPTED: '✅', BID_REJECTED: '❌',
      ORDER_ASSIGNED: '🚛', ORDER_IN_TRANSIT: '🛣️', ORDER_DELIVERED: '🏁',
      ORDER_CANCELLED: '🚫', PAYMENT_RECEIVED: '💵', NEW_MESSAGE: '💬', SYSTEM: '⚙️',
    };
    return icons[type] ?? '🔔';
  }
}
