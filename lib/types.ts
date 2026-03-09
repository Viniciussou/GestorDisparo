export interface Client {
  id: string
  data: Record<string, string>
  status: string | null
  statuses: string[]
  starred: boolean
  bank: string | null
  dispatched: boolean
  dispatchedAt?: string
  messages: Message[]
}

export interface Message {
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

export interface DispatchConfig {
  senderNumbers: SenderNumber[]
  selectedSenderIndex: number
  dispatchesPerNumber: number
  interval: number // em minutos
  messages: string[]
  numbersPerDispatch: number
  isActive: boolean
}

export interface DispatchLog {
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
