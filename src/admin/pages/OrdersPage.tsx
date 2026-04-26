import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, downloadCSV } from '@/lib/utils'
import { Search, Download, Plus, Trash2, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Order {
  id: string
  user_id: string
  product_id: string
  quantity: number
  total_amount: number
  status: string
  shipping_address: string | null
  created_at: string
  profiles?: { full_name: string; email: string }
  products?: { name: string; sku: string }
}

interface OrderableItem {
  product_id: string
  variant_id: string | null   // null for products without variants (like the kit)
  name: string                // "Box — Case (12 boxes)" or "Wholesaler Starter Kit"
  sku: string
  price: number               // distributor price for admin order calc
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [items, setItems] = useState<OrderableItem[]>([])
  const [formData, setFormData] = useState({
    user_id: '', product_id: '', variant_id: '' as string | null, quantity: 1, shipping_address: '', status: 'pending'
  })
  const pageSize = 10

  useEffect(() => { fetchOrders(); fetchReferences() }, [page, search])

  const fetchReferences = async () => {
    const [{ data: u, error: uErr }, { data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('products').select('id, name, sku, price').eq('is_active', true),
      supabase.from('product_variants').select('id, product_id, name, sku, distributor_price, in_stock').order('sku')
    ])
    if (uErr) console.error('[OrdersPage] profiles error:', uErr)
    if (pErr) console.error('[OrdersPage] products error:', pErr)
    if (vErr) console.error('[OrdersPage] variants error:', vErr)

    setUsers(u || [])

    // Build flattened list of every orderable item (product + variant combos)
    const orderable: OrderableItem[] = []

    for (const p of (products || [])) {
      const pVariants = (variants || []).filter(v => v.product_id === p.id && v.in_stock !== false)

      if (pVariants.length > 0) {
        // Product has variants — list each variant as its own orderable item
        for (const v of pVariants) {
          orderable.push({
            product_id: p.id,
            variant_id: v.id,
            name: `${p.name} — ${v.name}`,
            sku: v.sku,
            price: v.distributor_price ?? p.price ?? 0,
          })
        }
      } else {
        // Product has no variants (e.g., the kit) — list the product itself
        orderable.push({
          product_id: p.id,
          variant_id: null,
          name: p.name,
          sku: p.sku || '',
          price: p.price ?? 0,
        })
      }
    }

    setItems(orderable)
    console.log('[OrdersPage] Loaded', orderable.length, 'orderable items:', orderable.map(i => i.name))
  }

  const fetchOrders = async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, profiles(full_name, email), products(name, sku)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search) {
      query = query.or(`status.ilike.%${search}%,shipping_address.ilike.%${search}%`)
    }

    const { data, count, error } = await query
    if (error) console.error(error)
    else { setOrders((data as any) || []); setTotalCount(count || 0) }
    setLoading(false)
  }

  const handleCreate = async () => {
    const selected = items.find(i => i.product_id === formData.product_id && i.variant_id === formData.variant_id)
    if (!selected) { alert('Please select a product'); return }

    const total = selected.price * formData.quantity
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: formData.user_id,
        product_id: formData.product_id,
        quantity: Number(formData.quantity),
        total_amount: total,
        shipping_address: formData.shipping_address,
        status: formData.status,
      }])
      .select()
      .single()

    if (orderError) { alert('Error: ' + orderError.message); return }

    // Auto-generate invoice
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    await supabase.from('invoices').insert([{
      order_id: orderData.id,
      user_id: formData.user_id,
      amount: total,
      status: 'unpaid',
      due_date: dueDate.toISOString().split('T')[0]
    }])

    // Log audit
    await supabase.from('audit_log').insert([{
      action: 'order_created',
      table_name: 'orders',
      record_id: orderData.id,
      old_data: null,
      new_data: JSON.stringify({ total_amount: total, status: 'pending', auto_invoice: true, sku: selected.sku })
    }])

    setShowModal(false)
    setFormData({ user_id: '', product_id: '', variant_id: null, quantity: 1, shipping_address: '', status: 'pending' })
    fetchOrders()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this order?')) return
    await supabase.from('invoices').delete().eq('order_id', id)
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchOrders()
  }

  const generateInvoice = async (order: Order) => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    const { error } = await supabase.from('invoices').insert([{
      order_id: order.id,
      user_id: order.user_id,
      amount: order.total_amount,
      status: 'unpaid',
      due_date: dueDate.toISOString().split('T')[0]
    }])
    if (error) alert('Error: ' + error.message)
    else alert('Invoice generated successfully!')
  }

  const exportCSV = () => {
    downloadCSV('orders', ['ID', 'Customer', 'Product', 'Quantity', 'Total', 'Status', 'Created'],
      orders.map(o => [o.id, o.profiles?.full_name || o.user_id, o.products?.name || o.product_id, String(o.quantity), String(o.total_amount), o.status, o.created_at]))
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // Compute order preview total
  const selectedItem = items.find(i => i.product_id === formData.product_id && i.variant_id === formData.variant_id)
  const previewTotal = selectedItem ? selectedItem.price * formData.quantity : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search orders..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white transition-colors">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No orders found</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-mono text-gray-300">#{o.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-500">{formatDate(o.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{o.profiles?.full_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{o.products?.name || o.product_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{o.quantity}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{formatCurrency(o.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium',
                      o.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      o.status === 'shipped' ? 'bg-[#9a02d0]/15 text-[#44f80c]' :
                      o.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400')}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => generateInvoice(o)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-purple-400" title="Generate Invoice">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(o.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <span className="text-sm text-gray-500">{totalCount} total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-gray-400">Page {page + 1} of {totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">New Order</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Customer</label>
                <select value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50">
                  <option value="">Select customer...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Product</label>
                <select
                  value={formData.variant_id ? `${formData.product_id}::${formData.variant_id}` : formData.product_id}
                  onChange={e => {
                    const val = e.target.value
                    if (val.includes('::')) {
                      const [pid, vid] = val.split('::')
                      setFormData({...formData, product_id: pid, variant_id: vid})
                    } else {
                      setFormData({...formData, product_id: val, variant_id: null})
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="">Select product...</option>
                  {items.map(item => (
                    <option key={item.variant_id ? `${item.product_id}::${item.variant_id}` : item.product_id} value={item.variant_id ? `${item.product_id}::${item.variant_id}` : item.product_id}>
                      {item.name} — {formatCurrency(item.price)}
                    </option>
                  ))}
                </select>
                {items.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">No products loaded. Check console for errors.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Quantity</label>
                <input type="number" min={1} value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              {selectedItem && (
                <div className="flex items-center justify-between text-sm bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2">
                  <span className="text-gray-400">Unit price:</span>
                  <span className="text-[#44f80c] font-medium">{formatCurrency(selectedItem.price)}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-400">Line total:</span>
                  <span className="text-white font-medium">{formatCurrency(previewTotal)}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Shipping Address</label>
                <textarea value={formData.shipping_address} onChange={e => setFormData({...formData, shipping_address: e.target.value})} rows={2} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white">Create Order & Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
