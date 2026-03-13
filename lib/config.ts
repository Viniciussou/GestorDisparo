/**
 * Application Configuration
 * Centralizes all API and environment-specific URLs
 */

// Get the Baileys API URL from environment
export const BAILEYS_API_URL = 
  process.env.NEXT_PUBLIC_BAILEYS_SERVER_URL || 
  'https://api-1-ft6j.onrender.com'

// API Endpoints - For Baileys Backend
export const API_ENDPOINTS = {
  // Frontend API Routes (for client-side calls)
  SESSIONS: '/api/sessions',
  SESSION: (id: string) => `/api/sessions/${id}`,
  SESSION_CONNECT: (id: string) => `/api/sessions/${id}/connect`,
  
  CONTACTS: '/api/contacts',
  CONTACT: (id: string) => `/api/contacts/${id}`,

  DISPATCH: '/api/dispatch',
  DISPATCH_LOGS: '/api/dispatch/logs',
  DISPATCH_STATS: (period: string) => `/api/dispatch/stats?period=${period}`,

  CONVERSATIONS: '/api/conversations',
  CONVERSATION_MESSAGES: (jid: string) => `/api/conversations/${jid}/messages`,
  MESSAGES: '/api/messages',

  TEMPLATES: '/api/templates',
  TEMPLATE: (id: string) => `/api/templates/${id}`,

  // Baileys Backend Endpoints (for server-side calls)
  BAILEYS_CONNECT: `${BAILEYS_API_URL}/api/connect`,
  BAILEYS_DISCONNECT: `${BAILEYS_API_URL}/api/disconnect`,
  BAILEYS_SEND: `${BAILEYS_API_URL}/api/send`,
  BAILEYS_SEND_BULK: `${BAILEYS_API_URL}/api/send-bulk`,
  BAILEYS_STATUS: (phone: string) => `${BAILEYS_API_URL}/api/status?phone=${phone}`,
}

// API Headers
export const getApiHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ''}`,
})

// Default fetch options with error handling
export const defaultFetchOptions = {
  headers: getApiHeaders(),
}

console.log('[Config] Using Baileys API URL:', BAILEYS_API_URL)
