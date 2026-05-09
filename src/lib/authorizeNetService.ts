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

// ─── Load Accept.js Script Dynamically ───────────────────────────────

let scriptLoaded = false
let scriptLoading: Promise<void> | null = null
const SUPABASE_URL = 'https://fildaxejimuvfrcqmoba.supabase.co'

function waitForAcceptJs(maxWait = 5000, interval = 200): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const check = () => {
      if (typeof (window as any).Accept !== 'undefined') {
        resolve()
        return
      }
      if (Date.now() - startTime > maxWait) {
        reject(new Error('Accept.js initialized but Accept global not found'))
        return
      }
      setTimeout(check, interval)
    }
    check()
  })
}

function loadAcceptJs(mode: 'test' | 'live', retries = 3): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoading) return scriptLoading

  scriptLoading = new Promise((resolve, reject) => {
    const url =
      mode === 'live'
        ? 'https://js.authorize.net/v1/Accept.js'
        : 'https://jstest.authorize.net/v1/Accept.js'

    // If script tag already exists, just wait for Accept global
    if (document.querySelector(`script[src="${url}"]`)) {
      console.log('[AuthorizeNet] Script tag already exists, waiting for Accept global...')
      waitForAcceptJs().then(() => {
        scriptLoaded = true
        resolve()
      }).catch(reject)
      return
    }

    console.log(`[AuthorizeNet] Loading Accept.js from ${url}...`)

    const script = document.createElement('script')
    script.src = url
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.crossOrigin = 'anonymous'

    let timeoutId: ReturnType<typeof setTimeout>

    const cleanup = () => {
      clearTimeout(timeoutId)
      script.onload = null
      script.onerror = null
    }

    script.onload = () => {
      console.log('[AuthorizeNet] Script loaded, polling for Accept global...')
      cleanup()
      // Script loaded but Accept global may not be ready yet — poll for it
      waitForAcceptJs(8000, 300).then(() => {
        console.log('[AuthorizeNet] Accept.js ready')
        scriptLoaded = true
        resolve()
      }).catch((err) => {
        console.error('[AuthorizeNet] Accept global not found after load:', err)
        if (retries > 0) {
          scriptLoading = null
          document.head.removeChild(script)
          loadAcceptJs(mode, retries - 1).then(resolve).catch(reject)
        } else {
          reject(new Error('Accept.js loaded but Accept global is undefined. Your domain may not be whitelisted in Authorize.net Merchant Interface.'))
        }
      })
    }

    script.onerror = (e) => {
      cleanup()
      console.error('[AuthorizeNet] Script load error:', e)
      if (script.parentNode) document.head.removeChild(script)
      if (retries > 0) {
        scriptLoading = null
        console.log(`[AuthorizeNet] Retrying... (${retries} attempts left)`)
        setTimeout(() => {
          loadAcceptJs(mode, retries - 1).then(resolve).catch(reject)
        }, 1000)
      } else {
        reject(new Error('Failed to load Accept.js — check CSP settings or domain whitelist'))
      }
    }

    timeoutId = setTimeout(() => {
      cleanup()
      if (script.parentNode) document.head.removeChild(script)
      if (retries > 0) {
        scriptLoading = null
        console.log(`[AuthorizeNet] Load timed out, retrying... (${retries} attempts left)`)
        loadAcceptJs(mode, retries - 1).then(resolve).catch(reject)
      } else {
        reject(new Error('Accept.js load timed out after all retries'))
      }
    }, 15000)

    document.head.appendChild(script)
  })

  return scriptLoading
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
  await loadAcceptJs(config.mode)

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
