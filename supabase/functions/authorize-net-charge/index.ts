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
  'Access-Control-Allow-Origin': 'https://www.microdos2u.com',
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
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    const body: ChargeRequest = await req.json()

    // Read ONLY mode from database; login ID and transaction key from env vars
    const { data: configData } = await supabaseAdmin
      .from('app_config')
      .select('key, value')
      .in('key', ['payment_mode'])

    const configMap = new Map((configData || []).map((r: any) => [r.key, r.value]))
    // BOTH credentials from env vars - guaranteed paired correctly
    const loginId = Deno.env.get('AUTHORIZE_NET_API_LOGIN_ID') || ''
    const txKey = Deno.env.get('AUTHORIZE_NET_TRANSACTION_KEY') || ''
    const sandbox = (configMap.get('payment_mode') || 'test') === 'test'

    console.log('[EDGE DEBUG] loginId:', loginId ? `${loginId.substring(0, 6)}...` : 'MISSING')
    console.log('[EDGE DEBUG] txKey length:', txKey ? txKey.length : 0)
    console.log('[EDGE DEBUG] sandbox:', sandbox)

    if (!loginId || !txKey) {
      return json({ 
        success: false, 
        error: 'Payment processor not configured',
        debug: { loginIdPresent: !!loginId, txKeyPresent: !!txKey }
      }, 500)
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

    console.log('[EDGE DEBUG] Authorize.net resultCode:', result.messages?.resultCode)
    console.log('[EDGE DEBUG] Authorize.net responseCode:', tx?.responseCode)

    if (result.messages?.resultCode !== 'Ok') {
      const err = result.messages?.message?.[0]
      console.log('[EDGE DEBUG] API Error:', err?.code, err?.text)
      return json({ 
        success: false, 
        error: err?.text || 'API error', 
        code: err?.code || 'E00001',
      }, 400)
    }

    if (tx?.responseCode !== '1') {
      const err = tx?.errors?.[0] || tx?.messages?.[0]
      console.log('[EDGE DEBUG] Transaction Error:', err)
      return json({ 
        success: false, 
        error: err?.errorText || err?.description || 'Declined', 
        code: err?.errorCode || err?.code || '0',
      }, 400)
    }

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
