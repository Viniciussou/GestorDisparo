import { NextRequest, NextResponse } from 'next/server'

// URL do servidor Baileys externo (se estiver rodando)
const BAILEYS_SERVER_URL = process.env.BAILEYS_SERVER_URL || 'http://localhost:3001'

// Armazenamento em memória para sessões e status (fallback)
const sessions: Map<string, {
  connected: boolean
  qrCode: string | null
  phoneNumber: string
  lastActivity: Date
}> = new Map()

const messageQueue: Array<{
  id: string
  to: string
  message: string
  senderNumber: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: Date
}> = []

// Tentar conectar ao servidor Baileys externo
async function tryBaileysServer(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(`${BAILEYS_SERVER_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })
    
    if (response.ok) {
      return await response.json()
    }
    return null
  } catch {
    return null
  }
}

// GET - Verificar status das sessões
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  
  if (action === 'status') {
    const phoneNumber = searchParams.get('phone')
    if (phoneNumber) {
      const session = sessions.get(phoneNumber)
      return NextResponse.json({
        success: true,
        session: session || null
      })
    }
    
    // Retornar todas as sessões
    const allSessions = Array.from(sessions.entries()).map(([phone, data]) => ({
      phone,
      ...data
    }))
    
    return NextResponse.json({
      success: true,
      sessions: allSessions
    })
  }
  
  if (action === 'queue') {
    return NextResponse.json({
      success: true,
      queue: messageQueue.filter(m => m.status === 'pending'),
      sent: messageQueue.filter(m => m.status === 'sent').length,
      failed: messageQueue.filter(m => m.status === 'failed').length
    })
  }
  
  return NextResponse.json({
    success: true,
    message: 'WhatsApp API está rodando',
    availableActions: ['status', 'queue']
  })
}

// POST - Enviar mensagem ou conectar sessão
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, phoneNumber, to, message, senderNumber } = body
    
    if (action === 'connect') {
      if (!phoneNumber) {
        return NextResponse.json({
          success: false,
          error: 'Número de telefone é obrigatório'
        }, { status: 400 })
      }
      
      // Tentar conectar via servidor Baileys externo
      const baileysResult = await tryBaileysServer('/api/connect', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber })
      })
      
      if (baileysResult) {
        // Baileys server está ativo, usar resultado dele
        sessions.set(phoneNumber, {
          connected: baileysResult.connected || false,
          qrCode: baileysResult.qr || null,
          phoneNumber,
          lastActivity: new Date()
        })
        
        return NextResponse.json({
          success: true,
          message: baileysResult.message,
          qr: baileysResult.qr,
          qrImage: baileysResult.qrImage,
          connected: baileysResult.connected,
          usingBaileys: true
        })
      }
      
      // Fallback: simular conexão local
      sessions.set(phoneNumber, {
        connected: true,
        qrCode: null,
        phoneNumber,
        lastActivity: new Date()
      })
      
      return NextResponse.json({
        success: true,
        message: `Sessão conectada para ${phoneNumber} (modo simulado)`,
        session: sessions.get(phoneNumber),
        usingBaileys: false
      })
    }
    
    if (action === 'disconnect') {
      if (!phoneNumber) {
        return NextResponse.json({
          success: false,
          error: 'Número de telefone é obrigatório'
        }, { status: 400 })
      }
      
      // Tentar desconectar via Baileys
      await tryBaileysServer('/api/disconnect', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber })
      })
      
      sessions.delete(phoneNumber)
      
      return NextResponse.json({
        success: true,
        message: `Sessão desconectada para ${phoneNumber}`
      })
    }
    
    if (action === 'send') {
      if (!to || !message || !senderNumber) {
        return NextResponse.json({
          success: false,
          error: 'Campos obrigatórios: to, message, senderNumber'
        }, { status: 400 })
      }
      
      // Tentar enviar via Baileys
      const baileysResult = await tryBaileysServer('/api/send', {
        method: 'POST',
        body: JSON.stringify({ senderNumber, to, message })
      })
      
      if (baileysResult && baileysResult.success) {
        return NextResponse.json({
          success: true,
          messageId: `baileys_${Date.now()}`,
          message: `Mensagem enviada para ${to} via Baileys`
        })
      }
      
      // Fallback: simular envio
      const session = sessions.get(senderNumber)
      
      if (!session || !session.connected) {
        return NextResponse.json({
          success: false,
          error: `Número ${senderNumber} não está conectado`
        }, { status: 400 })
      }
      
      // Adicionar à fila simulada
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      messageQueue.push({
        id: messageId,
        to,
        message,
        senderNumber,
        status: 'sent',
        createdAt: new Date()
      })
      
      session.lastActivity = new Date()
      sessions.set(senderNumber, session)
      
      return NextResponse.json({
        success: true,
        messageId,
        message: `Mensagem enviada para ${to} (simulado)`
      })
    }
    
    if (action === 'send-bulk') {
      const { recipients, messages: bulkMessages, senderNumbers, dispatchesPerNumber } = body
      
      if (!recipients || !bulkMessages || !senderNumbers) {
        return NextResponse.json({
          success: false,
          error: 'Campos obrigatórios: recipients, messages, senderNumbers'
        }, { status: 400 })
      }
      
      // Tentar enviar via Baileys
      const baileysResult = await tryBaileysServer('/api/send-bulk', {
        method: 'POST',
        body: JSON.stringify({ recipients, messages: bulkMessages, senderNumbers, dispatchesPerNumber })
      })
      
      if (baileysResult && baileysResult.success) {
        return NextResponse.json({
          success: true,
          results: baileysResult.results,
          totalSent: baileysResult.totalSent,
          totalFailed: baileysResult.totalFailed
        })
      }
      
      // Fallback: simular envio em massa
      const results: Array<{
        to: string
        success: boolean
        messageId?: string
        error?: string
      }> = []
      
      let currentSenderIndex = 0
      let dispatchCount = 0
      const maxPerNumber = dispatchesPerNumber || 30
      
      for (const recipient of recipients) {
        const currentSender = senderNumbers[currentSenderIndex]
        const session = sessions.get(currentSender)
        
        if (!session || !session.connected) {
          results.push({
            to: recipient.phone,
            success: false,
            error: `Número ${currentSender} não está conectado`
          })
          continue
        }
        
        // Escolher mensagem aleatória
        const randomMessage = bulkMessages[Math.floor(Math.random() * bulkMessages.length)]
        const personalizedMessage = randomMessage.replace(/{nome}/gi, recipient.name || '')
        
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        
        messageQueue.push({
          id: messageId,
          to: recipient.phone,
          message: personalizedMessage,
          senderNumber: currentSender,
          status: 'sent',
          createdAt: new Date()
        })
        
        results.push({
          to: recipient.phone,
          success: true,
          messageId
        })
        
        dispatchCount++
        
        // Rotacionar número se atingir o limite
        if (dispatchCount >= maxPerNumber) {
          currentSenderIndex = (currentSenderIndex + 1) % senderNumbers.length
          dispatchCount = 0
        }
      }
      
      return NextResponse.json({
        success: true,
        results,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length
      })
    }
    
if (action === 'get-qr') {
    const { phoneNumber } = body
    
    if (!phoneNumber) {
      return NextResponse.json({
        success: false,
        error: 'phoneNumber é obrigatório'
      }, { status: 400 })
    }

    // Tentar obter QR code via Baileys
    const baileysResult = await tryBaileysServer(`/api/qr/${phoneNumber}`)
    
    if (baileysResult && baileysResult.success) {
      return NextResponse.json({
        success: true,
        qr: baileysResult.qr,
        qrImage: baileysResult.qrImage
      })
    }

    return NextResponse.json({
      success: false,
      error: 'QR Code não disponível'
    })
  }

    return NextResponse.json({
      success: false,
      error: 'Ação inválida'
    }, { status: 400 })
    
  } catch (error) {
    console.error('Erro na API WhatsApp:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
