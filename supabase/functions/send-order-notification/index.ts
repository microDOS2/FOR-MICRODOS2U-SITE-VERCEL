// supabase/functions/send-order-notification/index.ts
// Sends email notification to customer when order status changes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface NotificationPayload {
  order_id: string;
  status: 'processing' | 'shipped' | 'cancelled';
  test_email?: string; // Optional: send copy to test email
}

const emailColors = {
  pending: { bg: '#1a1600', border: '#ca8a04', accent: '#facc15' },
  processing: { bg: '#0a1628', border: '#3b82f6', accent: '#60a5fa' },
  shipped: { bg: '#0a1a1a', border: '#22c55e', accent: '#4ade80' },
  cancelled: { bg: '#1a0808', border: '#ef4444', accent: '#f87171' },
};

function buildEmailHTML(params: {
  status: string;
  poNumber: string;
  businessName: string;
  total: number;
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;
  orderDate: string;
}) {
  const colors = emailColors[params.status as keyof typeof emailColors] || emailColors.pending;
  const statusLabels: Record<string, string> = {
    processing: 'Your Order is Being Processed',
    shipped: 'Your Order Has Shipped!',
    cancelled: 'Your Order Has Been Cancelled',
  };

  const statusMessages: Record<string, string> = {
    processing: 'Your order has been confirmed and is now being prepared for fulfillment.',
    shipped: 'Great news! Your order has been dispatched and is on its way to you.',
    cancelled: 'Your order has been cancelled. Please contact us if you have any questions.',
  };

  const trackingHTML = params.status === 'shipped' && params.trackingNumber
    ? `<div style="background:#150f24;border:1px solid ${colors.border};border-radius:8px;padding:20px;margin:24px 0;">
        <h3 style="color:${colors.accent};margin:0 0 12px 0;font-size:16px;">📦 Tracking Information</h3>
        <p style="margin:4px 0;color:#e0e0e0;"><strong>Carrier:</strong> ${params.carrier || 'N/A'}</p>
        <p style="margin:4px 0;color:#e0e0e0;"><strong>Tracking Number:</strong> <span style="font-family:monospace;background:#0a0514;padding:4px 8px;border-radius:4px;">${params.trackingNumber}</span></p>
        ${params.shippedDate ? `<p style="margin:4px 0;color:#e0e0e0;"><strong>Shipped:</strong> ${new Date(params.shippedDate).toLocaleDateString()}</p>` : ''}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0514;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #44f80c;">
      <h1 style="color:#44f80c;margin:0;font-size:28px;display:inline;">micro</h1>
      <h1 style="color:#9a02d0;margin:0;font-size:28px;display:inline;">DOS</h1>
      <span style="color:#ff66c4;font-size:28px;font-weight:bold;">(2)</span>
      <p style="color:#888;margin:8px 0 0 0;font-size:14px;">Order Notification</p>
    </div>

    <!-- Status Banner -->
    <div style="background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <h2 style="color:${colors.accent};margin:0 0 12px 0;font-size:22px;">${statusLabels[params.status] || 'Order Update'}</h2>
      <p style="color:#ccc;margin:0;font-size:15px;line-height:1.6;">${statusMessages[params.status] || ''}</p>
    </div>

    <!-- Order Details -->
    <div style="background:#150f24;border:1px solid #2a2440;border-radius:8px;padding:24px;margin:24px 0;">
      <h3 style="color:#fff;margin:0 0 16px 0;font-size:16px;">📋 Order Details</h3>
      <table style="width:100%;color:#ccc;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#888;">PO Number</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${params.poNumber}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Account</td><td style="padding:6px 0;text-align:right;">${params.businessName}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Order Date</td><td style="padding:6px 0;text-align:right;">${new Date(params.orderDate).toLocaleDateString()}</td></tr>
        <tr style="border-top:1px solid #2a2440;">
          <td style="padding:10px 0;color:#fff;font-weight:bold;">Total</td>
          <td style="padding:10px 0;text-align:right;color:#44f80c;font-weight:bold;font-size:18px;">$${params.total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    ${trackingHTML}

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #2a2440;margin-top:24px;color:#888;font-size:13px;">
      <p>Questions? Reply to this email or contact us at info@microdos2u.com</p>
      <p style="margin-top:12px;">microDOS(2) | 9555 Las Vegas Blvd South, Suite 100 | Las Vegas, NV 89123</p>
      <p style="font-size:11px;color:#555;">This is an automated message. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET') || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const payload: NotificationPayload = await req.json();
    const { order_id, status, test_email } = payload;

    // Fetch order with customer details
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, po_number, total, status, created_at, tracking_number, carrier, shipped_date, users!inner(email, business_name, contact_name)')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      console.error('Order fetch error:', orderErr);
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    const userData = order.users as any;
    const customerEmail = userData?.email;
    const businessName = userData?.business_name || userData?.contact_name || 'Valued Customer';

    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'Customer email not found' }), { status: 400 });
    }

    // Build email HTML
    const html = buildEmailHTML({
      status,
      poNumber: order.po_number,
      businessName,
      total: order.total,
      trackingNumber: order.tracking_number || undefined,
      carrier: order.carrier || undefined,
      shippedDate: order.shipped_date || undefined,
      orderDate: order.created_at,
    });

    const subjectMap: Record<string, string> = {
      processing: `[microDOS(2)] Order ${order.po_number} Confirmed - Being Processed`,
      shipped: `[microDOS(2)] Order ${order.po_number} Has Shipped!`,
      cancelled: `[microDOS(2)] Order ${order.po_number} Cancelled`,
    };

    // Send to customer
    const recipients = [customerEmail];
    // Add test email if provided (for development testing)
    if (test_email) {
      recipients.push(test_email);
    }

    const results = [];
    for (const to of recipients) {
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject: subjectMap[status] || `[microDOS(2)] Order ${order.po_number} Update`,
          html,
        }),
      });

      const sendData = await sendRes.json();
      results.push({ to, success: sendRes.ok, id: sendData.id });
      console.log(`Notification sent to ${to}:`, sendData.id || sendData.error);
    }

    return new Response(JSON.stringify({ success: true, results }), { status: 200 });

  } catch (err: any) {
    console.error('send-order-notification error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
});
