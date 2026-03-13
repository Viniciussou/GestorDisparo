"use client"

import { Users, Send, CreditCard, MessageCircle, Star } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { hasStatus } from '@/lib/helpers'

export function StatsBar() {
  const { clients } = useAppStore()

  const stats = [
    {
      label: 'Total de Clientes',
      value: clients.length,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/15',
    },
    {
      label: 'Disparados',
      value: clients.filter((c) => hasStatus(c, 'dispatched') || c.dispatched).length,
      icon: Send,
      color: 'text-green-500',
      bg: 'bg-green-500/15',
    },
    {
      label: 'Banco Simulado',
      value: clients.filter((c) => c.bank).length,
      icon: CreditCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/15',
    },
    {
      label: 'Cliente Respondendo',
      value: clients.filter((c) => hasStatus(c, 'responding')).length,
      icon: MessageCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/15',
    },
    {
      label: 'Destacados',
      value: clients.filter((c) => c.starred).length,
      icon: Star,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/15',
    },
  ]

  return (
    <section className="grid grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-4 p-5 bg-card border border-border rounded-lg hover:border-muted-foreground/30 transition-colors"
        >
          <div className={`flex items-center justify-center w-12 h-12 rounded-md ${stat.bg}`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{stat.value}</span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
        </div>
      ))}
    </section>
  )
}
