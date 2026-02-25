import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Conversation, Message, WsMessage } from '../../core/models/messaging.model';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="messaging-page">
      <div class="page-header"><h1>{{ 'MESSAGING.TITLE' | translate }}</h1></div>

      <div class="messaging-layout">
        <!-- Conversations -->
        <div class="conv-panel">
          <div class="conv-search">
            <input type="text" [(ngModel)]="searchTerm" [placeholder]="'COMMON.SEARCH' | translate" />
          </div>
          <div class="conv-list">
            <div class="conv-item"
              *ngFor="let c of filteredConvs()"
              [class.active]="activeConv()?.id === c.id"
              (click)="openConversation(c)">
              <div class="conv-icon">📦</div>
              <div class="conv-body">
                <div class="conv-ref">{{ c.order_reference }}</div>
                <div class="conv-last text-sm text-muted" *ngIf="c.last_message">
                  {{ c.last_message.content | slice:0:40 }}{{ c.last_message.content.length > 40 ? '...' : '' }}
                </div>
              </div>
              <div class="conv-badge" *ngIf="c.unread_count > 0">{{ c.unread_count }}</div>
            </div>
            <div class="empty-state" *ngIf="!conversations().length">
              <div class="empty-icon">💬</div>
              <p>{{ 'MESSAGING.EMPTY_TITLE' | translate }}</p>
            </div>
          </div>
        </div>

        <!-- Chat window -->
        <div class="chat-panel">
          <ng-container *ngIf="activeConv(); else noConv">
            <div class="chat-header">
              <strong>{{ 'MESSAGING.ORDER' | translate }} {{ activeConv()!.order_reference }}</strong>
              <span class="text-sm text-muted">{{ messages().length }} {{ 'MESSAGING.MESSAGES' | translate }}</span>
            </div>

            <div class="messages-area" #messagesEnd>
              <div class="loading-overlay" *ngIf="loadingMessages()">⏳</div>
              <div class="message-group" *ngIf="!loadingMessages()">
                <div class="message"
                  *ngFor="let m of messages()"
                  [class.own]="m.sender === auth.user()?.id">
                  <div class="message-bubble">
                    <div class="message-sender" *ngIf="m.sender !== auth.user()?.id">
                      {{ m.sender_name }}
                    </div>
                    <div class="message-content">{{ m.content }}</div>
                    <div class="message-time text-sm">{{ m.created_at | date:'HH:mm' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-input">
              <input type="text" [(ngModel)]="newMessage"
                [placeholder]="'MESSAGING.INPUT_PLACEHOLDER' | translate"
                (keydown.enter)="sendMessage()" />
              <button class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim()">
                ➤
              </button>
            </div>
          </ng-container>
          <ng-template #noConv>
            <div class="no-conv-placeholder">
              <div style="font-size:48px;margin-bottom:12px;">💬</div>
              <p>{{ 'MESSAGING.SELECT_CONVERSATION' | translate }}</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .messaging-page { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-height) - 48px); }
    .page-header { margin-bottom: 16px; flex-shrink: 0; }
    h1 { font-size: 24px; font-weight: 700; }
    .messaging-layout { display: grid; grid-template-columns: 320px 1fr; gap: 16px; flex: 1; min-height: 0; }
    .conv-panel { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .conv-search { padding: 12px; border-bottom: 1px solid #F0F0F0; }
    .conv-search input { width: 100%; padding: 8px 12px; border: 1.5px solid #E0E0E0; border-radius: 8px; font-size: 13px; outline: none; }
    .conv-list { flex: 1; overflow-y: auto; }
    .conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; transition: background .15s; border-bottom: 1px solid #F8F8F8; }
    .conv-item:hover, .conv-item.active { background: #FFF3F0; }
    .conv-icon { font-size: 24px; flex-shrink: 0; }
    .conv-body { flex: 1; min-width: 0; }
    .conv-ref { font-weight: 700; font-size: 14px; }
    .conv-last { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-badge { background: #FF6B35; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }
    .chat-panel { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .chat-header { padding: 16px 20px; border-bottom: 1px solid #F0F0F0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .message { display: flex; }
    .message.own { justify-content: flex-end; }
    .message-bubble { max-width: 70%; }
    .message.own .message-bubble { }
    .message-sender { font-size: 11px; font-weight: 700; color: #FF6B35; margin-bottom: 3px; }
    .message-content { background: #F0F0F0; border-radius: 12px 12px 12px 2px; padding: 10px 14px; font-size: 14px; line-height: 1.4; }
    .message.own .message-content { background: #FF6B35; color: white; border-radius: 12px 12px 2px 12px; }
    .message-time { color: #9E9E9E; text-align: right; margin-top: 3px; }
    .message.own .message-time { color: #9E9E9E; }
    .chat-input { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid #F0F0F0; flex-shrink: 0; }
    .chat-input input { flex: 1; padding: 10px 14px; border: 1.5px solid #E0E0E0; border-radius: 24px; font-size: 14px; outline: none; }
    .chat-input input:focus { border-color: #FF6B35; }
    .send-btn { width: 40px; height: 40px; border-radius: 50%; background: #FF6B35; color: white; border: none; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .no-conv-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #757575; }
    .empty-state { padding: 32px; text-align: center; color: #757575; }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    .text-sm { font-size: 12px; } .text-muted { color: #757575; }
    .loading-overlay { text-align: center; padding: 20px; }
    @media (max-width: 768px) { .messaging-layout { grid-template-columns: 1fr; } }
  `]
})
export class MessagingComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private ws = inject(WebSocketService);

  conversations = signal<Conversation[]>([]);
  activeConv = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  loadingMessages = signal(false);
  searchTerm = '';
  newMessage = '';
  private wsSub?: Subscription;

  @ViewChild('messagesEnd') messagesEnd?: ElementRef;

  ngOnInit(): void {
    this.api.getConversations().subscribe({ next: (r) => this.conversations.set(r.results) });
  }

  filteredConvs(): Conversation[] {
    if (!this.searchTerm) return this.conversations();
    return this.conversations().filter(c =>
      c.order_reference.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  openConversation(c: Conversation): void {
    this.activeConv.set(c);
    this.loadingMessages.set(true);
    this.wsSub?.unsubscribe();

    this.api.getMessages(c.id).subscribe({
      next: (r) => { this.messages.set(r.results); this.loadingMessages.set(false); this.scrollBottom(); },
    });

    this.wsSub = this.ws.connect<WsMessage>('chat', c.id).subscribe({
      next: (msg) => {
        if (msg.type === 'chat_message' && msg.message) {
          this.messages.update(ms => [...ms, msg.message!]);
          this.scrollBottom();
        }
      },
    });
  }

  sendMessage(): void {
    const content = this.newMessage.trim();
    if (!content || !this.activeConv()) return;
    this.newMessage = '';
    // Optimistic: send via WS
    this.ws.send<{ type: string; content: string }>('chat', this.activeConv()!.id, {
      type: 'chat_message', content
    });
  }

  private scrollBottom(): void {
    setTimeout(() => {
      const el = this.messagesEnd?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    const c = this.activeConv();
    if (c) this.ws.disconnect('chat', c.id);
  }
}
