import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Contact, PaginatedResponse, ImportContactsRequest } from '@/lib/types'

// GET /api/contacts - List all contacts
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
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (search) {
      query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }

    if (tags && tags.length > 0) {
      query = query.contains('tags', tags)
    }
    
    const { data: contacts, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<Contact> = {
      data: contacts || [],
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

// POST /api/contacts - Create a new contact or bulk import
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body = await request.json()
    
    // Check if this is a bulk import
    if (body.contacts && Array.isArray(body.contacts)) {
      const importRequest: ImportContactsRequest = body
      
      if (importRequest.contacts.length === 0) {
        return NextResponse.json({ error: 'Validation error', message: 'No contacts to import' }, { status: 400 })
      }

      if (importRequest.contacts.length > 10000) {
        return NextResponse.json({ error: 'Limit exceeded', message: 'Maximum 10,000 contacts per import' }, { status: 400 })
      }

      // Normalize phone numbers and prepare contacts
      const contactsToInsert = importRequest.contacts.map(contact => ({
        user_id: user.id,
        phone: contact.phone.replace(/\D/g, ''),
        name: contact.name || null,
        email: contact.email || null,
        tags: contact.tags || [],
        custom_fields: contact.custom_fields || {},
        status: 'active' as const
      }))

      // Filter out duplicates within the import batch
      const uniquePhones = new Set<string>()
      const uniqueContacts = contactsToInsert.filter(contact => {
        if (uniquePhones.has(contact.phone)) return false
        uniquePhones.add(contact.phone)
        return true
      })

      // Get existing phones to avoid duplicates
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('phone')
        .eq('user_id', user.id)
        .in('phone', uniqueContacts.map(c => c.phone))

      const existingPhones = new Set(existingContacts?.map(c => c.phone) || [])
      const newContacts = uniqueContacts.filter(c => !existingPhones.has(c.phone))

      if (newContacts.length === 0) {
        return NextResponse.json({ 
          success: true, 
          data: { 
            imported: 0, 
            duplicates: uniqueContacts.length,
            message: 'All contacts already exist'
          } 
        })
      }

      // Insert in batches of 1000
      const batchSize = 1000
      let totalImported = 0

      for (let i = 0; i < newContacts.length; i += batchSize) {
        const batch = newContacts.slice(i, i + batchSize)
        const { error: insertError, count } = await supabase
          .from('contacts')
          .insert(batch)
          .select('id', { count: 'exact', head: true })

        if (insertError) {
          console.error('Error importing contacts batch:', insertError)
        } else {
          totalImported += count || batch.length
        }
      }

      return NextResponse.json({ 
        success: true, 
        data: { 
          imported: totalImported, 
          duplicates: uniqueContacts.length - newContacts.length + (importRequest.contacts.length - uniqueContacts.length),
          total_processed: importRequest.contacts.length
        } 
      }, { status: 201 })
    }

    // Single contact creation
    if (!body.phone) {
      return NextResponse.json({ error: 'Validation error', message: 'phone is required' }, { status: 400 })
    }

    const normalizedPhone = body.phone.replace(/\D/g, '')

    // Check for duplicate
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (existingContact) {
      return NextResponse.json({ error: 'Duplicate error', message: 'A contact with this phone number already exists' }, { status: 409 })
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        phone: normalizedPhone,
        name: body.name || null,
        email: body.email || null,
        tags: body.tags || [],
        custom_fields: body.custom_fields || {},
        status: 'active'
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating contact:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: contact }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/contacts - Bulk delete contacts
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body = await request.json()
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'Validation error', message: 'ids array is required' }, { status: 400 })
    }

    const { error, count } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', user.id)
      .in('id', body.ids)

    if (error) {
      console.error('Error deleting contacts:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { deleted: count || body.ids.length } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
