"use client"

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import {
  getClientName,
  getClientCPF,
  getClientPhone,
  getClientValor,
  getClientSaldo,
  findFieldKey,
} from '@/lib/helpers'
import type { Client } from '@/lib/types'

interface EditModalProps {
  client: Client | null
  onClose: () => void
  showToast: (message: string, type: 'success' | 'error') => void
}

const FIELD_MAPPINGS = {
  nome: ['nome', 'name', 'cliente', 'razao social', 'razão social', 'razao', 'razão', 'nomes'],
  cpf: ['cpf', 'cpf/cnpj', 'documento', 'doc', 'cpfs', 'documentos'],
  telefone: ['numero', 'número', 'telefone', 'tel', 'celular', 'whatsapp', 'fone', 'phone', 'contato', 'numeros', 'números', 'telefones', 'cel'],
  valor: ['valor', 'value', 'total', 'montante', 'valor emprestimo', 'valor empréstimo', 'emprestimo', 'empréstimo', 'valores'],
  saldo: ['saldo', 'balance', 'saldo fgts', 'saldo disponivel', 'saldo disponível', 'fgts', 'saldos'],
}

export function EditModal({ client, onClose, showToast }: EditModalProps) {
  const { updateClient } = useAppStore()
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    valor: '',
    saldo: '',
  })

  useEffect(() => {
    if (client) {
      setFormData({
        nome: getClientName(client) || '',
        cpf: getClientCPF(client) || '',
        telefone: getClientPhone(client) || '',
        valor: getClientValor(client) || '',
        saldo: getClientSaldo(client) || '',
      })
    }
  }, [client])

  if (!client) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newData = { ...client.data }

    // Nome
    const nomeKey = findFieldKey(client.data, FIELD_MAPPINGS.nome)
    if (nomeKey) {
      newData[nomeKey] = formData.nome
    } else if (formData.nome) {
      newData['nome'] = formData.nome
    }

    // CPF
    const cpfKey = findFieldKey(client.data, FIELD_MAPPINGS.cpf)
    if (cpfKey) {
      newData[cpfKey] = formData.cpf
    } else if (formData.cpf) {
      newData['cpf'] = formData.cpf
    }

    // Telefone
    const telKey = findFieldKey(client.data, FIELD_MAPPINGS.telefone)
    if (telKey) {
      newData[telKey] = formData.telefone
    } else if (formData.telefone) {
      newData['telefone'] = formData.telefone
    }

    // Valor
    const valorKey = findFieldKey(client.data, FIELD_MAPPINGS.valor)
    if (valorKey) {
      newData[valorKey] = formData.valor
    } else if (formData.valor) {
      newData['valor'] = formData.valor
    }

    // Saldo
    const saldoKey = findFieldKey(client.data, FIELD_MAPPINGS.saldo)
    if (saldoKey) {
      newData[saldoKey] = formData.saldo
    } else if (formData.saldo) {
      newData['saldo'] = formData.saldo
    }

    updateClient(client.id, { data: newData })
    showToast('Cliente atualizado com sucesso!', 'success')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">Editar Cliente</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editNome">Nome</Label>
            <Input
              id="editNome"
              placeholder="Nome do cliente"
              value={formData.nome}
              onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editCpf">CPF</Label>
            <Input
              id="editCpf"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={(e) => setFormData((prev) => ({ ...prev, cpf: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTelefone">Telefone</Label>
            <Input
              id="editTelefone"
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editValor">Valor</Label>
            <Input
              id="editValor"
              placeholder="R$ 0,00"
              value={formData.valor}
              onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editSaldo">Saldo</Label>
            <Input
              id="editSaldo"
              placeholder="R$ 0,00"
              value={formData.saldo}
              onChange={(e) => setFormData((prev) => ({ ...prev, saldo: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
