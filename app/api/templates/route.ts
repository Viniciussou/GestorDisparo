import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { MessageTemplate, PaginatedResponse } from '@/lib/types'

// GET /api/templates - List message templates
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
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    
    let query = supabase
      .from('message_templates')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (category) {
      query = query.eq('category', category)
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }
    
    const { data: templates, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1)
    
    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<MessageTemplate> = {
      data: templates || [],
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

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const body = await request.json()
    
    if (!body.name || !body.content) {
      return NextResponse.json({ 
        error: 'Validation error', 
        message: 'name and content are required' 
      }, { status: 400 })
    }

    // Extract variables from content (format: {{variable_name}})
    const variableRegex = /\{\{(\w+)\}\}/g
    const variables: string[] = []
    let match
    while ((match = variableRegex.exec(body.content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    const { data: template, error } = await supabase
      .from('message_templates')
      .insert({
        user_id: user.id,
        name: body.name,
        content: body.content,
        variables,
        category: body.category || null,
        is_active: body.is_active !== false
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Database error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
