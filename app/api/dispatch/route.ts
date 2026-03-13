import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { BulkDispatchRequest, PaginatedResponse, DispatchQueueItem } from '@/lib/types'

// GET /api/dispatch - List dispatch queue items
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
    const status = searchParams.get('status')
    const sessionId = searchParams.get('session_id')
    
    let query = supabase
      .from('dispatch_queue')
      .select('*, contacts(phone, name), whatsapp_sessions(phone_number, name)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true })
    
    if (status) {
      query = query.eq('status', status)
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data: items, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching dispatch queue:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<DispatchQueueItem> = {
      data: items || [],
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

// POST /api/dispatch - Create bulk dispatch (add to queue)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body: BulkDispatchRequest = await request.json()
    
    // Validate request
    if (!body.session_ids || body.session_ids.length === 0) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'At least one session_id is required' 
      }, { status: 400 })
    }

    if (!body.contact_ids || body.contact_ids.length === 0) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'At least one contact_id is required' 
      }, { status: 400 })
    }

    if (!body.message_content && !body.template_id) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'Either message_content or template_id is required' 
      }, { status: 400 })
    }

    // Get message content from template if provided
    let messageContent = body.message_content || ''
    if (body.template_id) {
      const { data: template } = await supabase
        .from('message_templates')
        .select('content')
        .eq('id', body.template_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!template) {
        return NextResponse.json({ 
          error: 'Not found', 
          message: 'Template not found or inactive' 
        }, { status: 404 })
      }
      messageContent = template.content
    }

    // Verify sessions belong to user and are connected
    const { data: sessions, error: sessionsError } = await supabase
      .from('whatsapp_sessions')
      .select('id, status, daily_message_count')
      .eq('user_id', user.id)
      .in('id', body.session_ids)
      .eq('status', 'connected')

    if (sessionsError || !sessions || sessions.length === 0) {
      return NextResponse.json({ 
        error: 'No connected sessions', 
        message: 'No connected WhatsApp sessions found' 
      }, { status: 400 })
    }

    // Verify contacts belong to user
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', body.contact_ids)
      .eq('status', 'active')

    if (contactsError || !contacts || contacts.length === 0) {
      return NextResponse.json({ 
        error: 'No contacts', 
        message: 'No active contacts found' 
      }, { status: 400 })
    }

    // Get dispatch config
    let config = {
      messages_per_session_per_day: 30,
      min_delay_seconds: 10,
      max_delay_seconds: 60,
      active_hours_start: '08:00',
      active_hours_end: '20:00'
    }

    if (body.config_id) {
      const { data: userConfig } = await supabase
        .from('dispatch_configs')
        .select('*')
        .eq('id', body.config_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (userConfig) {
        config = userConfig
      }
    } else {
      // Get default config
      const { data: defaultConfig } = await supabase
        .from('dispatch_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (defaultConfig) {
        config = defaultConfig
      }
    }

    // Calculate scheduled times with rate limiting
    const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : new Date()
    const queueItems: Partial<DispatchQueueItem>[] = []
    
    // Distribute contacts across sessions with delays
    const contactIds = contacts.map(c => c.id)
    const sessionIds = sessions.map(s => s.id)
    
    let currentTime = scheduledAt.getTime()
    let sessionIndex = 0
    const sessionMessageCounts: Record<string, number> = {}
    
    // Initialize session message counts
    for (const session of sessions) {
      sessionMessageCounts[session.id] = session.daily_message_count || 0
    }

    for (let i = 0; i < contactIds.length; i++) {
      const contactId = contactIds[i]
      
      // Find next available session (round-robin with daily limit check)
      let attempts = 0
      while (attempts < sessionIds.length) {
        const sessionId = sessionIds[sessionIndex]
        
        if (sessionMessageCounts[sessionId] < config.messages_per_session_per_day) {
          // Add random delay between min and max
          const delay = Math.floor(
            Math.random() * (config.max_delay_seconds - config.min_delay_seconds) + config.min_delay_seconds
          ) * 1000

          queueItems.push({
            user_id: user.id,
            session_id: sessionId,
            contact_id: contactId,
            template_id: body.template_id || null,
            message_content: messageContent,
            priority: 5,
            status: 'pending',
            scheduled_at: new Date(currentTime).toISOString(),
            attempts: 0,
            max_attempts: 3
          })

          sessionMessageCounts[sessionId]++
          currentTime += delay
          break
        }

        sessionIndex = (sessionIndex + 1) % sessionIds.length
        attempts++
      }

      // Move to next session for round-robin
      sessionIndex = (sessionIndex + 1) % sessionIds.length

      // If all sessions are at limit, we can't schedule more
      if (attempts >= sessionIds.length) {
        console.warn(`All sessions at daily limit, skipping remaining contacts`)
        break
      }
    }

    if (queueItems.length === 0) {
      return NextResponse.json({ 
        error: 'Limit exceeded', 
        message: 'All sessions have reached their daily message limit' 
      }, { status: 429 })
    }

    // Insert queue items in batches
    const batchSize = 500
    let totalQueued = 0

    for (let i = 0; i < queueItems.length; i += batchSize) {
      const batch = queueItems.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('dispatch_queue')
        .insert(batch)
        .select('id')

      if (insertError) {
        console.error('Error inserting dispatch queue batch:', insertError)
      } else {
        totalQueued += batch.length
      }
    }

    // Notify Baileys server to start processing bulk sends
    const baileysServerUrl = process.env.BAILEYS_SERVER_URL
    if (baileysServerUrl) {
      try {
        await fetch(`${baileysServerUrl}/api/send-bulk`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BAILEYS_SERVER_SECRET}`
          },
          body: JSON.stringify({ 
            session_ids: body.session_ids,
            contact_ids: body.contact_ids,
            user_id: user.id 
          })
        })
      } catch (e) {
        console.error('Failed to notify Baileys server:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        queued: totalQueued,
        total_contacts: contactIds.length,
        sessions_used: sessionIds.length,
        estimated_completion: new Date(currentTime).toISOString()
      } 
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/dispatch - Cancel pending dispatches
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const ids = searchParams.get('ids')?.split(',').filter(Boolean)
    const cancelAll = searchParams.get('cancel_all') === 'true'

    if (!ids && !cancelAll) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'Either ids or cancel_all=true is required' 
      }, { status: 400 })
    }

    let query = supabase
      .from('dispatch_queue')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])

    if (ids && !cancelAll) {
      query = query.in('id', ids)
    }

    const { error, count } = await query

    if (error) {
      console.error('Error cancelling dispatches:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { cancelled: count || 0 } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
