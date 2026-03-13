import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { WebhookPayload } from '@/lib/types'

export async function GET() {
    return NextResponse.json({ status: "webhook alive" })
}

// ================================
// Verify webhook secret
// ================================
function verifyWebhookSecret(request: NextRequest): boolean {

    const authHeader = request.headers.get("authorization")

    const expectedSecret =
        process.env.BAILEYS_SERVER_SECRET ||
        process.env.SERVER_SECRET

    if (!expectedSecret) {
        console.error("[Webhook] Secret not configured")
        return false
    }

    if (!authHeader) {
        console.error("[Webhook] Missing Authorization header")
        return false
    }

    const token = authHeader.replace("Bearer ", "")

    const isValid = token === expectedSecret

    if (!isValid) {
        console.error("[Webhook] Secret verification failed", {
            receivedSecret: "***",
            expectedSecretExists: true
        })
    }

    return isValid
}

// ================================
// POST webhook
// ================================
export async function POST(request: NextRequest) {

    if (!verifyWebhookSecret(request)) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        )
    }

    try {

        const payload: WebhookPayload = await request.json()

        if (!payload?.event) {
            return NextResponse.json(
                { error: "Invalid payload" },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        switch (payload.event) {

            // ====================
            // SESSION CONNECTED
            // ====================
            case 'session.connected': {

                const { error } = await supabase
                    .from('whatsapp_sessions')
                    .update({
                        status: 'connected',
                        qr_code: null,
                        auth_state: payload.data?.auth_state || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payload.session_id)

                if (error) {
                    console.error('Error updating session status:', error)
                }

                break
            }

            // ====================
            // SESSION DISCONNECTED
            // ====================
            case 'session.disconnected': {

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

            // ====================
            // QR UPDATE
            // ====================
            case 'session.qr_update': {

                const { error } = await supabase
                    .from('whatsapp_sessions')
                    .update({
                        qr_code: payload.data?.qr_code,
                        status: 'connecting',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payload.session_id)

                if (error) {
                    console.error('Error updating QR code:', error)
                }

                break
            }

            // ====================
            // MESSAGE RECEIVED
            // ====================
            case 'message.received': {

                const { data: session } = await supabase
                    .from('whatsapp_sessions')
                    .select('user_id')
                    .eq('id', payload.session_id)
                    .maybeSingle()

                if (!session) {
                    console.error('Session not found:', payload.session_id)
                    break
                }

                const messageData = payload.data as any

                const phone = messageData.remote_jid
                    ?.replace('@s.whatsapp.net', '')
                    ?.replace('@g.us', '')

                let contactId: string | null = null

                const { data: existingContact } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('user_id', session.user_id)
                    .eq('phone', phone)
                    .maybeSingle()

                if (existingContact) {

                    contactId = existingContact.id

                    await supabase
                        .from('contacts')
                        .update({
                            last_contact_at: new Date().toISOString()
                        })
                        .eq('id', contactId)

                } else {

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
                    console.error('Error saving message:', messageError)
                }

                break
            }

            // ====================
            // MESSAGE SENT
            // ====================
            case 'message.sent': {

                const messageData = payload.data as any

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

                break
            }

            // ====================
            // MESSAGE STATUS
            // ====================
            case 'message.delivered':
            case 'message.read': {

                const messageData = payload.data as any

                const status =
                    payload.event === 'message.delivered'
                        ? 'delivered'
                        : 'read'

                await supabase
                    .from('messages')
                    .update({
                        status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('message_id', messageData.message_id)

                break
            }

            default:
                console.warn('Unknown webhook event:', payload.event)

        }

        return NextResponse.json({ success: true })

    } catch (error) {

        console.error('Webhook error:', error)

        return NextResponse.json(
            {
                error: 'Server error',
                message: 'Unexpected error'
            },
            { status: 500 }
        )
    }
}