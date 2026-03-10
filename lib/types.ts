// ==========================================
// Database Types (match Supabase schema)
// ==========================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  max_sessions: number
  max_messages_per_day: number
  created_at: string
  updated_at: string
}

export interface WhatsAppSession {
  id: string
  user_id: string
  phone_number: string
  name: string
  status: 'disconnected' | 'connecting' | 'connected' | 'banned'
  qr_code: string | null
  auth_state: Record<string, unknown> | null
  daily_message_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  phone: string
  name: string | null
  email: string | null
  tags: string[]
  custom_fields: Record<string, string>
  status: 'active' | 'blocked' | 'unsubscribed'
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  user_id: string
  session_id: string
  contact_id: string | null
  remote_jid: string
  message_id: string
  direction: 'incoming' | 'outgoing'
  content: string
  media_url: string | null
  media_type: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DispatchQueueItem {
  id: string
  user_id: string
  session_id: string
  contact_id: string
  template_id: string | null
  message_content: string
  priority: number
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  scheduled_at: string
  processed_at: string | null
  attempts: number
  max_attempts: number
  error_message: string | null
  created_at: string
}

export interface DispatchLog {
  id: string
  user_id: string
  queue_id: string | null
  session_id: string
  contact_id: string
  contact_phone: string
  contact_name: string | null
  sender_phone: string
  message_content: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  error_message: string | null
  sent_at: string
}

export interface MessageTemplate {
  id: string
  user_id: string
  name: string
  content: string
  variables: string[]
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DispatchConfig {
  id: string
  user_id: string
  name: string
  messages_per_session_per_day: number
  min_delay_seconds: number
  max_delay_seconds: number
  active_hours_start: string
  active_hours_end: string
  days_of_week: number[]
  auto_rotate_sessions: boolean
  pause_on_response: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ==========================================
// API Request/Response Types
// ==========================================

export interface CreateSessionRequest {
  phone_number: string
  name: string
}

export interface SendMessageRequest {
  session_id: string
  to: string
  message: string
  media_url?: string
}

export interface BulkDispatchRequest {
  session_ids: string[]
  contact_ids: string[]
  template_id?: string
  message_content?: string
  scheduled_at?: string
  config_id?: string
}

export interface ImportContactsRequest {
  contacts: {
    phone: string
    name?: string
    email?: string
    tags?: string[]
    custom_fields?: Record<string, string>
  }[]
}

export interface WebhookPayload {
  event: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'session.connected' | 'session.disconnected' | 'session.qr_update'
  session_id: string
  data: Record<string, unknown>
  timestamp: string
}

// ==========================================
// Real-time Types
// ==========================================

export interface ChatConversation {
  contact: Contact
  session: WhatsAppSession
  messages: Message[]
  unread_count: number
  last_message: Message | null
}

// ==========================================
// Legacy Types (for backwards compatibility)
// ==========================================

export interface Client {
  id: string
  data: Record<string, string>
  status: string | null
  statuses: string[]
  starred: boolean
  bank: string | null
  dispatched: boolean
  dispatchedAt?: string
  messages: LegacyMessage[]
}

export interface LegacyMessage {
  id: string
  text: string
  sender: 'user' | 'client'
  timestamp: string
  status: 'sent' | 'delivered' | 'read'
}

export interface SenderNumber {
  phone: string
  name: string
  connected: boolean
  lastActivity?: string
  dispatchCount: number
}

export interface LegacyDispatchConfig {
  senderNumbers: SenderNumber[]
  selectedSenderIndex: number
  dispatchesPerNumber: number
  interval: number
  messages: string[]
  numbersPerDispatch: number
  isActive: boolean
}

export interface LegacyDispatchLog {
  id: string
  clientId: string
  clientName: string
  clientPhone: string
  senderNumber: string
  message: string
  timestamp: string
  status: 'sent' | 'failed'
}

export type FilterType = 'all' | 'dispatched' | 'simulated' | 'responding' | 'starred' | 'none'

export const BANKS = ['V8', 'C6', 'Mercantil', 'Prata', 'Presença', 'Facta'] as const

export const INTERVAL_OPTIONS = [
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
] as const

// ==========================================
// Utility Types
// ==========================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  error: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiSuccess<T = unknown> {
  success: true
  data: T
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError
