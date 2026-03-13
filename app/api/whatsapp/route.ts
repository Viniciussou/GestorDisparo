import { NextRequest, NextResponse } from 'next/server'

// URL do servidor Baileys externo (se estiver rodando)
const BAILEYS_SERVER_URL = process.env.BAILEYS_SERVER_URL

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
async function tryBaileysServer(endpoint: string, options: RequestInit = {}) {
  try {
    const url = `${BAILEYS_SERVER_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SERVER_SECRET}`,
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log("Baileys error response:", errorText)
      return null
    }

    return await response.json()

  } catch (error) {
    console.log("Baileys server error:", error)
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
      const baileysResult = await tryBaileysServer(`/api/sessions/connect`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000', // Default user UUID
          phone_number: phoneNumber
        })
      })

      if (baileysResult) {
        // Baileys server está ativo, usar resultado dele
        console.log('Connect Baileys result:', baileysResult)

        sessions.set(phoneNumber, {
          connected: baileysResult.connected || false,
          qrCode: baileysResult.qr_code || null,
          phoneNumber,
          lastActivity: new Date()
        })

        return NextResponse.json({
          success: true,
          message: baileysResult.message,
          data: {
            session_id: baileysResult.session_id,
            qr_code: baileysResult.qr_code,
            qr: baileysResult.qr_code,
            connected: baileysResult.connected
          },
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

    if (action === 'get_qr') {
      const { sessionId } = body

      if (!sessionId) {
        return NextResponse.json({
          success: false,
          error: 'sessionId é obrigatório'
        }, { status: 400 })
      }

      // Tentar obter QR via Baileys
      const baileysResult = await tryBaileysServer(`/api/sessions/${sessionId}`)

      console.log('QR polling result:', { sessionId, baileysResult })

      if (baileysResult && baileysResult.qr_code) {
        return NextResponse.json({
          success: true,
          data: {
            session_id: sessionId,
            qr_code: baileysResult.qr_code,
            qr: baileysResult.qr_code
          }
        })
      }

      // QR ainda não pronto, retornar session_id para continuar polling
      return NextResponse.json({
        success: true,
        data: {
          session_id: sessionId,
          qr_code: null
        }
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
      await tryBaileysServer(`/api/sessions/${phoneNumber}/disconnect`, {
        method: 'POST'
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
      const baileysResult = await tryBaileysServer('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          session_id: senderNumber,
          to,
          message
        })
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
