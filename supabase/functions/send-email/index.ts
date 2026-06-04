import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.microdos2u.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: apps, error } = await supabaseAdmin
      .from('applications')
      .select('id,email,first_name,last_name,company_name,role')
      .eq('status', 'approved')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let processed = 0

    for (const app of apps ?? []) {
      const password = Array.from(crypto.getRandomValues(new Uint8Array(10)))
        .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56])
        .join('')

      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: app.email,
        password,
        email_confirm: true,
        user_metadata: {
          business_name: app.company_name || `${app.first_name} ${app.last_name}`,
          first_name: app.first_name,
          last_name: app.last_name,
          phone: app.phone,
          role: app.role ?? 'distributor',
        },
      })

      if (createError && !createError.message.toLowerCase().includes('already') && createError.code !== 'user_already_exists') {
        console.error('Create user error for', app.email, createError)
        continue
      }

      const existing = createError?.message.toLowerCase().includes('already') || createError?.code === 'user_already_exists'

      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const user = listData?.users?.find((u: any) => u.email?.toLowerCase() === app.email.toLowerCase())
      if (!user) {
        console.error('User not found after creation for', app.email)
        continue
      }

      const appUrl = 'https://www.microdos2u.com'

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: user.id,
          email: app.email,
          business_name: app.company_name || `${app.first_name} ${app.last_name}`,
          first_name: app.first_name,
          last_name: app.last_name,
          phone: app.phone,
          role: app.role ?? 'distributor',
          is_active: true,
          account_status: 'approved',
        }, { onConflict: 'id' })

      if (profileError) console.error('Profile error for', app.email, profileError)

      const emailHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#0a0514;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0514;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding-bottom:30px;">
<span style="font-size:28px;font-weight:bold;"><span style="color:#44f80c;">micro</span><span style="color:#9a02d0;">DOS</span><span style="color:#ff66c4;">(2)</span></span>
</td></tr>
<tr><td style="background-color:#150f24;border-radius:12px;padding:40px;border:1px solid rgba(255,255,255,0.1);">
<h1 style="color:#ffffff;font-size:24px;margin:0 0 10px 0;text-align:center;">Welcome to microDOS(2)</h1>
<p style="color:#9a02d0;font-size:14px;margin:0 0 30px 0;text-align:center;font-weight:bold;">Your Account Has Been ${existing ? 'Updated' : 'Created'}</p>
<div style="color:#d1d5db;font-size:15px;line-height:1.7;margin-bottom:30px;">
<p>Hi ${app.first_name || 'there'},</p>
<p>An administrator has ${existing ? 'reset your password' : 'created an account'} on the <strong style="color:#ffffff;">microDOS(2)</strong> platform.</p>
<p style="margin-top:20px;"><strong style="color:#ffffff;">Your Login Credentials:</strong></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background:#0a0514;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.1);">
<tr><td style="padding:10px 20px;">
<p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email / Username</p>
<p style="margin:5px 0 0 0;color:#ffffff;font-size:16px;font-family:monospace;">${app.email}</p>
</td></tr>
<tr><td style="padding:10px 20px;">
<p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
<p style="margin:5px 0 0 0;color:#44f80c;font-size:16px;font-family:monospace;font-weight:bold;">${password}</p>
</td></tr>
</table>
</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
<tr><td align="center">
<a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#9a02d0,#7a01a8);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">Log In Now</a>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding-top:30px;color:#6b7280;font-size:12px;line-height:1.6;">
<p style="margin:0;">microDOS(2) &middot; Premium Microdosing Solutions</p>
</td></tr>
</table></td></tr></table></body></html>`

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'microDOS(2) <notifications@microdos2u.com>',
            to: app.email,
            subject: existing ? 'Your microDOS(2) Password Has Been Reset' : 'Welcome to microDOS(2) - Your Account Has Been Created',
            html: emailHtml,
          }),
        })
      } catch (emailErr) {
        console.error('Email send error for', app.email, emailErr)
      }

      await supabaseAdmin
        .from('applications')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', app.id)

      processed++
    }

    return new Response(JSON.stringify({ processed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
