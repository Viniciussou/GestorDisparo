'use client'

import useSWR from 'swr'
import { useState } from 'react'
import type { WhatsAppSession, PaginatedResponse, CreateSessionRequest } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<WhatsAppSession>>(
    '/api/sessions',
    fetcher,
    { refreshInterval: 5000 }
  )

  return {
    sessions: data?.data || [],
    total: data?.total || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useSession(sessionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    sessionId ? `/api/sessions/${sessionId}` : null,
    fetcher,
    { refreshInterval: 3000 }
  )

  return {
    session: data?.data as WhatsAppSession | undefined,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useSessionActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async (data: CreateSessionRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to create session')
      return result.data as WhatsAppSession
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const connectSession = async (sessionId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/connect`, {
        method: 'POST'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to connect session')
      return result.data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectSession = async (sessionId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/connect`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to disconnect session')
      return result.data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to delete session')
      return result.data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createSession,
    connectSession,
    disconnectSession,
    deleteSession,
    isLoading,
    error
  }
}
