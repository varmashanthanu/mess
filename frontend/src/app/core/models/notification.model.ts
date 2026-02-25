export type NotificationType =
  | 'ORDER_POSTED' | 'BID_RECEIVED' | 'BID_ACCEPTED' | 'BID_REJECTED'
  | 'ORDER_ASSIGNED' | 'ORDER_PICKED_UP' | 'ORDER_IN_TRANSIT'
  | 'ORDER_DELIVERED' | 'ORDER_CANCELLED' | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED' | 'NEW_MESSAGE' | 'SYSTEM';

export interface Notification {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
