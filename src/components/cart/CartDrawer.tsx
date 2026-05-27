import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Minus, Plus, Trash2, ShoppingCart, Loader2, CreditCard, FileText } from 'lucide-react';
import { formatPrice } from '@/data/products';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { CartPaymentForm } from './CartPaymentForm';

type CheckoutStep = 'cart' | 'payment' | 'success';

export function CartDrawer() {
  const { items, removeItem, updateQuantity, clearCart, placeOrder, totalPrice, isOpen, setIsOpen } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [lastOrder, setLastOrder] = useState<{ poNumber: string; total: number } | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmitOrder = async () => {
    if (!user) { toast.error('Please log in'); return; }
    setIsCheckingOut(true);
    try {
      const result = await placeOrder();
      setLastOrder({ poNumber: result.poNumber, total: result.total });
      setStep('success');
      toast.success(
        <div className="space-y-1">
          <p className="font-bold">Order submitted!</p>
          <p className="text-sm">{result.poNumber} — An invoice has been generated.</p>
        </div>,
        { duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handlePayAndPlace = async (transactionId: string) => {
    if (!user) { toast.error('Please log in'); return; }
    setIsCheckingOut(true);
    try {
      const result = await placeOrder(transactionId);
      setLastOrder({ poNumber: result.poNumber, total: result.total });
      setStep('success');
      toast.success(
        <div className="space-y-1">
          <p className="font-bold">Order placed & paid!</p>
          <p className="text-sm">{result.poNumber} — Payment confirmed.</p>
        </div>,
        { duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStep('cart');
      setLastOrder(null);
    }, 300);
  };

  const handleGoToDashboard = () => {
    handleClose();
    setTimeout(() => {
      const role = user?.role;
      if (role === 'wholesaler') navigate('/wholesaler-dashboard');
      else if (role === 'distributor') navigate('/distributor-dashboard');
      else navigate('/');
    }, 400);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="bg-[#150f24] border-l border-white/10 w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle className="text-white flex items-center gap-2">
            {step === 'payment' ? (
              <><CreditCard className="w-5 h-5 text-[#9a02d0]" /> Payment</>
            ) : step === 'success' ? (
              <><ShoppingCart className="w-5 h-5 text-[#44f80c]" /> Confirmation</>
            ) : (
              <><ShoppingCart className="w-5 h-5 text-[#9a02d0]" /> Your Cart</>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* === CART STEP === */}
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Your cart is empty</p>
                  <p className="text-gray-500 text-sm mt-1">Add products to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="bg-[#0a0514] rounded-lg p-4 border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-white font-medium">{item.productName}</h4>
                          <p className="text-gray-400 text-sm">{item.packagingName}</p>
                          <p className="text-gray-500 text-xs">SKU: {item.sku}</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded bg-[#150f24] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-white w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded bg-[#150f24] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[#44f80c] font-medium">{formatPrice(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* === PAYMENT STEP === */}
          {step === 'payment' && (
            <CartPaymentForm
              amount={totalPrice}
              onSuccess={(txId) => handlePayAndPlace(txId)}
              onError={(err) => toast.error(err)}
              onBack={() => setStep('cart')}
            />
          )}

          {/* === SUCCESS STEP === */}
          {step === 'success' && lastOrder && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-full bg-[#44f80c]/20 flex items-center justify-center mx-auto">
                <FileText className="w-10 h-10 text-[#44f80c]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Order Confirmed!</h3>
                <p className="text-3xl font-bold text-[#44f80c] mb-1">{lastOrder.poNumber}</p>
                <p className="text-gray-400">Total: {formatPrice(lastOrder.total)}</p>
              </div>
              <div className="bg-[#0a0514] rounded-lg p-4 border border-white/10 text-left">
                <p className="text-gray-400 text-sm text-center">
                  Your order has been placed successfully. You can track it in your dashboard.
                </p>
              </div>
              <Button onClick={handleGoToDashboard} className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90">
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>

        {/* === CART FOOTER (only in cart step) === */}
        {step === 'cart' && items.length > 0 && (
          <div className="border-t border-white/10 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white text-xl font-bold">{formatPrice(totalPrice)}</span>
            </div>

            {/* Dual checkout buttons */}
            <div className="space-y-2">
              {/* Primary: Pay & Place Order */}
              <Button
                className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90 font-semibold py-3"
                onClick={() => setStep('payment')}
                disabled={isCheckingOut}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pay & Place Order
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-500">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Secondary: Submit Order */}
              <Button
                variant="outline"
                className="w-full border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
                onClick={handleSubmitOrder}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Submit Order</>
                )}
              </Button>
              <p className="text-xs text-gray-600 text-center">
                An invoice will be generated for payment in your portal.
              </p>
            </div>

            <Button variant="ghost" onClick={clearCart} className="w-full text-gray-500 hover:text-red-400 text-xs">
              Clear Cart
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
