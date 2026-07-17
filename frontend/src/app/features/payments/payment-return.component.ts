import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="return-page">
      <div class="card return-card">
        <div class="return-icon">💳</div>
        <h1>{{ 'PAYMENTS.RETURN_TITLE' | translate }}</h1>
        <p>{{ 'PAYMENTS.RETURN_BODY' | translate }}</p>
        <a class="btn-action btn-green" [routerLink]="orderId ? ['/orders', orderId] : ['/orders']">
          {{ 'PAYMENTS.RETURN_BACK' | translate }}
        </a>
      </div>
    </div>
  `,
  styles: [`
    .return-page { display: flex; justify-content: center; padding: 60px 16px; }
    .return-card { max-width: 420px; text-align: center; padding: 40px 32px; }
    .return-icon { font-size: 40px; margin-bottom: 12px; }
    .return-card h1 { font-size: 20px; margin-bottom: 8px; }
    .return-card p { color: var(--text-secondary); margin-bottom: 24px; }
  `],
})
export class PaymentReturnComponent {
  private route = inject(ActivatedRoute);
  orderId = this.route.snapshot.queryParamMap.get('order');
}
