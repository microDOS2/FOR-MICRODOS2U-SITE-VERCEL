import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface ChargeRequest {
  opaqueData: {
    dataDescriptor: string
    dataValue: string
  }
  amount: string
  invoiceId: string
  customerEmail: string
  description?: string
}

interface AuthorizeNetResponse {
  messages: {
    resultCode: string
    message: Array<{
      code: string
      text: string
    }>
  }
  transactionResponse?: {
    responseCode: string
    authCode: string
    avsResultCode: string
    cvvResultCode: string
    transId: string
    refTransID: string
    transHash: string
    accountNumber: string
    accountType: string
    messages?: Array<{
      code: string
      description: string
    }>
    errors?: Array<{
      errorCode: string
      errorText: string
    }>
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}

serve(async (req) => {
  // ─── CORS Preflight ───
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const body: ChargeRequest = await req.json()

    // ─── Get merchant credentials from env ───
    const apiLoginId = Deno.env.get('AUTHORIZE_NET_API_LOGIN_ID') || ''
    const transactionKey = Deno.env.get('AUTHORIZE_NET_TRANSACTION_KEY') || ''
    const isSandbox = (Deno.env.get('AUTHORIZE_NET_MODE') || 'test') === 'test'

    if (!apiLoginId || !transactionKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Payment processor not configured. Set AUTHORIZE_NET_API_LOGIN_ID and AUTHORIZE_NET_TRANSACTION_KEY in Supabase secrets.',
        },
        500
      )
    }

    const endpointUrl = isSandbox
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api'

    // ─── Build the transaction request ───
    // XSD element order: transactionType, amount, payment, order, customer...
    const payload = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey,
        },
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
          customer: {
            email: body.customerEmail,
          },
        },
      },
    }

    // ─── Call Authorize.net ───
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result: AuthorizeNetResponse = await response.json()

    // ─── Parse response ───
    const txResponse = result.transactionResponse
    const overallResult = result.messages?.resultCode

    // Handle overall API errors
    if (overallResult !== 'Ok') {
      const apiError = result.messages?.message?.[0]?.text || 'Unknown Authorize.net error'
      const apiCode = result.messages?.message?.[0]?.code || 'E00001'
      return jsonResponse({ success: false, error: apiError, code: apiCode }, 400)
    }

    // Handle transaction-level errors
    if (txResponse?.responseCode !== '1') {
      const txError = txResponse?.errors?.[0]?.errorText
        || txResponse?.messages?.[0]?.description
        || 'Transaction declined'
      const txErrorCode = txResponse?.errors?.[0]?.errorCode
        || txResponse?.messages?.[0]?.code
        || '0'

      return jsonResponse(
        { success: false, error: txError, code: txErrorCode, transactionId: txResponse?.transId || null },
        400
      )
    }

    // ─── Success ───
    return jsonResponse({
      success: true,
      transactionId: txResponse.transId,
      authCode: txResponse.authCode,
      avsResultCode: txResponse.avsResultCode,
      cvvResultCode: txResponse.cvvResultCode,
      accountNumber: txResponse.accountNumber,
      accountType: txResponse.accountType,
      message: txResponse.messages?.[0]?.description || 'Transaction approved',
    }, 200)

  } catch (err: any) {
    console.error('[authorize-net-charge] Error:', err)
    return jsonResponse({ success: false, error: err.message || 'Internal error' }, 500)
  }
})
