'use client'

import useSWR from 'swr'
import { useState } from 'react'
import type { Contact, PaginatedResponse, ImportContactsRequest } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UseContactsOptions {
  page?: number
  perPage?: number
  search?: string
  status?: string
  tags?: string[]
}

export function useContacts(options: UseContactsOptions = {}) {
  const { page = 1, perPage = 50, search, status, tags } = options
  
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('per_page', perPage.toString())
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (tags?.length) params.set('tags', tags.join(','))

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Contact>>(
    `/api/contacts?${params.toString()}`,
    fetcher
  )

  return {
    contacts: data?.data || [],
    total: data?.total || 0,
    totalPages: data?.total_pages || 0,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useContact(contactId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    contactId ? `/api/contacts/${contactId}` : null,
    fetcher
  )

  return {
    contact: data?.data as Contact | undefined,
    isLoading,
    isError: error,
    refresh: mutate
  }
}

export function useContactActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createContact = async (data: Partial<Contact>) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to create contact')
      return result.data as Contact
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const importContacts = async (contacts: ImportContactsRequest['contacts']) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to import contacts')
      return result.data as { imported: number; duplicates: number; total_processed: number }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const updateContact = async (contactId: string, data: Partial<Contact>) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to update contact')
      return result.data as Contact
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const deleteContact = async (contactId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to delete contact')
      return result.data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const deleteContacts = async (contactIds: string[]) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: contactIds })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to delete contacts')
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
    createContact,
    importContacts,
    updateContact,
    deleteContact,
    deleteContacts,
    isLoading,
    error
  }
}
