export type OrderStatus =
  | 'DRAFT' | 'POSTED' | 'BIDDING' | 'ASSIGNED'
  | 'PICKUP_PENDING' | 'PICKED_UP' | 'IN_TRANSIT'
  | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export type CargoType =
  | 'GENERAL' | 'REFRIGERATED' | 'HAZMAT' | 'LIVESTOCK'
  | 'BULK' | 'CONTAINER' | 'OVERSIZE';

export interface FreightOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  shipper: string;
  shipper_name: string;
  cargo_type: CargoType;
  cargo_description: string;
  weight_kg: number;
  volume_m3: number | null;
  pickup_address: string;
  pickup_city: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_city: string;
  delivery_latitude: number;
  delivery_longitude: number;
  pickup_date: string;
  delivery_deadline: string | null;
  budget_xof: number | null;
  final_price_xof: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
  assignment?: OrderAssignment;
  active_bid_count?: number;
}

export interface OrderBid {
  id: string;
  order: string;
  driver: string;
  driver_name: string;
  driver_phone: string;
  amount_xof: number;
  estimated_pickup: string | null;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface OrderAssignment {
  id: string;
  order: string;
  driver: string;
  driver_name: string;
  driver_phone: string;
  vehicle: string | null;
  bid: string | null;
  agreed_price_xof: number;
  assigned_at: string;
  proof_photo: string | null;
  proof_signature: string | null;
  shipper_rating: number | null;
  driver_rating: number | null;
}

export interface CreateOrderPayload {
  cargo_type: CargoType;
  cargo_description: string;
  weight_kg: number;
  volume_m3?: number;
  pickup_address: string;
  pickup_city: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_city: string;
  delivery_latitude: number;
  delivery_longitude: number;
  pickup_date: string;
  delivery_deadline?: string;
  budget_xof?: number;
  notes?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
