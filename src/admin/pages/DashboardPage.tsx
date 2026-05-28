import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  Users,
  ShoppingCart,
  FileText,
  DollarSign,
  TrendingUp,
  Package,
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface Stats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  pendingOrders: number
  pendingInvoices: number
  pendingApplications: number
  recentOrders: any[]
}

interface PendingApp {
  id: string
  business_name: string | null
  contact_name: string | null
  email: string
  account_type: string
  state: string | null
  submitted_at: string
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    pendingOrders: 0,
    pendingInvoices: 0,
    pendingApplications: 0,
    recentOrders: []
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
      // Use RPC functions that bypass RLS for accurate data
      const [
        { data: allUsers, error: usersErr },
        { data: allOrders, error: ordersErr },
        { count: productCount },
        { data: pendingAppsData },
        { data: allInvoices, error: invoicesErr }
      ] = await Promise.all([
        supabase.rpc('get_all_users'),
        supabase.rpc('get_all_orders'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase
          .from('applications')
          .select('id, business_name, contact_name, email, account_type, state, submitted_at')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(5),
        supabase.from('invoices').select('id, status, total').limit(1000)
      ])

      if (usersErr) console.error('Users RPC error:', usersErr)
      if (ordersErr) console.error('Orders RPC error:', ordersErr)
      if (invoicesErr) console.error('Invoices error:', invoicesErr)

      const usersData = allUsers || []
      const ordersData = allOrders || []
      const invoicesData = allInvoices || []

      const totalRevenue = ordersData.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      const pendingOrdersCount = ordersData.filter((o: any) => o.status === 'pending').length
      const pendingInvoicesCount = invoicesData.filter((i: any) => i.status === 'pending').length

      setStats({
        totalUsers: usersData.length,
        totalOrders: ordersData.length,
        totalRevenue,
        totalProducts: productCount || 0,
        pendingOrders: pendingOrdersCount,
        pendingInvoices: pendingInvoicesCount,
        pendingApplications: pendingAppsData?.length || 0,
        recentOrders: ordersData.slice(0, 5)
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
          orders: dayOrders.length
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

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-[#44f80c]', bg: 'bg-[#44f80c]/10', border: 'border-[#44f80c]/20', link: '/admin/users', desc: 'View all accounts' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-[#9a02d0]', bg: 'bg-[#9a02d0]/10', border: 'border-[#9a02d0]/20', link: '/admin/orders-invoices', desc: 'Manage orders' },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-[#ff66c4]', bg: 'bg-[#ff66c4]/10', border: 'border-[#ff66c4]/20', link: '/admin/orders-invoices', desc: 'Order history' },
    { label: 'Products', value: stats.totalProducts, icon: Package, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', link: '/admin/products', desc: 'Manage catalog' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', link: '/admin/orders-invoices', desc: 'Needs payment' },
    { label: 'Pending Invoices', value: stats.pendingInvoices, icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', link: '/admin/orders-invoices', desc: 'Unpaid invoices' },
    { label: 'Pending Approvals', value: stats.pendingApplications, icon: ClipboardList, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', link: '/admin/applications', desc: 'Signup requests' },
  ]

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid — Clickable cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              to={card.link}
              className={`group bg-[#150f24] border ${card.border} rounded-xl p-4 hover:border-opacity-60 hover:translate-y-[-2px] transition-all duration-200 block`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">{card.label}</span>
                <div className={`p-1.5 rounded-lg ${card.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="flex items-center gap-1 mt-1 text-gray-500 text-xs group-hover:text-gray-400 transition-colors">
                <span>{card.desc}</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Charts Row + Pending Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-[#150f24] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Revenue Overview</h3>
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Last 7 days</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9a02d0" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#9a02d0" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#150f24" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #150f24', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#9a02d0" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie Chart */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Order Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {orderStatusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #150f24', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {orderStatusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-gray-400 capitalize">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Pending Applications + Daily Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Signup Applications */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-400" />
              Pending Approvals
            </h3>
            {pendingApps.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {pendingApps.length}
              </span>
            )}
          </div>

          {pendingApps.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#44f80c]/10 flex items-center justify-center mx-auto mb-3">
                <ClipboardList className="w-6 h-6 text-[#44f80c]" />
              </div>
              <p className="text-gray-400 text-sm">All caught up!</p>
              <p className="text-gray-500 text-xs mt-1">No signup applications awaiting approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApps.map((app) => (
                <Link
                  key={app.id}
                  to="/admin/applications"
                  className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg border border-white/5 hover:border-yellow-500/30 hover:bg-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{app.business_name || app.email}</p>
                    <p className="text-gray-500 text-xs">{app.contact_name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="bg-white/5 px-1.5 py-0.5 rounded capitalize">{app.account_type || 'Unknown'}</span>
                      {app.state && <span>{app.state}</span>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-yellow-400 flex-shrink-0 transition-colors" />
                </Link>
              ))}
              <Link
                to="/admin/applications"
                className="flex items-center justify-center gap-1 text-sm text-[#9a02d0] hover:text-[#ff66c4] pt-1"
              >
                View all applications <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Daily Orders */}
        <div className="lg:col-span-2 bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Daily Orders</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#150f24" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #150f24', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
