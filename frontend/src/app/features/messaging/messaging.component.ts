import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
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
                  <span *ngIf="c.last_message.message_type === 'VOICE'">🎤 Message vocal</span>
                  <span *ngIf="c.last_message.message_type !== 'VOICE'">{{ c.last_message.content | slice:0:40 }}{{ c.last_message.content.length > 40 ? '...' : '' }}</span>
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

                  <!-- Text message -->
                  <div class="message-bubble" *ngIf="m.message_type === 'TEXT' || m.message_type === 'SYSTEM'">
                    <div class="message-sender" *ngIf="m.sender !== auth.user()?.id">{{ m.sender_name }}</div>
                    <div class="message-content">{{ m.content }}</div>
                    <div class="message-time text-sm">{{ m.created_at | date:'HH:mm' }}</div>
                  </div>

                  <!-- Voice message -->
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
                    <div class="message-time text-sm">{{ m.created_at | date:'HH:mm' }}</div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Input bar -->
            <div class="chat-input">

              <!-- Recording in progress -->
              <div class="recording-bar" *ngIf="isRecording()">
                <span class="rec-dot"></span>
                <span class="rec-label">{{ recordingTime() }}s · Relâchez pour envoyer</span>
                <div class="rec-waves">
                  <span class="rec-wave" *ngFor="let w of [1,2,3,4,5]"></span>
                </div>
              </div>

              <!-- Normal input -->
              <ng-container *ngIf="!isRecording()">
                <input type="text" [(ngModel)]="newMessage"
                  [placeholder]="'MESSAGING.SEND_PLACEHOLDER' | translate"
                  (keydown.enter)="sendMessage()" />
              </ng-container>

              <!-- Voice button (hold) -->
              <button class="voice-btn"
                [class.voice-btn--recording]="isRecording()"
                (mousedown)="startRecording()"
                (mouseup)="stopRecording()"
                (touchstart)="startRecording()"
                (touchend)="stopRecording()"
                [title]="'MESSAGING.HOLD_RECORD' | translate">
                🎤
              </button>

              <!-- Send button (only if text typed) -->
              <button class="send-btn" *ngIf="!isRecording() && newMessage.trim()"
                (click)="sendMessage()">
                ➤
              </button>

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

    <!-- Hidden audio element for playback -->
    <audio #audioPlayer (ended)="playingId.set(null)"></audio>
  `,
  styles: [`
    .messaging-page { max-width: 1100px; }
    .page-header { margin-bottom: 20px; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0; }
    .messaging-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; height: calc(100vh - 160px); }

    /* Conversations */
    .conv-panel { background: var(--surface); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .conv-search { padding: 12px; border-bottom: 1px solid var(--border); }
    .conv-search input { width: 100%; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 20px; font-size: 13px; outline: none; background: var(--surface-raised); color: var(--text-primary); box-sizing: border-box; }
    .conv-search input:focus { border-color: #FF6B35; }
    .conv-list { flex: 1; overflow-y: auto; }
    .conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; transition: background .15s; border-bottom: 1px solid var(--border); color: var(--text-primary); }
    .conv-item:hover, .conv-item.active { background: rgba(201,162,39,0.08); }
    .conv-icon { font-size: 24px; flex-shrink: 0; }
    .conv-body { flex: 1; min-width: 0; }
    .conv-ref { font-weight: 700; font-size: 14px; color: var(--text-primary); }
    .conv-last { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary); }
    .conv-badge { background: #FF6B35; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }

    /* Chat */
    .chat-panel { background: var(--surface); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .chat-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; color: var(--text-primary); }
    .messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .message { display: flex; }
    .message.own { justify-content: flex-end; }
    .message-bubble { max-width: 70%; }
    .message-sender { font-size: 11px; font-weight: 700; color: #FF6B35; margin-bottom: 3px; }
    .message-content { background: var(--surface-raised); color: var(--text-primary); border-radius: 12px 12px 12px 2px; padding: 10px 14px; font-size: 14px; line-height: 1.4; border: 1px solid var(--border); }
    .message.own .message-content { background: #FF6B35; color: white; border-radius: 12px 12px 2px 12px; border-color: transparent; }
    .message-time { color: var(--text-secondary); text-align: right; margin-top: 3px; font-size: 11px; }
    .message.own .message-time { color: rgba(255,255,255,0.6); }

    /* Voice bubble */
    .message-bubble--voice .message-content { display: none; }
    .voice-player {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface-raised); border: 1px solid var(--border);
      border-radius: 12px 12px 12px 2px; padding: 10px 14px;
      min-width: 200px;
    }
    .message.own .voice-player {
      background: #FF6B35; border-color: transparent;
      border-radius: 12px 12px 2px 12px;
    }
    .voice-play-btn {
      width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
      background: #FF6B35; color: white; font-size: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .message.own .voice-play-btn { background: rgba(255,255,255,0.25); }
    .voice-waveform { flex: 1; display: flex; align-items: center; gap: 2px; height: 24px; }
    .voice-bar {
      display: inline-block; width: 3px; border-radius: 2px;
      background: rgba(255,107,53,0.4); animation: none;
    }
    .voice-bar:nth-child(1) { height: 8px; }
    .voice-bar:nth-child(2) { height: 16px; }
    .voice-bar:nth-child(3) { height: 22px; }
    .voice-bar:nth-child(4) { height: 12px; }
    .voice-bar:nth-child(5) { height: 18px; }
    .voice-bar:nth-child(6) { height: 10px; }
    .voice-bar:nth-child(7) { height: 20px; }
    .voice-bar:nth-child(8) { height: 14px; }
    .voice-bar:nth-child(9) { height: 8px; }
    .voice-bar:nth-child(10) { height: 16px; }
    .message.own .voice-bar { background: rgba(255,255,255,0.5); }
    .voice-duration { font-size: 11px; color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
    .message.own .voice-duration { color: rgba(255,255,255,0.8); }

    /* Input bar */
    .chat-input { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; min-height: 64px; }
    .chat-input input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 24px; font-size: 14px; outline: none; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; }
    .chat-input input:focus { border-color: #FF6B35; }
    .send-btn { width: 40px; height: 40px; border-radius: 50%; background: #FF6B35; color: white; border: none; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Voice button */
    .voice-btn {
      width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border);
      background: var(--surface-raised); cursor: pointer; font-size: 18px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all .15s; user-select: none; -webkit-user-select: none;
    }
    .voice-btn:hover { border-color: #FF6B35; background: rgba(255,107,53,0.08); }
    .voice-btn--recording { background: #E53935; border-color: #E53935; animation: pulse-rec 1s infinite; }
    @keyframes pulse-rec { 0%,100% { box-shadow: 0 0 0 0 rgba(229,57,53,0.4); } 50% { box-shadow: 0 0 0 8px rgba(229,57,53,0); } }

    /* Recording bar */
    .recording-bar {
      flex: 1; display: flex; align-items: center; gap: 10px;
      background: rgba(229,57,53,0.08); border: 1.5px solid rgba(229,57,53,0.3);
      border-radius: 24px; padding: 8px 16px;
    }
    .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #E53935; animation: blink 1s infinite; flex-shrink: 0; }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
    .rec-label { font-size: 13px; color: #E53935; font-weight: 600; flex: 1; }
    .rec-waves { display: flex; align-items: center; gap: 3px; }
    .rec-wave { display: inline-block; width: 3px; border-radius: 2px; background: #E53935; animation: wave 0.6s ease-in-out infinite; }
    .rec-wave:nth-child(1) { height: 6px; animation-delay: 0s; }
    .rec-wave:nth-child(2) { height: 14px; animation-delay: 0.1s; }
    .rec-wave:nth-child(3) { height: 20px; animation-delay: 0.2s; }
    .rec-wave:nth-child(4) { height: 14px; animation-delay: 0.3s; }
    .rec-wave:nth-child(5) { height: 6px; animation-delay: 0.4s; }
    @keyframes wave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.3); } }

    /* Misc */
    .no-conv-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); gap: 12px; }
    .empty-state { padding: 32px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    .text-sm { font-size: 12px; } .text-muted { color: var(--text-secondary); }
    .loading-overlay { text-align: center; padding: 20px; }
    @media (max-width: 768px) { .messaging-layout { grid-template-columns: 1fr; height: auto; } }
  `]
})
export class MessagingComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private ws = inject(WebSocketService);

  conversations = signal<Conversation[]>([]);
  activeConv    = signal<Conversation | null>(null);
  messages      = signal<Message[]>([]);
  loadingMessages = signal(false);
  isRecording   = signal(false);
  recordingTime = signal(0);
  playingId     = signal<string | null>(null);
  sendingVoice  = signal(false);

  searchTerm = '';
  newMessage = '';
  waveformBars = Array(10).fill(0);

  private wsSub?: Subscription;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private recordingStart = 0;
  private recordingTimer?: ReturnType<typeof setInterval>;
  private currentAudio?: HTMLAudioElement;

  @ViewChild('messagesEnd') messagesEnd?: ElementRef;
  @ViewChild('audioPlayer') audioPlayerRef?: ElementRef<HTMLAudioElement>;

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
    this.ws.send<{ type: string; content: string }>('chat', this.activeConv()!.id, {
      type: 'chat_message', content
    });
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
      // Stop all tracks to release mic
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
      if (duration >= 1 && this.activeConv()) {
        this.sendingVoice.set(true);
        this.api.sendVoiceMessage(this.activeConv()!.id, blob, duration).subscribe({
          next: (msg) => {
            this.messages.update(ms => [...ms, msg]);
            this.scrollBottom();
            this.sendingVoice.set(false);
          },
          error: () => this.sendingVoice.set(false),
        });
      }
    };
    this.mediaRecorder.stop();
  }

  togglePlay(messageId: string, fileUrl: string | null): void {
    if (!fileUrl) return;
    if (this.playingId() === messageId) {
      this.currentAudio?.pause();
      this.playingId.set(null);
      return;
    }
    if (this.currentAudio) { this.currentAudio.pause(); }
    this.currentAudio = new Audio(fileUrl);
    this.playingId.set(messageId);
    this.currentAudio.play();
    this.currentAudio.onended = () => this.playingId.set(null);
  }

  formatDuration(seconds: number | null): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    clearInterval(this.recordingTimer);
    const c = this.activeConv();
    if (c) this.ws.disconnect('chat', c.id);
  }
}
