import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  Search, Download, CheckCircle, Truck, FileText, ShoppingCart,
  Loader2, Building2,
  Phone, Mail, MapPin, User, Plus, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────

interface FulfillmentOrder {
  id: string
  po_number: string
  user_id: string
  items: number
  total: number
  status: string
  notes: string | null
  created_at: string
  shipping_address: string | null
  contact_person: string | null
  contact_phone: string | null
  payment_method: string | null
  payment_reference: string | null
  forwarded_to_fulfillment_at: string | null
  fulfilled_at: string | null
  users?: { business_name: string; email: string; phone: string }
  invoices?: { id: string; invoice_number: string; amount: number; status: string; due_date: string }[]
}

interface FulfillmentInvoice {
  id: string
  invoice_number: string
  order_id: string
  user_id: string
  amount: number
  status: string
  date: string
  due_date: string
  paid_date: string | null
  paid_method: string | null
  paid_reference: string | null
  users?: { business_name: string; email: string; phone: string }
  orders?: { po_number: string; shipping_address: string; contact_person: string; contact_phone: string }
}

interface Product {
  id: string
  name: string
  sku: string
  description: string
}

interface ProductVariant {
  id: string
  product_id: string
  name: string
  tier: string
  sku: string
  quantity: number
  wholesaler_price: number
  distributor_price: number
  in_stock: boolean
}

interface BusinessUser {
  id: string
  email: string
  business_name: string | null
  role: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}

// ─── Main Page ────────────────────────────────────────────────────

