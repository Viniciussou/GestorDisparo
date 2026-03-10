import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { DispatchLog, PaginatedResponse } from '@/lib/types'

// GET /api/dispatch/logs - List dispatch logs
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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    let query = supabase
      .from('dispatch_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (startDate) {
      query = query.gte('sent_at', startDate)
    }

    if (endDate) {
      query = query.lte('sent_at', endDate)
    }
    
    const { data: logs, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching dispatch logs:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<DispatchLog> = {
      data: logs || [],
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
