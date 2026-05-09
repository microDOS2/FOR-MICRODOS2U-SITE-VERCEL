/**
 * AuthorizeNetService — Client-side Accept.js integration for Authorize.net
 *
 * Accept.js tokenizes card data directly with Authorize.net servers so your
 * code never handles raw card numbers. Returns a one-time nonce used by the
 * Edge Function to charge the card server-side.
 */

import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────

export interface OpaqueData {
  dataDescriptor: string // e.g. "COMMON.ACCEPT.INAPP.PAYMENT"
  dataValue: string      // The payment nonce
}

export interface TokenizeResult {
  success: boolean
  opaqueData?: OpaqueData
  errorMessage?: string
  messages?: any[]
}

export interface ChargeResult {
  success: boolean
  transactionId?: string
  authCode?: string
  accountNumber?: string
  accountType?: string
  error?: string
  code?: string
}

export interface AuthorizeNetConfig {
  enabled: boolean
  mode: 'test' | 'live'
  publicClientKey: string
  apiLoginId: string
  endpointUrl: string
}

// ─── Accept.js is pre-loaded in index.html ───────────────────────────
// <script src="https://jstest.authorize.net/v1/Accept.js">
// This just verifies it's ready before use.

let scriptLoaded = false
const SUPABASE_URL = 'https://fildaxejimuvfrcqmoba.supabase.co'

function ensureAcceptJsReady(maxWait = 8000): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (typeof (window as any).Accept !== 'undefined') {
        scriptLoaded = true
        resolve()
        return
      }
      if (Date.now() - start > maxWait) {
        reject(new Error('Accept.js is not loaded correctly'))
        return
      }
      setTimeout(check, 300)
    }
    check()
  })
}

// ─── Fetch Config from Supabase ──────────────────────────────────────

export async function getAuthorizeNetConfig(): Promise<AuthorizeNetConfig> {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'payment_processor',
      'payment_mode',
      'payment_public_client_key',
      'payment_client_id',
      'payment_endpoint_url',
    ])

  const map = new Map((data || []).map((r: any) => [r.key, r.value]))
  const processor = map.get('payment_processor') || ''
  const mode = (map.get('payment_mode') as 'test' | 'live') || 'test'
  const publicKey = map.get('payment_public_client_key') || ''
  const clientId = map.get('payment_client_id') || ''
  const endpoint = map.get('payment_endpoint_url') || ''

  return {
    enabled: processor === 'authorize_net' && publicKey.length > 0 && clientId.length > 0,
    mode,
    publicClientKey: publicKey,
    apiLoginId: clientId,
    endpointUrl: endpoint,
  }
}

// ─── Tokenize Card with Accept.js ────────────────────────────────────

export async function tokenizeCard(
  cardData: {
    cardNumber: string
    month: string
    year: string
    cardCode: string
    zip?: string
    fullName?: string
  },
  config: AuthorizeNetConfig
): Promise<TokenizeResult> {
  await ensureAcceptJsReady()

  return new Promise((resolve) => {
    const authData = {
      clientKey: config.publicClientKey,
      apiLoginID: config.apiLoginId,
    }

    const cardDataPayload = {
      cardNumber: cardData.cardNumber.replace(/\s/g, ''),
      month: cardData.month,
      year: cardData.year,
      cardCode: cardData.cardCode,
      zip: cardData.zip || '',
      fullName: cardData.fullName || '',
    }

    const secureData = {
      authData,
      cardData: cardDataPayload,
    }

    // @ts-ignore — Accept.js is loaded globally
    if (typeof Accept === 'undefined') {
      resolve({ success: false, errorMessage: 'Accept.js not loaded' })
      return
    }

    // @ts-ignore
    Accept.dispatchData(secureData, (response: any) => {
      if (response.messages.resultCode === 'Error') {
        const errorMsg = response.messages.message?.[0]?.text || 'Card tokenization failed'
        resolve({
          success: false,
          errorMessage: errorMsg,
          messages: response.messages.message,
        })
        return
      }

      resolve({
        success: true,
        opaqueData: {
          dataDescriptor: response.opaqueData.dataDescriptor,
          dataValue: response.opaqueData.dataValue,
        },
      })
    })
  })
}

// ─── Charge Card via Edge Function ───────────────────────────────────

export async function chargeCard(
  opaqueData: OpaqueData,
  amount: number,
  invoiceId: string,
  customerEmail: string,
  description?: string
): Promise<ChargeResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''

  const functionUrl = `${SUPABASE_URL}/functions/v1/authorize-net-charge`

  const resp = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({
      opaqueData,
      amount: amount.toFixed(2),
      invoiceId,
      customerEmail,
      description,
    }),
  })

  const result = await resp.json()

  if (!resp.ok || !result.success) {
    return {
      success: false,
      error: result.error || 'Payment failed',
      code: result.code || '0',
    }
  }

  return {
    success: true,
    transactionId: result.transactionId,
    authCode: result.authCode,
    accountNumber: result.accountNumber,
    accountType: result.accountType,
  }
}
