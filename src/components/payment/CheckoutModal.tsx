/**
 * CheckoutModal — Modal wrapper for the PaymentForm
 * Opens from cart/invoice "Pay Now" buttons
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PaymentForm } from './PaymentForm'
import { getAuthorizeNetConfig, type AuthorizeNetConfig } from '@/lib/authorizeNetService'
import { Loader2 } from 'lucide-react'

interface CheckoutModalProps {
  open: boolean
  onClose: () => void
  amount: number
  invoiceId: string
  customerEmail: string
  description?: string
  onPaymentSuccess?: (result: { transactionId: string }) => void
  onPaymentError?: (error: string) => void
}

export function CheckoutModal({
  open,
  onClose,
  amount,
  invoiceId,
  customerEmail,
  description,
  onPaymentSuccess,
  onPaymentError,
}: CheckoutModalProps) {
  const [config, setConfig] = useState<AuthorizeNetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    getAuthorizeNetConfig()
      .then((cfg) => {
        setConfig(cfg)
        if (!cfg.enabled) {
          setError('Payment processing is not configured. Contact admin.')
        }
      })
      .catch(() => setError('Failed to load payment config'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">Secure Checkout</h3>
            <p className="text-gray-500 text-xs mt-0.5">Invoice #{invoiceId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : config ? (
            <PaymentForm
              config={config}
              amount={amount}
              invoiceId={invoiceId}
              customerEmail={customerEmail}
              description={description}
              onSuccess={(result) => {
                onPaymentSuccess?.(result)
                setTimeout(onClose, 2000)
              }}
              onError={(err) => {
                onPaymentError?.(err)
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
