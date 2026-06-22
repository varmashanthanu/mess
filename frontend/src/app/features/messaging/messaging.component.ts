import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Conversation, Message, UserBasic, WsMessage, ConversationType } from '../../core/models/messaging.model';

type Tab = 'orders' | 'direct' | 'group';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="messaging-page">
      <div class="page-header">
        <h1>{{ 'MESSAGING.TITLE' | translate }}</h1>
      </div>

      <div class="messaging-layout">
        <!-- ── Left panel: conversation list ── -->
        <div class="conv-panel">

          <!-- Tabs -->
          <div class="tabs">
            <button class="tab" [class.active]="activeTab() === 'orders'" (click)="setTab('orders')">📦 {{ 'MESSAGING.TAB_ORDERS' | translate }}</button>
            <button class="tab" [class.active]="activeTab() === 'direct'" (click)="setTab('direct')">💬 {{ 'MESSAGING.TAB_DIRECT' | translate }}</button>
            <button class="tab" [class.active]="activeTab() === 'group'"  (click)="setTab('group')">👥 {{ 'MESSAGING.TAB_GROUP' | translate }}</button>
          </div>

          <!-- Search + New button -->
          <div class="conv-search">
            <input type="text" [(ngModel)]="searchTerm" [placeholder]="'COMMON.SEARCH' | translate" />
            <button class="new-conv-btn" *ngIf="activeTab() !== 'orders'" (click)="openNewConvModal()" title="{{ 'MESSAGING.NEW_CONV' | translate }}">+</button>
          </div>

          <!-- Conversation list -->
          <div class="conv-list">
            <div class="conv-item"
              *ngFor="let c of filteredConvs()"
              [class.active]="activeConv()?.id === c.id"
              (click)="openConversation(c)">
              <div class="conv-icon">
                <span *ngIf="c.conversation_type === 'ORDER'">📦</span>
                <span *ngIf="c.conversation_type === 'DIRECT'">👤</span>
                <span *ngIf="c.conversation_type === 'GROUP'">👥</span>
              </div>
              <div class="conv-body">
                <div class="conv-ref">{{ c.display_title }}</div>
                <div class="conv-last text-sm text-muted" *ngIf="c.last_message">
                  <span *ngIf="c.last_message.message_type === 'VOICE'">🎤 Message vocal</span>
                  <span *ngIf="c.last_message.message_type === 'IMAGE'">🖼️ Image</span>
                  <span *ngIf="c.last_message.message_type === 'SYSTEM'">ℹ️ {{ c.last_message.content | slice:0:35 }}</span>
                  <span *ngIf="c.last_message.message_type === 'TEXT'">{{ c.last_message.content | slice:0:38 }}{{ c.last_message.content.length > 38 ? '…' : '' }}</span>
                </div>
              </div>
              <div class="conv-badge" *ngIf="c.unread_count > 0">{{ c.unread_count }}</div>
            </div>
            <div class="empty-state" *ngIf="!filteredConvs().length">
              <div class="empty-icon">💬</div>
              <p>{{ 'MESSAGING.EMPTY_TITLE' | translate }}</p>
            </div>
          </div>
        </div>

        <!-- ── Right panel: chat window ── -->
        <div class="chat-panel">
          <ng-container *ngIf="activeConv(); else noConv">

            <!-- Chat header -->
            <div class="chat-header">
              <div>
                <strong>{{ activeConv()!.display_title }}</strong>
                <span class="header-sub text-sm text-muted" *ngIf="activeConv()!.conversation_type === 'ORDER'">
                  Commande {{ activeConv()!.order_reference }}
                </span>
              </div>
              <div class="header-meta text-sm text-muted">{{ messages().length }} messages</div>
            </div>

            <!-- Messages area -->
            <div class="messages-area" #messagesEnd>
              <div class="loading-overlay" *ngIf="loadingMessages()">⏳</div>
              <div class="message-group" *ngIf="!loadingMessages()">
                <ng-container *ngFor="let m of messages()">

                  <!-- SYSTEM message — centered pill -->
                  <div class="system-message" *ngIf="m.message_type === 'SYSTEM'">
                    <span>{{ m.content }}</span>
                  </div>

                  <!-- Regular message -->
                  <div class="message" *ngIf="m.message_type !== 'SYSTEM'"
                    [class.own]="m.sender === auth.user()?.id">

                    <!-- TEXT -->
                    <div class="message-bubble" *ngIf="m.message_type === 'TEXT'">
                      <div class="message-sender" *ngIf="m.sender !== auth.user()?.id">{{ m.sender_name }}</div>
                      <div class="message-content">{{ m.content }}</div>
                      <div class="message-time">{{ m.created_at | date:'HH:mm' }}</div>
                    </div>

                    <!-- IMAGE -->
                    <div class="message-bubble message-bubble--image" *ngIf="m.message_type === 'IMAGE'">
                      <div class="message-sender" *ngIf="m.sender !== auth.user()?.id">{{ m.sender_name }}</div>
                      <img class="chat-image" [src]="mediaUrl(m.file)" alt="Image" (click)="openImageFull(mediaUrl(m.file))" />
                      <div class="message-time">{{ m.created_at | date:'HH:mm' }}</div>
                    </div>

                    <!-- VOICE -->
                    <div class="message-bubble message-bubble--voice" *ngIf="m.message_type === 'VOICE'">
                      <div class="message-sender" *ngIf="m.sender !== auth.user()?.id">{{ m.sender_name }}</div>
                      <div class="voice-player">
                        <button class="voice-play-btn" (click)="togglePlay(m.id, m.file)">
                          {{ playingId() === m.id ? '⏸' : '▶' }}
                        </button>
                        <div class="voice-waveform">
                          <span class="voice-bar" *ngFor="let b of waveformBars"></span>
                        </div>
                        <span class="voice-duration">{{ formatDuration(m.file_duration_seconds) }}</span>
                      </div>
                      <div class="message-time">{{ m.created_at | date:'HH:mm' }}</div>
                    </div>

                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Input bar -->
            <div class="chat-input">

              <!-- Recording bar -->
              <div class="recording-bar" *ngIf="isRecording()">
                <span class="rec-dot"></span>
                <span class="rec-label">{{ recordingTime() }}s · Relâchez pour envoyer</span>
                <div class="rec-waves">
                  <span class="rec-wave" *ngFor="let w of [1,2,3,4,5]"></span>
                </div>
              </div>

              <!-- Text input -->
              <ng-container *ngIf="!isRecording()">
                <input type="text" [(ngModel)]="newMessage"
                  [placeholder]="'MESSAGING.SEND_PLACEHOLDER' | translate"
                  (keydown.enter)="sendMessage()" />
              </ng-container>

              <!-- Image upload button -->
              <button class="media-btn" *ngIf="!isRecording()" (click)="imageInput.click()" title="Envoyer une image">🖼️</button>
              <input #imageInput type="file" accept="image/*" style="display:none" (change)="onImageSelected($event)" />

              <!-- Voice button (hold) -->
              <button class="voice-btn"
                [class.voice-btn--recording]="isRecording()"
                (mousedown)="startRecording()"
                (mouseup)="stopRecording()"
                (touchstart)="startRecording()"
                (touchend)="stopRecording()"
                title="{{ 'MESSAGING.HOLD_RECORD' | translate }}">
                🎤
              </button>

              <!-- Send text button -->
              <button class="send-btn" *ngIf="!isRecording() && newMessage.trim()" (click)="sendMessage()">➤</button>

            </div>
          </ng-container>

          <ng-template #noConv>
            <div class="no-conv-placeholder">
              <div style="font-size:48px">💬</div>
              <p>{{ 'MESSAGING.SELECT_CONV' | translate }}</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>

    <!-- Hidden audio element -->
    <audio #audioPlayer (ended)="playingId.set(null)"></audio>

    <!-- ── New Direct / Group conversation modal ── -->
    <div class="modal-overlay" *ngIf="showNewConvModal()" (click)="closeNewConvModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ activeTab() === 'group' ? ('MESSAGING.NEW_GROUP' | translate) : ('MESSAGING.NEW_DM' | translate) }}</h3>
          <button class="modal-close" (click)="closeNewConvModal()">✕</button>
        </div>
        <div class="modal-body">
          <!-- Group name (group only) -->
          <div class="modal-field" *ngIf="activeTab() === 'group'">
            <label>{{ 'MESSAGING.GROUP_NAME' | translate }}</label>
            <input type="text" [(ngModel)]="newConvTitle" [placeholder]="'MESSAGING.GROUP_NAME_PH' | translate" />
          </div>
          <!-- User search -->
          <div class="modal-field">
            <label>{{ 'MESSAGING.SEARCH_USERS' | translate }}</label>
            <input type="text" [(ngModel)]="userSearchQuery"
              (ngModelChange)="onUserSearch($event)"
              [placeholder]="'MESSAGING.SEARCH_USERS_PH' | translate" />
            <!-- Results -->
            <div class="user-results" *ngIf="userSearchResults().length">
              <div class="user-result-item" *ngFor="let u of userSearchResults()" (click)="selectUser(u)">
                <span class="user-result-avatar">👤</span>
                <span class="user-result-name">{{ u.full_name || u.phone_number }}</span>
                <span class="user-result-role text-sm text-muted">{{ u.role }}</span>
              </div>
            </div>
          </div>
          <!-- Selected users chips -->
          <div class="selected-users" *ngIf="selectedUsers().length">
            <div class="user-chip" *ngFor="let u of selectedUsers()">
              {{ u.full_name || u.phone_number }}
              <button (click)="removeUser(u.id)">✕</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeNewConvModal()">{{ 'COMMON.CANCEL' | translate }}</button>
          <button class="btn-create" [disabled]="!selectedUsers().length" (click)="createConversation()">
            {{ 'MESSAGING.START_CONV' | translate }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Full-screen image viewer ── -->
    <div class="img-viewer" *ngIf="fullImageUrl()" (click)="fullImageUrl.set(null)">
      <img [src]="fullImageUrl()!" alt="Image plein écran" />
    </div>
  `,
  styles: [`
    /* ── Page layout ───────────────────────── */
    .messaging-page { max-width: 1100px; }
    .page-header { margin-bottom: 20px; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0; }
    .messaging-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; height: calc(100vh - 160px); }

    /* ── Tabs ─────────────────────────────── */
    .tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .tab { flex: 1; padding: 10px 4px; font-size: 12px; font-weight: 600; background: none; border: none; cursor: pointer; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all .15s; }
    .tab.active { color: #FF6B35; border-bottom-color: #FF6B35; }
    .tab:hover:not(.active) { background: rgba(255,107,53,0.05); }

    /* ── Left panel ───────────────────────── */
    .conv-panel { background: var(--surface); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .conv-search { padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: center; }
    .conv-search input { flex: 1; padding: 7px 12px; border: 1.5px solid var(--border); border-radius: 20px; font-size: 13px; outline: none; background: var(--surface-raised); color: var(--text-primary); }
    .conv-search input:focus { border-color: #FF6B35; }
    .new-conv-btn { width: 30px; height: 30px; border-radius: 50%; background: #FF6B35; color: white; border: none; cursor: pointer; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .conv-list { flex: 1; overflow-y: auto; }
    .conv-item { display: flex; align-items: center; gap: 10px; padding: 11px 14px; cursor: pointer; transition: background .15s; border-bottom: 1px solid var(--border); color: var(--text-primary); }
    .conv-item:hover, .conv-item.active { background: rgba(255,107,53,0.06); }
    .conv-icon { font-size: 22px; flex-shrink: 0; }
    .conv-body { flex: 1; min-width: 0; }
    .conv-ref { font-weight: 700; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-last { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary); margin-top: 2px; }
    .conv-badge { background: #FF6B35; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }

    /* ── Chat panel ───────────────────────── */
    .chat-panel { background: var(--surface); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .chat-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; color: var(--text-primary); }
    .chat-header strong { font-size: 15px; display: block; }
    .header-sub { display: block; margin-top: 2px; }
    .messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }

    /* ── System message ───────────────────── */
    .system-message { display: flex; justify-content: center; margin: 4px 0; }
    .system-message span { background: rgba(255,107,53,0.08); color: var(--text-secondary); font-size: 11px; padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255,107,53,0.15); text-align: center; max-width: 80%; }

    /* ── Message bubbles ──────────────────── */
    .message { display: flex; }
    .message.own { justify-content: flex-end; }
    .message-bubble { max-width: 70%; }
    .message-sender { font-size: 11px; font-weight: 700; color: #FF6B35; margin-bottom: 3px; }
    .message-content { background: var(--surface-raised); color: var(--text-primary); border-radius: 12px 12px 12px 2px; padding: 10px 14px; font-size: 14px; line-height: 1.4; border: 1px solid var(--border); }
    .message.own .message-content { background: #FF6B35; color: white; border-radius: 12px 12px 2px 12px; border-color: transparent; }
    .message-time { color: var(--text-secondary); text-align: right; margin-top: 3px; font-size: 11px; }
    .message.own .message-time { color: rgba(255,107,53,0.7); }

    /* ── Image message ────────────────────── */
    .message-bubble--image .message-content { display: none; }
    .chat-image { max-width: 240px; max-height: 240px; border-radius: 10px; display: block; cursor: pointer; border: 1px solid var(--border); object-fit: cover; }
    .message.own .chat-image { border-color: transparent; }

    /* ── Voice bubble ─────────────────────── */
    .message-bubble--voice .message-content { display: none; }
    .voice-player { display: flex; align-items: center; gap: 10px; background: var(--surface-raised); border: 1px solid var(--border); border-radius: 12px 12px 12px 2px; padding: 10px 14px; min-width: 200px; }
    .message.own .voice-player { background: #FF6B35; border-color: transparent; border-radius: 12px 12px 2px 12px; }
    .voice-play-btn { width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; background: #FF6B35; color: white; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .message.own .voice-play-btn { background: rgba(255,255,255,0.25); }
    .voice-waveform { flex: 1; display: flex; align-items: center; gap: 2px; height: 24px; }
    .voice-bar { display: inline-block; width: 3px; border-radius: 2px; background: rgba(255,107,53,0.4); }
    .voice-bar:nth-child(1){height:8px} .voice-bar:nth-child(2){height:16px} .voice-bar:nth-child(3){height:22px}
    .voice-bar:nth-child(4){height:12px} .voice-bar:nth-child(5){height:18px} .voice-bar:nth-child(6){height:10px}
    .voice-bar:nth-child(7){height:20px} .voice-bar:nth-child(8){height:14px} .voice-bar:nth-child(9){height:8px} .voice-bar:nth-child(10){height:16px}
    .message.own .voice-bar { background: rgba(255,255,255,0.5); }
    .voice-duration { font-size: 11px; color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
    .message.own .voice-duration { color: rgba(255,255,255,0.8); }

    /* ── Input bar ────────────────────────── */
    .chat-input { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; min-height: 64px; }
    .chat-input input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 24px; font-size: 14px; outline: none; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; }
    .chat-input input:focus { border-color: #FF6B35; }
    .send-btn { width: 40px; height: 40px; border-radius: 50%; background: #FF6B35; color: white; border: none; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .media-btn { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--surface-raised); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
    .media-btn:hover { border-color: #FF6B35; background: rgba(255,107,53,0.08); }
    .voice-btn { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface-raised); cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; user-select: none; -webkit-user-select: none; }
    .voice-btn:hover { border-color: #FF6B35; background: rgba(255,107,53,0.08); }
    .voice-btn--recording { background: #E53935; border-color: #E53935; animation: pulse-rec 1s infinite; }
    @keyframes pulse-rec { 0%,100% { box-shadow: 0 0 0 0 rgba(229,57,53,0.4); } 50% { box-shadow: 0 0 0 8px rgba(229,57,53,0); } }
    .recording-bar { flex: 1; display: flex; align-items: center; gap: 10px; background: rgba(229,57,53,0.08); border: 1.5px solid rgba(229,57,53,0.3); border-radius: 24px; padding: 8px 16px; }
    .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #E53935; animation: blink 1s infinite; flex-shrink: 0; }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
    .rec-label { font-size: 13px; color: #E53935; font-weight: 600; flex: 1; }
    .rec-waves { display: flex; align-items: center; gap: 3px; }
    .rec-wave { display: inline-block; width: 3px; border-radius: 2px; background: #E53935; animation: wave 0.6s ease-in-out infinite; }
    .rec-wave:nth-child(1){height:6px;animation-delay:0s} .rec-wave:nth-child(2){height:14px;animation-delay:0.1s}
    .rec-wave:nth-child(3){height:20px;animation-delay:0.2s} .rec-wave:nth-child(4){height:14px;animation-delay:0.3s}
    .rec-wave:nth-child(5){height:6px;animation-delay:0.4s}
    @keyframes wave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.3); } }

    /* ── Misc ─────────────────────────────── */
    .no-conv-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); gap: 12px; }
    .empty-state { padding: 32px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    .text-sm { font-size: 12px; } .text-muted { color: var(--text-secondary); }
    .loading-overlay { text-align: center; padding: 20px; }

    /* ── Modal ────────────────────────────── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--surface); border-radius: 16px; width: 420px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border); }
    .modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-secondary); }
    .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .modal-field input { padding: 9px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 14px; outline: none; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; }
    .modal-field input:focus { border-color: #FF6B35; }
    .user-results { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-top: 4px; max-height: 180px; overflow-y: auto; }
    .user-result-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; transition: background .12s; }
    .user-result-item:hover { background: rgba(255,107,53,0.06); }
    .user-result-avatar { font-size: 20px; }
    .user-result-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .user-result-role { background: rgba(255,107,53,0.1); color: #FF6B35; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .selected-users { display: flex; flex-wrap: wrap; gap: 8px; }
    .user-chip { display: flex; align-items: center; gap: 6px; background: rgba(255,107,53,0.1); color: #FF6B35; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .user-chip button { background: none; border: none; color: #FF6B35; cursor: pointer; font-size: 12px; padding: 0; line-height: 1; }
    .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); }
    .btn-cancel { padding: 8px 18px; border: 1.5px solid var(--border); border-radius: 8px; background: none; cursor: pointer; color: var(--text-secondary); font-size: 14px; }
    .btn-create { padding: 8px 18px; border: none; border-radius: 8px; background: #FF6B35; color: white; cursor: pointer; font-size: 14px; font-weight: 600; }
    .btn-create:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Full image viewer ────────────────── */
    .img-viewer { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 2000; cursor: zoom-out; }
    .img-viewer img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }

    @media (max-width: 768px) { .messaging-layout { grid-template-columns: 1fr; height: auto; } }
  `]
})
export class MessagingComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private ws  = inject(WebSocketService);
  private cdr = inject(ChangeDetectorRef);

  // ── State ───────────────────────────────────────────────────────
  conversations    = signal<Conversation[]>([]);
  activeConv       = signal<Conversation | null>(null);
  messages         = signal<Message[]>([]);
  loadingMessages  = signal(false);
  activeTab        = signal<Tab>('orders');
  isRecording      = signal(false);
  recordingTime    = signal(0);
  playingId        = signal<string | null>(null);
  sendingVoice     = signal(false);
  showNewConvModal = signal(false);
  userSearchResults = signal<UserBasic[]>([]);
  selectedUsers    = signal<UserBasic[]>([]);
  fullImageUrl     = signal<string | null>(null);

  searchTerm      = '';
  newMessage      = '';
  newConvTitle    = '';
  userSearchQuery = '';
  waveformBars    = Array(10).fill(0);

  private wsSub?: Subscription;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private recordingStart = 0;
  private recordingTimer?: ReturnType<typeof setInterval>;
  private userSearchSubject = new Subject<string>();
  // Singleton audio player — avoids GC and ViewChild issues
  private readonly player = new Audio();
  private userSearchSub?: Subscription;

  @ViewChild('messagesEnd') messagesEnd?: ElementRef;

  // ── Computed ─────────────────────────────────────────────────────
  filteredConvs = computed(() => {
    const tab  = this.activeTab();
    const term = this.searchTerm.toLowerCase();
    const typeMap: Record<Tab, ConversationType> = { orders: 'ORDER', direct: 'DIRECT', group: 'GROUP' };
    return this.conversations().filter(c => {
      if (c.conversation_type !== typeMap[tab]) return false;
      if (!term) return true;
      return c.display_title.toLowerCase().includes(term);
    });
  });

  ngOnInit(): void {
    this.player.onended = () => this.playingId.set(null);
    this.loadConversations();
    // Debounced user search
    this.userSearchSub = this.userSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2 ? this.api.searchUsers(q) : [])
    ).subscribe(results => this.userSearchResults.set(results));
  }

  private loadConversations(): void {
    this.api.getConversations().subscribe({
      next: (r) => this.conversations.set(r.results ?? []),
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.activeConv.set(null);
    this.messages.set([]);
    this.wsSub?.unsubscribe();
  }

  openConversation(c: Conversation): void {
    this.activeConv.set(c);
    this.loadingMessages.set(true);
    this.wsSub?.unsubscribe();

    this.api.getMessages(c.id).subscribe({
      next: (r) => {
        const msgs = (r.results ?? []).map(m => ({ ...m, file: this.mediaUrl(m.file) }));
        this.messages.set(msgs);
        this.loadingMessages.set(false);
        this.scrollBottom();
      },
    });

    this.wsSub = this.ws.connect<any>('chat', c.id).subscribe({
      next: (event) => {
        if (event.type === 'chat_message') {
          // Consumer sends flat fields, not a nested message object
          const newMsg: Message = {
            id: event.message_id,
            conversation: c.id,
            sender: event.sender_id ?? null,
            sender_name: event.sender_name ?? 'Système',
            content: event.content ?? '',
            message_type: event.message_type ?? 'TEXT',
            file: this.mediaUrl(event.file ?? null),
            file_duration_seconds: event.file_duration_seconds ?? null,
            attachment: null,
            is_read: false,
            created_at: event.timestamp,
          };
          // Avoid duplicates (HTTP response + WS echo)
          this.messages.update(ms =>
            ms.some(m => m.id === newMsg.id) ? ms : [...ms, newMsg]
          );
          this.scrollBottom();
        }
      },
    });
  }

  sendMessage(): void {
    const content = this.newMessage.trim();
    if (!content || !this.activeConv()) return;
    this.newMessage = '';
    // Send with message_type so the consumer stores it as TEXT (max_length=10)
    this.ws.send('chat', this.activeConv()!.id, { message_type: 'TEXT', content });
  }

  // ── Image upload ─────────────────────────────────────────────────
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.activeConv()) return;
    this.api.sendImageMessage(this.activeConv()!.id, file).subscribe({
      next: (msg) => { const m = { ...msg, file: this.mediaUrl(msg.file) }; this.messages.update(ms => [...ms, m]); this.scrollBottom(); },
    });
    input.value = '';
  }

  openImageFull(url: string | null | undefined): void {
    if (url) this.fullImageUrl.set(url);
  }

  // ── Voice recording ───────────────────────────────────────────────
  async startRecording(): Promise<void> {
    if (this.isRecording()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.getSupportedMimeType() });
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.start(100);
      this.recordingStart = Date.now();
      this.isRecording.set(true);
      this.recordingTime.set(0);
      this.recordingTimer = setInterval(() => {
        this.recordingTime.set(Math.floor((Date.now() - this.recordingStart) / 1000));
      }, 500);
    } catch {
      alert('Microphone non disponible. Veuillez autoriser l\'accès au microphone.');
    }
  }

  stopRecording(): void {
    if (!this.isRecording() || !this.mediaRecorder) return;
    clearInterval(this.recordingTimer);
    const duration = (Date.now() - this.recordingStart) / 1000;
    this.isRecording.set(false);
    this.mediaRecorder.onstop = () => {
      const mimeType = this.getSupportedMimeType();
      const blob = new Blob(this.audioChunks, { type: mimeType });
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
      if (duration >= 1 && this.activeConv()) {
        this.sendingVoice.set(true);
        this.api.sendVoiceMessage(this.activeConv()!.id, blob, duration).subscribe({
          next: (msg) => { const m = { ...msg, file: this.mediaUrl(msg.file) }; this.messages.update(ms => [...ms, m]); this.scrollBottom(); this.sendingVoice.set(false); },
          error: () => this.sendingVoice.set(false),
        });
      }
    };
    this.mediaRecorder.stop();
  }

  /** Strip Docker-internal host from media URLs so Angular proxy handles them. */
  mediaUrl(url: string | null): string | null {
    if (!url) return null;
    try { return url.startsWith('http') ? new URL(url).pathname : url; }
    catch { return url; }
  }

  togglePlay(messageId: string, fileUrl: string | null): void {
    if (!fileUrl) return;

    if (this.playingId() === messageId) {
      this.player.pause();
      this.playingId.set(null);
      return;
    }

    const src = this.mediaUrl(fileUrl)!;

    this.player.pause();
    this.player.src = src;
    this.player.currentTime = 0;
    this.player.load();
    this.playingId.set(messageId);
    this.player.play().catch(() => this.playingId.set(null));
  }

  formatDuration(seconds: number | null): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── New conversation modal ────────────────────────────────────────
  openNewConvModal(): void {
    this.showNewConvModal.set(true);
    this.userSearchQuery = '';
    this.newConvTitle = '';
    this.userSearchResults.set([]);
    this.selectedUsers.set([]);
  }

  closeNewConvModal(): void {
    this.showNewConvModal.set(false);
  }

  onUserSearch(q: string): void {
    this.userSearchSubject.next(q);
  }

  selectUser(user: UserBasic): void {
    if (this.selectedUsers().some(u => u.id === user.id)) return;
    if (this.activeTab() === 'direct') {
      // DM: only one other participant
      this.selectedUsers.set([user]);
    } else {
      this.selectedUsers.update(us => [...us, user]);
    }
    this.userSearchResults.set([]);
    this.userSearchQuery = '';
  }

  removeUser(id: string): void {
    this.selectedUsers.update(us => us.filter(u => u.id !== id));
  }

  createConversation(): void {
    const type = this.activeTab() === 'group' ? 'GROUP' : 'DIRECT';
    const payload = {
      conversation_type: type as 'DIRECT' | 'GROUP',
      participant_ids: this.selectedUsers().map(u => u.id),
      title: this.newConvTitle,
    };
    this.api.createConversation(payload).subscribe({
      next: (conv) => {
        // Add to list if not already there, then open it
        this.conversations.update(cs => {
          const exists = cs.some(c => c.id === conv.id);
          return exists ? cs : [conv, ...cs];
        });
        this.closeNewConvModal();
        this.openConversation(conv);
      },
    });
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
  }

  private scrollBottom(): void {
    setTimeout(() => {
      const el = this.messagesEnd?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.userSearchSub?.unsubscribe();
    clearInterval(this.recordingTimer);
    const c = this.activeConv();
    if (c) this.ws.disconnect('chat', c.id);
  }
}
