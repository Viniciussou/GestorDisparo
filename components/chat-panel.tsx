"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { 
  Send, 
  Search, 
  Phone, 
  MoreVertical, 
  Check, 
  CheckCheck,
  ExternalLink,
  Circle,
  MessageCircle,
  RefreshCw,
  Wifi,
  User
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { 
  getClientName, 
  getClientPhone, 
  getInitials, 
  formatPhone,
  formatTime,
  formatDateTime,
  generateId,
  openWhatsApp,
  hasStatus,
  formatWhatsAppNumber
} from '@/lib/helpers'
import type { Message } from '@/lib/types'

interface ChatPanelProps {
  showToast: (message: string, type: 'success' | 'error') => void
}

export function ChatPanel({ showToast }: ChatPanelProps) {
  const { 
    clients, 
    activeChatClientId, 
    setActiveChatClientId,
    addMessage,
    dispatchLogs,
    dispatchConfig,
    updateClient
  } = useAppStore()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedSender, setSelectedSender] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Números conectados
  const connectedSenders = useMemo(() => {
    return dispatchConfig.senderNumbers.filter(s => s.connected)
  }, [dispatchConfig.senderNumbers])

  // Definir remetente padrão
  useEffect(() => {
    if (connectedSenders.length > 0 && !selectedSender) {
      setSelectedSender(connectedSenders[0].phone)
    }
  }, [connectedSenders, selectedSender])

  // Carregar mensagens do disparo para o chat
  const loadDispatchMessages = useCallback((clientId: string) => {
    const clientLogs = dispatchLogs.filter(log => log.clientId === clientId)
    const client = clients.find(c => c.id === clientId)
    
    if (client && clientLogs.length > 0 && (!client.messages || client.messages.length === 0)) {
      const messages: Message[] = clientLogs.map(log => ({
        id: generateId(),
        text: log.message,
        sender: 'user',
        timestamp: log.timestamp,
        status: 'delivered' as const
      }))
      
      updateClient(clientId, { messages })
    }
  }, [dispatchLogs, clients, updateClient])

  // Carregar mensagens recebidas do WhatsApp
  const loadReceivedMessages = useCallback(async (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    if (!client) return

    const phone = getClientPhone(client)
    if (!phone) return

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-messages',
          clientPhone: formatWhatsAppNumber(phone)
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.messages.length > 0) {
        // Mesclar mensagens recebidas com as existentes
        const existingMessages = client.messages || []
        const existingIds = new Set(existingMessages.map(m => m.id))
        
        const newMessages = data.messages.filter((m: Message) => !existingIds.has(m.id))
        
        if (newMessages.length > 0) {
          updateClient(clientId, {
            messages: [...existingMessages, ...newMessages]
          })
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens recebidas:', error)
    }
  }, [clients, updateClient])

  // Carregar mensagens quando selecionar cliente
  useEffect(() => {
    if (activeChatClientId) {
      loadDispatchMessages(activeChatClientId)
      loadReceivedMessages(activeChatClientId)
    }
  }, [activeChatClientId, loadDispatchMessages, loadReceivedMessages])

  // Buscar mensagens recebidas periodicamente
  useEffect(() => {
    if (!activeChatClientId) return

    const interval = setInterval(() => {
      loadReceivedMessages(activeChatClientId)
    }, 10000) // A cada 10 segundos

    return () => clearInterval(interval)
  }, [activeChatClientId, loadReceivedMessages])

  // Filtrar apenas clientes disparados
  const dispatchedClients = useMemo(() => {
    return clients.filter((c) => hasStatus(c, 'dispatched') || c.dispatched)
  }, [clients])

  // Filtrar por busca
  const filteredClients = useMemo(() => {
    if (!searchTerm) return dispatchedClients
    const term = searchTerm.toLowerCase()
    return dispatchedClients.filter((client) => {
      const name = getClientName(client).toLowerCase()
      const phone = getClientPhone(client).toLowerCase()
      return name.includes(term) || phone.includes(term)
    })
  }, [dispatchedClients, searchTerm])

  // Cliente ativo
  const activeClient = useMemo(() => {
    return clients.find((c) => c.id === activeChatClientId) || null
  }, [clients, activeChatClientId])

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeClient?.messages])

  // Enviar mensagem via API
  const sendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeClient) return

    const phone = getClientPhone(activeClient)
    if (!phone) {
      showToast('Cliente não possui telefone cadastrado!', 'error')
      return
    }

    const messageText = messageInput.trim()
    const newMessage: Message = {
      id: generateId(),
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
      status: 'sent',
    }

    setIsSending(true)
    setMessageInput('') // Limpa input imediatamente para UX

    try {
      // Tentar enviar via API do Baileys
      if (selectedSender) {
        const response = await fetch('/api/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            senderNumber: selectedSender,
            to: formatWhatsAppNumber(phone),
            message: messageText
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          addMessage(activeClient.id, { ...newMessage, status: 'delivered' })
          showToast('Mensagem enviada!', 'success')
        } else {
          // Fallback para WhatsApp Web
          addMessage(activeClient.id, newMessage)
          openWhatsApp(phone, messageText)
          showToast('Abrindo WhatsApp Web...', 'success')
        }
      } else {
        // Sem remetente selecionado, abre WhatsApp Web
        addMessage(activeClient.id, newMessage)
        openWhatsApp(phone, messageText)
        showToast('Abrindo WhatsApp Web...', 'success')
      }
    } catch {
      // Fallback: abrir WhatsApp Web
      addMessage(activeClient.id, newMessage)
      openWhatsApp(phone, messageText)
      showToast('Abrindo WhatsApp Web...', 'success')
    } finally {
      setIsSending(false)
    }
  }, [messageInput, activeClient, selectedSender, addMessage, showToast])

  // Obter último disparo do cliente
  const getLastDispatch = (clientId: string) => {
    const log = dispatchLogs.find((l) => l.clientId === clientId)
    return log ? formatDateTime(log.timestamp) : null
  }

  // Obter remetente do disparo
  const getDispatchSender = (clientId: string) => {
    const log = dispatchLogs.find((l) => l.clientId === clientId)
    if (!log) return null
    const sender = dispatchConfig.senderNumbers.find(s => s.phone === log.senderNumber)
    return sender?.name || formatPhone(log.senderNumber)
  }

  // Simular resposta do cliente (para testes)
  const simulateClientResponse = useCallback(() => {
    if (!activeClient) return
    
    const responses = [
      'Olá! Tudo bem?',
      'Boa tarde!',
      'Obrigado pelo contato!',
      'Tenho interesse sim!',
      'Pode me explicar melhor?',
      'Qual o valor?',
      'Vou pensar e retorno!',
      'Perfeito, vamos conversar!'
    ]
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    
    const clientMessage: Message = {
      id: generateId(),
      text: randomResponse,
      sender: 'client',
      timestamp: new Date().toISOString(),
      status: 'read'
    }
    
    addMessage(activeClient.id, clientMessage)
    
    // Marcar cliente como "respondendo"
    if (!hasStatus(activeClient, 'responding')) {
      updateClient(activeClient.id, {
        statuses: [...(activeClient.statuses || []), 'responding']
      })
    }
    
    showToast('Resposta simulada recebida!', 'success')
  }, [activeClient, addMessage, updateClient, showToast])

  // Renderizar status da mensagem
  const renderMessageStatus = (status: Message['status']) => {
    switch (status) {
      case 'sent':
        return <Check className="w-3 h-3 text-muted-foreground" />
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="flex h-[calc(100vh-180px)] bg-card border border-border rounded-lg overflow-hidden">
      {/* Lista de Conversas */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold mb-3">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm text-center">Nenhuma conversa</p>
              <p className="text-xs text-center">Dispare mensagens para iniciar</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const name = getClientName(client)
              const phone = getClientPhone(client)
              const initials = getInitials(name)
              const lastDispatch = getLastDispatch(client.id)
              const dispatchSender = getDispatchSender(client.id)
              const lastMessage = client.messages?.[client.messages.length - 1]
              const isActive = activeChatClientId === client.id

              return (
                <button
                  key={client.id}
                  onClick={() => setActiveChatClientId(client.id)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-border/50 ${
                    isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                      {initials}
                    </div>
                    {hasStatus(client, 'responding') && (
                      <Circle className="w-3 h-3 fill-green-500 text-green-500 absolute -bottom-0.5 -right-0.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {lastMessage ? formatTime(lastMessage.timestamp) : lastDispatch?.split(' ')[1] || ''}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {lastMessage?.text || `Via ${dispatchSender || 'WhatsApp'}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {formatPhone(phone)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Info dos números conectados */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Números conectados</span>
            <span className={connectedSenders.length > 0 ? 'text-green-500' : 'text-red-500'}>
              {connectedSenders.length}
            </span>
          </div>
        </div>
      </div>

      {/* Área de Chat */}
      {activeClient ? (
        <div className="flex-1 flex flex-col">
          {/* Header do Chat */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                {getInitials(getClientName(activeClient))}
              </div>
              <div>
                <h3 className="font-semibold">{getClientName(activeClient)}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {formatPhone(getClientPhone(activeClient))}
                  {hasStatus(activeClient, 'responding') && (
                    <span className="text-xs text-green-500">Respondendo</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={simulateClientResponse}
                title="Simular resposta do cliente (teste)"
                className="text-xs"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Simular Resposta
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openWhatsApp(getClientPhone(activeClient), '')}
                title="Abrir no WhatsApp"
              >
                <ExternalLink className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" title="Ligar">
                <Phone className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Info do Disparo */}
          {getLastDispatch(activeClient.id) && (
            <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Disparado em {getLastDispatch(activeClient.id)} via {getDispatchSender(activeClient.id)}
              </span>
              {activeClient.bank && (
                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded">
                  {activeClient.bank}
                </span>
              )}
            </div>
          )}

          {/* Mensagens */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundColor: 'hsl(var(--background))',
            }}
          >
            {(!activeClient.messages || activeClient.messages.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs">Envie uma mensagem para iniciar a conversa</p>
              </div>
            ) : (
              activeClient.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card border border-border rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <div className={`flex items-center gap-1 justify-end mt-1 ${
                      message.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      <span className="text-[10px]">{formatTime(message.timestamp)}</span>
                      {message.sender === 'user' && renderMessageStatus(message.status)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Seletor de Remetente */}
          {connectedSenders.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Enviar como:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={selectedSender || ''}
                onChange={(e) => setSelectedSender(e.target.value)}
              >
                {connectedSenders.map((sender) => (
                  <option key={sender.phone} value={sender.phone}>
                    {sender.name} ({formatPhone(sender.phone)})
                  </option>
                ))}
              </select>
              <Wifi className="w-4 h-4 text-green-500" />
            </div>
          )}

          {/* Input de Mensagem */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Digite uma mensagem..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1"
                disabled={isSending}
              />
              <Button onClick={sendMessage} disabled={!messageInput.trim() || isSending}>
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            {connectedSenders.length === 0 && (
              <p className="text-xs text-yellow-500 mt-2 text-center">
                Nenhum número conectado. Mensagens serão abertas no WhatsApp Web.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <MessageCircle className="w-12 h-12 opacity-50" />
          </div>
          <h3 className="text-xl font-medium mb-2">GestorDisparo Chat</h3>
          <p className="text-sm text-center max-w-sm">
            Selecione uma conversa na lista para ver as mensagens e interagir com seus clientes
          </p>
          
          {dispatchedClients.length === 0 && (
            <div className="mt-6 p-4 bg-card rounded-lg border border-border max-w-sm">
              <p className="text-sm text-center">
                Nenhum cliente disparado ainda. Vá para a aba <strong>Disparos</strong> para enviar mensagens.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
