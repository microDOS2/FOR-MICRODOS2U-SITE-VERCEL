/**
 * PaymentForm — Authorize.net Accept.js card input form
 * Styled with microDOS(2) brand colors: #0a0514 bg, #150f24 card, #44f80c green
 */

import { useState, useCallback } from 'react'
import { CreditCard, Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  tokenizeCard,
  chargeCard,
  type AuthorizeNetConfig,
} from '@/lib/authorizeNetService'

interface PaymentFormProps {
  config: AuthorizeNetConfig
  amount: number
  invoiceId: string
  customerEmail: string
  description?: string
  onSuccess?: (result: { transactionId: string; authCode?: string }) => void
  onError?: (error: string) => void
}

interface CardInput {
  cardNumber: string
  cardholderName: string
  month: string
  year: string
  cvv: string
  zip: string
}

function formatCardNumber(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 16)
  const parts = v.match(/.{1,4}/g)
  return parts ? parts.join(' ') : v
}

function detectCardType(num: string): string {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n)) return 'visa'
  if (/^5[1-5]/.test(n)) return 'mastercard'
  if (/^3[47]/.test(n)) return 'amex'
  if (/^6(?:011|5)/.test(n)) return 'discover'
  return ''
}

export function PaymentForm({
  config,
  amount,
  invoiceId,
  customerEmail,
  description,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const [card, setCard] = useState<CardInput>({
    cardNumber: '',
    cardholderName: '',
    month: '',
    year: '',
    cvv: '',
    zip: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const cardType = detectCardType(card.cardNumber)

  const isValid = useCallback(() => {
    const num = card.cardNumber.replace(/\s/g, '')
    return (
      num.length >= 13 &&
      card.cardholderName.length > 0 &&
      card.month.length === 2 &&
      card.year.length === 4 &&
      card.cvv.length >= 3 &&
      card.zip.length >= 5
    )
  }, [card])

  const handleSubmit = async () => {
    if (!isValid()) return
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Step 1: Tokenize card with Accept.js
      const tokenResult = await tokenizeCard(
        {
          cardNumber: card.cardNumber,
          month: card.month,
          year: card.year,
          cardCode: card.cvv,
          zip: card.zip,
          fullName: card.cardholderName,
        },
        config
      )

      if (!tokenResult.success || !tokenResult.opaqueData) {
        const msg = tokenResult.errorMessage || 'Card tokenization failed'
        setError(msg)
        onError?.(msg)
        setLoading(false)
        return
      }

      // Step 2: Charge via Edge Function
      const chargeResult = await chargeCard(
        tokenResult.opaqueData,
        amount,
        invoiceId,
        customerEmail,
        description
      )

      if (!chargeResult.success) {
        const msg = chargeResult.error || 'Payment declined'
        setError(msg)
        onError?.(msg)
        setLoading(false)
        return
      }

      // Success
      setSuccess(true)
      onSuccess?.({
        transactionId: chargeResult.transactionId || '',
        authCode: chargeResult.authCode,
      })
    } catch (err: any) {
      const msg = err?.message || 'Payment failed'
      setError(msg)
      onError?.(msg)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-[#44f80c]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#44f80c]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Payment Successful</h3>
        <p className="text-gray-400 text-sm">Your transaction has been processed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          Card Number
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            value={card.cardNumber}
            onChange={(e) =>
              setCard({ ...card, cardNumber: formatCardNumber(e.target.value) })
            }
            maxLength={19}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
          />
          {cardType && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#44f80c] font-medium uppercase">
              {cardType}
            </span>
          )}
        </div>
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          Cardholder Name
        </label>
        <input
          type="text"
          placeholder="JOHN DOE"
          value={card.cardholderName}
          onChange={(e) => setCard({ ...card, cardholderName: e.target.value.toUpperCase() })}
          className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
        />
      </div>

      {/* Expiry + CVV row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Month</label>
          <select
            value={card.month}
            onChange={(e) => setCard({ ...card, month: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
          >
            <option value="">MM</option>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, '0')
              return <option key={m} value={m}>{m}</option>
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Year</label>
          <select
            value={card.year}
            onChange={(e) => setCard({ ...card, year: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
          >
            <option value="">YYYY</option>
            {Array.from({ length: 10 }, (_, i) => {
              const y = String(new Date().getFullYear() + i)
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">CVV</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="password"
              placeholder="123"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              maxLength={4}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
            />
          </div>
        </div>
      </div>

      {/* ZIP */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          Billing ZIP
        </label>
        <input
          type="text"
          placeholder="12345"
          value={card.zip}
          onChange={(e) => setCard({ ...card, zip: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          maxLength={10}
          className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#44f80c]/50"
        />
      </div>

      {/* Amount display */}
      <div className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10">
        <span className="text-gray-400 text-sm">Amount to charge</span>
        <span className="text-[#44f80c] font-bold text-lg">${amount.toFixed(2)}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={loading || !isValid()}
        className="w-full bg-gradient-to-r from-[#44f80c] to-[#9a02d0] hover:opacity-90 text-white font-bold py-3"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </Button>

      <p className="text-center text-gray-600 text-xs flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Authorize.net. Card data never touches our servers.
      </p>
    </div>
  )
}
