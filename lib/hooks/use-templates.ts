'use client'

import useSWR from 'swr'
import { useState } from 'react'
import type { MessageTemplate, PaginatedResponse } from '@/lib/types'
import { API_ENDPOINTS } from '@/lib/config'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UseTemplatesOptions {
  page?: number
  perPage?: number
  category?: string
  active?: boolean
}

export function useTemplates(options: UseTemplatesOptions = {}) {
  const { page = 1, perPage = 50, category, active } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (category) params.set('category', category)
  if (active !== undefined) params.set('active', active.toString())

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<MessageTemplate>>(
    `${API_ENDPOINTS.TEMPLATES}?${params.toString()}`,
    fetcher
  )

  return {
    templates: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useTemplate(templateId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    templateId ? API_ENDPOINTS.TEMPLATE(templateId) : null,
    fetcher
  )

  return {
    template: data?.data as MessageTemplate | undefined,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useTemplateActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = async (data: Partial<MessageTemplate>) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(API_ENDPOINTS.TEMPLATES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to create template')
      return result.data as MessageTemplate
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const updateTemplate = async (templateId: string, data: Partial<MessageTemplate>) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(API_ENDPOINTS.TEMPLATE(templateId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to update template')
      return result.data as MessageTemplate
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(API_ENDPOINTS.TEMPLATE(templateId), {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to delete template')
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
    createTemplate,
    updateTemplate,
    deleteTemplate,
    isLoading,
    error
  }
}
