import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse, FreightOrder, OrderBid, CreateOrderPayload, OrderAssignment } from '../models/order.model';
import { Vehicle, VehicleType } from '../models/fleet.model';
import { Conversation, Message } from '../models/messaging.model';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { DriverLocation } from '../models/tracking.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Orders ────────────────────────────────────────────────────
  getOrders(params?: Record<string, string>): Observable<PaginatedResponse<FreightOrder>> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => (p = p.set(k, v)));
    return this.http.get<PaginatedResponse<FreightOrder>>(`${this.base}/orders/`, { params: p });
  }

  getOrder(id: string): Observable<FreightOrder> {
    return this.http.get<FreightOrder>(`${this.base}/orders/${id}/`);
  }

  createOrder(payload: CreateOrderPayload): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/`, payload);
  }

  updateOrder(id: string, payload: Partial<CreateOrderPayload>): Observable<FreightOrder> {
    return this.http.patch<FreightOrder>(`${this.base}/orders/${id}/`, payload);
  }

  postOrder(id: string): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/${id}/post/`, {});
  }

  transitionOrder(id: string, transition: string, data?: Record<string, unknown>): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/${id}/transition/`, { transition, ...data });
  }

  cancelOrder(id: string, reason?: string): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/${id}/transition/`, {
      transition: 'cancel', reason
    });
  }

  // ── Bids ──────────────────────────────────────────────────────
  getBids(orderId: string): Observable<PaginatedResponse<OrderBid>> {
    return this.http.get<PaginatedResponse<OrderBid>>(`${this.base}/orders/${orderId}/bids/`);
  }

  submitBid(orderId: string, payload: { amount_xof: number; message?: string; estimated_pickup?: string }): Observable<OrderBid> {
    return this.http.post<OrderBid>(`${this.base}/orders/${orderId}/bids/`, payload);
  }

  acceptBid(orderId: string, bidId: string): Observable<OrderAssignment> {
    return this.http.post<OrderAssignment>(`${this.base}/orders/${orderId}/bids/${bidId}/accept/`, {});
  }

  confirmDelivery(orderId: string): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/${orderId}/confirm-delivery/`, {});
  }

  rateDelivery(orderId: string, rating: number, comment?: string): Observable<FreightOrder> {
    return this.http.post<FreightOrder>(`${this.base}/orders/${orderId}/rate/`, { rating, comment });
  }

  // ── Tracking ──────────────────────────────────────────────────
  getAvailableDrivers(params?: { lat?: number; lng?: number; radius_km?: number }): Observable<DriverLocation[]> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && (p = p.set(k, String(v))));
    return this.http.get<DriverLocation[]>(`${this.base}/tracking/available-drivers/`, { params: p });
  }

  // ── Fleet ─────────────────────────────────────────────────────
  getVehicleTypes(): Observable<VehicleType[]> {
    return this.http.get<VehicleType[]>(`${this.base}/fleet/vehicle-types/`);
  }

  getVehicles(params?: Record<string, string>): Observable<PaginatedResponse<Vehicle>> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => (p = p.set(k, v)));
    return this.http.get<PaginatedResponse<Vehicle>>(`${this.base}/fleet/vehicles/`, { params: p });
  }

  createVehicle(payload: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.base}/fleet/vehicles/`, payload);
  }

  updateVehicle(id: string, payload: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.base}/fleet/vehicles/${id}/`, payload);
  }

  // ── Messaging ─────────────────────────────────────────────────
  getConversations(): Observable<PaginatedResponse<Conversation>> {
    return this.http.get<PaginatedResponse<Conversation>>(`${this.base}/messaging/conversations/`);
  }

  getMessages(conversationId: string): Observable<PaginatedResponse<Message>> {
    return this.http.get<PaginatedResponse<Message>>(
      `${this.base}/messaging/conversations/${conversationId}/messages/`
    );
  }

  sendMessage(conversationId: string, content: string): Observable<Message> {
    return this.http.post<Message>(
      `${this.base}/messaging/conversations/${conversationId}/messages/`, { content }
    );
  }

  // ── Notifications ─────────────────────────────────────────────
  getNotifications(unreadOnly = false): Observable<PaginatedResponse<Notification>> {
    const params = unreadOnly ? new HttpParams().set('is_read', 'false') : undefined;
    return this.http.get<PaginatedResponse<Notification>>(`${this.base}/notifications/`, { params });
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/mark-all-read/`, {});
  }

  // ── Accounts ──────────────────────────────────────────────────
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.base}/accounts/me/`);
  }

  updateMe(payload: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.base}/accounts/me/`, payload);
  }

  getUsers(params?: Record<string, string>): Observable<PaginatedResponse<User>> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => (p = p.set(k, v)));
    return this.http.get<PaginatedResponse<User>>(`${this.base}/accounts/users/`, { params: p });
  }

  updateDriverAvailability(available: boolean): Observable<{ is_available: boolean }> {
    return this.http.post<{ is_available: boolean }>(`${this.base}/accounts/driver/availability/`, {
      is_available: available
    });
  }
}