export function OrdersInvoicesPage() {
  const [view, setView] = useState<'orders' | 'invoices'>('orders')
  const [orders, setOrders] = useState<FulfillmentOrder[]>([])
  const [invoices, setInvoices] = useState<FulfillmentInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Create Order modal state
  const [showCreateOrder, setShowCreateOrder] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [businessUsers, setBusinessUsers] = useState<BusinessUser[]>([])
  const [orderForm, setOrderForm] = useState({
    userId: '',
    productId: '',
    variantId: '',
    quantity: 1,
    shippingAddress: '',
    contactPerson: '',
    contactPhone: '',
    notes: '',
  })
  const [orderSubmitting, setOrderSubmitting] = useState(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (showCreateOrder) {
      fetchProductsAndUsers()
    }
  }, [showCreateOrder])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: o, error: oErr }, { data: i, error: iErr }] = await Promise.all([
      supabase.from('orders')
        .select(`
          *,
          users!user_id (business_name, email, phone),
          invoices(id, invoice_number, amount, status, due_date)
        `)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('invoices')
        .select(`
          *,
          users!user_id (business_name, email, phone),
          orders:order_id (po_number, shipping_address, contact_person, contact_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (oErr) console.error('[OrdersInvoices] orders error:', oErr)
    if (iErr) console.error('[OrdersInvoices] invoices error:', iErr)
    setOrders((o as any) || [])
    setInvoices((i as any) || [])
    setLoading(false)
  }

  const fetchProductsAndUsers = async () => {
    const [{ data: p }, { data: v }, { data: u }] = await Promise.all([
      supabase.from('products').select('id,name,sku,description').eq('is_active', true),
      supabase.from('product_variants').select('*').eq('in_stock', true),
      supabase.from('users').select('id,email,business_name,role,phone,address,city,state,zip').or('role.eq.wholesaler,role.eq.distributor'),
    ])
    setProducts((p as any) || [])
    setVariants((v as any) || [])
    setBusinessUsers((u as any) || [])
  }

  const selectedUser = businessUsers.find(u => u.id === orderForm.userId)
  const selectedVariant = variants.find(v => v.id === orderForm.variantId)
  const unitPrice = selectedUser && selectedVariant
    ? (selectedUser.role === 'distributor' ? selectedVariant.distributor_price : selectedVariant.wholesaler_price)
    : 0
  const lineTotal = unitPrice * orderForm.quantity

  const handleCreateOrder = async () => {
    if (!orderForm.userId || !orderForm.variantId) {
      toast.error('Please select a user and product variant')
      return
    }
    if (!selectedUser || !selectedVariant) return

    setOrderSubmitting(true)
    const { error } = await supabase.from('orders').insert({
      user_id: orderForm.userId,
      items: orderForm.quantity,
      total: lineTotal,
      status: 'pending',
      notes: orderForm.notes || `${selectedVariant.name} x${orderForm.quantity} (SKU: ${selectedVariant.sku})`,
      shipping_address: orderForm.shippingAddress || [selectedUser.address, selectedUser.city, selectedUser.state, selectedUser.zip].filter(Boolean).join(', ') || null,
      contact_person: orderForm.contactPerson || selectedUser.business_name || null,
      contact_phone: orderForm.contactPhone || selectedUser.phone || null,
    })

    setOrderSubmitting(false)
    if (error) {
      toast.error('Failed to create order: ' + error.message)
      return
    }

    // Insert order_items for the created order
    if (data && selectedVariant) {
      const product = products.find(p => p.id === selectedVariant.product_id)
      const { error: itemsError } = await supabase.from('order_items').insert({
        order_id: data.id,
        product_id: selectedVariant.product_id,
        variant_id: selectedVariant.id,
        product_name: product?.name || '',
        variant_name: selectedVariant.name,
        sku: selectedVariant.sku,
        quantity: orderForm.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
      if (itemsError) {
        console.error('[CreateOrder] order_items error:', itemsError);
      }
    }

    toast.success('Order created successfully! Invoice auto-generated.')
    setShowCreateOrder(false)
    setOrderForm({ userId: '', productId: '', variantId: '', quantity: 1, shippingAddress: '', contactPerson: '', contactPhone: '', notes: '' })
    fetchData()
  }

  const markPaid = async (invoiceId: string, orderId: string, method: 'check' | 'cash' | 'wire') => {
    setProcessingId(invoiceId)
    const now = new Date().toISOString()
    const [{ error: invErr }, { error: ordErr }] = await Promise.all([
      supabase.from('invoices').update({
        status: 'paid',
        paid_date: now.split('T')[0],
        paid_method: method,
        paid_reference: `Manual: ${method}`,
      }).eq('id', invoiceId),
      supabase.from('orders').update({ status: 'paid' }).eq('id', orderId),
    ])
    setProcessingId(null)
    if (invErr || ordErr) {
      toast.error('Failed to mark paid: ' + ((invErr || ordErr)?.message || ''))
    } else {
      toast.success('Marked as paid! Ready for fulfillment.')
      fetchData()
    }
  }

  const forwardToFulfillment = async (orderId: string) => {
    setProcessingId(orderId)
    const { error } = await supabase.from('orders').update({
      status: 'processing',
      forwarded_to_fulfillment_at: new Date().toISOString(),
    }).eq('id', orderId)
    setProcessingId(null)
    if (error) toast.error('Failed to forward: ' + error.message)
    else {
      toast.success('Forwarded to fulfillment/shipping department!')
      fetchData()
    }
  }

  const filteredOrders = orders.filter(o => {
    const s = search.toLowerCase()
    return (
      o.po_number?.toLowerCase().includes(s) ||
      o.users?.business_name?.toLowerCase().includes(s) ||
      o.users?.email?.toLowerCase().includes(s)
    )
  })

  const filteredInvoices = invoices.filter(i => {
    const s = search.toLowerCase()
    return (
      i.invoice_number?.toLowerCase().includes(s) ||
      i.users?.business_name?.toLowerCase().includes(s) ||
      i.orders?.po_number?.toLowerCase().includes(s)
    )
  })

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
      overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    }
    return map[status] || 'bg-gray-500/10 text-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* Header + Toggle + Create Button */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex bg-[#150f24] rounded-lg p-1 border border-white/10">
          <button
            onClick={() => setView('orders')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'orders'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase Orders
            <span className="ml-1 text-xs bg-[#9a02d0]/30 px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'pending' || o.status === 'paid').length}
            </span>
          </button>
          <button
            onClick={() => setView('invoices')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'invoices'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <FileText className="w-4 h-4" />
            Invoices
            <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {invoices.filter(i => i.status === 'pending').length}
            </span>
          </button>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <div className="relative flex-grow lg:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={view === 'orders' ? 'Search PO or business...' : 'Search invoice or business...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full lg:w-64 pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
            />
          </div>
          <button
            onClick={() => setShowCreateOrder(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#44f80c]/10 hover:bg-[#44f80c]/20 text-[#44f80c] border border-[#44f80c]/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Order
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#9a02d0] animate-spin" />
        </div>
      ) : view === 'orders' ? (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No orders found</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onMarkPaid={(invId, method) => {
                  const invoice = order.invoices?.[0]
                  if (invoice) markPaid(invId, order.id, method)
                }}
                onForward={() => forwardToFulfillment(order.id)}
                processingId={processingId}
                getStatusBadge={getStatusBadge}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No invoices found</p>
            </div>
          ) : (
            filteredInvoices.map(invoice => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onMarkPaid={(method) => markPaid(invoice.id, invoice.order_id, method)}
                processingId={processingId}
                getStatusBadge={getStatusBadge}
              />
            ))
          )}
        </div>
      )}

      {/* ─── Create Order Modal ─────────────────────────────── */}
      {showCreateOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[#150f24] border-b border-white/10 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#44f80c]" />
                Create New Order
              </h2>
              <button
                onClick={() => setShowCreateOrder(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* User Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Business Customer *</label>
                <select
                  value={orderForm.userId}
                  onChange={e => {
                    const user = businessUsers.find(u => u.id === e.target.value)
                    setOrderForm({
                      ...orderForm,
                      userId: e.target.value,
                      shippingAddress: [user?.address, user?.city, user?.state, user?.zip].filter(Boolean).join(', ') || '',
                      contactPerson: user?.business_name || '',
                      contactPhone: user?.phone || '',
                    })
                  }}
                  className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="">Select a wholesaler or distributor...</option>
                  {businessUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.business_name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product + Variant */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Product *</label>
                  <select
                    value={orderForm.productId}
                    onChange={e => setOrderForm({ ...orderForm, productId: e.target.value, variantId: '' })}
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  >
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Package *</label>
                  <select
                    value={orderForm.variantId}
                    onChange={e => setOrderForm({ ...orderForm, variantId: e.target.value })}
                    disabled={!orderForm.productId}
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50 disabled:opacity-40"
                  >
                    <option value="">Select package...</option>
                    {variants
                      .filter(v => v.product_id === orderForm.productId)
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.quantity} units)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Price Display */}
              {selectedUser && selectedVariant && (
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Pricing Tier</p>
                      <p className="text-white font-medium">{selectedUser.role === 'distributor' ? 'Distributor Price' : 'Wholesaler Price'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Unit Price</p>
                      <p className="text-xl font-bold text-[#44f80c]">{formatCurrency(unitPrice)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity + Line Total */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    value={orderForm.quantity}
                    onChange={e => setOrderForm({ ...orderForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div className="flex items-end">
                  <div className="w-full bg-[#9a02d0]/10 rounded-lg p-3 border border-[#9a02d0]/20">
                    <p className="text-sm text-gray-400">Line Total</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
              </div>

              {/* Shipping Details */}
              <div className="border-t border-white/10 pt-4 space-y-4">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Shipping Details
                </h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Shipping Address</label>
                  <input
                    type="text"
                    value={orderForm.shippingAddress}
                    onChange={e => setOrderForm({ ...orderForm, shippingAddress: e.target.value })}
                    placeholder="123 Main St, City, State ZIP"
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Contact Person</label>
                    <input
                      type="text"
                      value={orderForm.contactPerson}
                      onChange={e => setOrderForm({ ...orderForm, contactPerson: e.target.value })}
                      className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Contact Phone</label>
                    <input
                      type="text"
                      value={orderForm.contactPhone}
                      onChange={e => setOrderForm({ ...orderForm, contactPhone: e.target.value })}
                      className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Order Notes</label>
                <textarea
                  value={orderForm.notes}
                  onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Special instructions, delivery notes, etc."
                  className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateOrder}
                  disabled={orderSubmitting || !orderForm.userId || !orderForm.variantId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#44f80c] to-[#9a02d0] text-white rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {orderSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {orderSubmitting ? 'Creating...' : 'Create Order'}
                </button>
                <button
                  onClick={() => setShowCreateOrder(false)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Order Card ─────────────────────────────────────────────────

function OrderCard({
  order,
  onMarkPaid,
  onForward,
  processingId,
  getStatusBadge,
}: {
  order: FulfillmentOrder
  onMarkPaid: (invId: string, method: 'check' | 'cash' | 'wire') => void
  onForward: () => void
  processingId: string | null
  getStatusBadge: (s: string) => string
}) {
  const invoice = order.invoices?.[0]
  const isProcessing = processingId === order.id || processingId === invoice?.id

  return (
    <div className="bg-[#150f24] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Top Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#44f80c]/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-[#44f80c]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', getStatusBadge(order.status))}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{formatCurrency(order.total)}</p>
          <p className="text-xs text-gray-500">{order.items} items</p>
        </div>
      </div>

      {/* Business Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Business</p>
            <p className="text-white font-medium">{order.users?.business_name || 'Unknown'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Mail className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Email</p>
            <p className="text-white">{order.users?.email || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Contact</p>
            <p className="text-white">{order.contact_person || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Phone</p>
            <p className="text-white">{order.contact_phone || order.users?.phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      {order.shipping_address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Shipping Address</p>
            <p className="text-white">{order.shipping_address}</p>
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="text-sm text-gray-400 bg-[#0a0514] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Order Details:</p>
          <p className="text-white">{order.notes}</p>
        </div>
      )}

      {/* Invoice Summary */}
      {invoice && (
        <div className="flex items-center gap-3 text-sm bg-[#0a0514] rounded-lg p-3">
          <FileText className="w-4 h-4 text-[#9a02d0]" />
          <div className="flex-1">
            <p className="text-gray-400">
              Invoice <span className="font-mono text-gray-300">{invoice.invoice_number}</span>
              {' — '}
              <span className={cn('text-xs px-2 py-0.5 rounded-full border', getStatusBadge(invoice.status))}>
                {invoice.status}
              </span>
            </p>
          </div>
          <p className="text-white font-medium">{formatCurrency(invoice.amount)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
        {invoice?.status === 'pending' && (
          <>
            <button
              onClick={() => onMarkPaid(invoice.id, 'check')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark as Paid (Check)
            </button>
            <button
              onClick={() => onMarkPaid(invoice.id, 'wire')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark as Paid (Wire)
            </button>
          </>
        )}
        {order.status === 'paid' && !order.forwarded_to_fulfillment_at && (
          <button
            onClick={onForward}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-[#9a02d0]/10 hover:bg-[#9a02d0]/20 text-[#9a02d0] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Forward to Fulfillment
          </button>
        )}
        {order.forwarded_to_fulfillment_at && (
          <span className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm">
            <Truck className="w-4 h-4" />
            Forwarded {new Date(order.forwarded_to_fulfillment_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Invoice Card ─────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  onMarkPaid,
  processingId,
  getStatusBadge,
}: {
  invoice: FulfillmentInvoice
  onMarkPaid: (method: 'check' | 'cash' | 'wire') => void
  processingId: string | null
  getStatusBadge: (s: string) => string
}) {
  const isProcessing = processingId === invoice.id

  return (
    <div className="bg-[#150f24] border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#9a02d0]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#9a02d0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-300">{invoice.invoice_number}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', getStatusBadge(invoice.status))}>
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              PO: {invoice.orders?.po_number || 'N/A'} · Due: {invoice.due_date}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{formatCurrency(invoice.amount)}</p>
          <p className="text-xs text-gray-500">{invoice.date}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Business</p>
            <p className="text-white font-medium">{invoice.users?.business_name || 'Unknown'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Mail className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Email</p>
            <p className="text-white">{invoice.users?.email || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Contact</p>
            <p className="text-white">{invoice.orders?.contact_person || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Phone</p>
            <p className="text-white">{invoice.orders?.contact_phone || invoice.users?.phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      {invoice.orders?.shipping_address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400">Shipping Address</p>
            <p className="text-white">{invoice.orders.shipping_address}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
        {invoice.status === 'pending' && (
          <>
            <button
              onClick={() => onMarkPaid('check')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Paid (Check)
            </button>
            <button
              onClick={() => onMarkPaid('cash')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Paid (Cash)
            </button>
            <button
              onClick={() => onMarkPaid('wire')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Paid (Wire)
            </button>
          </>
        )}
        {invoice.status === 'paid' && (
          <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4" />
            Paid {invoice.paid_date} ({invoice.paid_method})
          </span>
        )}
      </div>
    </div>
  )
}
