export interface Message {
  id: string;
  conversation: string;
  sender: string | null;
  sender_name: string;
  content: string;
  message_type: 'TEXT' | 'IMAGE' | 'VOICE' | 'DOCUMENT' | 'SYSTEM';
  file: string | null;
  file_duration_seconds: number | null;
  attachment: string | null;
  is_read: boolean;
  created_at: string;
}

export type ConversationType = 'ORDER' | 'DIRECT' | 'GROUP';

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  order: string | null;
  order_reference: string | null;
  title: string;
  display_title: string;
  participants: UserBasic[];
  last_message: Message | null;
  unread_count: number;
  created_at: string;
}

export interface UserBasic {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
}

export interface WsMessage {
  type: 'chat_message' | 'read_receipt' | 'typing' | 'user_joined';
  message?: Message;
  sender?: string;
}
