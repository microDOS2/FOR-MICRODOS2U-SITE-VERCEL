import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  Users,
  ShoppingCart,
  FileText,
  DollarSign,
  TrendingUp,
  Package
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
  recentOrders: any[]
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    pendingOrders: 0,
    recentOrders: []
  })
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderStatusData, setOrderStatusData] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch counts in parallel
      const [
        { count: userCount },
        { count: orderCount },
        { data: ordersData },
        { count: productCount },
        { count: approvalCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total, status, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ])

      const totalRevenue = ordersData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0

      setStats({
        totalUsers: userCount || 0,
        totalOrders: orderCount || 0,
        totalRevenue,
        totalProducts: productCount || 0,
        pendingOrders: approvalCount || 0,
        recentOrders: ordersData?.slice(0, 5) || []
      })

      // Generate revenue chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const revenueByDay = last7Days.map(date => {
        const dayOrders = ordersData?.filter(o => o.created_at?.startsWith(date)) || []
        return {
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          orders: dayOrders.length
        }
      })
      setRevenueData(revenueByDay)

      // Order status breakdown
      const statusCounts: Record<string, number> = {}
      ordersData?.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
      })
      setOrderStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-[#44f80c]', bg: 'bg-[#9a02d0]/10' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Products', value: stats.totalProducts, icon: Package, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: FileText, color: 'text-rose-400', bg: 'bg-rose-400/10' },
  ]

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9a02d0]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-[#150f24] border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
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

      {/* Orders Bar Chart */}
      <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
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
  )
}
