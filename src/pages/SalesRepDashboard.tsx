import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import {
  Store,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Building2,
  Package,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

interface OrderSummary {
  total_orders: number
  total_amount: number
  paid_amount: number
  pending_amount: number
}

interface ActivityItem {
  id: string
  action: string
  table_name: string
  created_at: string
  details: string
}

export function SalesRepDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [accountCount, setAccountCount] = useState(0)
  const [storeCount, setStoreCount] = useState(0)
  const [orderSummary, setOrderSummary] = useState<OrderSummary>({
    total_orders: 0,
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
  })
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [notifications, setNotifications] = useState(0)

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    // Verify role
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', repId)
      .single()
    if (me?.role !== 'sales_rep') {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // 1. Account assignments (account rep)
    const { data: acctAssignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', repId)

    const accountIds = (acctAssignments || []).map((a: any) => a.account_id)
    setAccountCount(accountIds.length)

    // 2. Store assignments (store rep)
    const { data: storeData } = await supabase
      .from('wholesaler_store_locations')
      .select('id')
      .ilike('license_number', `rep:${repId}%`)

    const storeIds = (storeData || []).map((s: any) => s.id)
    setStoreCount(storeIds.length)

    // 3. Orders from assigned accounts
    let ordersData: any[] = []
    if (accountIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select('id, total_amount, status, user_id, created_at')
        .in('user_id', accountIds)
        .order('created_at', { ascending: false })
      ordersData = data || []
    }

    // 4. Invoices for those orders
    const orderIds = ordersData.map((o: any) => o.id)
    let invoiceMap = new Map<string, string>()
    if (orderIds.length > 0) {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('order_id, status, amount')
        .in('order_id', orderIds)
      ;(invoiceData || []).forEach((inv: any) => {
        invoiceMap.set(inv.order_id, inv.status)
      })
    }

    // Calculate order summary
    let total = 0
    let paid = 0
    let pending = 0
    ordersData.forEach((o: any) => {
      total += o.total_amount || 0
      const invStatus = invoiceMap.get(o.id)
      if (invStatus === 'paid') {
        paid += o.total_amount || 0
      } else {
        pending += o.total_amount || 0
      }
    })

    setOrderSummary({
      total_orders: ordersData.length,
      total_amount: total,
      paid_amount: paid,
      pending_amount: pending,
    })

    // 5. Recent activity from audit log
    const { data: auditData } = await supabase
      .from('audit_log')
      .select('id, action, table_name, record_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    const activity: ActivityItem[] = (auditData || []).map((a: any) => ({
      id: a.id,
      action: a.action,
      table_name: a.table_name,
      created_at: a.created_at,
      details: formatAuditAction(a.action, a.table_name, a.record_id),
    }))
    setRecentActivity(activity)

    // 6. Pending notifications count
    const { count: transferCount } = await supabase
      .from('assignment_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', repId)
      .eq('status', 'pending')

    setNotifications(transferCount || 0)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const formatAuditAction = (action: string, table: string, recordId: string) => {
    if (action === 'account_transferred') return `Account transferred (ID: ${recordId?.slice(0, 8)})`
    if (action === 'rep_transferred') return `Rep reassigned (ID: ${recordId?.slice(0, 8)})`
    if (action === 'transfer_created') return `Transfer request created`
    if (action === 'transfer_accepted') return `Transfer accepted`
    if (action === 'transfer_rejected') return `Transfer rejected`
    if (action === 'account_rep_assigned') return `Account rep assigned`
    if (action === 'store_rep_assigned') return `Store rep assigned`
    return `${action} on ${table}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading dashboard...</div>
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
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Sales Rep Dashboard</h1>
              <p className="text-gray-400 text-sm">Overview of your accounts, stores, and orders</p>
            </div>
            {notifications > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400/30 px-3 py-1">
                <Bell className="w-3.5 h-3.5 mr-1.5" />
                {notifications} pending notification{notifications !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Accounts</p>
                    <p className="text-2xl font-bold text-white">{accountCount}</p>
                  </div>
                  <Building2 className="w-5 h-5 text-[#44f80c]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Stores</p>
                    <p className="text-2xl font-bold text-white">{storeCount}</p>
                  </div>
                  <Store className="w-5 h-5 text-[#9a02d0]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Total Orders</p>
                    <p className="text-2xl font-bold text-white">{orderSummary.total_orders}</p>
                  </div>
                  <ShoppingCart className="w-5 h-5 text-[#ff66c4]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Total Volume</p>
                    <p className="text-2xl font-bold text-white">
                      ${orderSummary.total_amount.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-5 h-5 text-[#44f80c]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Paid / Cleared</p>
                    <p className="text-xl font-bold text-[#44f80c]">
                      ${orderSummary.paid_amount.toLocaleString()}
                    </p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#44f80c]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Pending Payment</p>
                    <p className="text-xl font-bold text-yellow-400">
                      ${orderSummary.pending_amount.toLocaleString()}
                    </p>
                  </div>
                  <ArrowDownRight className="w-5 h-5 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs">Collection Rate</p>
                    <p className="text-xl font-bold text-white">
                      {orderSummary.total_amount > 0
                        ? Math.round((orderSummary.paid_amount / orderSummary.total_amount) * 100)
                        : 0}%
                    </p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-[#9a02d0]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-[#9a02d0]" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg border border-white/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#9a02d0]/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-[#9a02d0]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">{item.details}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(item.created_at).toLocaleDateString()} at{' '}
                          {new Date(item.created_at).toLocaleTimeString()}
                        </p>
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
