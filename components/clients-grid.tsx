"use client"

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { ClientCard } from './client-card'
import { hasStatus } from '@/lib/helpers'
import type { Client } from '@/lib/types'

interface ClientsGridProps {
  onEdit: (client: Client) => void
  onOpenChat: (clientId: string) => void
}

export function ClientsGrid({ onEdit, onOpenChat }: ClientsGridProps) {
  const { clients, currentFilter, searchTerm } = useAppStore()

  const filteredClients = useMemo(() => {
    let filtered = [...clients]

    // Aplicar filtro de status
    switch (currentFilter) {
      case 'dispatched':
        filtered = filtered.filter((c) => hasStatus(c, 'dispatched') || c.dispatched)
        break
      case 'simulated':
        filtered = filtered.filter((c) => c.bank)
        break
      case 'responding':
        filtered = filtered.filter((c) => hasStatus(c, 'responding'))
        break
      case 'starred':
        filtered = filtered.filter((c) => c.starred)
        break
      case 'none':
        filtered = filtered.filter(
          (c) => !hasStatus(c, 'dispatched') && !c.dispatched && !hasStatus(c, 'responding') && !c.bank
        )
        break
    }

    // Aplicar busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((client) => {
        const values = Object.values(client.data).map((v) => String(v).toLowerCase())
        return values.some((v) => v.includes(term))
      })
    }

    // Ordenar: destacados primeiro
    filtered.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))

    return filtered
  }, [clients, currentFilter, searchTerm])

  if (filteredClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search className="w-16 h-16 mb-6 opacity-50" />
        <h3 className="text-lg text-secondary-foreground mb-2">Nenhum cliente encontrado</h3>
        <p className="text-sm">Tente ajustar os filtros ou buscar por outro termo</p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-1.5 max-w-5xl mx-auto">
      {filteredClients.map((client) => (
        <ClientCard key={client.id} client={client} onEdit={onEdit} onOpenChat={onOpenChat} />
      ))}
    </section>
  )
}
