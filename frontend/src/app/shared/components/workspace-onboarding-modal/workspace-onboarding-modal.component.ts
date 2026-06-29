import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { WorkspaceType } from '../../../core/models/workspace.model';
import { forkJoin, switchMap } from 'rxjs';

@Component({
  selector: 'app-workspace-onboarding-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal-box" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modal-header">
          <div class="modal-icon">{{ targetWorkspace === 'CARRIER' ? '🏢' : '🚛' }}</div>
          <div>
            <h2 class="modal-title">
              {{ (targetWorkspace === 'CARRIER' ? 'ONBOARDING.CARRIER_TITLE' : 'ONBOARDING.DRIVER_TITLE') | translate }}
            </h2>
            <p class="modal-sub">
              {{ (targetWorkspace === 'CARRIER' ? 'ONBOARDING.CARRIER_SUB' : 'ONBOARDING.DRIVER_SUB') | translate }}
            </p>
          </div>
          <button class="modal-close" (click)="cancel()">✕</button>
        </div>

        <!-- Step indicator -->
        <div class="steps">
          <div class="step" [class.active]="step() === 1" [class.done]="step() > 1">
            <span class="step-num">1</span>
            <span class="step-lbl">{{ (targetWorkspace === 'CARRIER' ? 'ONBOARDING.STEP1_CARRIER' : 'ONBOARDING.STEP1_DRIVER') | translate }}</span>
          </div>
          <div class="step-line"></div>
          <div class="step" [class.active]="step() === 2" [class.done]="step() > 2">
            <span class="step-num">2</span>
            <span class="step-lbl">{{ (targetWorkspace === 'CARRIER' ? 'ONBOARDING.STEP2_CARRIER' : 'ONBOARDING.STEP2_DRIVER') | translate }}</span>
          </div>
        </div>

        <!-- Error banner -->
        <div class="error-banner" *ngIf="error()">{{ error() }}</div>

        <!-- ── STEP 1: Identity / Company ── -->
        <div *ngIf="step() === 1">

          <!-- DRIVER: identity -->
          <form *ngIf="targetWorkspace === 'DRIVER'" [formGroup]="driverIdentityForm" class="form-body">
            <div class="form-group">
              <label>{{ 'ONBOARDING.FIRST_NAME' | translate }} <span class="req">*</span></label>
              <input type="text" formControlName="first_name" placeholder="Votre prénom" />
            </div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.LAST_NAME' | translate }} <span class="req">*</span></label>
              <input type="text" formControlName="last_name" placeholder="Votre nom de famille" />
            </div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.NATIONAL_ID' | translate }} <span class="req">*</span></label>
              <input type="text" formControlName="national_id" placeholder="Ex: 1 234 567 890 1" />
            </div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.LICENSE_NUMBER' | translate }} <span class="req">*</span></label>
              <input type="text" formControlName="license_number" placeholder="Ex: SN-DK-00123" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>{{ 'ONBOARDING.LICENSE_CLASS' | translate }} <span class="req">*</span></label>
                <select formControlName="license_class">
                  <option value="">{{ 'ONBOARDING.LICENSE_CLASS_SELECT' | translate }}</option>
                  <option value="B">B — Véhicule léger</option>
                  <option value="C">C — Poids lourd</option>
                  <option value="D">D — Transport en commun</option>
                  <option value="E">E — Remorque</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ 'ONBOARDING.LICENSE_EXPIRY' | translate }} <span class="req">*</span></label>
                <input type="date" formControlName="license_expiry" />
              </div>
            </div>
          </form>

          <!-- CARRIER: company -->
          <form *ngIf="targetWorkspace === 'CARRIER'" [formGroup]="carrierCompanyForm" class="form-body">
            <div class="section-title">{{ 'ONBOARDING.SECTION_LEGAL' | translate }}</div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.COMPANY_NAME' | translate }} <span class="req">*</span></label>
              <input type="text" formControlName="legal_company_name" placeholder="Ex: DIAW Transport SARL" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>{{ 'ONBOARDING.NINEA' | translate }}</label>
                <input type="text" formControlName="tax_id" placeholder="Ex: 123456789 2Z3" />
              </div>
              <div class="form-group">
                <label>{{ 'ONBOARDING.CITY' | translate }} <span class="req">*</span></label>
                <input type="text" formControlName="company_city" placeholder="Ex: Dakar" />
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.COMPANY_ADDRESS' | translate }}</label>
              <input type="text" formControlName="company_address" placeholder="Ex: Rue 10 × 23, Médina" />
            </div>
            <div class="section-title" style="margin-top:16px">{{ 'ONBOARDING.SECTION_INSURANCE' | translate }}</div>
            <div class="form-row">
              <div class="form-group">
                <label>{{ 'ONBOARDING.INSURER' | translate }} <span class="req">*</span></label>
                <input type="text" formControlName="insurance_provider" placeholder="Ex: AMSA, Allianz..." />
              </div>
              <div class="form-group">
                <label>{{ 'ONBOARDING.POLICY_NUMBER' | translate }} <span class="req">*</span></label>
                <input type="text" formControlName="insurance_policy_number" placeholder="Ex: POL-2026-001" />
              </div>
            </div>
            <div class="form-group">
              <label>{{ 'ONBOARDING.INSURANCE_EXPIRY' | translate }} <span class="req">*</span></label>
              <input type="date" formControlName="insurance_expiry" />
            </div>
          </form>
        </div>

        <!-- ── STEP 2: Vehicles ── -->
        <div *ngIf="step() === 2" class="form-body">
          <div class="vehicles-header">
            <span>{{ 'ONBOARDING.VEHICLES_HEADER' | translate }} ({{ vehicleForms.length }} / min. {{ minVehicles() }})</span>
            <button type="button" class="btn-add-vehicle" (click)="addVehicle()">{{ 'ONBOARDING.ADD_VEHICLE' | translate }}</button>
          </div>

          <div *ngFor="let vf of vehicleForms; let i = index" class="vehicle-card">
            <div class="vehicle-card-header">
              <span>{{ 'ONBOARDING.VEHICLE_N' | translate }} {{ i + 1 }}</span>
              <button type="button" class="btn-remove" *ngIf="vehicleForms.length > minVehicles()" (click)="removeVehicle(i)">✕</button>
            </div>
            <div [formGroup]="vf">
              <div class="form-row">
                <div class="form-group">
                  <label>{{ 'ONBOARDING.PLATE' | translate }} <span class="req">*</span></label>
                  <input type="text" formControlName="registration_number" placeholder="Ex: DK-1234-AA" />
                </div>
                <div class="form-group">
                  <label>{{ 'ONBOARDING.MAKE' | translate }} <span class="req">*</span></label>
                  <input type="text" formControlName="make" placeholder="Ex: Mercedes" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>{{ 'ONBOARDING.MODEL' | translate }}</label>
                  <input type="text" formControlName="model" placeholder="Ex: Actros" />
                </div>
                <div class="form-group">
                  <label>{{ 'ONBOARDING.YEAR' | translate }}</label>
                  <input type="number" formControlName="year" placeholder="Ex: 2020" min="1990" max="2030" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>{{ 'ONBOARDING.INSURER' | translate }} <span class="req">*</span></label>
                  <input type="text" formControlName="insurance_provider" placeholder="Ex: AMSA" />
                </div>
                <div class="form-group">
                  <label>{{ 'ONBOARDING.POLICY_NUMBER' | translate }} <span class="req">*</span></label>
                  <input type="text" formControlName="insurance_policy_number" placeholder="Ex: POL-001" />
                </div>
              </div>
              <div class="form-group">
                <label>{{ 'ONBOARDING.COMPANY_INSURANCE_EXPIRY' | translate }} <span class="req">*</span></label>
                <input type="date" formControlName="insurance_expiry" />
              </div>
            </div>
          </div>

          <div class="vehicles-hint" *ngIf="vehicleForms.length < minVehicles()">
            ⚠ {{ (minVehicles() > 1 ? 'ONBOARDING.VEHICLES_HINT_PLURAL' : 'ONBOARDING.VEHICLES_HINT_SINGULAR') | translate:{ min: minVehicles() } }}
          </div>
        </div>

        <!-- Footer actions -->
        <div class="modal-footer">
          <button class="btn-cancel" (click)="cancel()" [disabled]="saving()">{{ 'ONBOARDING.CANCEL' | translate }}</button>
          <button *ngIf="step() === 1" class="btn-primary" (click)="nextStep()">
            {{ 'ONBOARDING.NEXT' | translate }}
          </button>
          <button *ngIf="step() === 2" class="btn-secondary" (click)="prevStep()">{{ 'ONBOARDING.BACK' | translate }}</button>
          <button *ngIf="step() === 2" class="btn-primary" (click)="submit()" [disabled]="saving() || vehicleForms.length < minVehicles()">
            {{ saving() ? ('ONBOARDING.SAVING' | translate) : ('ONBOARDING.ACTIVATE' | translate) }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }

    .modal-box {
      background: #1C1C1C; border: 1px solid rgba(201,162,39,0.2); border-radius: 16px;
      width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }

    .modal-header {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .modal-icon { font-size: 32px; flex-shrink: 0; line-height: 1; margin-top: 2px; }
    .modal-title { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #fff; }
    .modal-sub { margin: 0; font-size: 13px; color: rgba(255,255,255,0.5); }
    .modal-close {
      margin-left: auto; flex-shrink: 0; background: none; border: none;
      color: rgba(255,255,255,0.4); font-size: 18px; cursor: pointer; padding: 2px 6px;
    }
    .modal-close:hover { color: #fff; }

    .steps {
      display: flex; align-items: center; gap: 0; padding: 14px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .step { display: flex; align-items: center; gap: 8px; }
    .step-num {
      width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .step.active .step-num { background: #C9A227; color: #000; }
    .step.done .step-num { background: #43A047; color: #fff; }
    .step-lbl { font-size: 12px; color: rgba(255,255,255,0.4); }
    .step.active .step-lbl, .step.done .step-lbl { color: #fff; }
    .step-line { flex: 1; height: 1px; background: rgba(255,255,255,0.1); margin: 0 10px; }

    .error-banner {
      margin: 12px 20px 0; padding: 10px 14px; background: rgba(239,83,80,0.12);
      border: 1px solid rgba(239,83,80,0.3); border-radius: 8px;
      color: #EF5350; font-size: 13px;
    }

    .form-body { padding: 16px 20px; }
    .section-title {
      font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 12px;
    }
    .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
    .form-group label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); }
    .req { color: #C9A227; }
    .form-group input, .form-group select {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 13px;
      outline: none; transition: border-color .15s;
    }
    .form-group input:focus, .form-group select:focus { border-color: #C9A227; }
    .form-group select option { background: #1C1C1C; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .vehicles-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px;
    }
    .vehicles-header span { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
    .btn-add-vehicle {
      background: rgba(201,162,39,0.12); border: 1px solid rgba(201,162,39,0.3);
      border-radius: 8px; padding: 6px 14px; color: #C9A227; font-size: 12px;
      font-weight: 600; cursor: pointer;
    }
    .btn-add-vehicle:hover { background: rgba(201,162,39,0.2); }

    .vehicle-card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 14px; margin-bottom: 12px;
    }
    .vehicle-card-header {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;
    }
    .btn-remove {
      background: rgba(239,83,80,0.1); border: 1px solid rgba(239,83,80,0.2);
      border-radius: 6px; padding: 2px 8px; color: #EF5350; font-size: 12px; cursor: pointer;
    }
    .vehicles-hint {
      font-size: 12px; color: #FF8A65; background: rgba(255,138,101,0.08);
      border: 1px solid rgba(255,138,101,0.2); border-radius: 8px;
      padding: 8px 12px; margin-top: 8px;
    }

    .modal-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07);
    }
    .btn-cancel {
      background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      padding: 9px 18px; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer;
    }
    .btn-cancel:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
    .btn-secondary {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; padding: 9px 18px; color: #fff; font-size: 13px;
      font-weight: 600; cursor: pointer;
    }
    .btn-primary {
      background: #C9A227; border: none; border-radius: 8px;
      padding: 9px 20px; color: #000; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: #E8C84A; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class WorkspaceOnboardingModalComponent implements OnInit {
  @Input() targetWorkspace!: WorkspaceType;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private translate = inject(TranslateService);

  step   = signal(1);
  saving = signal(false);
  error  = signal('');

  // ── Step 1 forms ────────────────────────────────────────────────
  driverIdentityForm = this.fb.group({
    first_name:     ['', Validators.required],
    last_name:      ['', Validators.required],
    national_id:    ['', Validators.required],
    license_number: ['', Validators.required],
    license_class:  ['', Validators.required],
    license_expiry: ['', Validators.required],
  });

  carrierCompanyForm = this.fb.group({
    legal_company_name:    ['', Validators.required],
    tax_id:                [''],
    company_city:          ['', Validators.required],
    company_address:       [''],
    insurance_provider:    ['', Validators.required],
    insurance_policy_number: ['', Validators.required],
    insurance_expiry:      ['', Validators.required],
  });

  // ── Step 2: vehicle forms list ───────────────────────────────────
  vehicleForms: FormGroup[] = [];

  minVehicles(): number { return this.targetWorkspace === 'CARRIER' ? 2 : 1; }

  ngOnInit(): void {
    for (let i = 0; i < this.minVehicles(); i++) this.addVehicle();
  }

  addVehicle(): void {
    this.vehicleForms.push(this.fb.group({
      registration_number:    ['', Validators.required],
      make:                   ['', Validators.required],
      model:                  [''],
      year:                   [null],
      insurance_provider:     ['', Validators.required],
      insurance_policy_number:['', Validators.required],
      insurance_expiry:       ['', Validators.required],
    }));
  }

  removeVehicle(i: number): void {
    this.vehicleForms.splice(i, 1);
  }

  nextStep(): void {
    this.error.set('');
    const form = this.targetWorkspace === 'DRIVER' ? this.driverIdentityForm : this.carrierCompanyForm;
    if (form.invalid) {
      form.markAllAsTouched();
      this.error.set(this.translate.instant('ONBOARDING.VALIDATE_REQUIRED'));
      return;
    }
    this.step.set(2);
  }

  prevStep(): void { this.step.set(1); }

  submit(): void {
    this.error.set('');

    const invalidVehicle = this.vehicleForms.find(f => f.invalid);
    if (invalidVehicle) {
      invalidVehicle.markAllAsTouched();
      this.error.set(this.translate.instant('ONBOARDING.VALIDATE_VEHICLES'));
      return;
    }
    if (this.vehicleForms.length < this.minVehicles()) {
      this.error.set(this.translate.instant(
        this.minVehicles() > 1 ? 'ONBOARDING.VEHICLES_HINT_PLURAL' : 'ONBOARDING.VEHICLES_HINT_SINGULAR',
        { min: this.minVehicles() }
      ));
      return;
    }

    this.saving.set(true);
    const onError = (err: unknown) => {
      this.saving.set(false);
      const detail = (err as any)?.error;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        this.error.set(firstKey ? `${firstKey} : ${detail[firstKey]}` : 'Une erreur est survenue.');
      } else {
        this.error.set('Une erreur est survenue. Vérifiez vos informations et réessayez.');
      }
    };

    // 1. Create profile first, THEN create vehicles sequentially
    const vehicleData = this.vehicleForms.map(f => ({
      registration_number:     f.value.registration_number,
      make:                    f.value.make,
      model:                   f.value.model,
      year:                    f.value.year || null,
      insurance_provider:      f.value.insurance_provider,
      insurance_expiry:        f.value.insurance_expiry || null,
    }));

    if (this.targetWorkspace === 'DRIVER') {
      const { first_name, last_name, national_id, ...driverData } = this.driverIdentityForm.value as any;
      this.api.updateDriverProfile({ ...driverData, national_id })
        .pipe(switchMap(() => forkJoin(vehicleData.map(v => this.api.createVehicle(v)))))
        .subscribe({
          next: () => { this.saving.set(false); this.confirmed.emit(); },
          error: onError,
        });
    } else {
      this.api.updateCarrierProfile(this.carrierCompanyForm.value as any)
        .pipe(switchMap(() => forkJoin(vehicleData.map(v => this.api.createVehicle(v)))))
        .subscribe({
          next: () => { this.saving.set(false); this.confirmed.emit(); },
          error: onError,
        });
    }
  }

  cancel(): void { this.cancelled.emit(); }

  onOverlayClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel();
    }
  }
}
