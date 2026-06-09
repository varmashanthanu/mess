import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { Vehicle, VehicleType } from '../../core/models/fleet.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule],
  template: `
    <div class="profile-page">
      <h1>{{ 'PROFILE.TITLE' | translate }}</h1>

      <!-- Header card -->
      <div class="header-card">
        <div class="avatar">{{ initials() }}</div>
        <div class="header-info">
          <h2>{{ auth.user()?.full_name }}</h2>
          <div class="role-chip role-chip--{{ auth.role()?.toLowerCase() }}">
            {{ roleLabel() }}
          </div>
          <div class="phone-line">{{ auth.user()?.phone_number }}</div>
        </div>
        <div class="verify-badge" [class.verified]="auth.user()?.is_verified">
          {{ (auth.user()?.is_verified ? 'PROFILE.VERIFIED' : 'PROFILE.NOT_VERIFIED') | translate }}
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'info'" (click)="tab.set('info')">
          👤 Informations
        </button>
        <button class="tab" [class.active]="tab() === 'role'" (click)="tab.set('role')" *ngIf="auth.role() === 'DRIVER'">
          🪪 Permis & Conformité
        </button>
        <button class="tab" [class.active]="tab() === 'vehicle'" (click)="tab.set('vehicle')" *ngIf="auth.role() === 'DRIVER'">
          🚛 Mon Véhicule
        </button>
        <button class="tab" [class.active]="tab() === 'role'" (click)="tab.set('role')" *ngIf="auth.role() === 'CARRIER'">
          🏢 Ma Société
        </button>
        <button class="tab" [class.active]="tab() === 'fleet'" (click)="loadFleet(); tab.set('fleet')" *ngIf="auth.role() === 'CARRIER'">
          🚛 Ma Flotte
        </button>
        <button class="tab" [class.active]="tab() === 'drivers'" (click)="loadDrivers(); tab.set('drivers')" *ngIf="auth.role() === 'CARRIER'">
          👷 Mes Chauffeurs
        </button>
      </div>

      <!-- ── TAB: Personal info ── -->
      <div class="card" *ngIf="tab() === 'info'">
        <h3>Informations personnelles</h3>
        <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED' | translate }}</div>
        <div class="alert-error" *ngIf="error()">{{ error() }}</div>
        <form [formGroup]="infoForm" (ngSubmit)="saveInfo()">
          <div class="form-row">
            <div class="form-group">
              <label>{{ 'PROFILE.FIRST_NAME' | translate }}</label>
              <input type="text" formControlName="first_name" />
            </div>
            <div class="form-group">
              <label>{{ 'PROFILE.LAST_NAME' | translate }}</label>
              <input type="text" formControlName="last_name" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ 'PROFILE.EMAIL' | translate }}</label>
            <input type="email" formControlName="email" />
          </div>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ (saving() ? 'PROFILE.SAVING' : 'PROFILE.SAVE') | translate }}
          </button>
        </form>
      </div>

      <!-- ── TAB: Driver – License & Compliance ── -->
      <div class="card" *ngIf="tab() === 'role' && auth.role() === 'DRIVER'">
        <h3>🪪 Permis & Conformité</h3>
        <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED' | translate }}</div>
        <div class="alert-error" *ngIf="error()">{{ error() }}</div>
        <form [formGroup]="driverForm" (ngSubmit)="saveDriver()">
          <div class="section-title">Permis de conduire</div>
          <div class="form-row">
            <div class="form-group">
              <label>Numéro de permis *</label>
              <input type="text" formControlName="license_number" />
            </div>
            <div class="form-group">
              <label>Classe (A, B, C…)</label>
              <input type="text" formControlName="license_class" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Pays / Région de délivrance</label>
              <input type="text" formControlName="license_state" />
            </div>
            <div class="form-group">
              <label>Date d'expiration</label>
              <input type="date" formControlName="license_expiry" />
            </div>
          </div>
          <div class="form-group">
            <label>Endorsements CDL (ex: hazmat, tanker, doubles)</label>
            <input type="text" formControlName="cdl_endorsements" placeholder="hazmat, tanker..." />
          </div>
          <div class="form-group">
            <label>Numéro ID national</label>
            <input type="text" formControlName="national_id" />
          </div>

          <div class="section-title">Médical & Conformité</div>
          <div class="form-row">
            <div class="form-group">
              <label>Expiration carte médicale</label>
              <input type="date" formControlName="medical_card_expiry" />
            </div>
            <div class="form-group">
              <label>Statut test drogue</label>
              <select formControlName="drug_testing_status">
                <option value="">-- Sélectionner --</option>
                <option value="COMPLIANT">Conforme</option>
                <option value="NOT_COMPLIANT">Non conforme</option>
                <option value="PENDING">En attente</option>
              </select>
            </div>
          </div>

          <div class="section-title">Expérience & Opérationnel</div>
          <div class="form-group">
            <label>Adresse domicile</label>
            <input type="text" formControlName="home_address" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Années d'expérience</label>
              <input type="number" formControlName="driving_experience_years" min="0" />
            </div>
            <div class="form-group">
              <label>Types d'équipement</label>
              <input type="text" formControlName="equipment_types" placeholder="Frigorifique, plateau..." />
            </div>
          </div>
          <div class="form-group">
            <label>Zones / Trajets préférés</label>
            <textarea formControlName="preferred_lanes" rows="2" placeholder="Ex: Dakar – Thiès – Mbour"></textarea>
          </div>

          <div class="section-title">Paiement</div>
          <div class="form-group">
            <label>Mode de paiement</label>
            <select formControlName="payment_method">
              <option value="">-- Sélectionner --</option>
              <option value="ACH">Virement bancaire (ACH)</option>
              <option value="WAVE">Wave</option>
              <option value="ORANGE_MONEY">Orange Money</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Nom du titulaire</label>
              <input type="text" formControlName="bank_account_name" />
            </div>
            <div class="form-group">
              <label>Numéro de compte</label>
              <input type="text" formControlName="bank_account_number" />
            </div>
          </div>

          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ (saving() ? 'PROFILE.SAVING' : 'PROFILE.SAVE') | translate }}
          </button>
        </form>
      </div>

      <!-- ── TAB: Driver – Vehicle ── -->
      <div class="card" *ngIf="tab() === 'vehicle' && auth.role() === 'DRIVER'">
        <h3>🚛 Mon Véhicule</h3>
        <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED' | translate }}</div>
        <div class="alert-error" *ngIf="error()">{{ error() }}</div>
        <form [formGroup]="vehicleForm" (ngSubmit)="saveVehicle()">
          <div class="form-row">
            <div class="form-group">
              <label>Immatriculation *</label>
              <input type="text" formControlName="registration_number" placeholder="DK-1234-AB" />
            </div>
            <div class="form-group">
              <label>VIN</label>
              <input type="text" formControlName="vin" placeholder="17 caractères" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Marque</label>
              <input type="text" formControlName="make" placeholder="Mercedes" />
            </div>
            <div class="form-group">
              <label>Modèle</label>
              <input type="text" formControlName="model" placeholder="Actros" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Année</label>
              <input type="number" formControlName="year" placeholder="2020" />
            </div>
            <div class="form-group">
              <label>Type de remorque</label>
              <input type="text" formControlName="trailer_type" placeholder="Plateau, Frigorifique..." />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type de véhicule *</label>
              <select formControlName="vehicle_type">
                <option value="">-- Sélectionner --</option>
                <option *ngFor="let vt of vehicleTypes()" [value]="vt.id">{{ vt.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Capacité (kg)</label>
              <input type="number" formControlName="payload_kg" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Poids brut (kg)</label>
              <input type="number" formControlName="gross_weight_kg" />
            </div>
            <div class="form-group">
              <label>Expiration immatriculation</label>
              <input type="date" formControlName="registration_expiry" />
            </div>
          </div>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ (saving() ? 'PROFILE.SAVING' : 'PROFILE.SAVE') | translate }}
          </button>
        </form>
      </div>

      <!-- ── TAB: Carrier – Company info ── -->
      <div class="card" *ngIf="tab() === 'role' && auth.role() === 'CARRIER'">
        <h3>🏢 Informations Société</h3>
        <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED' | translate }}</div>
        <div class="alert-error" *ngIf="error()">{{ error() }}</div>
        <form [formGroup]="carrierForm" (ngSubmit)="saveCarrier()">
          <div class="section-title">Identité juridique</div>
          <div class="form-group">
            <label>Raison sociale *</label>
            <input type="text" formControlName="legal_company_name" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Numéro DOT</label>
              <input type="text" formControlName="dot_number" />
            </div>
            <div class="form-group">
              <label>Numéro MC / Autorité</label>
              <input type="text" formControlName="mc_number" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Autorité d'exploitation</label>
              <select formControlName="operating_authority">
                <option value="">-- Sélectionner --</option>
                <option value="INTERSTATE">Interurbain</option>
                <option value="INTRASTATE">Local</option>
                <option value="BOTH">Les deux</option>
              </select>
            </div>
            <div class="form-group">
              <label>Identifiant fiscal (NINEA / Tax ID)</label>
              <input type="text" formControlName="tax_id" />
            </div>
          </div>

          <div class="section-title">Adresse & Contacts</div>
          <div class="form-group">
            <label>Adresse société</label>
            <input type="text" formControlName="company_address" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ville</label>
              <input type="text" formControlName="company_city" />
            </div>
            <div class="form-group">
              <label>Pays</label>
              <input type="text" formControlName="company_country" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Contact principal</label>
              <input type="text" formControlName="primary_contact_name" />
            </div>
            <div class="form-group">
              <label>Téléphone contact</label>
              <input type="text" formControlName="primary_contact_phone" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email contact</label>
              <input type="email" formControlName="primary_contact_email" />
            </div>
            <div class="form-group">
              <label>Contact dispatch</label>
              <input type="text" formControlName="dispatch_contact_name" />
            </div>
          </div>

          <div class="section-title">Assurance</div>
          <div class="form-row">
            <div class="form-group">
              <label>Assureur</label>
              <input type="text" formControlName="insurance_provider" />
            </div>
            <div class="form-group">
              <label>N° Police</label>
              <input type="text" formControlName="insurance_policy_number" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Couverture RC Auto (XOF)</label>
              <input type="number" formControlName="auto_liability_amount" />
            </div>
            <div class="form-group">
              <label>Couverture Cargo (XOF)</label>
              <input type="number" formControlName="cargo_insurance_amount" />
            </div>
          </div>
          <div class="form-group">
            <label>Expiration assurance</label>
            <input type="date" formControlName="insurance_expiry" />
          </div>

          <div class="section-title">Zones & Paiement</div>
          <div class="form-group">
            <label>Zones de service</label>
            <textarea formControlName="service_area" rows="2" placeholder="Ex: Dakar, Saint-Louis, Ziguinchor..."></textarea>
          </div>
          <div class="form-group">
            <label>Trajets préférés</label>
            <textarea formControlName="preferred_lanes" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>Mode de paiement</label>
            <select formControlName="payment_method">
              <option value="">-- Sélectionner --</option>
              <option value="ACH">Virement bancaire (ACH)</option>
              <option value="WAVE">Wave</option>
              <option value="ORANGE_MONEY">Orange Money</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Titulaire compte</label>
              <input type="text" formControlName="bank_account_name" />
            </div>
            <div class="form-group">
              <label>N° de compte</label>
              <input type="text" formControlName="bank_account_number" />
            </div>
          </div>
          <div class="form-group">
            <label>Statut programme anti-drogue</label>
            <select formControlName="drug_testing_status">
              <option value="">-- Sélectionner --</option>
              <option value="COMPLIANT">Conforme</option>
              <option value="NOT_COMPLIANT">Non conforme</option>
              <option value="PENDING">En attente</option>
            </select>
          </div>

          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ (saving() ? 'PROFILE.SAVING' : 'PROFILE.SAVE') | translate }}
          </button>
        </form>
      </div>

      <!-- ── TAB: Carrier – Fleet ── -->
      <div class="card" *ngIf="tab() === 'fleet' && auth.role() === 'CARRIER'">
        <div class="card-header">
          <h3>🚛 Ma Flotte</h3>
          <button class="btn-outline" (click)="showAddVehicle.set(!showAddVehicle())">
            {{ showAddVehicle() ? '✕ Annuler' : '+ Ajouter un véhicule' }}
          </button>
        </div>

        <!-- Add vehicle form -->
        <div class="add-form" *ngIf="showAddVehicle()">
          <div class="alert-success" *ngIf="saved()">{{ 'PROFILE.SAVED' | translate }}</div>
          <div class="alert-error" *ngIf="error()">{{ error() }}</div>
          <form [formGroup]="vehicleForm" (ngSubmit)="saveVehicle()">
            <div class="form-row">
              <div class="form-group">
                <label>Immatriculation *</label>
                <input type="text" formControlName="registration_number" placeholder="DK-1234-AB" />
              </div>
              <div class="form-group">
                <label>VIN</label>
                <input type="text" formControlName="vin" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Marque</label>
                <input type="text" formControlName="make" placeholder="Mercedes" />
              </div>
              <div class="form-group">
                <label>Modèle</label>
                <input type="text" formControlName="model" placeholder="Actros" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Année</label>
                <input type="number" formControlName="year" />
              </div>
              <div class="form-group">
                <label>Type remorque</label>
                <input type="text" formControlName="trailer_type" placeholder="Plateau, Frigo..." />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Type véhicule *</label>
                <select formControlName="vehicle_type">
                  <option value="">-- Sélectionner --</option>
                  <option *ngFor="let vt of vehicleTypes()" [value]="vt.id">{{ vt.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Capacité (kg)</label>
                <input type="number" formControlName="payload_kg" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Exp. immatriculation</label>
                <input type="date" formControlName="registration_expiry" />
              </div>
              <div class="form-group">
                <label>Poids brut (kg)</label>
                <input type="number" formControlName="gross_weight_kg" />
              </div>
            </div>
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Enregistrement...' : 'Ajouter le véhicule' }}
            </button>
          </form>
        </div>

        <!-- Vehicle list -->
        <div class="empty-state" *ngIf="!myVehicles().length && !loadingVehicles()">
          <div class="empty-icon">🚛</div>
          <p>Aucun véhicule enregistré.</p>
        </div>
        <div class="vehicle-list">
          <div class="vehicle-card" *ngFor="let v of myVehicles()">
            <div class="vehicle-plate">{{ v.registration_number }}</div>
            <div class="vehicle-details">
              <span>{{ v.make }} {{ v.model }} {{ v.year }}</span>
              <span class="text-muted" *ngIf="v.trailer_type"> · {{ v.trailer_type }}</span>
            </div>
            <div class="vehicle-meta text-muted">{{ v.payload_kg | number }} kg</div>
          </div>
        </div>
      </div>

      <!-- ── TAB: Carrier – Drivers ── -->
      <div class="card" *ngIf="tab() === 'drivers' && auth.role() === 'CARRIER'">
        <div class="card-header">
          <h3>👷 Mes Chauffeurs</h3>
          <button class="btn-outline" (click)="showInvite.set(!showInvite())">
            {{ showInvite() ? '✕ Annuler' : '+ Associer un chauffeur' }}
          </button>
        </div>

        <!-- Invite form -->
        <div class="add-form" *ngIf="showInvite()">
          <div class="alert-success" *ngIf="inviteSaved()">Chauffeur associé avec succès !</div>
          <div class="alert-error" *ngIf="inviteError()">{{ inviteError() }}</div>
          <div class="form-group">
            <label>Numéro de téléphone du chauffeur</label>
            <input type="tel" [(ngModel)]="invitePhone" [ngModelOptions]="{standalone: true}" placeholder="+221 77 000 00 00" />
          </div>
          <button class="btn-primary" (click)="inviteDriver()" [disabled]="inviting()">
            {{ inviting() ? 'Association...' : 'Associer' }}
          </button>
        </div>

        <!-- Driver list -->
        <div class="empty-state" *ngIf="!myDrivers().length && !loadingDrivers()">
          <div class="empty-icon">👷</div>
          <p>Aucun chauffeur associé.</p>
        </div>
        <div class="driver-list">
          <div class="driver-card" *ngFor="let d of myDrivers()">
            <div class="driver-avatar">{{ driverInitials(d) }}</div>
            <div class="driver-info">
              <div class="driver-name">{{ d.full_name }}</div>
              <div class="driver-phone text-muted">{{ d.phone_number }}</div>
              <div class="driver-license text-muted" *ngIf="d.driver_profile">
                Permis : {{ $any(d.driver_profile)?.license_number }}
              </div>
            </div>
            <div class="driver-status" [class.available]="$any(d.driver_profile)?.is_available">
              {{ $any(d.driver_profile)?.is_available ? '🟢 Disponible' : '🔴 Indisponible' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 900px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: var(--text-primary, #1A1A1A); }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 18px; color: var(--text-primary, #1A1A1A); }

    /* Header card */
    .header-card {
      display: flex; align-items: center; gap: 18px;
      background: white; border-radius: 14px; padding: 20px 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 16px;
      border: 1px solid var(--border, #E5E2DA);
    }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800;
    }
    .header-info { flex: 1; }
    .header-info h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .phone-line { font-size: 13px; color: #757575; margin-top: 4px; }
    .role-chip {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: rgba(201,162,39,0.15); color: #A8861F;
    }
    .role-chip--driver { background: rgba(67,160,71,0.15); color: #2E7D32; }
    .role-chip--carrier { background: rgba(33,150,243,0.15); color: #0277BD; }
    .role-chip--shipper { background: rgba(201,162,39,0.15); color: #A8861F; }
    .verify-badge { font-size: 12px; font-weight: 600; color: #E53935; white-space: nowrap; }
    .verify-badge.verified { color: #43A047; }

    /* Tabs */
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tab {
      padding: 8px 16px; border-radius: 20px; border: 1.5px solid #E5E2DA;
      background: white; font-size: 13px; font-weight: 600; color: #555;
      cursor: pointer; transition: all .15s;
    }
    .tab:hover { border-color: #C9A227; color: #A8861F; }
    .tab.active { background: #C9A227; color: #111; border-color: #C9A227; }

    /* Cards */
    .card {
      background: white; border-radius: 14px; padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid var(--border, #E5E2DA);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .card-header h3 { margin: 0; }

    /* Section title */
    .section-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #C9A227; margin: 20px 0 12px;
      padding-bottom: 6px; border-bottom: 1px solid rgba(201,162,39,0.2);
    }
    .section-title:first-child { margin-top: 0; }

    /* Form */
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 5px; }
    input, select, textarea {
      width: 100%; padding: 10px 12px; border: 1.5px solid #E0E0E0;
      border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box;
      background: #FAFAF8; color: #1A1A1A; font-family: inherit;
    }
    textarea { resize: vertical; }
    input:focus, select:focus, textarea:focus { border-color: #C9A227; }
    .btn-primary {
      padding: 11px 24px; background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border: none; border-radius: 8px; font-size: 14px;
      font-weight: 700; cursor: pointer; box-shadow: 0 3px 10px rgba(201,162,39,0.35);
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline {
      padding: 8px 16px; border: 1.5px solid #C9A227; background: white;
      color: #A8861F; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all .15s;
    }
    .btn-outline:hover { background: rgba(201,162,39,0.08); }
    .add-form { background: #FAFAF8; border-radius: 10px; padding: 18px; margin-bottom: 20px; }
    .alert-success { background: #E8F5E9; color: #2E7D32; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; }
    .alert-error { background: #FFEBEE; color: #C62828; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; }

    /* Vehicle list */
    .vehicle-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .vehicle-card {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      border: 1.5px solid #E5E2DA; border-radius: 10px; background: #FAFAF8;
    }
    .vehicle-plate { font-size: 15px; font-weight: 800; color: #111; min-width: 120px; }
    .vehicle-details { flex: 1; font-size: 13px; }
    .vehicle-meta { font-size: 12px; }

    /* Driver list */
    .driver-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .driver-card {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      border: 1.5px solid #E5E2DA; border-radius: 10px; background: #FAFAF8;
    }
    .driver-avatar {
      width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #43A047, #2E7D32);
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800;
    }
    .driver-info { flex: 1; }
    .driver-name { font-size: 14px; font-weight: 700; }
    .driver-phone { font-size: 12px; }
    .driver-license { font-size: 12px; }
    .driver-status { font-size: 12px; font-weight: 600; white-space: nowrap; }

    /* Empty state */
    .empty-state { text-align: center; padding: 40px 20px; color: #9E9E9E; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }

    .text-muted { color: #9E9E9E; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } .tabs { gap: 6px; } }
  `]
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  tab = signal<string>('info');
  saving = signal(false);
  saved = signal(false);
  error = signal('');
  showAddVehicle = signal(false);
  showInvite = signal(false);
  invitePhone = '';
  inviting = signal(false);
  inviteSaved = signal(false);
  inviteError = signal('');
  loadingVehicles = signal(false);
  loadingDrivers = signal(false);
  myVehicles = signal<Vehicle[]>([]);
  myDrivers = signal<User[]>([]);
  vehicleTypes = signal<VehicleType[]>([]);
  existingVehicleId = signal<string | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────
  infoForm = this.fb.group({
    first_name: ['', Validators.required],
    last_name:  [''],
    email:      [''],
  });

  driverForm = this.fb.group({
    license_number:           [''],
    license_class:            [''],
    license_state:            [''],
    license_expiry:           [''],
    cdl_endorsements:         [''],
    national_id:              [''],
    medical_card_expiry:      [''],
    drug_testing_status:      [''],
    home_address:             [''],
    driving_experience_years: [null as number | null],
    equipment_types:          [''],
    preferred_lanes:          [''],
    payment_method:           [''],
    bank_account_name:        [''],
    bank_account_number:      [''],
  });

  vehicleForm = this.fb.group({
    registration_number: ['', Validators.required],
    vin:                 [''],
    make:                [''],
    model:               [''],
    year:                [null as number | null],
    trailer_type:        [''],
    vehicle_type:        ['', Validators.required],
    payload_kg:          [null as number | null],
    gross_weight_kg:     [null as number | null],
    registration_expiry: [''],
  });

  carrierForm = this.fb.group({
    legal_company_name:    [''],
    dot_number:            [''],
    mc_number:             [''],
    operating_authority:   [''],
    tax_id:                [''],
    company_address:       [''],
    company_city:          [''],
    company_country:       [''],
    primary_contact_name:  [''],
    primary_contact_phone: [''],
    primary_contact_email: [''],
    dispatch_contact_name: [''],
    insurance_provider:    [''],
    insurance_policy_number: [''],
    auto_liability_amount: [null as number | null],
    cargo_insurance_amount:[null as number | null],
    insurance_expiry:      [''],
    service_area:          [''],
    preferred_lanes:       [''],
    payment_method:        [''],
    bank_account_name:     [''],
    bank_account_number:   [''],
    drug_testing_status:   [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    const u = this.auth.user();
    if (!u) return;

    const [first, ...rest] = (u.full_name ?? '').split(' ');
    this.infoForm.patchValue({ first_name: first ?? '', last_name: rest.join(' '), email: (u as any).email ?? '' });

    const dp = (u as any).driver_profile;
    if (dp) this.driverForm.patchValue({ ...dp });

    const cp = (u as any).carrier_profile;
    if (cp) this.carrierForm.patchValue({ ...cp });

    // Load vehicle types
    this.api.getVehicleTypes().subscribe(types => this.vehicleTypes.set(types));

    // Pre-load driver's vehicle
    if (this.auth.role() === 'DRIVER') {
      this.loadFleet();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────
  initials(): string {
    return (this.auth.user()?.full_name ?? '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  roleLabel(): string {
    const map: Record<string, string> = { SHIPPER: '📦 Expéditeur', DRIVER: '🚚 Chauffeur', CARRIER: '🏢 Transporteur', ADMIN: '⚙️ Admin' };
    return map[this.auth.role() ?? ''] ?? '';
  }

  driverInitials(u: User): string {
    return (u.full_name ?? '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // ── Loaders ───────────────────────────────────────────────────────
  loadFleet(): void {
    this.loadingVehicles.set(true);
    this.api.getVehicles().subscribe({
      next: (res) => {
        const vehicles = (res as any).results ?? res;
        this.myVehicles.set(vehicles);
        if (this.auth.role() === 'DRIVER' && vehicles.length > 0) {
          this.existingVehicleId.set(vehicles[0].id);
          this.vehicleForm.patchValue({ ...vehicles[0], vehicle_type: vehicles[0].vehicle_type });
        }
        this.loadingVehicles.set(false);
      },
      error: () => this.loadingVehicles.set(false),
    });
  }

  loadDrivers(): void {
    this.loadingDrivers.set(true);
    this.api.getMyDrivers().subscribe({
      next: (drivers) => { this.myDrivers.set(drivers); this.loadingDrivers.set(false); },
      error: () => this.loadingDrivers.set(false),
    });
  }

  // ── Save actions ──────────────────────────────────────────────────
  private resetFeedback(): void { this.saved.set(false); this.error.set(''); }

  saveInfo(): void {
    if (this.infoForm.invalid) return;
    this.saving.set(true); this.resetFeedback();
    this.api.updateMe(this.infoForm.value as any).subscribe({
      next: (u) => { this.auth.updateProfile(u); this.saved.set(true); this.saving.set(false); },
      error: (err) => { this.error.set(err?.error?.error?.message || 'Erreur de mise à jour.'); this.saving.set(false); },
    });
  }

  saveDriver(): void {
    this.saving.set(true); this.resetFeedback();
    this.api.updateMe({ driver_profile: this.driverForm.value } as any).subscribe({
      next: (u) => { this.auth.updateProfile(u); this.saved.set(true); this.saving.set(false); },
      error: (err) => { this.error.set(err?.error?.error?.message || 'Erreur de mise à jour.'); this.saving.set(false); },
    });
  }

  saveVehicle(): void {
    if (this.vehicleForm.invalid) return;
    this.saving.set(true); this.resetFeedback();
    const payload = this.vehicleForm.value as any;
    const existingId = this.existingVehicleId();
    const obs = existingId
      ? this.api.updateVehicle(existingId, payload)
      : this.api.createVehicle(payload);
    obs.subscribe({
      next: (v) => {
        this.existingVehicleId.set(v.id);
        this.saved.set(true); this.saving.set(false);
        this.showAddVehicle.set(false);
        this.loadFleet();
      },
      error: (err) => { this.error.set(err?.error?.registration_number?.[0] || err?.error?.error?.message || 'Erreur.'); this.saving.set(false); },
    });
  }

  saveCarrier(): void {
    this.saving.set(true); this.resetFeedback();
    this.api.updateMe({ carrier_profile: this.carrierForm.value } as any).subscribe({
      next: (u) => { this.auth.updateProfile(u); this.saved.set(true); this.saving.set(false); },
      error: (err) => { this.error.set(err?.error?.error?.message || 'Erreur de mise à jour.'); this.saving.set(false); },
    });
  }

  inviteDriver(): void {
    if (!this.invitePhone) return;
    this.inviting.set(true); this.inviteSaved.set(false); this.inviteError.set('');
    this.api.inviteDriver(this.invitePhone).subscribe({
      next: () => { this.inviteSaved.set(true); this.inviting.set(false); this.loadDrivers(); },
      error: (err) => { this.inviteError.set(err?.error?.error || 'Chauffeur introuvable.'); this.inviting.set(false); },
    });
  }
}
