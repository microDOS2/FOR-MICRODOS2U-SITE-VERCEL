/**
 * CartPaymentForm — Inline card payment form for in-app checkout
 * Uses Accept.js to tokenize, then edge function to charge
 */

import { useState } from 'react';
import { CreditCard, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  tokenizeCard,
  chargeCard,
  getAuthorizeNetConfig,
} from '@/lib/authorizeNetService';

interface CartPaymentFormProps {
  amount: number;
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

function formatCardNumber(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 16);
  const parts = v.match(/.{1,4}/g);
  return parts ? parts.join(' ') : v;
}

export function CartPaymentForm({ amount, onSuccess, onError, onBack }: CartPaymentFormProps) {
  const [card, setCard] = useState({
    cardNumber: '',
    cardholderName: '',
    month: '',
    year: '',
    cvv: '',
    zip: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!card.cardNumber.replace(/\s/g, '') || !card.cardholderName || !card.month || !card.year || !card.cvv) {
      onError('Please fill in all card fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const config = await getAuthorizeNetConfig();
      if (!config.enabled) {
        throw new Error('Payment processing is not configured');
      }

      // Tokenize card via Accept.js
      const tokenResult = await tokenizeCard(
        {
          cardNumber: card.cardNumber.replace(/\s/g, ''),
          month: card.month,
          year: card.year,
          cardCode: card.cvv,
          zip: card.zip,
          fullName: card.cardholderName,
        },
        config
      );

      if (!tokenResult.success || !tokenResult.opaqueData) {
        throw new Error(tokenResult.errorMessage || 'Failed to tokenize card');
      }

      // Charge the card via edge function
      const chargeResult = await chargeCard(
        tokenResult.opaqueData,
        amount,
        'cart-checkout',
        '',
        'Cart Checkout Payment'
      );

      if (!chargeResult.success) {
        throw new Error(chargeResult.error || 'Payment declined');
      }

      onSuccess(chargeResult.transactionId || 'unknown');
    } catch (err: any) {
      onError(err.message || 'Payment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => (currentYear + i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-[#9a02d0] hover:text-[#ff66c4] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to cart
      </button>

      {/* Amount display */}
      <div className="bg-[#0a0514] rounded-lg p-4 border border-[#44f80c]/30 text-center">
        <p className="text-gray-400 text-sm">Total to charge</p>
        <p className="text-3xl font-bold text-[#44f80c]">${amount.toFixed(2)}</p>
      </div>

      {/* Card Number */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Card Number</label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            value={card.cardNumber}
            onChange={(e) => setCard({ ...card, cardNumber: formatCardNumber(e.target.value) })}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] focus:ring-1 focus:ring-[#9a02d0] text-sm font-mono"
            maxLength={19}
          />
        </div>
      </div>

      {/* Cardholder Name */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Cardholder Name</label>
        <input
          type="text"
          placeholder="Full name on card"
          value={card.cardholderName}
          onChange={(e) => setCard({ ...card, cardholderName: e.target.value })}
          className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] focus:ring-1 focus:ring-[#9a02d0] text-sm"
        />
      </div>

      {/* Expiry & CVV */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Month</label>
          <select
            value={card.month}
            onChange={(e) => setCard({ ...card, month: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9a02d0] text-sm"
          >
            <option value="">MM</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Year</label>
          <select
            value={card.year}
            onChange={(e) => setCard({ ...card, year: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9a02d0] text-sm"
          >
            <option value="">YYYY</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide">CVV</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123"
            value={card.cvv}
            onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] focus:ring-1 focus:ring-[#9a02d0] text-sm font-mono"
            maxLength={4}
          />
        </div>
      </div>

      {/* ZIP */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Billing ZIP</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="89123"
          value={card.zip}
          onChange={(e) => setCard({ ...card, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
          className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] focus:ring-1 focus:ring-[#9a02d0] text-sm"
          maxLength={5}
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90 font-semibold py-3"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
        ) : (
          <><Lock className="w-4 h-4 mr-2" /> Pay ${amount.toFixed(2)}</>
        )}
      </Button>

      <p className="text-xs text-gray-600 text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secured by Authorize.net
      </p>
    </div>
  );
}
