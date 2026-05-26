import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ChargeRequest {
  opaqueData: { dataDescriptor: string; dataValue: string }
  amount: string
  invoiceId: string
  customerEmail: string
  description?: string
}

interface AuthorizeNetResponse {
  messages: {
    resultCode: string
    message: Array<{ code: string; text: string }>
  }
  transactionResponse?: {
    responseCode: string
    transId: string
    authCode: string
    avsResultCode: string
    cvvResultCode: string
    accountNumber: string
    accountType: string
    messages?: Array<{ code: string; description: string }>
    errors?: Array<{ errorCode: string; errorText: string }>
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const supabaseAdmin = createClient(
    'https://fildaxejimuvfrcqmoba.supabase.co',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    const body: ChargeRequest = await req.json()

    // Read credentials from database instead of env vars
    const { data: configData } = await supabaseAdmin
      .from('app_config')
      .select('key, value')
      .in('key', [
        'payment_client_id',
        'payment_api_key',
        'payment_mode',
      ])

    const configMap = new Map((configData || []).map((r: any) => [r.key, r.value]))
    const loginId = configMap.get('payment_client_id') || ''
    const txKey = configMap.get('payment_api_key') || ''
    const sandbox = (configMap.get('payment_mode') || 'test') === 'test'

    if (!loginId || !txKey) {
      return json({ success: false, error: 'Payment processor not configured' }, 500)
    }

    const endpoint = sandbox
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api'

    const payload = {
      createTransactionRequest: {
        merchantAuthentication: { name: loginId, transactionKey: txKey },
        refId: body.invoiceId,
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: body.amount,
          payment: {
            opaqueData: {
              dataDescriptor: body.opaqueData.dataDescriptor,
              dataValue: body.opaqueData.dataValue,
            },
          },
          order: {
            invoiceNumber: body.invoiceId,
            description: body.description || `Payment for Invoice ${body.invoiceId}`,
          },
          customer: { email: body.customerEmail },
        },
      },
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result: AuthorizeNetResponse = await resp.json()
    const tx = result.transactionResponse

    if (result.messages?.resultCode !== 'Ok') {
      const err = result.messages?.message?.[0]
      return json({ success: false, error: err?.text || 'API error', code: err?.code || 'E00001' }, 400)
    }

    if (tx?.responseCode !== '1') {
      const err = tx?.errors?.[0] || tx?.messages?.[0]
      return json({ success: false, error: err?.errorText || err?.description || 'Declined', code: err?.errorCode || err?.code || '0' }, 400)
    }

    // SUCCESS - update invoice via service role
    let updated = false
    try {
      const { error } = await supabaseAdmin
        .from('invoices')
        .update({ status: 'paid', transaction_id: tx.transId, paid_at: new Date().toISOString() })
        .eq('invoice_number', body.invoiceId)
      if (!error) updated = true
    } catch (e) {
      console.error('Invoice update failed:', e)
    }

    return json({
      success: true,
      transactionId: tx.transId,
      authCode: tx.authCode,
      accountNumber: tx.accountNumber,
      accountType: tx.accountType,
      invoiceUpdated: updated,
      message: tx.messages?.[0]?.description || 'Approved',
    }, 200)

  } catch (err: any) {
    console.error('[authorize-net-charge] Error:', err)
    return json({ success: false, error: err.message || 'Internal error' }, 500)
  }
})
