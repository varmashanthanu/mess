export interface Message {
  id: string;
  conversation: string;
  sender: string;
  sender_name: string;
  content: string;
  message_type: 'TEXT' | 'IMAGE' | 'SYSTEM';
  attachment: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  order: string;
  order_reference: string;
  participants: string[];
  last_message: Message | null;
  unread_count: number;
  created_at: string;
}

export interface WsMessage {
  type: 'chat_message' | 'read_receipt' | 'typing' | 'user_joined';
  message?: Message;
  sender?: string;
}
