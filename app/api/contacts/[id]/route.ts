import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/contacts/[id] - Get a specific contact
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

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ error: 'Not found', message: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PATCH /api/contacts/[id] - Update a contact
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
    const allowedFields = ['name', 'email', 'tags', 'custom_fields', 'status']
    const updateData: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle phone update separately (needs normalization)
    if (body.phone) {
      const normalizedPhone = body.phone.replace(/\D/g, '')
      
      // Check for duplicate
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('phone', normalizedPhone)
        .neq('id', id)
        .single()

      if (existingContact) {
        return NextResponse.json({ error: 'Duplicate error', message: 'Another contact with this phone number already exists' }, { status: 409 })
      }

      updateData.phone = normalizedPhone
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Validation error', message: 'No valid fields to update' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    if (!contact) {
      return NextResponse.json({ error: 'Not found', message: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/contacts/[id] - Delete a contact
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
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting contact:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
