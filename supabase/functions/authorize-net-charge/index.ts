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

serve(async (req) => {
  // ─── CORS ───
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
      },
    })
  }

  // ─── Auth check ───
  const authHeader = req.headers.get('Authorization') || ''
  const apiKey = req.headers.get('apikey') || ''

  // Verify the caller is authenticated via Supabase
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!authHeader && !apiKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body: ChargeRequest = await req.json()

    // ─── Get merchant credentials from env ───
    const apiLoginId = Deno.env.get('AUTHORIZE_NET_API_LOGIN_ID') || ''
    const transactionKey = Deno.env.get('AUTHORIZE_NET_TRANSACTION_KEY') || ''
    const isSandbox = (Deno.env.get('AUTHORIZE_NET_MODE') || 'test') === 'test'

    if (!apiLoginId || !transactionKey) {
      return new Response(
        JSON.stringify({ error: 'Payment processor not configured. Set AUTHORIZE_NET_API_LOGIN_ID and AUTHORIZE_NET_TRANSACTION_KEY in Supabase secrets.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const endpointUrl = isSandbox
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api'

    // ─── Build the transaction request ───
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
          customer: {
            email: body.customerEmail,
          },
          order: {
            invoiceNumber: body.invoiceId,
            description: body.description || `Payment for Invoice ${body.invoiceId}`,
          },
        },
      },
    }

    // ─── Call Authorize.net ───
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
      return new Response(
        JSON.stringify({
          success: false,
          error: apiError,
          code: apiCode,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Handle transaction-level errors
    if (txResponse?.responseCode !== '1') {
      const txError = txResponse?.errors?.[0]?.errorText
        || txResponse?.messages?.[0]?.description
        || 'Transaction declined'
      const txErrorCode = txResponse?.errors?.[0]?.errorCode
        || txResponse?.messages?.[0]?.code
        || '0'

      return new Response(
        JSON.stringify({
          success: false,
          error: txError,
          code: txErrorCode,
          transactionId: txResponse?.transId || null,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ─── Success ───
    return new Response(
      JSON.stringify({
        success: true,
        transactionId: txResponse.transId,
        authCode: txResponse.authCode,
        avsResultCode: txResponse.avsResultCode,
        cvvResultCode: txResponse.cvvResultCode,
        accountNumber: txResponse.accountNumber,
        accountType: txResponse.accountType,
        message: txResponse.messages?.[0]?.description || 'Transaction approved',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (err: any) {
    console.error('[authorize-net-charge] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
