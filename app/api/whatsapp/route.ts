import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const BAILEYS_SERVER_URL = process.env.BAILEYS_SERVER_URL
const BAILEYS_SERVER_SECRET = process.env.BAILEYS_SERVER_SECRET

// armazenamento local fallback
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

async function tryBaileysServer(endpoint: string, options: RequestInit = {}) {

  if (!BAILEYS_SERVER_URL) {
    console.error("[Baileys] BAILEYS_SERVER_URL não configurado");
    return null
  }

  try {

    const url = `${BAILEYS_SERVER_URL}${endpoint}`
    console.log("[Baileys] Fazendo requisição para:", url, "com método:", options.method || "GET")

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BAILEYS_SERVER_SECRET}`,
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Baileys] Erro ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    console.log("[Baileys] Resposta OK:", data)
    return data

  } catch (error) {
    console.error("[Baileys] Erro ao conectar:", error)
    return null
  }
}

// GET
export async function GET(request: NextRequest) {

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (action === 'status') {

    const phoneNumber = searchParams.get('phone')

    if (phoneNumber) {

      const session = sessions.get(phoneNumber)

      return NextResponse.json({
        success: true,
        session
      })
    }

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
    message: "WhatsApp API rodando"
  })
}

// POST
export async function POST(request: NextRequest) {

  try {

    const body = await request.json()

    const {
      action,
      phoneNumber,
      sessionId,
      to,
      message,
      senderNumber
    } = body

    console.log("[WhatsApp API] Ação:", action, "Dados:", { phoneNumber, sessionId, to, senderNumber })

    // CONNECT
    if (action === "connect") {

      const actualSessionId = sessionId || phoneNumber || randomUUID()

      const baileysResult = await tryBaileysServer(`/api/sessions/connect`, {
        method: "POST",
        body: JSON.stringify({
          session_id: actualSessionId,
          phone_number: phoneNumber,
          user_id: "550e8400-e29b-41d4-a716-446655440000"
        })
      })

      if (baileysResult) {

        sessions.set(actualSessionId, {
          connected: false,
          qrCode: baileysResult.qr || baileysResult.data?.qr_code,
          phoneNumber,
          lastActivity: new Date()
        })

        return NextResponse.json({
          success: true,
          qr: baileysResult.qr || baileysResult.data?.qr_code,
          sessionId: actualSessionId
        })
      }

      return NextResponse.json({
        success: false,
        error: "Erro ao conectar Baileys"
      }, { status: 400 })
    }

    // GET QR
    if (action === "get_qr") {

      const result = await tryBaileysServer(`/api/status?phone=${sessionId}`)

      if (result && result.session) {
        return NextResponse.json({
          success: true,
          data: {
            qr_code: result.session.qrCode,
            connected: result.session.connected
          }
        })
      }

      return NextResponse.json({
        success: false,
        error: "Sessão não encontrada"
      }, { status: 404 })
    }

    // DISCONNECT
    if (action === "disconnect") {

      // Limpa a sessão local
      // Nota: O Baileys Server mantém a sessão ativa
      // Para desconectar completamente, escaneie QR novamente
      sessions.delete(phoneNumber)

      return NextResponse.json({
        success: true,
        message: "Sessão removida localmente. Para desconectar do WhatsApp, reconecte com novo QR."
      })
    }

    // SEND MESSAGE
    if (action === "send") {

      const result = await tryBaileysServer(`/api/messages/send`, {
        method: "POST",
        body: JSON.stringify({
          phone: senderNumber,
          to,
          message
        })
      })

      if (result && result.success) {

        return NextResponse.json({
          success: true,
          data: result
        })
      }

      return NextResponse.json({
        success: false,
        error: "Erro ao enviar mensagem"
      }, { status: 400 })
    }

    // BULK SEND
    if (action === "send-bulk") {

      const { recipients, messages, senderNumbers } = body

      const result = await tryBaileysServer(`/api/send-bulk`, {
        method: "POST",
        body: JSON.stringify({
          recipients,
          messages,
          senders: senderNumbers
        })
      })

      if (result && result.success) {

        return NextResponse.json({
          success: true,
          data: result
        })
      }

      return NextResponse.json({
        success: false,
        error: "Erro ao enviar mensagens em massa"
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: "Ação inválida"
    })

  } catch (error) {

    console.error("[WhatsApp API] Erro interno:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro interno",
      details: process.env.NODE_ENV === "development" ? error : undefined
    }, { status: 500 })
  }
}