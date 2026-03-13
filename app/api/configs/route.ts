import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { DispatchConfig, PaginatedResponse } from '@/lib/types'

// GET /api/configs - List dispatch configurations
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
    
    const { data: configs, error, count } = await supabase
      .from('dispatch_configs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching configs:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<DispatchConfig> = {
      data: configs || [],
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

// POST /api/configs - Create a new configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body = await request.json()
    
    if (!body.name) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'name is required' 
      }, { status: 400 })
    }

    // Validate numeric fields
    const numericFields = ['messages_per_session_per_day', 'min_delay_seconds', 'max_delay_seconds']
    for (const field of numericFields) {
      if (body[field] !== undefined && (typeof body[field] !== 'number' || body[field] < 0)) {
        return NextResponse.json({ 
          error: 'Validation error', 
          message: `${field} must be a positive number` 
        }, { status: 400 })
      }
    }

    // Validate time fields
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (body.active_hours_start && !timeRegex.test(body.active_hours_start)) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'active_hours_start must be in HH:MM format' 
      }, { status: 400 })
    }
    if (body.active_hours_end && !timeRegex.test(body.active_hours_end)) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'active_hours_end must be in HH:MM format' 
      }, { status: 400 })
    }

    // Validate days_of_week
    if (body.days_of_week) {
      if (!Array.isArray(body.days_of_week) || 
          body.days_of_week.some((d: number) => typeof d !== 'number' || d < 0 || d > 6)) {
        return NextResponse.json({ 
          error: 'Validation error', 
          message: 'days_of_week must be an array of numbers 0-6' 
        }, { status: 400 })
      }
    }

    const { data: config, error } = await supabase
      .from('dispatch_configs')
      .insert({
        user_id: user.id,
        name: body.name,
        messages_per_session_per_day: body.messages_per_session_per_day || 30,
        min_delay_seconds: body.min_delay_seconds || 10,
        max_delay_seconds: body.max_delay_seconds || 60,
        active_hours_start: body.active_hours_start || '08:00',
        active_hours_end: body.active_hours_end || '20:00',
        days_of_week: body.days_of_week || [1, 2, 3, 4, 5],
        auto_rotate_sessions: body.auto_rotate_sessions !== false,
        pause_on_response: body.pause_on_response !== false,
        is_active: body.is_active !== false
      })
      .select()
      .maybeSingle()
      
    if (error) {
      console.error('Error creating config:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: config }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
