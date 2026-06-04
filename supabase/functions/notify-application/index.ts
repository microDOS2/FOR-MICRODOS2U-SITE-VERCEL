// supabase/functions/notify-application/index.ts
// Sends application-related emails (received confirmation + approval with credentials)
// Requires RESEND_API_KEY environment variable

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.microdos2u.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function emailTemplate({ title, subtitle, bodyHtml, ctaText, ctaUrl }: {
  title: string;
  subtitle: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0514;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0514;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <span style="font-size:28px;font-weight:bold;">
                <span style="color:#44f80c;">micro</span><span style="color:#9a02d0;">DOS</span><span style="color:#ff66c4;">(2)</span>
              </span>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td style="background-color:#150f24;border-radius:12px;padding:40px;border:1px solid rgba(255,255,255,0.1);">
              <!-- Title -->
              <h1 style="color:#ffffff;font-size:24px;margin:0 0 10px 0;text-align:center;">${title}</h1>
              <p style="color:#9a02d0;font-size:14px;margin:0 0 30px 0;text-align:center;font-weight:bold;">${subtitle}</p>
              <!-- Body -->
              <div style="color:#d1d5db;font-size:15px;line-height:1.7;margin-bottom:30px;">
                ${bodyHtml}
              </div>
              ${ctaText && ctaUrl ? `
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#9a02d0,#7a01a8);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:30px;color:#6b7280;font-size:12px;line-height:1.6;">
              <p style="margin:0;">microDOS(2) &middot; Premium Microdosing Solutions</p>
              <p style="margin:5px 0 0 0;">This email was sent automatically. Do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://fildaxejimuvfrcqmoba.supabase.co';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { type, email, business_name, account_type, password, site_url } = await req.json();

    if (!type || !email) {
      return new Response(JSON.stringify({ error: 'Missing type or email' }), { status: 400, headers: corsHeaders });
    }

    let subject = '';
    let html = '';
    const appUrl = site_url || 'https://www.microdos2u.com';

    if (type === 'application_received') {
      // Email 2: Application received confirmation
      subject = `We Received Your ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} Application — microDOS(2)`;
      html = emailTemplate({
        title: 'Application Received',
        subtitle: `Your ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} Application`,
        bodyHtml: `
          <p>Hi ${business_name || 'there'},</p>
          <p>Thank you for applying to become a ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} with <strong style="color:#ffffff;">microDOS(2)</strong>.</p>
          <p>We have received your application and our team is reviewing it. You will receive another email once your application has been approved.</p>
          <p style="margin-top:20px;"><strong style="color:#ffffff;">What happens next?</strong></p>
          <ul style="padding-left:20px;">
            <li>Our team reviews your application (usually within 1-2 business days)</li>
            <li>You will receive an email with your login credentials upon approval</li>
            <li>Log in to access your ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} portal and start ordering</li>
          </ul>
        `,
        ctaText: 'Visit Our Website',
        ctaUrl: appUrl,
      });
    } else if (type === 'application_approved') {
      // Email 3: Application approved with credentials
      if (!password) {
        return new Response(JSON.stringify({ error: 'Password required for approval email' }), { status: 400, headers: corsHeaders });
      }
      const portalPath = account_type === 'distributor' ? '/distributor-portal' : '/wholesaler-portal';
      const portalUrl = `${appUrl}/#${portalPath}`;

      subject = `Your ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} Account is Approved — microDOS(2)`;
      html = emailTemplate({
        title: 'You\'re Approved!',
        subtitle: 'Welcome to the microDOS(2) Family',
        bodyHtml: `
          <p>Congratulations! Your application to become a <strong style="color:#ffffff;">${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'}</strong> has been approved.</p>
          <p style="margin-top:20px;"><strong style="color:#ffffff;">Your Login Credentials:</strong></p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background:#0a0514;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.1);">
            <tr>
              <td style="padding:10px 20px;">
                <p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email / Username</p>
                <p style="margin:5px 0 0 0;color:#ffffff;font-size:16px;font-family:monospace;">${email}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 20px;">
                <p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
                <p style="margin:5px 0 0 0;color:#44f80c;font-size:16px;font-family:monospace;font-weight:bold;">${password}</p>
              </td>
            </tr>
          </table>
          <p style="font-size:13px;color:#ff66c4;"><strong>Please change your password after your first login.</strong></p>
        `,
        ctaText: `Log In to ${account_type === 'distributor' ? 'Distributor' : 'Wholesaler'} Portal`,
        ctaUrl: portalUrl,
      });
    } else if (type === 'welcome') {
      // Email 1: Admin created user — welcome with credentials
      if (!password) {
        return new Response(JSON.stringify({ error: 'Password required for welcome email' }), { status: 400, headers: corsHeaders });
      }
      subject = `Your microDOS(2) Account Has Been Created`;
      html = emailTemplate({
        title: 'Welcome to microDOS(2)',
        subtitle: 'Your Account is Ready',
        bodyHtml: `
          <p>Hi ${business_name || 'there'},</p>
          <p>An administrator has created an account for you on the <strong style="color:#ffffff;">microDOS(2)</strong> platform.</p>
          <p style="margin-top:20px;"><strong style="color:#ffffff;">Your Login Credentials:</strong></p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background:#0a0514;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.1);">
            <tr>
              <td style="padding:10px 20px;">
                <p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email / Username</p>
                <p style="margin:5px 0 0 0;color:#ffffff;font-size:16px;font-family:monospace;">${email}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 20px;">
                <p style="margin:0;color:#9a02d0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
                <p style="margin:5px 0 0 0;color:#44f80c;font-size:16px;font-family:monospace;font-weight:bold;">${password}</p>
              </td>
            </tr>
          </table>
          <p style="font-size:13px;color:#ff66c4;"><strong>Please change your password after your first login.</strong></p>
        `,
        ctaText: 'Log In Now',
        ctaUrl: `${appUrl}/#/admin-portal`,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: corsHeaders });
    }

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'microDOS(2) <notifications@microdos2.com>',
        to: email,
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Failed to send email' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('notify-application error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: corsHeaders });
  }
});
