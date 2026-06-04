import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { sendOrderNotification } from '@/lib/orderNotifications'
import { formatCurrency } from '@/lib/utils'
import {
  Search, Download, CheckCircle, Truck, FileText, ShoppingCart,
  Loader2, Building2,
  Phone, Mail, MapPin, User, Plus, X, CreditCard,
  XCircle, Trash2, AlertTriangle, Package, Archive
} from 'lucide-react'
import { PaymentService } from '@/lib/paymentService'
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
  tracking_number: string | null
  carrier: string | null
  shipped_date: string | null
  archived_at: string | null
  users?: { business_name: string; email: string; phone: string; contact_name: string | null }
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
  archived_at: string | null
  users?: { business_name: string; email: string; phone: string; contact_name: string | null }
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
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'pending' | 'fulfillment' | 'shipped' | 'cancelled' | 'archived'>(
    searchParams.get('tab') === 'fulfillment' ? 'fulfillment' :
    searchParams.get('tab') === 'shipped' ? 'shipped' :
    searchParams.get('tab') === 'cancelled' ? 'cancelled' :
    searchParams.get('tab') === 'archived' ? 'archived' : 'pending'
  )
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

  // Create Invoice modal state
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({
    userId: '',
    amount: '',
    dueDate: '',
    description: '',
    orderId: '',
  })
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (showCreateOrder || showCreateInvoice) {
      fetchProductsAndUsers()
    }
  }, [showCreateOrder, showCreateInvoice])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: o, error: oErr }, { data: i, error: iErr }] = await Promise.all([
      supabase.from('orders')
        .select(`
          *,
          users!user_id (business_name, email, phone, contact_name),
          invoices(id, invoice_number, amount, status, due_date)
        `)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('invoices')
        .select(`
          *,
          users!user_id (business_name, email, phone, contact_name),
          orders:order_id (po_number, shipping_address, contact_person, contact_phone)
        `)
        .in('status', ['pending', 'overdue'])
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    if (oErr) console.error('Orders fetch error:', oErr)
    if (iErr) console.error('Invoices fetch error:', iErr)
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
    const { data: orderData, error } = await supabase.from('orders').insert({
      user_id: orderForm.userId,
      items: orderForm.quantity,
      total: lineTotal,
      status: 'pending',
      notes: orderForm.notes || `${selectedVariant.name} x${orderForm.quantity} (SKU: ${selectedVariant.sku})`,
      shipping_address: orderForm.shippingAddress || [selectedUser.address, selectedUser.city, selectedUser.state, selectedUser.zip].filter(Boolean).join(', ') || null,
      contact_person: orderForm.contactPerson || selectedUser.business_name || null,
      contact_phone: orderForm.contactPhone || selectedUser.phone || null,
    }).select().single()

    setOrderSubmitting(false)
    if (error || !orderData) {
      toast.error('Failed to create order: ' + (error?.message || 'Unknown'))
      return
    }

    // Insert order_items for the created order
    if (selectedVariant) {
      const product = products.find(p => p.id === selectedVariant.product_id)
      const { error: itemsError } = await supabase.from('order_items').insert({
        order_id: orderData.id,
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
        // Clean up: delete the order since items failed
        try { await supabase.from('orders').delete().eq('id', orderData.id); } catch (e) { /* ignore */ }
        toast.error('Failed to add order items: ' + itemsError.message)
        setOrderSubmitting(false)
        return
      }
    }

    // Explicitly create invoice (don't rely on trigger)
    const poNumber = orderData.po_number || `PO-${Date.now().toString(36).toUpperCase()}`;
    const { error: invError } = await supabase.from('invoices').insert({
      invoice_number: poNumber,
      order_id: orderData.id,
      user_id: orderForm.userId,
      amount: lineTotal,
      status: 'pending',
      date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (invError) {
      toast.warning('Order created but invoice generation failed: ' + invError.message)
    } else {
      toast.success('Order and invoice created successfully!')
    }
    setShowCreateOrder(false)
    setOrderForm({ userId: '', productId: '', variantId: '', quantity: 1, shippingAddress: '', contactPerson: '', contactPhone: '', notes: '' })
    fetchData()
  }

  const handleCreateInvoice = async () => {
    if (!invoiceForm.userId || !invoiceForm.amount) {
      toast.error('Please select a customer and enter an amount')
      return
    }
    const amount = parseFloat(invoiceForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setInvoiceSubmitting(true)
    const today = new Date().toISOString().split('T')[0]
    const dueDate = invoiceForm.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: invoiceData, error } = await supabase.from('invoices').insert({
      user_id: invoiceForm.userId,
      amount: amount,
      status: 'pending',
      date: today,
      due_date: dueDate,
      order_id: invoiceForm.orderId || null,
      paid_method: invoiceForm.description || null,
    }).select().single()

    setInvoiceSubmitting(false)
    if (error || !invoiceData) {
      toast.error('Failed to create invoice: ' + (error?.message || 'Unknown'))
      return
    }

    toast.success(`Invoice ${invoiceData.invoice_number} created successfully!`)
    setShowCreateInvoice(false)
    setInvoiceForm({ userId: '', amount: '', dueDate: '', description: '', orderId: '' })
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
      supabase.from('orders').update({
        status: 'processing',
        forwarded_to_fulfillment_at: now,
      }).eq('id', orderId),
    ])
    setProcessingId(null)
    if (invErr || ordErr) {
      toast.error('Failed to mark paid: ' + ((invErr || ordErr)?.message || ''))
    } else {
      toast.success('Marked as paid! Ready for fulfillment.')
      // Send processing notification
      try {
        const order = orders.find((o: any) => o.id === orderId)
        if (order?.users?.email) {
          await sendOrderNotification({
            status: 'processing',
            poNumber: order.po_number,
            customerEmail: order.users.email,
            businessName: order.users.business_name || order.users.contact_name || 'Valued Customer',
            total: order.total,
            orderDate: order.created_at,
          })
        }
      } catch (notifyErr: any) {
        console.error('Notification error:', notifyErr)
      }

      // Generate commissions for this order
      try {
        const { data: commResult, error: commErr } = await supabase
          .rpc('generate_order_commissions', { p_order_id: orderId })
        if (commErr) {
          console.error('Commission generation error:', commErr)
        } else if (commResult) {
          const result = typeof commResult === 'string' ? JSON.parse(commResult) : commResult
          if (result?.success && result?.rep_amount > 0) {
            toast.success(`Commission generated: $${Number(result.rep_amount).toFixed(2)} for rep`)
          }
        }
      } catch (commErr: any) {
        console.error('Commission generation failed:', commErr)
      }

      fetchData()
    }
  }

  // Admin: Cancel an order (any non-shipped)
  const adminCancelOrder = async (orderId: string, poNumber: string) => {
    // Check for commissions
    const { data: comms } = await supabase
      .from('commission_payments')
      .select('id, amount, status, users!inner(email)')
      .eq('order_id', orderId)

    const paidApproved = (comms || []).filter(c => c.status === 'paid' || c.status === 'approved')
    if (paidApproved.length > 0) {
      const total = paidApproved.reduce((s, c) => s + (c.amount || 0), 0)
      if (!confirm(`WARNING: This order has $${total.toFixed(2)} in approved/paid commissions.\n\nCancelling will void pending commissions and flag approved/paid ones for clawback review.\n\nProceed?`)) {
        return
      }
    }

    const reason = prompt(`Cancel order ${poNumber}?\n\nEnter reason:`)
    if (reason === null) return

    try {
      const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
        p_reason: reason || 'Cancelled by admin',
      })
      if (error) throw error
      const result = typeof data === 'string' ? JSON.parse(data) : data
      if (result?.success) {
        toast.success(`Order ${poNumber} cancelled`)
        fetchData()
      } else {
        toast.error(result?.error || 'Cancel failed')
      }
    } catch (e: any) {
      toast.error('Cancel failed: ' + e.message)
    }
  }

  // Admin: Hard delete order (test data cleanup)
  const adminHardDeleteOrder = async (orderId: string, poNumber: string) => {
    if (!confirm(`PERMANENTLY DELETE order ${poNumber}?\n\nThis removes the order, invoice, commissions, and all related records FOREVER.\n\nThis action cannot be undone!`)) return
    if (!confirm(`Are you absolutely sure? Type "DELETE" to confirm:`)) return

    try {
      const { data, error } = await supabase.rpc('admin_delete_order', { p_order_id: orderId })
      if (error) throw error
      if (data) {
        toast.success(`Order ${poNumber} permanently deleted`)
        fetchData()
      } else {
        toast.error('Delete failed — not authorized or order not found')
      }
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message)
    }
  }

  // Manual archive: move order/invoice to Archived tab
  const archiveOrder = async (orderId: string, poNumber: string) => {
    if (!confirm(`Archive order ${poNumber}?\n\nIt will move to the Archived tab.`)) return
    try {
      const { error } = await supabase.from('orders').update({ archived_at: new Date().toISOString() }).eq('id', orderId)
      if (error) throw error
      toast.success(`Order ${poNumber} archived`)
      fetchData()
    } catch (e: any) {
      toast.error('Archive failed: ' + e.message)
    }
  }

  const archiveInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!confirm(`Archive invoice ${invoiceNumber}?\n\nIt will move to the Archived tab.`)) return
    try {
      const { error } = await supabase.from('invoices').update({ archived_at: new Date().toISOString() }).eq('id', invoiceId)
      if (error) throw error
      toast.success(`Invoice ${invoiceNumber} archived`)
      fetchData()
    } catch (e: any) {
      toast.error('Archive failed: ' + e.message)
    }
  }

  // 45-day auto-archive helper
  const isAutoArchived = (date: string | null) => {
    if (!date) return false
    const daysSince = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 45
  }

  // Tab-scoped filtered data
  const tabOrders = orders.filter(o => {
    if (view === 'pending') return o.status === 'pending'
    if (view === 'fulfillment') return o.status === 'processing'
    if (view === 'shipped') return o.status === 'shipped' && !o.archived_at && !isAutoArchived(o.shipped_date)
    if (view === 'cancelled') return o.status === 'cancelled'
    if (view === 'archived') return o.status === 'shipped' && (!!o.archived_at || isAutoArchived(o.shipped_date))
    return true
  })

  const tabInvoices = invoices.filter(i => {
    if (view === 'pending') return i.status === 'pending' || i.status === 'overdue'
    if (view === 'cancelled') return i.status === 'cancelled'
    return false // no invoices in fulfillment, shipped, or archived tabs
  })

  const filteredOrders = tabOrders.filter(o => {
    const s = search.toLowerCase()
    return (
      o.po_number?.toLowerCase().includes(s) ||
      o.users?.business_name?.toLowerCase().includes(s) ||
      o.users?.email?.toLowerCase().includes(s)
    )
  })

  const filteredInvoices = tabInvoices.filter(i => {
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
      overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return map[status] || 'bg-gray-500/10 text-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* Header + Toggle + Create Button */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex bg-[#150f24] rounded-lg p-1 border border-white/10 flex-wrap">
          <button
            onClick={() => setView('pending')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'pending'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Orders and invoices awaiting payment"
          >
            <AlertTriangle className="w-4 h-4" />
            Pending
            <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'pending').length + invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length}
            </span>
          </button>
          <button
            onClick={() => setView('fulfillment')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'fulfillment'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Orders being packed and prepared for shipment"
          >
            <Package className="w-4 h-4" />
            Fulfillment
            <span className="ml-1 text-xs bg-blue-400/20 text-blue-400 px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'processing').length}
            </span>
          </button>
          <button
            onClick={() => setView('shipped')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'shipped'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Recently shipped orders and paid invoices (not yet archived)"
          >
            <Truck className="w-4 h-4" />
            Shipped
            <span className="ml-1 text-xs bg-[#44f80c]/20 text-[#44f80c] px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'shipped' && !o.archived_at && !isAutoArchived(o.shipped_date)).length + invoices.filter(i => i.status === 'paid').length}
            </span>
          </button>
          <button
            onClick={() => setView('cancelled')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'cancelled'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Cancelled orders and invoices"
          >
            <XCircle className="w-4 h-4" />
            Cancelled
            <span className="ml-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'cancelled').length + invoices.filter(i => i.status === 'cancelled').length}
            </span>
          </button>
          <button
            onClick={() => setView('archived')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              view === 'archived'
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Archived: shipped >45 days or manually archived"
          >
            <Archive className="w-4 h-4" />
            Archived
            <span className="ml-1 text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === 'shipped' && (!!o.archived_at || isAutoArchived(o.shipped_date))).length}
            </span>
          </button>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <div className="relative flex-grow lg:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="admin-search-input"
              type="text"
              placeholder={'Search PO, invoice, or business...'}
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
          <button
            onClick={() => setShowCreateInvoice(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0]/10 hover:bg-[#9a02d0]/20 text-[#9a02d0] border border-[#9a02d0]/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
          <button
            onClick={() => {
              const csv = filteredOrders.map(o => ({
                'PO Number': o.po_number,
                'Business': o.users?.business_name || '',
                'Contact': o.users?.contact_name || '',
                'Email': o.users?.email || '',
                'Items': o.items,
                'Total': o.total,
                'Status': o.status,
                'Date': o.created_at ? new Date(o.created_at).toLocaleDateString() : '',
              }));
              if (csv.length === 0) return;
              const headers = Object.keys(csv[0]);
              const rows = csv.map(row => headers.map(h => `"${String((row as any)[h]).replace(/"/g, '""')}"`).join(','));
              const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#9a02d0] animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Orders Section */}
          {filteredOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Orders ({filteredOrders.length})
              </h3>
              <div className="space-y-4">
                {filteredOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onMarkPaid={(invId, method) => {
                      const invoice = order.invoices?.[0]
                      if (invoice) markPaid(invId, order.id, method)
                    }}
                    onCancel={adminCancelOrder}
                    onHardDelete={adminHardDeleteOrder}
                    onArchive={archiveOrder}
                    currentView={view}
                    processingId={processingId}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Invoices Section — hidden in fulfillment and cancelled (when no invoices to show) */}
          {view === 'pending' && filteredInvoices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 mt-6 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices ({filteredInvoices.length})
              </h3>
              <div className="space-y-4">
                {filteredInvoices.map(invoice => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onMarkPaid={(method) => markPaid(invoice.id, invoice.order_id, method)}
                    onArchive={archiveInvoice}
                    currentView={view}
                    processingId={processingId}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredOrders.length === 0 && filteredInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {view === 'pending' ? (
                <>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>No pending orders or invoices</p>
                </>
              ) : view === 'fulfillment' ? (
                <>
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>No orders in fulfillment</p>
                </>
              ) : view === 'shipped' ? (
                <>
                  <Truck className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>No shipped orders or paid invoices</p>
                  <p className="text-xs text-gray-600 mt-1">Items auto-archive after 45 days</p>
                </>
              ) : view === 'cancelled' ? (
                <>
                  <XCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>No cancelled orders or invoices</p>
                </>
              ) : (
                <>
                  <Archive className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>No archived orders or invoices</p>
                  <p className="text-xs text-gray-600 mt-1">Shipped orders appear here after 45 days</p>
                </>
              )}
            </div>
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
                  id="form-select-4241840"
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
                  id="form-select-4241840"
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
                  id="form-select-4241840"
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
                    id="order-qty"
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
                    id="order-shipping"
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
                      id="order-contact"
                      type="text"
                      value={orderForm.contactPerson}
                      onChange={e => setOrderForm({ ...orderForm, contactPerson: e.target.value })}
                      className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Contact Phone</label>
                    <input
                      id="order-phone"
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
                  id="order-notes"
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
      {/* ─── Create Invoice Modal ─────────────────────────────── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[#150f24] border-b border-white/10 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9a02d0]" />
                Create New Invoice
              </h2>
              <button
                onClick={() => setShowCreateInvoice(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Business Customer *</label>
                <select
                  id="form-select-4241840"
                  value={invoiceForm.userId}
                  onChange={e => setInvoiceForm({ ...invoiceForm, userId: e.target.value })}
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

              {/* Amount + Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Amount *</label>
                  <input
                    id="invoice-amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={invoiceForm.amount}
                    onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Due Date</label>
                  <input
                    id="invoice-due-date"
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
              </div>

              {/* Link to Order (optional) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Link to Order (optional)</label>
                <select
                  id="form-select-4241840"
                  value={invoiceForm.orderId}
                  onChange={e => setInvoiceForm({ ...invoiceForm, orderId: e.target.value })}
                  className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="">None — standalone invoice</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.po_number} — {(o as any).users?.business_name || (o as any).profiles?.business_name || 'Unknown'} — ${o.total}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description / Notes</label>
                <textarea
                  id="invoice-description"
                  value={invoiceForm.description}
                  onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  rows={3}
                  placeholder="e.g. Late fee, shipping adjustment, past-due balance..."
                  className="w-full bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateInvoice}
                  disabled={invoiceSubmitting || !invoiceForm.userId || !invoiceForm.amount}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#9a02d0] to-[#ff66c4] text-white rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {invoiceSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {invoiceSubmitting ? 'Creating...' : 'Create Invoice'}
                </button>
                <button
                  onClick={() => setShowCreateInvoice(false)}
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
  onCancel,
  onHardDelete,
  onArchive,
  currentView,
  processingId,
  getStatusBadge,
}: {
  order: FulfillmentOrder
  onMarkPaid: (invId: string, method: 'check' | 'cash' | 'wire') => void
  onCancel: (orderId: string, poNumber: string) => void
  onHardDelete: (orderId: string, poNumber: string) => void
  onArchive?: (orderId: string, poNumber: string) => void
  currentView?: string
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

      {/* Shipment Details — shown when shipped */}
      {order.status === 'shipped' && (order.carrier || order.tracking_number) && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
            <Truck className="w-4 h-4" />
            Shipment Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {order.carrier && (
              <div>
                <p className="text-gray-500 text-xs">Carrier</p>
                <p className="text-white font-medium">{order.carrier}</p>
              </div>
            )}
            {order.tracking_number && (
              <div>
                <p className="text-gray-500 text-xs">Tracking Number</p>
                <p className="text-purple-300 font-mono">{order.tracking_number}</p>
              </div>
            )}
            {order.shipped_date && (
              <div>
                <p className="text-gray-500 text-xs">Shipped Date</p>
                <p className="text-white">{new Date(order.shipped_date).toLocaleDateString()}</p>
              </div>
            )}
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
            {/* Phase 9: Pay Now — placeholder for High Wire integration */}
            <button
              onClick={async () => {
                try {
                  const config = await PaymentService.getConfig()
                  if (!config.clientId) {
                    toast.info('Payment processor not configured. Add credentials in Admin → Config.')
                    return
                  }
                  const intent = await PaymentService.createPaymentIntent({
                    invoiceId: invoice.id,
                    amount: invoice.amount,
                    customerEmail: order.users?.email || '',
                    description: `Invoice ${invoice.invoice_number}`,
                  })
                  toast.success(`Payment link created: ${intent.id}`)
                } catch (err: any) {
                  toast.error('Payment link failed: ' + err.message)
                }
              }}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-[#44f80c]/10 hover:bg-[#44f80c]/20 text-[#44f80c] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              Pay Now (Online)
            </button>
          </>
        )}
        {order.status === 'processing' && (
          <span className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm">
            <Package className="w-4 h-4" />
            In Fulfillment
          </span>
        )}
        {order.status === 'shipped' && currentView === 'shipped' && onArchive && (
          <button
            onClick={() => onArchive(order.id, order.po_number)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium transition-colors"
            title="Move this order to the Archived tab"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        )}
        {(order.status === 'pending' || order.status === 'processing') && (
          <button
            onClick={() => onCancel(order.id, order.po_number)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors"
            title="Cancel this order. Warns if commissions exist."
          >
            <XCircle className="w-4 h-4" />
            Cancel Order
          </button>
        )}
        <button
          onClick={() => onHardDelete(order.id, order.po_number)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
          title="Permanently delete this order and all related records. Use for test data cleanup only."
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Invoice Card ─────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  onMarkPaid,
  onArchive,
  currentView,
  processingId,
  getStatusBadge,
}: {
  invoice: FulfillmentInvoice
  onMarkPaid: (method: 'check' | 'cash' | 'wire') => void
  onArchive?: (invoiceId: string, invoiceNumber: string) => void
  currentView?: string
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
            Paid
            {invoice.paid_date && ` ${invoice.paid_date}`}
            {invoice.paid_method && ` (${invoice.paid_method})`}
          </span>
        )}
        {invoice.status === 'paid' && currentView === 'shipped' && onArchive && (
          <button
            onClick={() => onArchive(invoice.id, invoice.invoice_number)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium transition-colors"
            title="Move this invoice to the Archived tab"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        )}
      </div>
    </div>
  )
}
 