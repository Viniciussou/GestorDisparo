import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/configs/[id] - Get a specific config
export async function GET(
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

    const { data: config, error } = await supabase
      .from('dispatch_configs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !config) {
      return NextResponse.json({ error: 'Not found', message: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PATCH /api/configs/[id] - Update a config
export async function PATCH(
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

    const body = await request.json()
    const allowedFields = [
      'name', 'messages_per_session_per_day', 'min_delay_seconds', 'max_delay_seconds',
      'active_hours_start', 'active_hours_end', 'days_of_week', 'auto_rotate_sessions',
      'pause_on_response', 'is_active'
    ]
    
    const updateData: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Validation error', message: 'No valid fields to update' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data: config, error } = await supabase
      .from('dispatch_configs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating config:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    if (!config) {
      return NextResponse.json({ error: 'Not found', message: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/configs/[id] - Delete a config
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

    const { error } = await supabase
      .from('dispatch_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting config:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
