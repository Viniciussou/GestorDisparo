import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Message, PaginatedResponse, SendMessageRequest } from '@/lib/types'

// GET /api/messages - List messages with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    const sessionId = searchParams.get('session_id')
    const contactId = searchParams.get('contact_id')
    const remoteJid = searchParams.get('remote_jid')
    const direction = searchParams.get('direction')
    const status = searchParams.get('status')
    
    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    if (remoteJid) {
      query = query.eq('remote_jid', remoteJid)
    }
    
    if (direction) {
      query = query.eq('direction', direction)
    }

    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: messages, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<Message> = {
      data: messages || [],
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body: SendMessageRequest = await request.json()
    
    if (!body.session_id || !body.to || !body.message) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'session_id, to, and message are required' 
      }, { status: 400 })
    }

    // Verify session belongs to user and is connected
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', body.session_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not found', message: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'connected') {
      return NextResponse.json({ 
        error: 'Session not connected', 
        message: 'The WhatsApp session is not connected' 
      }, { status: 400 })
    }

    // Check daily message limit
    const { data: profile } = await supabase
      .from('profiles')
      .select('max_messages_per_day')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && session.daily_message_count >= profile.max_messages_per_day) {
      return NextResponse.json({ 
        error: 'Limit exceeded', 
        message: `Daily message limit reached (${profile.max_messages_per_day})` 
      }, { status: 429 })
    }

    // Normalize phone number and create JID
    const normalizedPhone = body.to.replace(/\D/g, '')
    const remoteJid = `${normalizedPhone}@s.whatsapp.net`

    // Find or create contact
    let contact = null
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (existingContact) {
      contact = existingContact
      // Update last contact time
      await supabase
        .from('contacts')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', contact.id)
    }

    // Create message record
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        session_id: body.session_id,
        contact_id: contact?.id || null,
        remote_jid: remoteJid,
        message_id: messageId,
        direction: 'outgoing',
        content: body.message,
        media_url: body.media_url || null,
        status: 'pending'
      })
      .select()
      .maybeSingle()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Database error', message: messageError.message }, { status: 500 })
    }

    // Send to Baileys server
    const baileysServerUrl = process.env.BAILEYS_SERVER_URL
    if (!baileysServerUrl) {
      await supabase
        .from('messages')
        .update({ status: 'failed', error_message: 'Baileys server not configured' })
        .eq('id', message.id)
      
      return NextResponse.json({ 
        error: 'Configuration error', 
        message: 'WhatsApp server not configured' 
      }, { status: 500 })
    }

    try {
      const response = await fetch(`${baileysServerUrl}/api/messages/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BAILEYS_SERVER_SECRET}`
        },
        body: JSON.stringify({
          session_id: body.session_id,
          to: remoteJid,
          message: body.message,
          media_url: body.media_url,
          message_db_id: message.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        await supabase
          .from('messages')
          .update({ status: 'failed', error_message: errorData.message || 'Failed to send' })
          .eq('id', message.id)
        
        return NextResponse.json({ 
          error: 'Send error', 
          message: errorData.message || 'Failed to send message' 
        }, { status: response.status })
      }

      const responseData = await response.json()
      
      // Update message with actual WhatsApp message ID
      if (responseData.wa_message_id) {
        await supabase
          .from('messages')
          .update({ message_id: responseData.wa_message_id, status: 'sent' })
          .eq('id', message.id)
      }

      // Increment daily message count
      await supabase
        .from('whatsapp_sessions')
        .update({ 
          daily_message_count: session.daily_message_count + 1,
          last_message_at: new Date().toISOString()
        })
        .eq('id', body.session_id)

      return NextResponse.json({ 
        success: true, 
        data: { 
          ...message, 
          message_id: responseData.wa_message_id || messageId,
          status: 'sent'
        } 
      }, { status: 201 })
    } catch (e) {
      console.error('Failed to send message:', e)
      await supabase
        .from('messages')
        .update({ status: 'failed', error_message: 'Connection error' })
        .eq('id', message.id)
      
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
