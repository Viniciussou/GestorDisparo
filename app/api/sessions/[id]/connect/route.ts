import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/sessions/[id]/connect - Request connection (generates QR code)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not found', message: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'connected') {
      return NextResponse.json({ error: 'Already connected', message: 'Session is already connected' }, { status: 400 })
    }

    // Update status to connecting
    await supabase
      .from('whatsapp_sessions')
      .update({ status: 'connecting', updated_at: new Date().toISOString() })
      .eq('id', id)

    // Request Baileys server to generate QR code
    const baileysServerUrl = process.env.BAILEYS_SERVER_URL
    if (!baileysServerUrl) {
      return NextResponse.json({ 
        error: 'Configuration error', 
        message: 'Baileys server URL not configured' 
      }, { status: 500 })
    }

    try {
      const response = await fetch(`${baileysServerUrl}/api/sessions/${id}/connect`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BAILEYS_SERVER_SECRET}`
        },
        body: JSON.stringify({ 
          session_id: id, 
          user_id: user.id,
          phone_number: session.phone_number
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return NextResponse.json({ 
          error: 'Baileys error', 
          message: errorData.message || 'Failed to initialize connection' 
        }, { status: response.status })
      }

      const data = await response.json()
      return NextResponse.json({ 
        success: true, 
        data: { 
          session_id: id,
          status: 'connecting',
          qr_code: data.qr_code || null
        } 
      })
    } catch (e) {
      console.error('Failed to connect to Baileys server:', e)
      return NextResponse.json({ 
        error: 'Connection error', 
        message: 'Failed to connect to WhatsApp server' 
      }, { status: 503 })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/sessions/[id]/connect - Disconnect session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)

    if (!session) {
      return NextResponse.json({ error: 'Not found', message: 'Session not found' }, { status: 404 })
    }

    // Notify Baileys server to disconnect
    const baileysServerUrl = process.env.BAILEYS_SERVER_URL
    if (baileysServerUrl) {
      try {
        await fetch(`${baileysServerUrl}/api/sessions/${id}/disconnect`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BAILEYS_SERVER_SECRET}`
          }
        })
      } catch (e) {
        console.error('Failed to notify Baileys server:', e)
      }
    }

    // Update session status
    await supabase
      .from('whatsapp_sessions')
      .update({ 
        status: 'disconnected', 
        qr_code: null,
        auth_state: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)

    return NextResponse.json({ success: true, data: { session_id: id, status: 'disconnected' } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
