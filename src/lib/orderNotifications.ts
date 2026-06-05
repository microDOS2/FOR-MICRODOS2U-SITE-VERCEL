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
      const { data, error } = await supabase.functions.invoke('send-order-notification', {
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

function buildInvoiceReminderHTML(params: {
  invoiceNumber: string;
  poNumber: string;
  businessName: string;
  total: number;
  dueDate: string;
  daysOverdue: number;
}) {
  const { invoiceNumber, poNumber, businessName, total, dueDate, daysOverdue } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice Reminder</title></head>
<body style="margin:0; padding:0; background-color:#0a0514; font-family:'Segoe UI',Arial,sans-serif; color:#ffffff;">
  <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
    <div style="text-align:center; margin-bottom:30px;">
      <div style="font-size:24px; font-weight:bold;">
        <span style="color:#44f80c;">micro</span><span style="color:#9a02d0;">DOS</span><span style="color:#ff66c4;">(2)</span>
      </div>
      <div style="height:3px; background:linear-gradient(90deg,#44f80c,#9a02d0,#ff66c4); margin-top:12px; border-radius:2px;"></div>
    </div>
    <div style="background:#150f24; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:30px; margin-bottom:20px;">
      <h1 style="color:#ffffff; font-size:20px; margin:0 0 8px 0;">Invoice Reminder: ${daysOverdue} Days Overdue</h1>
      <p style="color:#ff4444; font-size:14px; margin:0 0 20px 0; font-weight:600;">Please submit payment at your earliest convenience.</p>
      <div style="background:#0a0514; border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#9ca3af;">Business</span><span style="color:#ffffff; font-weight:500;">${businessName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#9ca3af;">Invoice</span><span style="color:#ffffff; font-weight:500;">${invoiceNumber}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#9ca3af;">PO Number</span><span style="color:#ffffff; font-weight:500;">${poNumber}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#9ca3af;">Due Date</span><span style="color:#ff4444; font-weight:500;">${dueDate}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:12px 0 0 0;">
          <span style="color:#9ca3af; font-size:16px;">Total Due</span><span style="color:#44f80c; font-weight:700; font-size:18px;">$${total.toFixed(2)}</span>
        </div>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://www.microdos2u.com" style="background:linear-gradient(135deg,#9a02d0,#7a01a8); color:#ffffff; text-decoration:none; padding:12px 32px; border-radius:8px; font-weight:600; font-size:15px; display:inline-block;">Pay Now</a>
      </div>
    </div>
    <div style="color:#6b7280; font-size:12px; text-align:center;">microDOS(2) | 9555 Las Vegas Blvd South, Suite 100 | info@microdos2u.com</div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceReminder(params: {
  invoiceNumber: string;
  poNumber: string;
  customerEmail: string;
  businessName: string;
  total: number;
  dueDate: string;
  daysOverdue: number;
}) {
  const html = buildInvoiceReminderHTML(params);
  const subject = `[microDOS(2)] Invoice ${params.invoiceNumber} - ${params.daysOverdue} Days Overdue - Please Submit Payment`;

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to: params.customerEmail, subject, html },
    });
    return { success: !error, id: data?.id || null, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
