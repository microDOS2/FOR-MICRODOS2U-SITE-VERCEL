import { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

interface Store {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  contact_name: string | null;
  is_primary: boolean;
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
  placeOrder: (paymentTransactionId?: string) => Promise<OrderResult>;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  // Store selection
  stores: Store[];
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  storesLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  // Store selection state
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);

  // Fetch stores when cart opens
  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchStores = async () => {
      setStoresLoading(true);
      const { data, error } = await supabase
        .from('wholesaler_store_locations') // unified store table (was legacy 'stores')
        .select('id, name, address, city, state, zip, phone, contact_name, is_primary')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (!error && data) {
        setStores(data);
        // Auto-select primary store if none selected
        const primary = data.find((s: Store) => s.is_primary);
        if (primary && !selectedStoreId) {
          setSelectedStoreId(primary.id);
        } else if (data.length > 0 && !selectedStoreId) {
          setSelectedStoreId(data[0].id);
        }
      }
      setStoresLoading(false);
    };

    fetchStores();
  }, [isOpen, user]);

  const addItem = useCallback((newItem: Omit<CartItem, 'totalPrice'>) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.sku === newItem.sku
      );
      
      if (existingIndex >= 0) {
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

  const placeOrder = useCallback(async (paymentTransactionId?: string): Promise<OrderResult> => {
    if (!user) throw new Error('You must be logged in to place an order');
    if (items.length === 0) throw new Error('Your cart is empty');

    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    // Build cart details for notes
    const cartDetails = items.map(item => 
      `${item.quantity}x ${item.productName} (${item.packagingName}) — SKU: ${item.sku} — $${item.totalPrice.toFixed(2)}`
    ).join('; ');

    // Determine initial status based on payment
    const initialStatus = paymentTransactionId ? 'processing' : 'pending';

    // Get selected store for shipping address
    const selectedStore = stores.find((s) => s.id === selectedStoreId);
    const shippingAddr = selectedStore
      ? [selectedStore.address, selectedStore.city, selectedStore.state, selectedStore.zip].filter(Boolean).join(', ')
      : [user.address, user.city, user.state, user.zip].filter(Boolean).join(', ');
    const contactPerson = selectedStore?.contact_name || user.contact_name || user.business_name || null;
    const contactPhone = selectedStore?.phone || user.phone || null;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        po_number: poNumber,
        user_id: user.id,
        items: itemCount,
        total: total,
        status: initialStatus,
        notes: cartDetails,
        shipping_address: shippingAddr || null,
        contact_person: contactPerson,
        contact_phone: contactPhone,
        shipping_store_id: selectedStoreId,
      })
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('[placeOrder] order insert error:', orderError);
      throw new Error('Failed to create order: ' + (orderError?.message || 'Unknown'));
    }

    // 2. Lookup variant IDs by SKU and insert order_items
    const skuList = items.map(i => i.sku);
    const { data: variantData, error: variantErr } = await supabase
      .from('product_variants')
      .select('id,product_id,sku')
      .in('sku', skuList);

    if (variantErr) {
      try { await supabase.from('order_items').delete().eq('order_id', orderData.id); } catch (e) { /* ignore */ }
      try { await supabase.from('invoices').delete().eq('order_id', orderData.id); } catch (e) { /* ignore */ }
      try { await supabase.from('orders').delete().eq('id', orderData.id); } catch (e) { /* ignore */ }
      throw new Error('Failed to validate order items: ' + variantErr.message);
    }

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
      try { await supabase.from('order_items').delete().eq('order_id', orderData.id); } catch (e) { /* ignore */ }
      try { await supabase.from('invoices').delete().eq('order_id', orderData.id); } catch (e) { /* ignore */ }
      try { await supabase.from('orders').delete().eq('id', orderData.id); } catch (e) { /* ignore */ }
      throw new Error('Failed to add order items: ' + itemsError.message);
    }

    // 3. Fetch the auto-created invoice
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', orderData.id)
      .maybeSingle();

    // 4. If payment was made, update invoice to paid via RPC (bypasses RLS)
    if (paymentTransactionId && invoiceData) {
      const { error: invoiceError } = await supabase.rpc('mark_invoice_paid', {
        p_invoice_id: invoiceData.id,
        p_transaction_id: paymentTransactionId,
        p_paid_method: 'Authorize.net',
        p_paid_reference: paymentTransactionId,
      });
      if (invoiceError) {
        console.error('[placeOrder] mark_invoice_paid failed:', invoiceError);
        throw new Error('Payment succeeded but invoice update failed. Please contact support.');
      }

      await supabase.from('orders').update({
        forwarded_to_fulfillment_at: new Date().toISOString(),
      }).eq('id', orderData.id);

      // Send processing notification
      try {
        const { sendOrderNotification } = await import('@/lib/orderNotifications');
        await sendOrderNotification({
          status: 'processing',
          orderId: orderData.id,
          poNumber: orderData.po_number,
          customerEmail: user.email || '',
          businessName: user.contact_name || user.business_name || 'Valued Customer',
          total: total,
          orderDate: orderData.created_at,
        });
      } catch (e) { /* silent */ }
    }

    // Clear cart after successful order
    clearCart();
    setIsOpen(false);
    setSelectedStoreId(null);

    // Refresh page so dashboard shows new order/invoice
    window.location.reload();

    return {
      orderId: orderData.id,
      poNumber: orderData.po_number,
      invoiceId: invoiceData?.id,
      total: total,
    };
  }, [items, user, clearCart, stores, selectedStoreId]);

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
        stores,
        selectedStoreId,
        setSelectedStoreId,
        storesLoading,
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
