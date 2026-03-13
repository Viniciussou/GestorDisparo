"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Play, Pause, Plus, Trash2, Send, Clock, Phone, MessageSquare, Settings,
  AlertCircle, CheckCircle2, History, Users, Wifi, WifiOff, RefreshCw,
  QrCode, X, User, Search, Check, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { INTERVAL_OPTIONS } from '@/lib/types'
import type { SenderNumber } from '@/lib/types'
import {
  getClientName, getClientPhone, getRandomMessage, formatWhatsAppNumber,
  formatPhone, formatDateTime, generateId, hasStatus
} from '@/lib/helpers'

interface DispatchPanelProps {
  showToast: (message: string, type: 'success' | 'error') => void
}

export function DispatchPanel({ showToast }: DispatchPanelProps) {
  const {
    clients,
    dispatchConfig,
    setDispatchConfig,
    dispatchLogs,
    addDispatchLog,
    clearDispatchLogs,
    updateClient
  } = useAppStore()

  const [newSenderName, setNewSenderName] = useState('')
  const [newSenderNumber, setNewSenderNumber] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [currentSenderIndex, setCurrentSenderIndex] = useState(0)
  const [dispatchCountForCurrentSender, setDispatchCountForCurrentSender] = useState(0)
  const [nextDispatchTime, setNextDispatchTime] = useState<Date | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [showClientSelector, setShowClientSelector] = useState(false)
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | "loading" | null>(null)
  const [connectingPhone, setConnectingPhone] = useState<string | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const isCancelled = useRef(false)
  const [countdown, setCountdown] = useState<number>(0)

  // Clientes elegíveis para disparo (não disparados ainda)
  const eligibleClients = useMemo(() => {
    return clients.filter(
      (c) => !hasStatus(c, 'dispatched') && !c.dispatched && getClientPhone(c)
    )
  }, [clients])

  // Clientes filtrados pela busca
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return eligibleClients
    const term = clientSearchTerm.toLowerCase()
    return eligibleClients.filter((client) => {
      const name = getClientName(client).toLowerCase()
      const phone = getClientPhone(client).toLowerCase()
      return name.includes(term) || phone.includes(term)
    })
  }, [eligibleClients, clientSearchTerm])

  // Números conectados
  const connectedSenders = useMemo(() => {
    return dispatchConfig.senderNumbers.filter(s => s.connected)
  }, [dispatchConfig.senderNumbers])

  // Poll for QR code
  const pollForQRCode = useCallback(async (sessionId: string, attemptCount: number = 0) => {
    const maxAttempts = 30
    if (attemptCount >= maxAttempts) {
      showToast('Timeout aguardando QR code. Tente novamente.', 'error')
      setIsConnecting(null)
      setQrImage(null)
      setQrCode(null)
      setConnectingPhone(null)
      return
    }

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_qr', sessionId })
      })

      const data = await response.json()
      console.log('QR polled:', { attemptCount, data })

      if (data.data?.qr_code) {
        setQrImage(data.data.qr_code)
        setQrCode(data.data.qr_code)
        showToast('QR Code gerado! Escaneie agora.', 'success')
      } else {
        setTimeout(() => pollForQRCode(sessionId, attemptCount + 1), 1000)
      }
    } catch (error) {
      console.error('Erro no polling do QR:', error)
      setTimeout(() => pollForQRCode(sessionId, attemptCount + 1), 1000)
    }
  }, [showToast])

  // Conectar número remetente via API
  const connectSender = async (phone: string) => {
    setIsConnecting(phone)
    setConnectingPhone(phone)
    setQrImage("loading")

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', phoneNumber: phone })
      })

      const data = await response.json()

      if (data.success) {

        if (data.debug) {
          setIsDebugMode(true)
          setQrImage(data.data.qr_code)
          setQrCode(data.data.qr_code)
          showToast('QR Code simulado gerado para debug.', 'error')

        } else if (data.data?.qr_code) {
          setIsDebugMode(false)
          setQrImage(data.data.qr_code)
          setQrCode(data.data.qr_code)
          showToast('QR Code gerado! Escaneie com o WhatsApp.', 'success')

        } else if (data.data?.session_id) {
          // QR ainda não pronto, fazer polling
          setQrCode("loading")
          setQrImage("loading")
          pollForQRCode(data.data.session_id)
        } else if (data.connected) {
          setDispatchConfig({
            senderNumbers: dispatchConfig.senderNumbers.map(s =>
              s.phone === phone
                ? { ...s, connected: true, lastActivity: new Date().toISOString() }
                : s
            )
          })
          showToast(`Número ${formatPhone(phone)} já estava conectado!`, 'success')
        } else {
          showToast('Aguardando QR Code...', 'success')
        }

      } else {

        if (data.banned) {
          showToast(data.error || 'Número banido pelo WhatsApp', 'error')
        } else {
          showToast(data.error || 'Erro ao conectar', 'error')
        }

      }

    } catch (error) {
      console.error(error)
      showToast('Erro ao conectar com a API', 'error')
    }
  }

  // Desconectar número remetente
  const disconnectSender = async (phone: string) => {
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', phoneNumber: phone })
      })

      setDispatchConfig({
        senderNumbers: dispatchConfig.senderNumbers.map(s =>
          s.phone === phone ? { ...s, connected: false } : s
        )
      })

      showToast(`Número ${formatPhone(phone)} desconectado`, 'success')
      setQrImage(null)
      setQrCode(null)
      setConnectingPhone(null)

    } catch (error) {
      console.error(error)
      showToast('Erro ao desconectar número', 'error')
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Remetentes</h2>

      {dispatchConfig.senderNumbers.map((sender) => (
        <div key={sender.phone} className="mb-4 border p-2 rounded">
          <div className="flex justify-between items-center">
            <span>{sender.name} ({formatPhone(sender.phone)})</span>
            {sender.connected ? (
              <Button size="sm" variant="destructive" onClick={() => disconnectSender(sender.phone)}>
                Desconectar
              </Button>
            ) : (
              <Button size="sm" onClick={() => connectSender(sender.phone)}>
                Conectar
              </Button>
            )}
          </div>

          {/* QR Code */}
          {connectingPhone === sender.phone && (
            <div className="mt-2">
              {qrImage === "loading" ? (
                <p className="text-center text-sm text-muted-foreground">Carregando QR Code...</p>
              ) : qrImage ? (
                <img src={qrImage} alt="QR Code WhatsApp" className="mx-auto w-64 h-64" />
              ) : (
                <p className="text-center text-sm text-muted-foreground">Aguardando QR Code...</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

      const data = await response.json()

      if (data.success) {
        setDispatchConfig({
          senderNumbers: dispatchConfig.senderNumbers.map(s =>
            s.phone === phone
              ? { ...s, connected: false }
              : s
          )
        })
        showToast(`Número ${formatPhone(phone)} desconectado!`, 'success')
      }
    } catch {
      showToast('Erro ao desconectar', 'error')
    }
  }

  // Executar disparo agora (função principal)
  const executeDispatchNow = useCallback(async () => {
    if (connectedSenders.length === 0) {
      showToast('Conecte pelo menos um número remetente!', 'error')
      setDispatchConfig({ isActive: false })
      return false
    }
    if (dispatchConfig.messages.length === 0) {
      showToast('Adicione pelo menos uma mensagem de disparo!', 'error')
      setDispatchConfig({ isActive: false })
      return false
    }

    // Usar clientes selecionados ou os elegíveis
    const clientsToDispatch = selectedClients.length > 0
      ? clients.filter(c => selectedClients.includes(c.id) && !c.dispatched).slice(0, dispatchConfig.numbersPerDispatch)
      : eligibleClients.slice(0, dispatchConfig.numbersPerDispatch)

    if (clientsToDispatch.length === 0) {
      showToast('Todos os clientes já foram disparados!', 'success')
      setDispatchConfig({ isActive: false })
      return false
    }

    const currentSender =
      connectedSenders[currentSenderIndex % connectedSenders.length]

    // Preparar dados para a API
    const recipients = clientsToDispatch.map(client => ({
      phone: formatWhatsAppNumber(getClientPhone(client)),
      name: getClientName(client),
      clientId: client.id
    }))

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-bulk',
          recipients,
          messages: dispatchConfig.messages,
          senderNumbers: [currentSender.phone],
          dispatchesPerNumber: dispatchConfig.dispatchesPerNumber
        })
      })

      const data = await response.json()

      if (data.success) {
        // Atualizar clientes disparados
        clientsToDispatch.forEach((client) => {
          const phone = getClientPhone(client)
          const name = getClientName(client)

          updateClient(client.id, {
            dispatched: true,
            dispatchedAt: new Date().toISOString(),
            statuses: [...(client.statuses || []), 'dispatched']
          })

          addDispatchLog({
            id: generateId(),
            clientId: client.id,
            clientName: name,
            clientPhone: phone,
            senderNumber: currentSender.phone,
            message: getRandomMessage(dispatchConfig.messages).replace(/{nome}/gi, name),
            timestamp: new Date().toISOString(),
            status: 'sent',
          })
        })

        // Remover dos selecionados
        setSelectedClients(prev => prev.filter(id => !clientsToDispatch.map(c => c.id).includes(id)))

        showToast(`${clientsToDispatch.length} disparos realizados com sucesso!`, 'success')
      } else {
        showToast(data.error || 'Erro ao enviar disparos', 'error')
      }
    } catch {
      // Fallback: abrir WhatsApp Web
      clientsToDispatch.forEach((client) => {
        const phone = getClientPhone(client)
        const name = getClientName(client)
        const message = getRandomMessage(dispatchConfig.messages)
        const formattedMessage = message.replace(/{nome}/gi, name)

        const formattedPhone = formatWhatsAppNumber(phone)
        const encodedMessage = encodeURIComponent(formattedMessage)
        window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank')

        updateClient(client.id, {
          dispatched: true,
          dispatchedAt: new Date().toISOString(),
          statuses: [...(client.statuses || []), 'dispatched']
        })

        addDispatchLog({
          id: generateId(),
          clientId: client.id,
          clientName: name,
          clientPhone: phone,
          senderNumber: currentSender.phone,
          message: formattedMessage,
          timestamp: new Date().toISOString(),
          status: 'sent',
        })
      })

      setSelectedClients(prev => prev.filter(id => !clientsToDispatch.map(c => c.id).includes(id)))
      showToast(`${clientsToDispatch.length} disparos realizados via WhatsApp Web!`, 'success')
    }

    // Atualizar contador do remetente atual
    const newDispatchCount = dispatchCountForCurrentSender + clientsToDispatch.length

    // Atualizar contador no sender
    setDispatchConfig({
      senderNumbers: dispatchConfig.senderNumbers.map(s =>
        s.phone === currentSender.phone
          ? { ...s, dispatchCount: s.dispatchCount + clientsToDispatch.length }
          : s
      )
    })

    if (newDispatchCount >= dispatchConfig.dispatchesPerNumber) {
      const nextIndex = (currentSenderIndex + 1) % connectedSenders.length
      setCurrentSenderIndex(nextIndex)
      setDispatchCountForCurrentSender(0)
    } else {
      setDispatchCountForCurrentSender(newDispatchCount)
    }

    return true
  }, [
    dispatchConfig,
    eligibleClients,
    selectedClients,
    clients,
    currentSenderIndex,
    dispatchCountForCurrentSender,
    connectedSenders,
    updateClient,
    addDispatchLog,
    showToast,
    setDispatchConfig,
  ])

  // Executar disparo pelo timer
  const executeDispatch = useCallback(async () => {
    if (!dispatchConfig.isActive) return

    const success = await executeDispatchNow()

    if (success) {
      // Configurar próximo disparo
      setNextDispatchTime(new Date(Date.now() + dispatchConfig.interval * 60 * 1000))
      setCountdown(dispatchConfig.interval * 60)
    }
  }, [dispatchConfig.isActive, dispatchConfig.interval, executeDispatchNow])

  // Iniciar automação - dispara imediatamente e depois aguarda o intervalo
  const startAutomation = useCallback(async () => {
    if (connectedSenders.length === 0) {
      showToast('Conecte pelo menos um número remetente!', 'error')
      return
    }
    if (dispatchConfig.messages.length === 0) {
      showToast('Adicione pelo menos uma mensagem de disparo!', 'error')
      return
    }
    if (eligibleClients.length === 0 && selectedClients.length === 0) {
      showToast('Não há clientes elegíveis para disparo!', 'error')
      return
    }

    // Ativar automação
    setDispatchConfig({ isActive: true })
    showToast('Automação iniciada! Disparando agora...', 'success')

    // Executar primeiro disparo imediatamente
    await executeDispatchNow()

    // Configurar próximo disparo
    setNextDispatchTime(new Date(Date.now() + dispatchConfig.interval * 60 * 1000))
    setCountdown(dispatchConfig.interval * 60)
  }, [dispatchConfig, eligibleClients, selectedClients, connectedSenders, showToast, setDispatchConfig, executeDispatchNow])

  // Parar automação
  const stopAutomation = useCallback(() => {
    setDispatchConfig({ isActive: false })
    setNextDispatchTime(null)
    setCountdown(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    showToast('Automação pausada!', 'success')
  }, [showToast, setDispatchConfig])

  // Efeito para o countdown (apenas decrementa o tempo)
  useEffect(() => {
    if (!dispatchConfig.isActive || countdown <= 0) return

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0 // Será tratado pelo outro effect
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [dispatchConfig.isActive, countdown])

  // Efeito para executar disparo quando countdown chega a 0
  useEffect(() => {
    if (dispatchConfig.isActive && countdown === 0) {
      executeDispatch()
    }
  }, [countdown, dispatchConfig.isActive, executeDispatch])

  // Adicionar número remetente
  const addSenderNumber = () => {
    if (!newSenderNumber.trim()) return
    const cleaned = newSenderNumber.replace(/\D/g, '')
    if (cleaned.length < 10) {
      showToast('Número inválido!', 'error')
      return
    }
    if (dispatchConfig.senderNumbers.some(s => s.phone === cleaned)) {
      showToast('Número já adicionado!', 'error')
      return
    }

    const newSender: SenderNumber = {
      phone: cleaned,
      name: newSenderName.trim() || `Remetente ${dispatchConfig.senderNumbers.length + 1}`,
      connected: false,
      dispatchCount: 0
    }

    setDispatchConfig({
      senderNumbers: [...dispatchConfig.senderNumbers, newSender],
    })
    setNewSenderNumber('')
    setNewSenderName('')
    showToast('Número adicionado! Conecte-o para usar nos disparos.', 'success')
  }

  // Remover número remetente
  const removeSenderNumber = (phone: string) => {
    setDispatchConfig({
      senderNumbers: dispatchConfig.senderNumbers.filter((s) => s.phone !== phone),
    })
  }

  // Adicionar mensagem
  const addMessage = () => {
    if (!newMessage.trim()) return
    setDispatchConfig({
      messages: [...dispatchConfig.messages, newMessage.trim()],
    })
    setNewMessage('')
    showToast('Mensagem adicionada!', 'success')
  }

  // Remover mensagem
  const removeMessage = (index: number) => {
    setDispatchConfig({
      messages: dispatchConfig.messages.filter((_, i) => i !== index),
    })
  }

  // Formatar countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Disparo manual único
  const manualDispatch = () => {
    if (dispatchConfig.messages.length === 0) {
      showToast('Adicione pelo menos uma mensagem!', 'error')
      return
    }
    if (eligibleClients.length === 0 && selectedClients.length === 0) {
      showToast('Não há clientes elegíveis para disparo!', 'error')
      return
    }
    if (connectedSenders.length === 0) {
      showToast('Conecte pelo menos um número remetente!', 'error')
      return
    }
    executeDispatch()
  }

  // Toggle seleção de cliente
  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    )
  }

  // Selecionar todos os clientes filtrados
  const selectAllFiltered = () => {
    const filteredIds = filteredClients.map(c => c.id)
    setSelectedClients(prev => {
      const allSelected = filteredIds.every(id => prev.includes(id))
      if (allSelected) {
        return prev.filter(id => !filteredIds.includes(id))
      }
      return [...new Set([...prev, ...filteredIds])]
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* QR Code Modal */}
      <Dialog
        open={qrImage !== null}
        onOpenChange={(open) => {
          if (!open) {
            isCancelled.current = true
            setQrCode(null)
            setQrImage(null)
            setIsConnecting(null)
            setConnectingPhone(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {isDebugMode
                ? 'Este é um QR Code simulado para debug. Não escaneie - use um número diferente que não esteja banido ou restrito pelo WhatsApp.'
                : 'Abra o WhatsApp no seu celular e escaneie o código QR abaixo:'
              }
            </p>

            <div className="flex justify-center">
              {isDebugMode ? (
                <div className="w-64 h-64 border border-red-500 rounded-lg flex items-center justify-center bg-red-50">
                  <div className="flex flex-col items-center gap-2 text-red-600">
                    <AlertTriangle className="w-8 h-8" />
                    <p className="text-sm font-medium">QR Code Inválido</p>
                    <p className="text-xs text-center">
                      Este QR é apenas para debug.<br />
                      Use um número não banido.
                    </p>
                  </div>
                </div>
              ) : qrImage && qrImage !== "loading" ? (
                <img
                  src={qrImage}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 border border-border rounded-lg flex items-center justify-center bg-muted">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Gerando QR Code...
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Número: <span className="font-mono">{connectingPhone ? formatPhone(connectingPhone) : ''}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Aguarde a conexão automática após escanear...
              </p>
              <p className="text-xs text-muted-foreground">
                O modal fechará automaticamente quando conectado.
              </p>
            </div>

            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQrImage(null)
                  setQrCode(null)
                  setIsConnecting(null)
                  setConnectingPhone(null)
                  isCancelled.current = true
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  // Tentar reconectar
                  if (connectingPhone) {
                    connectSender(connectingPhone)
                  }
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status da Automação */}
      <div className={`p-6 rounded-lg border ${dispatchConfig.isActive
        ? 'bg-green-500/10 border-green-500'
        : 'bg-card border-border'
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${dispatchConfig.isActive ? 'bg-green-500/20' : 'bg-muted'
              }`}>
              {dispatchConfig.isActive ? (
                <Play className="w-6 h-6 text-green-500" />
              ) : (
                <Pause className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {dispatchConfig.isActive ? 'Automação Ativa' : 'Automação Pausada'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {dispatchConfig.isActive
                  ? `Próximo disparo em ${formatCountdown(countdown)}`
                  : 'Configure e inicie a automação de disparos'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={manualDispatch}
              disabled={dispatchConfig.isActive}
            >
              <Send className="w-4 h-4 mr-2" />
              Disparo Manual
            </Button>
            {dispatchConfig.isActive ? (
              <Button variant="destructive" onClick={stopAutomation}>
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
            ) : (
              <Button onClick={startAutomation}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar
              </Button>
            )}
          </div>
        </div>

        {dispatchConfig.isActive && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{selectedClients.length > 0 ? selectedClients.length : eligibleClients.length}</p>
              <p className="text-xs text-muted-foreground">Clientes pendentes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {connectedSenders.length > 0
                  ? connectedSenders[currentSenderIndex % connectedSenders.length]?.name
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground">Remetente atual</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{dispatchCountForCurrentSender}/{dispatchConfig.dispatchesPerNumber}</p>
              <p className="text-xs text-muted-foreground">Disparos do número</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{dispatchLogs.length}</p>
              <p className="text-xs text-muted-foreground">Total disparados</p>
            </div>
          </div>
        )}
      </div>

      {/* Seleção de Clientes */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Clientes para Disparo</h3>
            {selectedClients.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {selectedClients.length} selecionados
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedClients.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClients([])}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClientSelector(!showClientSelector)}
            >
              {showClientSelector ? 'Ocultar' : 'Selecionar Clientes'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {selectedClients.length === 0
            ? `${eligibleClients.length} clientes elegíveis serão disparados automaticamente`
            : `${selectedClients.length} clientes selecionados para disparo`
          }
        </p>

        {showClientSelector && (
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                {filteredClients.every(c => selectedClients.includes(c.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado
                </p>
              ) : (
                filteredClients.map((client) => {
                  const name = getClientName(client)
                  const phone = getClientPhone(client)
                  const isSelected = selectedClients.includes(client.id)

                  return (
                    <button
                      key={client.id}
                      onClick={() => toggleClientSelection(client.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{name}</span>
                        <span className="text-xs text-muted-foreground">{formatPhone(phone)}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Números Remetentes */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Seus Números (Remetentes)</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione seus números de WhatsApp e conecte-os para fazer disparos.
          </p>

          <div className="space-y-2 mb-4">
            <Input
              placeholder="Nome do remetente (ex: Vendas 1)"
              value={newSenderName}
              onChange={(e) => setNewSenderName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="(00) 00000-0000"
                value={newSenderNumber}
                onChange={(e) => setNewSenderNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSenderNumber()}
              />
              <Button onClick={addSenderNumber}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dispatchConfig.senderNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum número adicionado
              </p>
            ) : (
              dispatchConfig.senderNumbers.map((sender, index) => (
                <div
                  key={sender.phone}
                  className={`flex items-center justify-between p-3 rounded-md border ${sender.connected
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-muted/50 border-border'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {sender.connected ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{sender.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{formatPhone(sender.phone)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sender.connected ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {sender.dispatchCount} enviados
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectSender(sender.phone)}
                          disabled={dispatchConfig.isActive}
                        >
                          <WifiOff className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectSender(sender.phone)}
                        disabled={isConnecting === sender.phone || dispatchConfig.isActive}
                      >
                        {isConnecting === sender.phone ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Wifi className="w-4 h-4 mr-1" />
                            Conectar
                          </>
                        )}
                      </Button>
                    )}
                    <button
                      onClick={() => removeSenderNumber(sender.phone)}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={dispatchConfig.isActive}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Configurações */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Configurações</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remetente para disparos</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dispatchConfig.selectedSenderIndex}
                onChange={(e) => setDispatchConfig(prev => ({ ...prev, selectedSenderIndex: parseInt(e.target.value) }))}
                disabled={dispatchConfig.isActive}
              >
                <option value={-1}>Rotacionar automaticamente</option>
                {connectedSenders.map((sender, index) => (
                  <option key={sender.phone} value={index}>
                    {sender.name} ({formatPhone(sender.phone)})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Escolha qual número usar ou deixe rotacionar automaticamente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Disparos por número</Label>
              <Input
                type="number"
                value={dispatchConfig.numbersPerDispatch}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(20, parseInt(e.target.value) || 5))
                  setDispatchConfig(prev => ({ ...prev, numbersPerDispatch: value }))
                }}
                disabled={dispatchConfig.isActive}
                min={1}
                max={20}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade de disparos antes de trocar para o próximo número
              </p>
            </div>

            <div className="space-y-2">
              <Label>Intervalo entre disparos</Label>
              <div className="flex gap-2 flex-wrap">
                {INTERVAL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDispatchConfig({ interval: option.value })}
                    disabled={dispatchConfig.isActive}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${dispatchConfig.interval === option.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 border-border hover:border-muted-foreground/50'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Números por disparo</Label>
              <Input
                type="number"
                value={dispatchConfig.numbersPerDispatch}
                onChange={(e) => setDispatchConfig({ numbersPerDispatch: parseInt(e.target.value) || 5 })}
                disabled={dispatchConfig.isActive}
                min={1}
                max={20}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade de clientes que receberão mensagem a cada ciclo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensagens de Disparo */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Mensagens de Disparo</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Adicione múltiplas mensagens. O sistema escolhe aleatoriamente para evitar banimento.
          Use {'{nome}'} para inserir o nome do cliente.
        </p>

        <div className="flex gap-2 mb-4">
          <Textarea
            placeholder="Digite sua mensagem aqui... Use {nome} para personalizar"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[80px]"
          />
          <Button onClick={addMessage} className="self-end">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {dispatchConfig.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem adicionada
            </p>
          ) : (
            dispatchConfig.messages.map((message, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-md border border-border"
              >
                <p className="text-sm flex-1 whitespace-pre-wrap">{message}</p>
                <button
                  onClick={() => removeMessage(index)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  disabled={dispatchConfig.isActive}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Histórico de Disparos */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Histórico de Disparos</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Ocultar' : 'Mostrar'} ({dispatchLogs.length})
            </Button>
            {dispatchLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearDispatchLogs}
                disabled={dispatchConfig.isActive}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {showLogs && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dispatchLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum disparo realizado ainda
              </p>
            ) : (
              dispatchLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'sent' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{log.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(log.clientPhone)} - via {formatPhone(log.senderNumber)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
