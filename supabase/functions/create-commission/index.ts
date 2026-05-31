// Edge Function: Create commission entry when an order is paid+shipped
// Called automatically when order status changes to 'delivered' or 'paid'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Fetch order details
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, total, status')
      .eq('id', order_id)
      .single()
    if (orderErr || !order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // 2. Skip if commission already exists for this order
    const { data: existing } = await supabaseAdmin
      .from('commission_entries')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle()
    if (existing) return new Response(JSON.stringify({ message: 'Commission already exists' }), { status: 200, headers: corsHeaders })

    // 3. Fetch commission settings
    const { data: settings } = await supabaseAdmin
      .from('commission_settings')
      .select('rep_rate, manager_override_rate')
      .single()
    if (!settings) return new Response(JSON.stringify({ error: 'Commission settings not found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // 4. Find the rep for this account
    const { data: assignment } = await supabaseAdmin
      .from('rep_account_assignments')
      .select('rep_id')
      .eq('account_id', order.user_id)
      .maybeSingle()
    if (!assignment) return new Response(JSON.stringify({ message: 'No rep assigned to this account' }), { status: 200, headers: corsHeaders })

    // 5. Fetch rep's manager
    const { data: rep } = await supabaseAdmin
      .from('users')
      .select('manager_id')
      .eq('id', assignment.rep_id)
      .single()

    // 6. Calculate commissions
    const repEarnings = Number((order.total * settings.rep_rate / 100).toFixed(2))
    const managerId = rep?.manager_id || null
    const managerEarnings = managerId ? Number((order.total * settings.manager_override_rate / 100).toFixed(2)) : null

    // 7. Insert commission entry
    const { data: entry, error: insertErr } = await supabaseAdmin
      .from('commission_entries')
      .insert({
        order_id: order.id,
        account_id: order.user_id,
        rep_id: assignment.rep_id,
        manager_id: managerId,
        order_amount: order.total,
        rep_rate: settings.rep_rate,
        rep_earnings: repEarnings,
        manager_rate: managerId ? settings.manager_override_rate : null,
        manager_earnings: managerEarnings,
        period: getPeriod(new Date()),
        status: 'accrued',
      })
      .select()
      .single()

    if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    return new Response(
      JSON.stringify({ success: true, commission: entry }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
