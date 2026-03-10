'use client'

import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, PaginatedResponse, SendMessageRequest } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UseConversationsOptions {
  sessionId?: string
  page?: number
  perPage?: number
}

export function useConversations(options: UseConversationsOptions = {}) {
  const { sessionId, page = 1, perPage = 50 } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (sessionId) params.set('session_id', sessionId)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/conversations?${params.toString()}`,
    fetcher,
    { refreshInterval: 3000 }
  )

  return {
    conversations: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

interface UseConversationMessagesOptions {
  remoteJid: string | null
  sessionId?: string
  page?: number
  perPage?: number
}

export function useConversationMessages(options: UseConversationMessagesOptions) {
  const { remoteJid, sessionId, page = 1, perPage = 50 } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (sessionId) params.set('session_id', sessionId)

  const encodedJid = remoteJid ? encodeURIComponent(remoteJid) : null

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Message>>(
    encodedJid ? `/api/conversations/${encodedJid}/messages?${params.toString()}` : null,
    fetcher,
    { refreshInterval: 2000 }
  )

  return {
    messages: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useRealtimeMessages(remoteJid: string | null) {
  const [newMessages, setNewMessages] = useState<Message[]>([])

  useEffect(() => {
    if (!remoteJid) return

    const supabase = createClient()

    const channel = supabase
      .channel(`messages:${remoteJid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `remote_jid=eq.${remoteJid}`
        },
        (payload) => {
          setNewMessages(prev => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [remoteJid])

  const clearNewMessages = () => setNewMessages([])

  return { newMessages, clearNewMessages }
}

export function useMessageActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = async (data: SendMessageRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to send message')
      return result.data as Message
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  return {
    sendMessage,
    isLoading,
    error
  }
}
