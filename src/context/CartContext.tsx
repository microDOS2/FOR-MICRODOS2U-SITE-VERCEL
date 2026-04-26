import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CartItem {
  id: string;
  productName: string;
  packagingName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderResult {
  orderId: string;
  poNumber: string;
  invoiceId?: string;
  total: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'totalPrice'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  placeOrder: () => Promise<OrderResult>;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const addItem = useCallback((newItem: Omit<CartItem, 'totalPrice'>) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.sku === newItem.sku
      );
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQuantity = existing.quantity + newItem.quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          totalPrice: newQuantity * existing.unitPrice,
        };
        return updated;
      }
      
      // Add new item
      return [
        ...prev,
        {
          ...newItem,
          totalPrice: newItem.quantity * newItem.unitPrice,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
          : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const placeOrder = useCallback(async (): Promise<OrderResult> => {
    if (!user) throw new Error('You must be logged in to place an order');
    if (items.length === 0) throw new Error('Your cart is empty');

    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    // Build cart details for notes
    const cartDetails = items.map(item => 
      `${item.quantity}x ${item.productName} (${item.packagingName}) — SKU: ${item.sku} — $${item.totalPrice.toFixed(2)}`
    ).join('; ');

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        po_number: poNumber,
        user_id: user.id,
        items: itemCount,
        total: total,
        status: 'pending',
        notes: cartDetails,
        shipping_address: [user.address, user.city, user.state, user.zip].filter(Boolean).join(', ') || null,
        contact_person: user.business_name || null,
        contact_phone: user.phone || null,
      })
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('[placeOrder] order insert error:', orderError);
      throw new Error('Failed to create order: ' + (orderError?.message || 'Unknown'));
    }

    // 2. Lookup variant IDs by SKU and insert order_items
    const skuList = items.map(i => i.sku);
    const { data: variantData } = await supabase
      .from('product_variants')
      .select('id,product_id,sku')
      .in('sku', skuList);

    const variantMap = new Map((variantData || []).map((v: any) => [v.sku, v]));

    const orderItems = items.map(item => {
      const v = variantMap.get(item.sku);
      return {
        order_id: orderData.id,
        product_id: v?.product_id || null,
        variant_id: v?.id || null,
        product_name: item.productName,
        variant_name: item.packagingName,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.totalPrice,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      console.error('[placeOrder] order_items insert error:', itemsError);
    }

    // 3. The auto-invoice trigger creates the invoice automatically
    // Fetch the created invoice for the result
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', orderData.id)
      .maybeSingle();

    // Clear cart after successful order
    clearCart();
    setIsOpen(false);

    return {
      orderId: orderData.id,
      poNumber: orderData.po_number,
      invoiceId: invoiceData?.id,
      total: total,
    };
  }, [items, user, clearCart]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        placeOrder,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
