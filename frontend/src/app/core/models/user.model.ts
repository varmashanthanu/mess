export type UserRole = 'SHIPPER' | 'DRIVER' | 'CARRIER' | 'BROKER' | 'ADMIN';

export interface User {
  id: string;
  phone_number: string;
  full_name: string;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  is_superuser?: boolean;
  date_joined: string;
  driver_profile?: DriverProfile;
  shipper_profile?: ShipperProfile;
  carrier_profile?: CarrierProfile;
}

export interface DriverProfile {
  id: string;
  license_number: string;
  license_class: string;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  rating_avg: number;
  rating_count: number;
  total_trips: number;
}

export interface ShipperProfile {
  id: string;
  company_name: string;
  siret: string;
  business_address: string;
}

export interface CarrierProfile {
  legal_company_name: string;
  dot_number: string;
  mc_number: string;
  operating_authority: string;
  company_address: string;
  company_city: string;
  company_country: string;
  insurance_expiry: string | null;
  carrier_agreement_accepted: boolean;
  rating: number;
  total_loads: number;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface JwtPayload {
  user_id: string;
  phone_number: string;
  role: UserRole;
  full_name: string;
  exp: number;
  iat: number;
  workspace_type?: string;
  workspace_name?: string;
}
