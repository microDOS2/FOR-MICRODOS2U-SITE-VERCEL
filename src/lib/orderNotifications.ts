// Order notification email builder
// Calls the send-order-notification edge function with {order_id, status}
// That edge function fetches order data from DB and sends the email via Resend

import { supabase } from './supabase';

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
  // Look up order_id by PO number — the edge function needs order_id, not poNumber
  const { data: orderRow, error: lookupErr } = await supabase
    .from('orders')
    .select('id')
    .eq('po_number', params.poNumber)
    .single();

  if (lookupErr || !orderRow) {
    console.error('[sendOrderNotification] Failed to find order_id for PO:', params.poNumber, lookupErr);
    return [{ to: params.customerEmail, success: false, error: 'Order not found for PO ' + params.poNumber }];
  }

  const results = [];

  // Send to customer
  try {
    const { data, error } = await supabase.functions.invoke('send-order-notification', {
      body: {
        order_id: orderRow.id,
        status: params.status,
      },
    });
    results.push({
      to: params.customerEmail,
      success: !error && data?.success,
      id: data?.results?.[0]?.id || null,
      error: error?.message || data?.results?.[0]?.error,
    });
  } catch (err: any) {
    results.push({ to: params.customerEmail, success: false, error: err.message });
  }

  // Send copy to test email if provided
  if (params.testEmail) {
    try {
      const { data, error } = await supabase.functions.invoke('send-order-notification', {
        body: {
          order_id: orderRow.id,
          status: params.status,
          test_email: params.testEmail,
        },
      });
      results.push({
        to: params.testEmail,
        success: !error && data?.success,
        id: data?.results?.[1]?.id || null,
        error: error?.message,
      });
    } catch (err: any) {
      results.push({ to: params.testEmail, success: false, error: err.message });
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
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
          <a href="https://www.microdos2u.com/#/login" style="background:#150f24; border:1px solid rgba(255,255,255,0.2); color:#ffffff; text-decoration:none; padding:10px 24px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">&#128274; Login</a>
          <a href="https://www.microdos2u.com/#/wholesaler-dashboard" style="background:linear-gradient(135deg,#9a02d0,#7a01a8); color:#ffffff; text-decoration:none; padding:10px 24px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">&#128179; Pay</a>
          <a href="https://www.microdos2u.com/#/wholesaler-dashboard" style="background:#150f24; border:1px solid #ff4444; color:#ff4444; text-decoration:none; padding:10px 24px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">&#10060; Cancel Order</a>
        </div>
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
    // This requires the updated send-order-notification edge function that supports {to, subject, html}
    // Until deployed, it will fail gracefully and the overdue status is still updated via DB cron
    const { data, error } = await supabase.functions.invoke('send-order-notification', {
      body: { to: params.customerEmail, subject, html },
    });
    return { success: !error, id: data?.id || null, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
