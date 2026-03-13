"use client"

import { useState } from 'react'
import { Star, ChevronDown, MessageCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { BANKS } from '@/lib/types'
import {
  getInitials,
  formatCPF,
  formatPhone,
  formatMoney,
  getClientName,
  getClientCPF,
  getClientPhone,
  getClientValor,
  getClientSaldo,
  hasStatus,
} from '@/lib/helpers'
import type { Client } from '@/lib/types'

interface ClientCardProps {
  client: Client
  onEdit: (client: Client) => void
  onOpenChat: (clientId: string) => void
}

export function ClientCard({ client, onEdit, onOpenChat }: ClientCardProps) {
  const { toggleStar, setStatus, setBank } = useAppStore()
  const [showBankDropdown, setShowBankDropdown] = useState(false)

  const nome = getClientName(client)
  const cpf = getClientCPF(client)
  const numero = getClientPhone(client)
  const valor = getClientValor(client)
  const saldo = getClientSaldo(client)
  const initials = getInitials(nome)

  return (
    <div
      className={`bg-card border rounded-md p-4 transition-colors hover:bg-card/80 ${
        client.starred ? 'border-yellow-500 bg-yellow-500/5' : 'border-border hover:border-muted-foreground/30'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => toggleStar(client.id)}
          className={`p-0.5 transition-colors ${
            client.starred ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
          }`}
        >
          <Star className="w-4 h-4" fill={client.starred ? 'currentColor' : 'none'} />
        </button>

        <div className="flex items-center gap-2.5 min-w-[180px]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-xs font-semibold text-white">
            {initials}
          </div>
          <div>
            <div
              className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary truncate max-w-[150px] flex items-center gap-1.5"
              title={nome}
              onClick={() => onEdit(client)}
            >
              {nome}
              {client.bank && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/15 rounded text-[10px] text-purple-500">
                  {client.bank}
                </span>
              )}
            </div>
            <div
              className="text-xs text-muted-foreground font-mono cursor-pointer hover:text-primary"
              onClick={() => onEdit(client)}
            >
              {cpf ? formatCPF(cpf) : 'Adicionar CPF'}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tel:</span>
            <span
              className="text-sm font-medium cursor-pointer hover:text-primary px-1 py-0.5 rounded transition-colors hover:bg-muted/50"
              onClick={() => onEdit(client)}
            >
              {numero ? formatPhone(numero) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor:</span>
            <span className="text-sm font-medium font-mono text-green-500">{valor ? formatMoney(valor) : '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo:</span>
            <span className="text-sm font-medium font-mono text-green-500">{saldo ? formatMoney(saldo) : '-'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-center mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setStatus(client.id, 'dispatched')}
          className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
            hasStatus(client, 'dispatched') || client.dispatched
              ? 'bg-green-500/15 border-green-500 text-green-500'
              : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50'
          }`}
        >
          Disparado
        </button>

        <div className="relative">
          <button
            onClick={() => setShowBankDropdown(!showBankDropdown)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1 ${
              client.bank
                ? 'bg-purple-500/15 border-purple-500 text-purple-500'
                : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50'
            }`}
          >
            {client.bank || 'Banco'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showBankDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-[120px] overflow-hidden">
              {BANKS.map((bank) => (
                <button
                  key={bank}
                  onClick={() => {
                    setBank(client.id, bank)
                    setShowBankDropdown(false)
                  }}
                  className={`block w-full px-3 py-2 text-xs text-left transition-colors hover:bg-muted/50 ${
                    client.bank === bank ? 'bg-purple-500/15 text-purple-500' : 'text-muted-foreground'
                  }`}
                >
                  {bank}
                </button>
              ))}
              {client.bank && (
                <button
                  onClick={() => {
                    setBank(client.id, null)
                    setShowBankDropdown(false)
                  }}
                  className="block w-full px-3 py-2 text-xs text-left text-muted-foreground hover:bg-muted/50 border-t border-border"
                >
                  Remover
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setStatus(client.id, 'responding')}
          className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
            hasStatus(client, 'responding')
              ? 'bg-orange-500/15 border-orange-500 text-orange-500'
              : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50'
          }`}
        >
          Respondendo
        </button>

        <button
          onClick={() => onOpenChat(client.id)}
          className="ml-auto px-2.5 py-1.5 rounded text-xs font-medium border bg-primary/10 border-primary text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
        >
          <MessageCircle className="w-3 h-3" />
          Chat
        </button>
      </div>
    </div>
  )
}
