import { NextRequest, NextResponse } from 'next/server'

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
    console.log("BAILEYS_SERVER_URL não configurado")
    return null
  }

  try {

    const url = `${BAILEYS_SERVER_URL}${endpoint}`

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
      console.log("Baileys error response:", errorText)
      return null
    }

    return await response.json()

  } catch (error) {
    console.log("Erro ao conectar Baileys:", error)
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

    // CONNECT
    if (action === "connect") {

      const baileysResult = await tryBaileysServer(`/api/connect`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: phoneNumber,
          userId: "550e8400-e29b-41d4-a716-446655440000"
        })
      })

      if (baileysResult) {

        sessions.set(phoneNumber, {
          connected: false,
          qrCode: baileysResult.qr,
          phoneNumber,
          lastActivity: new Date()
        })

        return NextResponse.json({
          success: true,
          qr: baileysResult.qr,
          sessionId: phoneNumber
        })
      }

      return NextResponse.json({
        success: false,
        error: "Erro ao conectar Baileys"
      })
    }

    // GET QR
    if (action === "get_qr") {

      const result = await tryBaileysServer(`/api/sessions/${sessionId}`)

      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // DISCONNECT
    if (action === "disconnect") {

      await tryBaileysServer(`/api/disconnect`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: phoneNumber
        })
      })

      sessions.delete(phoneNumber)

      return NextResponse.json({
        success: true
      })
    }

    // SEND MESSAGE
    if (action === "send") {

      const result = await tryBaileysServer(`/api/send`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: senderNumber,
          to,
          message
        })
      })

      if (result) {

        return NextResponse.json({
          success: true
        })
      }

      return NextResponse.json({
        success: false
      })
    }

    // BULK SEND
    if (action === "send-bulk") {

      const { recipients, messages, senderNumbers } = body

      const result = await tryBaileysServer(`/api/send-bulk`, {
        method: "POST",
        body: JSON.stringify({
          recipients,
          messages,
          senderNumbers
        })
      })

      if (result) {

        return NextResponse.json(result)
      }

      return NextResponse.json({
        success: false
      })
    }

    return NextResponse.json({
      success: false,
      error: "Ação inválida"
    })

  } catch (error) {

    console.error("Erro API WhatsApp:", error)

    return NextResponse.json({
      success: false,
      error: "Erro interno"
    }, { status: 500 })
  }
}