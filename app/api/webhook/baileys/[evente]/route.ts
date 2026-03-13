import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { WebhookPayload } from '@/lib/types'

export async function GET() {
  return Response.json({ status: "webhook alive" })
}

// Verify webhook secret
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret =
    request.headers.get('x-server-secret') ||
    request.headers.get('x-webhook-secret')

  // Support both BAILEYS_SERVER_SECRET and legacy SERVER_SECRET
  const expectedSecret =
    process.env.BAILEYS_SERVER_SECRET ||
    process.env.SERVER_SECRET ||
    process.env.NEXT_PUBLIC_BAILEYS_SERVER_SECRET

  if (!expectedSecret) {
    console.error('[Webhook] BAILEYS_SERVER_SECRET environment variable is not configured')
    return false
  }

  const isValid = secret === expectedSecret

  if (!isValid) {
    console.error('[Webhook] Secret verification failed', {
      receivedSecret: secret ? '***' : 'missing',
      hasExpectedSecret: !!expectedSecret,
      secretSource: process.env.BAILEYS_SERVER_SECRET ? 'BAILEYS_SERVER_SECRET' : 'SERVER_SECRET'
    })
  }

  return isValid
}

// POST /api/webhook/baileys - Receive events from Baileys server
export async function POST(request: NextRequest) {

  if (!verifyWebhookSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    // Verify webhook authenticity
    const payload: WebhookPayload = await request.json()

    if (!payload?.event) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      )
    }
    const supabase = await createClient()

    switch (payload.event) {
      case 'session.connected': {
        // Update session status to connected
        const { error } = await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'connected',
            qr_code: null,
            auth_state: payload.data.auth_state as Record<string, unknown> || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.session_id)

        if (error) {
          console.error('Error updating session status:', error)
        }
        break
      }

      case 'session.disconnected': {
        // Update session status to disconnected
        const { error } = await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.session_id)

        if (error) {
          console.error('Error updating session status:', error)
        }
        break
      }

      case 'session.qr_update': {
        const { error } = await supabase
          .from('whatsapp_sessions')
          .update({
            qr_code: payload.data.qr_code,
            status: 'connecting',
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.session_id)

        if (error) {
          console.error('Error updating QR code:', error)
        }

        break
      }

      case 'message.received': {
        // Get session to find user_id
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('user_id')
          .eq('id', payload.session_id)
          .maybeSingle()

        if (!session) {
          console.error('Session not found for message:', payload.session_id)
          break
        }

        const messageData = payload.data as {
          remote_jid: string
          message_id: string
          content: string
          media_url?: string
          media_type?: string
          sender_name?: string
        }

        // Extract phone from JID
        const phone = messageData.remote_jid.replace('@s.whatsapp.net', '').replace('@g.us', '')

        // Find or create contact
        let contactId: string | null = null
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('phone', phone)
          .maybeSingle()

        if (existingContact) {
          contactId = existingContact.id
          // Update last contact time
          await supabase
            .from('contacts')
            .update({ last_contact_at: new Date().toISOString() })
            .eq('id', contactId)
        } else {
          // Create new contact
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              user_id: session.user_id,
              phone,
              name: messageData.sender_name || null,
              status: 'active'
            })
            .select('id')
            .maybeSingle()

          if (newContact) {
            contactId = newContact.id
          }
        }

        // Save incoming message
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            user_id: session.user_id,
            session_id: payload.session_id,
            contact_id: contactId,
            remote_jid: messageData.remote_jid,
            message_id: messageData.message_id,
            direction: 'incoming',
            content: messageData.content,
            media_url: messageData.media_url || null,
            media_type: messageData.media_type || null,
            status: 'delivered'
          })

        if (messageError) {
          console.error('Error saving incoming message:', messageError)
        }

        // Check if there are pending dispatches for this contact and pause them
        // (pause_on_response feature)
        if (contactId) {
          const { data: config } = await supabase
            .from('dispatch_configs')
            .select('pause_on_response')
            .eq('user_id', session.user_id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

          if (config?.pause_on_response) {
            await supabase
              .from('dispatch_queue')
              .update({ status: 'cancelled' })
              .eq('contact_id', contactId)
              .eq('status', 'pending')
          }
        }
        break
      }

      case 'message.sent': {
        // Update message status
        const messageData = payload.data as {
          message_db_id?: string
          message_id: string
          status: 'sent' | 'failed'
          error_message?: string
        }

        if (messageData.message_db_id) {
          await supabase
            .from('messages')
            .update({
              status: messageData.status,
              message_id: messageData.message_id,
              error_message: messageData.error_message || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', messageData.message_db_id)
        }

        // Update dispatch queue if this was a queued message
        if (payload.data.queue_id) {
          const queueId = payload.data.queue_id as string

          // Get queue item details
          const { data: queueItem } = await supabase
            .from('dispatch_queue')
            .select('*, contacts(phone, name)')
            .eq('id', queueId)
            .maybeSingle()

          if (queueItem) {
            // Update queue status
            await supabase
              .from('dispatch_queue')
              .update({
                status: messageData.status,
                processed_at: new Date().toISOString()
              })
              .eq('id', queueId)

            // Get session phone
            const { data: sessionData } = await supabase
              .from('whatsapp_sessions')
              .select('phone_number')
              .eq('id', payload.session_id)
              .maybeSingle()

            // Log the dispatch
            await supabase
              .from('dispatch_logs')
              .insert({
                user_id: queueItem.user_id,
                queue_id: queueId,
                session_id: payload.session_id,
                contact_id: queueItem.contact_id,
                contact_phone: queueItem.contacts?.phone || '',
                contact_name: queueItem.contacts?.name || null,
                sender_phone: sessionData?.phone_number || '',
                message_content: queueItem.message_content,
                status: messageData.status,
                error_message: messageData.error_message || null
              })
          }
        }
        break
      }

      case 'message.delivered':
      case 'message.read': {
        // Update message status
        const messageData = payload.data as { message_id: string }

        const status = payload.event === 'message.delivered' ? 'delivered' : 'read'

        await supabase
          .from('messages')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('message_id', messageData.message_id)

        // Also update dispatch log if exists
        await supabase
          .from('dispatch_logs')
          .update({ status })
          .eq('session_id', payload.session_id)
          .match({ status: status === 'read' ? 'delivered' : 'sent' })
        break
      }

      default:
        console.warn('Unknown webhook event:', payload.event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
