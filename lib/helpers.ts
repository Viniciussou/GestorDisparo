import type { Client } from './types'

export function generateId(): string {
  return 'id_' + Math.random().toString(36).substring(2, 11)
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const words = name.trim().split(' ')
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export function formatCPF(cpf: string): string {
  const cleaned = String(cpf).replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return cpf
}

export function formatPhone(phone: string): string {
  const cleaned = String(phone).replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

export function formatMoney(value: string): string {
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (!isNaN(num)) {
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  return value
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const FIELD_MAPPINGS = {
  nome: ['nome', 'name', 'cliente', 'razao social', 'razão social', 'razao', 'razão', 'nomes'],
  cpf: ['cpf', 'cpf/cnpj', 'documento', 'doc', 'cpfs', 'documentos'],
  telefone: ['numero', 'número', 'telefone', 'tel', 'celular', 'whatsapp', 'fone', 'phone', 'contato', 'numeros', 'números', 'telefones', 'cel'],
  valor: ['valor', 'value', 'total', 'montante', 'valor emprestimo', 'valor empréstimo', 'emprestimo', 'empréstimo', 'valores'],
  saldo: ['saldo', 'balance', 'saldo fgts', 'saldo disponivel', 'saldo disponível', 'fgts', 'saldos'],
}

export function findField(data: Record<string, string>, possibleNames: string[]): string | null {
  const keys = Object.keys(data)
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase().trim()
    if (possibleNames.includes(lowerKey)) {
      return data[key]
    }
  }
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase().trim()
    for (const name of possibleNames) {
      if (lowerKey.includes(name) || name.includes(lowerKey)) {
        return data[key]
      }
    }
  }
  
  return null
}

export function findFieldKey(data: Record<string, string>, possibleNames: string[]): string | null {
  const keys = Object.keys(data)
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase().trim()
    if (possibleNames.includes(lowerKey)) {
      return key
    }
  }
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase().trim()
    for (const name of possibleNames) {
      if (lowerKey.includes(name) || name.includes(lowerKey)) {
        return key
      }
    }
  }
  
  return null
}

export function getClientName(client: Client): string {
  return findField(client.data, FIELD_MAPPINGS.nome) || 'Sem Nome'
}

export function getClientCPF(client: Client): string {
  return findField(client.data, FIELD_MAPPINGS.cpf) || ''
}

export function getClientPhone(client: Client): string {
  return findField(client.data, FIELD_MAPPINGS.telefone) || ''
}

export function getClientValor(client: Client): string {
  return findField(client.data, FIELD_MAPPINGS.valor) || ''
}

export function getClientSaldo(client: Client): string {
  return findField(client.data, FIELD_MAPPINGS.saldo) || ''
}

export function hasStatus(client: Client, status: string): boolean {
  if (Array.isArray(client.statuses)) {
    return client.statuses.includes(status)
  }
  return client.status === status
}

export function getRandomMessage(messages: string[]): string {
  if (messages.length === 0) return ''
  return messages[Math.floor(Math.random() * messages.length)]
}

export function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `55${cleaned}`
  } else if (cleaned.length === 10) {
    return `55${cleaned.substring(0, 2)}9${cleaned.substring(2)}`
  } else if (cleaned.startsWith('55')) {
    return cleaned
  }
  return `55${cleaned}`
}

export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = formatWhatsAppNumber(phone)
  const encodedMessage = encodeURIComponent(message)
  window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank')
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
