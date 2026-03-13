import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { WhatsAppSession, CreateSessionRequest, PaginatedResponse } from '@/lib/types'

// GET /api/sessions - List all sessions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '10')
    const status = searchParams.get('status')

    let query = supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: sessions, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<WhatsAppSession> = {
      data: sessions || [],
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

// POST /api/sessions - Create a new WhatsApp session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    // Check user's plan limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('max_sessions')
      .eq('id', user.id)
      .maybeSingle()

    const { count: sessionCount } = await supabase
      .from('whatsapp_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (profile && sessionCount !== null && sessionCount >= profile.max_sessions) {
      return NextResponse.json({
        error: 'Limit exceeded',
        message: `You have reached your maximum number of sessions (${profile.max_sessions})`
      }, { status: 403 })
    }

    const body: CreateSessionRequest = await request.json()

    if (!body.phone_number || !body.name) {
      return NextResponse.json({
        error: 'Validation error',
        message: 'phone_number and name are required'
      }, { status: 400 })
    }

    // Normalize phone number
    // Normalize phone number
    const normalizedPhone = body.phone_number.replace(/\D/g, '')

    // Check if phone already exists globally
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .maybeSingle()

    if (existingSession) {
      return NextResponse.json(
        {
          error: 'Session exists',
          message: 'Este número já possui uma sessão ativa'
        },
        { status: 409 }
      )
    }

    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        user_id: user.id,
        phone_number: normalizedPhone,
        name: body.name,
        status: 'disconnected'
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    // Notify Baileys server to initialize this session
    const baileysServerUrl = process.env.BAILEYS_SERVER_URL
    if (baileysServerUrl) {
      try {
        await fetch(`${baileysServerUrl}/api/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BAILEYS_SERVER_SECRET}`
          },
          body: JSON.stringify({ session_id: session.id, user_id: user.id, phone_number: normalizedPhone })
        })
      } catch (e) {
        console.error('Failed to notify Baileys server:', e)
      }
    }

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
