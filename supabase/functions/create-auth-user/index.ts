// Edge Function: Create auth user and send welcome email
// Uses admin API with email_confirm=true + sends credentials via Resend
// If user already exists, returns existing user ID so frontend can insert into users table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, business_name, role, site_url } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let userId: string
    let isExisting = false

    // Try to create user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { business_name, role },
    })

    if (createError) {
      // If "already exists", find the existing user and return their ID
      if (createError.message?.toLowerCase().includes('already') ||
          createError.message?.toLowerCase().includes('exists')) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
        const existing = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (existing) {
          userId = existing.id
          isExisting = true
        } else {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      userId = userData.user.id
    }

    // Send welcome email (only for new users, skip if already exists)
    if (!isExisting) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          const appUrl = site_url || 'https://for-microdos-2-u-site-vercel.vercel.app';
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
<p style="color:#9a02d0;font-size:14px;margin:0 0 30px 0;text-align:center;font-weight:bold;">Your Account is Ready</p>
<div style="color:#d1d5db;font-size:15px;line-height:1.7;margin-bottom:30px;">
<p>Hi ${business_name || 'there'},</p>
<p>An administrator has created an account for you on the <strong style="color:#ffffff;">microDOS(2)</strong> platform.</p>
<p style="margin-top:20px;"><strong style="color:#ffffff;">Your Login Credentials:</strong></p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background:#0a0514;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.1);">
<tr><td style="padding:10px 20px;">
<p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email / Username</p>
<p style="margin:5px 0 0 0;color:#ffffff;font-size:16px;font-family:monospace;">${email}</p>
</td></tr>
<tr><td style="padding:10px 20px;">
<p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
<p style="margin:5px 0 0 0;color:#44f80c;font-size:16px;font-family:monospace;font-weight:bold;">${password}</p>
</td></tr>
</table>
<p style="font-size:13px;color:#ff66c4;"><strong>Please change your password after your first login.</strong></p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
<tr><td align="center">
<a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#9a02d0,#7a01a8);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">Log In Now</a>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding-top:30px;color:#6b7280;font-size:12px;line-height:1.6;">
<p style="margin:0;">microDOS(2) &middot; Premium Microdosing Solutions</p>
<p style="margin:5px 0 0 0;">This email was sent automatically. Do not reply.</p>
</td></tr>
</table></td></tr></table></body></html>`;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'microDOS(2) <notifications@microdos2.com>',
              to: email,
              subject: 'Your microDOS(2) Account Has Been Created',
              html: emailHtml,
            }),
          });
        } catch (emailErr) {
          console.error('Welcome email failed (non-critical):', emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        user: { id: userId, email },
        existing: isExisting,
        message: isExisting ? 'User already exists, returning ID' : 'User created and welcome email sent',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
