import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import {
  ShoppingCart,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Search,
} from 'lucide-react'

interface OrderItem {
  id: string
  user_id: string
  product_name: string | null
  product_sku: string | null
  quantity: number
  total_amount: number
  status: string
  shipping_address: string | null
  created_at: string
  invoice_status: string | null
  invoice_paid_at: string | null
  account_name: string
}

export function SalesRepOrders() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    const { data: me } = await supabase.from('users').select('role').eq('id', repId).single()
    if (me?.role !== 'sales_rep') {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // 1. Get account assignments (account rep)
    const { data: acctAssignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', repId)
    const accountIds = (acctAssignments || []).map((a: any) => a.account_id)

    // 2. Get store assignments (store rep) → find their owner accounts
    const { data: storeData } = await supabase
      .from('wholesaler_store_locations')
      .select('user_id')
      .ilike('license_number', `rep:${repId}%`)
    const storeAccountIds = (storeData || []).map((s: any) => s.user_id).filter(Boolean)

    // Combine unique account IDs
    const allAccountIds = [...new Set([...accountIds, ...storeAccountIds])]
    if (allAccountIds.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    // 3. Get orders from these accounts
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, user_id, quantity, total_amount, status, shipping_address, created_at')
      .in('user_id', allAccountIds)
      .order('created_at', { ascending: false })

    const orderList = orderData || []
    if (orderList.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    // 4. Get invoices for these orders
    const orderIds = orderList.map((o: any) => o.id)
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('order_id, status, paid_at')
      .in('order_id', orderIds)

    const invoiceMap = new Map<string, { status: string; paid_at: string | null }>()
    ;(invoiceData || []).forEach((inv: any) => {
      invoiceMap.set(inv.order_id, { status: inv.status, paid_at: inv.paid_at })
    })

    // 5. Get account names
    const { data: accountNames } = await supabase
      .from('users')
      .select('id, business_name')
      .in('id', allAccountIds)

    const nameMap = new Map<string, string>()
    ;(accountNames || []).forEach((a: any) => {
      nameMap.set(a.id, a.business_name)
    })

    // 6. Get product names
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, sku')
    const productMap = new Map<string, { name: string; sku: string }>()
    ;(productData || []).forEach((p: any) => {
      productMap.set(p.id, { name: p.name, sku: p.sku })
    })

    // 7. Join product info from order items (if we had an order_items table)
    // For now, orders table has product_id but no join in this query
    // We'll use the order's own data
    const enriched: OrderItem[] = orderList.map((o: any) => {
      const inv = invoiceMap.get(o.id)
      return {
        id: o.id,
        user_id: o.user_id,
        product_name: null, // Would need order_items join
        product_sku: null,
        quantity: o.quantity || 1,
        total_amount: o.total_amount || 0,
        status: o.status || 'pending',
        shipping_address: o.shipping_address,
        created_at: o.created_at,
        invoice_status: inv?.status || 'pending',
        invoice_paid_at: inv?.paid_at || null,
        account_name: nameMap.get(o.user_id) || 'Unknown',
      }
    })

    setOrders(enriched)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = orders.filter(o => {
    const matchesSearch = !search ||
      o.account_name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'paid' && o.invoice_status === 'paid') ||
      (filter === 'pending' && o.invoice_status !== 'paid')
    return matchesSearch && matchesFilter
  })

  const totals = orders.reduce((acc, o) => {
    acc.total += o.total_amount
    if (o.invoice_status === 'paid') acc.paid += o.total_amount
    else acc.pending += o.total_amount
    return acc
  }, { total: 0, paid: 0, pending: 0 })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading orders...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Orders</h1>
            <p className="text-gray-400 text-sm">
              Purchase orders and invoices from your assigned accounts and stores
            </p>
          </div>

          {/* Running Tally */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Order Value</p>
                  <p className="text-xl font-bold text-white">${totals.total.toLocaleString()}</p>
                </div>
                <DollarSign className="w-5 h-5 text-[#9a02d0]" />
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-[#44f80c]/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Paid / Cleared</p>
                  <p className="text-xl font-bold text-[#44f80c]">${totals.paid.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-[#44f80c]" />
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-yellow-400/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Pending Payment</p>
                  <p className="text-xl font-bold text-yellow-400">${totals.pending.toLocaleString()}</p>
                </div>
                <ArrowDownRight className="w-5 h-5 text-yellow-400" />
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by account or order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
            >
              <option value="all">All Orders</option>
              <option value="paid">Paid / Cleared</option>
              <option value="pending">Pending Payment</option>
            </select>
          </div>

          {/* Orders Table */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#9a02d0]" />
                Orders ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No orders found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Orders will appear here when your accounts place them.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(order => (
                    <div
                      key={order.id}
                      className="bg-[#0a0514] rounded-lg p-4 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">
                            {order.id.slice(0, 8)}
                          </span>
                          <span className="text-white font-medium text-sm">{order.account_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <span>{formatDate(order.created_at)}</span>
                          <span>•</span>
                          <span>Qty: {order.quantity}</span>
                          {order.shipping_address && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px]">{order.shipping_address}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-white font-bold">${order.total_amount.toLocaleString()}</span>
                        {order.invoice_status === 'paid' ? (
                          <Badge className="bg-[#44f80c]/20 text-[#44f80c] border-[#44f80c]/20 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" /> Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400/20 text-xs">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
