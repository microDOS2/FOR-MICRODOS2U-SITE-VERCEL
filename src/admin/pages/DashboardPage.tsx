import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  ClipboardList,
  CreditCard,
  Truck,
  MapPin,
  ArrowRight,
  Loader2,
  Check,
  X
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { toast } from 'sonner'

interface Stats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  pendingApplications: number
  pendingPayment: number
  readyToShip: number
  inTransit: number
}

interface PendingApp {
  id: string
  business_name: string | null
  contact_name: string | null
  email: string
  account_type: string
  state: string | null
  phone: string | null
  submitted_at: string
}

// Tooltip wrapper using native title
function TooltipCard({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
  return (
    <div className="relative group" title={tooltip}>
      {children}
    </div>
  )
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    pendingApplications: 0,
    pendingPayment: 0,
    readyToShip: 0,
    inTransit: 0,
  })
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderStatusData, setOrderStatusData] = useState<any[]>([])
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [
        { data: allUsers, error: usersErr },
        { data: allOrders, error: ordersErr },
        { data: allInvoices, error: invoicesErr },
        { count: productCount },
        { data: pendingAppsData }
      ] = await Promise.all([
        supabase.rpc('get_all_users'),
        supabase.rpc('get_all_orders'),
        supabase.from('invoices').select('id, status').limit(1000),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase
          .from('applications')
          .select('id, business_name, contact_name, email, account_type, state, phone, submitted_at')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(5)
      ])

      if (usersErr) console.error('Users error:', usersErr)
      if (ordersErr) console.error('Orders error:', ordersErr)
      if (invoicesErr) console.error('Invoices error:', invoicesErr)

      const usersData = allUsers || []
      const ordersData = allOrders || []
      const invoicesData = allInvoices || []

      const totalRevenue = ordersData.reduce((sum: number, o: any) => sum + (o.total || 0), 0)

      setStats({
        totalUsers: usersData.length,
        totalOrders: ordersData.length,
        totalRevenue,
        totalProducts: productCount || 0,
        pendingApplications: pendingAppsData?.length || 0,
        pendingPayment: invoicesData.filter((i: any) => i.status === 'pending').length,
        readyToShip: ordersData.filter((o: any) => o.status === 'processing').length,
        inTransit: ordersData.filter((o: any) => o.status === 'shipped').length,
      })

      setPendingApps(pendingAppsData || [])

      // Revenue chart (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const revenueByDay = last7Days.map(date => {
        const dayOrders = ordersData.filter((o: any) => o.created_at?.startsWith(date))
        return {
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: dayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        }
      })
      setRevenueData(revenueByDay)

      // Order status breakdown
      const statusCounts: Record<string, number> = {}
      ordersData.forEach((o: any) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
      })
      setOrderStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (appId: string) => {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'approved' })
      .eq('id', appId)
    if (error) toast.error('Failed to approve: ' + error.message)
    else {
      toast.success('Application approved!')
      fetchDashboardData()
    }
  }

  const handleReject = async (appId: string) => {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', appId)
    if (error) toast.error('Failed to reject: ' + error.message)
    else {
      toast.success('Application rejected')
      fetchDashboardData()
    }
  }

  const COLORS: Record<string, string> = {
    pending: '#facc15',
    processing: '#60a5fa',
    shipped: '#a78bfa',
    cancelled: '#ef4444',
    delivered: '#4ade80',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* === ROW 1: NEEDS YOUR ATTENTION === */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Needs Your Attention</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Applications to Review */}
          <TooltipCard tooltip="New wholesaler/distributor signups waiting for your approval. Click to review.">
            <Link
              to="/admin/applications"
              className="block bg-[#150f24] border border-red-500/20 rounded-xl p-4 hover:border-red-500/40 hover:translate-y-[-2px] transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 text-xs font-medium">Applications to Review</span>
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <ClipboardList className="w-3.5 h-3.5 text-red-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{stats.pendingApplications}</div>
              <div className="text-gray-500 text-xs mt-1">Approve or reject signups</div>
              <div className="flex items-center gap-1 mt-2 text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Take action</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </TooltipCard>

          {/* Invoices Pending Payment */}
          <TooltipCard tooltip="Invoices with 'pending' status — payment not yet collected. Click to manage invoices and mark as paid.">
            <Link
              to="/admin/orders-invoices"
              className="block bg-[#150f24] border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-500/40 hover:translate-y-[-2px] transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-400 text-xs font-medium">Invoices Pending Payment</span>
                <div className="p-1.5 rounded-lg bg-yellow-500/10">
                  <CreditCard className="w-3.5 h-3.5 text-yellow-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{stats.pendingPayment}</div>
              <div className="text-gray-500 text-xs mt-1">Unpaid invoices awaiting collection</div>
              <div className="flex items-center gap-1 mt-2 text-yellow-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Collect payment</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </TooltipCard>

          {/* Orders Ready to Ship */}
          <TooltipCard tooltip="Orders with 'processing' status — payment received, ready to forward to shipping/fulfillment. Click to send to fulfillment.">
            <Link
              to="/admin/orders-invoices"
              className="block bg-[#150f24] border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 hover:translate-y-[-2px] transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-xs font-medium">Orders Ready to Ship</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Truck className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{stats.readyToShip}</div>
              <div className="text-gray-500 text-xs mt-1">Forward to fulfillment</div>
              <div className="flex items-center gap-1 mt-2 text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Send to shipping</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </TooltipCard>

          {/* Orders In Transit */}
          <TooltipCard tooltip="Orders with 'shipped' status — currently in transit to customer. Track delivery status.">
            <Link
              to="/admin/orders-invoices"
              className="block bg-[#150f24] border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/40 hover:translate-y-[-2px] transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 text-xs font-medium">Orders In Transit</span>
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{stats.inTransit}</div>
              <div className="text-gray-500 text-xs mt-1">Track delivery status</div>
              <div className="flex items-center gap-1 mt-2 text-purple-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Track orders</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </TooltipCard>
        </div>
      </div>

      {/* === ROW 2: BUSINESS SUMMARY === */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Business Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TooltipCard tooltip="Total registered user accounts across all roles: admin, sales managers, sales reps, wholesalers, distributors, and shipping.">
            <Link
              to="/admin/users"
              className="block bg-[#150f24] border border-[#44f80c]/10 rounded-xl p-4 hover:border-[#44f80c]/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Total Users</span>
                <Users className="w-4 h-4 text-[#44f80c]" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
              <div className="text-gray-600 text-xs mt-1">All accounts</div>
            </Link>
          </TooltipCard>

          <TooltipCard tooltip="Total purchase orders placed in the system. Includes all statuses: pending, processing, shipped, and cancelled.">
            <Link
              to="/admin/orders-invoices"
              className="block bg-[#150f24] border border-[#9a02d0]/10 rounded-xl p-4 hover:border-[#9a02d0]/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Total Orders</span>
                <ShoppingCart className="w-4 h-4 text-[#9a02d0]" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
              <div className="text-gray-600 text-xs mt-1">All-time orders</div>
            </Link>
          </TooltipCard>

          <TooltipCard tooltip="Total revenue from all orders placed in the system. Sum of all order totals.">
            <Link
              to="/admin/orders-invoices"
              className="block bg-[#150f24] border border-[#ff66c4]/10 rounded-xl p-4 hover:border-[#ff66c4]/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Revenue</span>
                <DollarSign className="w-4 h-4 text-[#ff66c4]" />
              </div>
              <div className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div className="text-gray-600 text-xs mt-1">Total sales</div>
            </Link>
          </TooltipCard>

          <TooltipCard tooltip="Number of products in the catalog. Each product has multiple packaging variants (Individual, Case, Master Case).">
            <Link
              to="/admin/products"
              className="block bg-[#150f24] border border-purple-500/10 rounded-xl p-4 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Products</span>
                <Package className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalProducts}</div>
              <div className="text-gray-600 text-xs mt-1">In catalog</div>
            </Link>
          </TooltipCard>
        </div>
      </div>

      {/* === ROW 3: CHARTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Overview</h3>
          {revenueData.some((d: any) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9a02d0" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9a02d0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1025" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#9a02d0" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600 gap-2">
              <DollarSign className="w-8 h-8" />
              <p className="text-sm">No revenue data yet</p>
              <p className="text-xs text-gray-700">Revenue will appear when orders are placed</p>
            </div>
          )}
        </div>

        {/* Order Status */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Order Status</h3>
          {orderStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {orderStatusData.map((entry: any) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {orderStatusData.map((entry: any) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[entry.name] || '#6b7280' }} />
                    <span className="text-gray-400 capitalize">{entry.name}</span>
                    <span className="text-gray-500">({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-gray-600 gap-2">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-sm">No orders yet</p>
            </div>
          )}
        </div>
      </div>

      {/* === ROW 4: PENDING APPLICATIONS PREVIEW === */}
      {pendingApps.length > 0 && (
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-400" />
              Applications Awaiting Approval
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {pendingApps.length}
              </span>
            </h3>
            <Link
              to="/admin/applications"
              className="text-sm text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApps.map((app) => (
              <div
                key={app.id}
                className="flex items-start justify-between p-4 bg-[#0a0514] rounded-lg border border-white/5"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium">{app.business_name}</p>
                  <p className="text-gray-500 text-sm">{app.contact_name} — {app.email}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span className="bg-white/5 px-1.5 py-0.5 rounded capitalize">{app.account_type}</span>
                    {app.state && <span>{app.state}</span>}
                    {app.phone && <span>{app.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleApprove(app.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#44f80c]/10 text-[#44f80c] rounded-lg hover:bg-[#44f80c]/20 transition-colors text-sm"
                    title="Approve this application"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
                    title="Reject this application"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === EMPTY STATE WHEN NO PENDING APPS === */}
      {pendingApps.length === 0 && (
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Applications Awaiting Approval</h3>
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[#44f80c]/10 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-6 h-6 text-[#44f80c]" />
            </div>
            <p className="text-gray-400 text-sm">All caught up!</p>
            <p className="text-gray-600 text-xs mt-1">No signup applications awaiting approval.</p>
          </div>
        </div>
      )}
    </div>
  )
}
