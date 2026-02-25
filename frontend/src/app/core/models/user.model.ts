export type UserRole = 'SHIPPER' | 'DRIVER' | 'BROKER' | 'FLEET_MANAGER' | 'ADMIN';

export interface User {
  id: string;
  phone_number: string;
  full_name: string;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
  driver_profile?: DriverProfile;
  shipper_profile?: ShipperProfile;
  broker_profile?: BrokerProfile;
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

export interface BrokerProfile {
  id: string;
  company_name: string;
  commission_rate: number;
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
}
