import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 });
  }

  try {
    const { email, password, displayName, roleLabel } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Missing email or password' }), { status: 400 });
    }

    const name = displayName || email.split('@')[0];
    const role = roleLabel || 'User';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#0a0514;color:#fff;margin:0;padding:20px}
.container{max-width:500px;margin:0 auto;background:#150f24;border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.1)}
.logo{text-align:center;margin-bottom:30px;font-size:28px;font-weight:bold}
.green{color:#44f80c}.purple{color:#9a02d0}.pink{color:#ff66c4}
h1{text-align:center;font-size:22px;margin-bottom:8px}
.subtitle{text-align:center;color:#888;font-size:14px;margin-bottom:30px}
.credentials{background:rgba(255,255,255,0.03);border:1px solid rgba(154,2,208,0.3);border-radius:12px;padding:24px;margin:24px 0}
.label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.value{color:#fff;font-size:16px;font-family:monospace;background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)}
.btn{display:block;background:linear-gradient(135deg,#9a02d0,#44f80c);color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:10px;font-weight:600;margin:24px 0}
.footer{text-align:center;color:#555;font-size:12px;margin-top:30px}
</style></head><body>
<div class="container">
<div class="logo"><span class="green">micro</span><span class="purple">DOS</span><span class="pink">(2)</span></div>
<h1>Welcome, ${name}!</h1><p class="subtitle">Your ${role} account has been created.</p>
<div class="credentials"><div style="margin-bottom:16px"><div class="label">Email</div><div class="value">${email}</div></div>
<div><div class="label">Password</div><div class="value">${password}</div></div></div>
<a href="https://for-microdos-2-u-site-vercel.vercel.app" class="btn">Log In to Your Portal</a>
<div class="footer">microDOS(2) - Automated System Email</div></div></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'microDOS(2) <notifications@microdos2.com>',
        to: email,
        subject: `Welcome to microDOS(2) - Your ${role} Account`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Failed to send' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
});
