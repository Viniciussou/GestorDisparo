/**
 * Application Configuration
 * Centralizes all API and environment-specific URLs
 */

// Get the Baileys API URL from environment
export const BAILEYS_API_URL = 
  process.env.NEXT_PUBLIC_BAILEYS_SERVER_URL || 
  'https://api-1-ft6j.onrender.com'

// API Endpoints
export const API_ENDPOINTS = {
  // Sessions
  SESSIONS: `${BAILEYS_API_URL}/api/sessions`,
  SESSION: (id: string) => `${BAILEYS_API_URL}/api/sessions/${id}`,
  SESSION_CONNECT: (id: string) => `${BAILEYS_API_URL}/api/sessions/${id}/connect`,
  SESSION_DISCONNECT: (id: string) => `${BAILEYS_API_URL}/api/sessions/${id}/disconnect`,
  SESSION_QR: (id: string) => `${BAILEYS_API_URL}/api/sessions/${id}/qr`,

  // Contacts
  CONTACTS: `${BAILEYS_API_URL}/api/contacts`,
  CONTACT: (id: string) => `${BAILEYS_API_URL}/api/contacts/${id}`,

  // Dispatch
  DISPATCH: `${BAILEYS_API_URL}/api/dispatch`,
  DISPATCH_LOGS: `${BAILEYS_API_URL}/api/dispatch/logs`,
  DISPATCH_STATS: (period: string) => `${BAILEYS_API_URL}/api/dispatch/stats?period=${period}`,

  // Conversations/Messages
  CONVERSATIONS: `${BAILEYS_API_URL}/api/conversations`,
  CONVERSATION_MESSAGES: (jid: string) => `${BAILEYS_API_URL}/api/conversations/${jid}/messages`,
  MESSAGES: `${BAILEYS_API_URL}/api/messages`,

  // Templates
  TEMPLATES: `${BAILEYS_API_URL}/api/templates`,
  TEMPLATE: (id: string) => `${BAILEYS_API_URL}/api/templates/${id}`,
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
