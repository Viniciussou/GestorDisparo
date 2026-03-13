"use client"

import { useMemo } from 'react'
import { 
  Users, 
  Send, 
  MessageCircle, 
  Star,
  TrendingUp,
  Clock,
  CreditCard,
  BarChart3
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { hasStatus, formatDateTime } from '@/lib/helpers'

export function StatisticsPanel() {
  const { clients, dispatchLogs, dispatchConfig } = useAppStore()

  const stats = useMemo(() => {
    const total = clients.length
    const dispatched = clients.filter((c) => hasStatus(c, 'dispatched') || c.dispatched).length
    const responding = clients.filter((c) => hasStatus(c, 'responding')).length
    const starred = clients.filter((c) => c.starred).length
    const withBank = clients.filter((c) => c.bank).length
    const pending = total - dispatched

    // Taxa de resposta
    const responseRate = dispatched > 0 ? ((responding / dispatched) * 100).toFixed(1) : '0'

    // Disparos por banco
    const bankStats: Record<string, number> = {}
    clients.forEach((client) => {
      if (client.bank) {
        bankStats[client.bank] = (bankStats[client.bank] || 0) + 1
      }
    })

    // Últimos disparos
    const recentDispatches = dispatchLogs.slice(0, 10)

    return {
      total,
      dispatched,
      responding,
      starred,
      withBank,
      pending,
      responseRate,
      bankStats,
      recentDispatches,
    }
  }, [clients, dispatchLogs])

  const statCards = [
    { label: 'Total de Clientes', value: stats.total, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/15' },
    { label: 'Disparados', value: stats.dispatched, icon: Send, color: 'text-green-500', bg: 'bg-green-500/15' },
    { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/15' },
    { label: 'Respondendo', value: stats.responding, icon: MessageCircle, color: 'text-orange-500', bg: 'bg-orange-500/15' },
    { label: 'Taxa de Resposta', value: `${stats.responseRate}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
    { label: 'Destacados', value: stats.starred, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 p-5 bg-card border border-border rounded-lg hover:border-muted-foreground/30 transition-colors"
          >
            <div className={`flex items-center justify-center w-12 h-12 rounded-md ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Estatísticas por Banco */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Clientes por Banco</h3>
          </div>

          {Object.keys(stats.bankStats).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum cliente com banco selecionado
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.bankStats)
                .sort((a, b) => b[1] - a[1])
                .map(([bank, count]) => {
                  const percentage = ((count / stats.withBank) * 100).toFixed(0)
                  return (
                    <div key={bank}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{bank}</span>
                        <span className="text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Últimos Disparos */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Últimos Disparos</h3>
          </div>

          {stats.recentDispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum disparo realizado ainda
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {stats.recentDispatches.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">{log.clientName}</p>
                    <p className="text-xs text-muted-foreground">{log.clientPhone}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${
                        log.status === 'sent'
                          ? 'bg-green-500/15 text-green-500'
                          : 'bg-red-500/15 text-red-500'
                      }`}
                    >
                      {log.status === 'sent' ? 'Enviado' : 'Falhou'}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuração Atual */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Configuração de Automação</h3>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{dispatchConfig.senderNumbers.length}</p>
            <p className="text-sm text-muted-foreground">Números Remetentes</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{dispatchConfig.dispatchesPerNumber}</p>
            <p className="text-sm text-muted-foreground">Disparos por Número</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{dispatchConfig.interval}min</p>
            <p className="text-sm text-muted-foreground">Intervalo</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{dispatchConfig.messages.length}</p>
            <p className="text-sm text-muted-foreground">Mensagens</p>
          </div>
        </div>
      </div>
    </div>
  )
}
