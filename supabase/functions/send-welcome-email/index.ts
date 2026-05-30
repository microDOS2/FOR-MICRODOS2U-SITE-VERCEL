// supabase/functions/send-welcome-email/index.ts
// Sends welcome email with login credentials to new users
// Requires RESEND_API_KEY environment variable

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface WelcomePayload {
  userId: string;
  email: string;
  password: string;
  businessName?: string;
  role?: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 });
  }

  // Verify admin authorization
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { persistSession: false } }
    );

    // Verify the caller is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: adminData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }

    const payload: WelcomePayload = await req.json();
    const { email, password, businessName, role } = payload;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password' }),
        { status: 400 }
      );
    }

    const displayName = businessName || email.split('@')[0];
    const roleLabel = role ? role.replace(/_/g, ' ').replace(/\\b\\w/g, (l: string) => l.toUpperCase()) : 'User';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0514; color: #fff; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #150f24; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo span { font-size: 28px; font-weight: bold; }
    .green { color: #44f80c; }
    .purple { color: #9a02d0; }
    .pink { color: #ff66c4; }
    h1 { text-align: center; color: #fff; font-size: 22px; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #888; font-size: 14px; margin-bottom: 30px; }
    .credentials { background: rgba(255,255,255,0.03); border: 1px solid rgba(154,2,208,0.3); border-radius: 12px; padding: 24px; margin: 24px 0; }
    .credentials h3 { color: #9a02d0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; }
    .field { margin-bottom: 16px; }
    .field:last-child { margin-bottom: 0; }
    .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { color: #fff; font-size: 16px; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); word-break: break-all; }
    .btn { display: block; background: linear-gradient(135deg, #9a02d0, #44f80c); color: #fff; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 10px; font-weight: 600; margin: 24px 0; }
    .footer { text-align: center; color: #555; font-size: 12px; margin-top: 30px; }
    .divider { height: 1px; background: rgba(255,255,255,0.1); margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="green">micro</span><span class="purple">DOS</span><span class="pink">(2)</span>
    </div>
    <h1>Welcome, ${displayName}!</h1>
    <p class="subtitle">Your ${roleLabel} account has been created.</p>
    <div class="credentials">
      <h3>Your Login Credentials</h3>
      <div class="field">
        <div class="label">Email</div>
        <div class="value">${email}</div>
      </div>
      <div class="field">
        <div class="label">Password</div>
        <div class="value">${password}</div>
      </div>
    </div>
    <a href="https://for-microdos-2-u-site-vercel.vercel.app" class="btn">Log In to Your Portal</a>
    <div class="divider"></div>
    <p style="color: #888; font-size: 13px; text-align: center;">
      Keep these credentials secure. You can change your password anytime from your account settings.
    </p>
    <div class="footer">
      microDOS(2) &mdash; Automated System Email
    </div>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'microDOS(2) <notifications@microdos2.com>',
        to: email,
        subject: `Welcome to microDOS(2) - Your ${roleLabel} Account`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Failed to send email' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 });
  } catch (err: any) {
    console.error('send-welcome-email error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
});
