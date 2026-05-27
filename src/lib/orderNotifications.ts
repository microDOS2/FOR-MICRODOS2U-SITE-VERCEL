// Order notification email builder
// Calls the existing 'send-email' edge function with styled HTML

import { supabase } from './supabase';

const emailColors: Record<string, { bg: string; border: string; accent: string }> = {
  processing: { bg: '#0a1628', border: '#3b82f6', accent: '#60a5fa' },
  shipped: { bg: '#0a1a1a', border: '#22c55e', accent: '#4ade80' },
  cancelled: { bg: '#1a0808', border: '#ef4444', accent: '#f87171' },
};

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

function buildNotificationHTML(params: {
  status: string;
  poNumber: string;
  businessName: string;
  total: number;
  orderDate: string;
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;
}): string {
  const colors = emailColors[params.status] || emailColors.processing;
  const label = statusLabels[params.status] || 'Order Update';
  const message = statusMessages[params.status] || '';

  const trackingHTML =
    params.status === 'shipped' && params.trackingNumber
      ? `<div style="background:#150f24;border:1px solid ${colors.border};border-radius:8px;padding:20px;margin:24px 0;">
          <h3 style="color:${colors.accent};margin:0 0 12px 0;font-size:16px;">&#128230; Tracking Information</h3>
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
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #44f80c;">
      <h1 style="color:#44f80c;margin:0;font-size:28px;display:inline;">micro</h1>
      <h1 style="color:#9a02d0;margin:0;font-size:28px;display:inline;">DOS</h1>
      <span style="color:#ff66c4;font-size:28px;font-weight:bold;">(2)</span>
      <p style="color:#888;margin:8px 0 0 0;font-size:14px;">Order Notification</p>
    </div>
    <div style="background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <h2 style="color:${colors.accent};margin:0 0 12px 0;font-size:22px;">${label}</h2>
      <p style="color:#ccc;margin:0;font-size:15px;line-height:1.6;">${message}</p>
    </div>
    <div style="background:#150f24;border:1px solid #2a2440;border-radius:8px;padding:24px;margin:24px 0;">
      <h3 style="color:#fff;margin:0 0 16px 0;font-size:16px;">&#128203; Order Details</h3>
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
    <div style="text-align:center;padding:24px 0;border-top:1px solid #2a2440;margin-top:24px;color:#888;font-size:13px;">
      <p>Questions? Contact us at <a href="mailto:info@microdos2u.com" style="color:#9a02d0;">info@microdos2u.com</a></p>
      <p style="margin-top:12px;">microDOS(2) | 9555 Las Vegas Blvd South, Suite 100 | Las Vegas, NV 89123</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendOrderNotification(params: {
  status: 'processing' | 'shipped' | 'cancelled';
  poNumber: string;
  customerEmail: string;
  businessName: string;
  total: number;
  orderDate: string;
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;
  testEmail?: string; // holtcrowder@gmail.com for testing
}) {
  const html = buildNotificationHTML(params);

  const subjectMap: Record<string, string> = {
    processing: `[microDOS(2)] Order ${params.poNumber} Confirmed - Being Processed`,
    shipped: `[microDOS(2)] Order ${params.poNumber} Has Shipped!`,
    cancelled: `[microDOS(2)] Order ${params.poNumber} Cancelled`,
  };

  const recipients = [params.customerEmail];
  if (params.testEmail) {
    recipients.push(params.testEmail);
  }

  const results = [];
  for (const to of recipients) {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          subject: subjectMap[params.status] || `[microDOS(2)] Order ${params.poNumber} Update`,
          html,
        },
      });
      results.push({ to, success: !error, id: data?.id || null, error: error?.message });
    } catch (err: any) {
      results.push({ to, success: false, error: err.message });
    }
  }

  return results;
}
