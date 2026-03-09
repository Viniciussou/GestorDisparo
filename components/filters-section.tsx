"use client"

import { Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { FilterType } from '@/lib/types'
import { hasStatus, getClientName } from '@/lib/helpers'
import * as XLSX from 'xlsx'

interface FiltersSectionProps {
  onNewUpload: () => void
  showToast: (message: string, type: 'success' | 'error') => void
}

export function FiltersSection({ onNewUpload, showToast }: FiltersSectionProps) {
  const { clients, currentFilter, setFilter } = useAppStore()

  const filters: { label: string; value: FilterType }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Disparados', value: 'dispatched' },
    { label: 'Banco Simulado', value: 'simulated' },
    { label: 'Respondendo', value: 'responding' },
    { label: 'Destacados', value: 'starred' },
    { label: 'Sem Status', value: 'none' },
  ]

  const exportData = () => {
    if (clients.length === 0) {
      showToast('Não há dados para exportar.', 'error')
      return
    }

    const exportRows = clients.map((client) => {
      const statuses = []
      if (hasStatus(client, 'dispatched') || client.dispatched) statuses.push('Disparado')
      if (client.bank) statuses.push('Banco: ' + client.bank)
      if (hasStatus(client, 'responding')) statuses.push('Respondendo')

      return {
        ...client.data,
        Status: statuses.length > 0 ? statuses.join(', ') : 'Sem status',
        Destacado: client.starred ? 'Sim' : 'Não',
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes_export_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast('Dados exportados com sucesso!', 'success')
  }

  return (
    <section className="flex justify-between items-center mb-6 flex-wrap gap-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setFilter(filter.value)}
            className={`px-4 py-2 rounded-md text-sm border transition-colors ${
              currentFilter === filter.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onNewUpload}>
          <Upload className="w-4 h-4 mr-2" />
          Nova Planilha
        </Button>
        <Button variant="outline" onClick={exportData}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>
    </section>
  )
}
