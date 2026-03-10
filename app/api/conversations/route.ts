import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/conversations - List all conversations (contacts with messages)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')

    // Get distinct remote_jids with their latest message
    let query = supabase
      .from('messages')
      .select(`
        remote_jid,
        content,
        direction,
        status,
        created_at,
        session_id,
        contact_id,
        contacts (
          id,
          phone,
          name,
          email,
          tags,
          status
        ),
        whatsapp_sessions (
          id,
          phone_number,
          name,
          status
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data: allMessages, error } = await query

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    // Group by remote_jid and get latest message + unread count
    const conversationsMap = new Map<string, {
      remote_jid: string
      contact: {
        id: string | null
        phone: string
        name: string | null
        email: string | null
        tags: string[]
        status: string
      }
      session: {
        id: string
        phone_number: string
        name: string
        status: string
      } | null
      last_message: {
        content: string
        direction: string
        status: string
        created_at: string
      }
      unread_count: number
    }>()

    for (const msg of allMessages || []) {
      if (!conversationsMap.has(msg.remote_jid)) {
        const phone = msg.remote_jid.replace('@s.whatsapp.net', '').replace('@g.us', '')
        
        conversationsMap.set(msg.remote_jid, {
          remote_jid: msg.remote_jid,
          contact: msg.contacts ? {
            id: msg.contacts.id,
            phone: msg.contacts.phone,
            name: msg.contacts.name,
            email: msg.contacts.email,
            tags: msg.contacts.tags || [],
            status: msg.contacts.status
          } : {
            id: null,
            phone,
            name: null,
            email: null,
            tags: [],
            status: 'active'
          },
          session: msg.whatsapp_sessions ? {
            id: msg.whatsapp_sessions.id,
            phone_number: msg.whatsapp_sessions.phone_number,
            name: msg.whatsapp_sessions.name,
            status: msg.whatsapp_sessions.status
          } : null,
          last_message: {
            content: msg.content,
            direction: msg.direction,
            status: msg.status,
            created_at: msg.created_at
          },
          unread_count: 0
        })
      }

      // Count unread incoming messages
      const conv = conversationsMap.get(msg.remote_jid)!
      if (msg.direction === 'incoming' && msg.status !== 'read') {
        conv.unread_count++
      }
    }

    // Convert to array and sort by last message time
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime())

    // Paginate
    const start = (page - 1) * perPage
    const paginatedConversations = conversations.slice(start, start + perPage)

    return NextResponse.json({
      data: paginatedConversations,
      total: conversations.length,
      page,
      per_page: perPage,
      total_pages: Math.ceil(conversations.length / perPage)
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
