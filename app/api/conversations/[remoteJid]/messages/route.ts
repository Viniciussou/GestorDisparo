import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/conversations/[remoteJid]/messages - Get messages for a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ remoteJid: string }> }
) {
  try {
    const { remoteJid } = await params
    const decodedJid = decodeURIComponent(remoteJid)
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    const sessionId = searchParams.get('session_id')

    let query = supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('remote_jid', decodedJid)
      .order('created_at', { ascending: false })

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data: messages, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    // Mark incoming messages as read
    await supabase
      .from('messages')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('remote_jid', decodedJid)
      .eq('direction', 'incoming')
      .neq('status', 'read')

    return NextResponse.json({
      data: (messages || []).reverse(), // Return in chronological order
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
