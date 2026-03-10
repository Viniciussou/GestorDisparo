'use client'

import useSWR from 'swr'
import { useState } from 'react'
import type { DispatchQueueItem, DispatchLog, PaginatedResponse, BulkDispatchRequest } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UseDispatchQueueOptions {
  page?: number
  perPage?: number
  status?: string
  sessionId?: string
}

export function useDispatchQueue(options: UseDispatchQueueOptions = {}) {
  const { page = 1, perPage = 50, status, sessionId } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (status) params.set('status', status)
  if (sessionId) params.set('session_id', sessionId)

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<DispatchQueueItem>>(
    `/api/dispatch?${params.toString()}`,
    fetcher,
    { refreshInterval: 5000 }
  )

  return {
    queue: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

interface UseDispatchLogsOptions {
  page?: number
  perPage?: number
  status?: string
  sessionId?: string
  startDate?: string
  endDate?: string
}

export function useDispatchLogs(options: UseDispatchLogsOptions = {}) {
  const { page = 1, perPage = 50, status, sessionId, startDate, endDate } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (status) params.set('status', status)
  if (sessionId) params.set('session_id', sessionId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<DispatchLog>>(
    `/api/dispatch/logs?${params.toString()}`,
    fetcher
  )

  return {
    logs: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useDispatchStats(period: 'today' | 'week' | 'month' | 'all' = 'today') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dispatch/stats?period=${period}`,
    fetcher,
    { refreshInterval: 10000 }
  )

  return {
    stats: data?.data,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useDispatchActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createDispatch = async (data: BulkDispatchRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to create dispatch')
      return result.data as { 
        queued: number
        total_contacts: number
        sessions_used: number
        estimated_completion: string 
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const cancelDispatch = async (ids: string[]) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('ids', ids.join(','))
      
      const response = await fetch(`/api/dispatch?${params.toString()}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to cancel dispatch')
      return result.data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const cancelAllDispatches = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dispatch?cancel_all=true', {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to cancel dispatches')
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
    createDispatch,
    cancelDispatch,
    cancelAllDispatches,
    isLoading,
    error
  }
}
