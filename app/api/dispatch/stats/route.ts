import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/dispatch/stats - Get dispatch statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'today' // today, week, month, all
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        startDate = new Date(0)
    }

    // Get queue stats
    const { data: queueStats } = await supabase
      .from('dispatch_queue')
      .select('status')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())

    const queueCounts = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    }

    queueStats?.forEach(item => {
      if (item.status in queueCounts) {
        queueCounts[item.status as keyof typeof queueCounts]++
      }
    })

    // Get logs stats
    const { data: logStats } = await supabase
      .from('dispatch_logs')
      .select('status')
      .eq('user_id', user.id)
      .gte('sent_at', startDate.toISOString())

    const logCounts = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0
    }

    logStats?.forEach(item => {
      if (item.status in logCounts) {
        logCounts[item.status as keyof typeof logCounts]++
      }
    })

    // Get session stats
    const { data: sessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, status, daily_message_count')
      .eq('user_id', user.id)

    const sessionStats = {
      total: sessions?.length || 0,
      connected: sessions?.filter(s => s.status === 'connected').length || 0,
      disconnected: sessions?.filter(s => s.status === 'disconnected').length || 0,
      total_messages_today: sessions?.reduce((sum, s) => sum + (s.daily_message_count || 0), 0) || 0
    }

    // Get contact count
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Get hourly distribution for the period
    const { data: hourlyData } = await supabase
      .from('dispatch_logs')
      .select('sent_at')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .gte('sent_at', startDate.toISOString())

    const hourlyDistribution: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0
    }

    hourlyData?.forEach(item => {
      const hour = new Date(item.sent_at).getHours()
      hourlyDistribution[hour]++
    })

    return NextResponse.json({
      success: true,
      data: {
        period,
        queue: queueCounts,
        logs: logCounts,
        sessions: sessionStats,
        contacts: contactCount || 0,
        hourly_distribution: hourlyDistribution,
        success_rate: logCounts.sent > 0 
          ? ((logCounts.delivered + logCounts.read) / logCounts.sent * 100).toFixed(2)
          : 0
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Server error', message: 'An unexpected error occurred' }, { status: 500 })
  }
}
