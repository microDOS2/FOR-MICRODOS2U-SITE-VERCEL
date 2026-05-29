import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Users, ShoppingCart, DollarSign, Package, ClipboardList,
  CreditCard, Truck, MapPin, Check, X, Loader2, ArrowRight,
  AlertTriangle, TrendingUp, Clock
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'
import { toast } from 'sonner'
import { sendInvoiceReminder } from '@/lib/orderNotifications'

interface Stats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  pendingApplications: number
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

interface ActivityItem {
  id: string
  type: 'paid' | 'shipped' | 'application' | 'cancelled'
  message: string
  time: string
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0, pendingApplications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderStatusData, setOrderStatusData] = useState<any[]>([])
  const [invoiceAgingData, setInvoiceAgingData] = useState<any[]>([])
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  const [processingOrders, setProcessingOrders] = useState<any[]>([])
  const [shippedOrders, setShippedOrders] = useState<any[]>([])
  const [payProcessingId, setPayProcessingId] = useState<string | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0)
  const [pendingInvoiceTotal, setPendingInvoiceTotal] = useState(0)
  const [fulfillmentCount, setFulfillmentCount] = useState(0)
  const [shippedOrderCount, setShippedOrderCount] = useState(0)

  useEffect(() => { fetchDashboardData() }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString()

      // REAL database counts using count queries
      const [
        { data: allUsers, error: usersErr },
        { data: allOrders, error: ordersErr },
        { data: allInvoices, error: _invoicesErr },
        { count: productCount },
        { count: pendingInvCount },
        { data: pendingInvSum },
        { count: processingCount },
        { count: shippedCount },
        { data: pendingAppsData },
        { data: pendingInvData },
        { data: procOrders },
        { data: shipOrders },
        { data: recentPaidInv },
        { data: recentShipped },
        { data: recentApps },
      ] = await Promise.all([
        supabase.rpc('get_all_users'),
        supabase.rpc('get_all_orders'),
        supabase.from('invoices').select('id, status, amount, created_at, paid_date, paid_method').limit(1000),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        // REAL counts from database
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invoices').select('amount').eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped'),
        // Limited lists for panels
        supabase.from('applications').select('id, business_name, contact_name, email, account_type, state, phone, submitted_at').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('invoices').select(`
          id, invoice_number, amount, created_at, user_id, order_id,
          users!user_id (business_name, email, contact_name),
          orders:order_id (po_number)
        `).eq('status', 'pending').order('created_at', { ascending: true }).limit(3),
        supabase.from('orders').select(`
          id, po_number, total, created_at, status, shipped_date, tracking_number, carrier, forwarded_to_fulfillment_at,
          users!user_id (business_name, email, contact_name)
        `).eq('status', 'processing').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select(`
          id, po_number, total, created_at, status, shipped_date, tracking_number, carrier, forwarded_to_fulfillment_at,
          users!user_id (business_name, email, contact_name)
        `).eq('status', 'shipped').order('shipped_date', { ascending: false }).limit(5),
        supabase.from('invoices').select(`
          id, invoice_number, amount, paid_date, paid_method,
          users!user_id (business_name),
          orders:order_id (po_number)
        `).eq('status', 'paid').order('paid_date', { ascending: false }).limit(5),
        supabase.from('orders').select(`
          id, po_number, shipped_date, carrier, tracking_number,
          users!user_id (business_name)
        `).eq('status', 'shipped').order('shipped_date', { ascending: false }).limit(5),
        supabase.from('applications').select('id, business_name, account_type, submitted_at').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(3),
      ])

      if (usersErr) console.error('Users error:', usersErr)
      if (ordersErr) console.error('Orders error:', ordersErr)

      const usersData = allUsers || []
      const ordersData = allOrders || []
      const invoicesData = allInvoices || []

      setStats({
        totalUsers: usersData.length,
        totalOrders: ordersData.length,
        totalRevenue: ordersData.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        totalProducts: productCount || 0,
        pendingApplications: pendingAppsData?.length || 0,
      })

      setPendingApps(pendingAppsData || [])
      setPendingInvoices(pendingInvData || [])
      setProcessingOrders(procOrders || [])
      setShippedOrders(shipOrders || [])

      // REAL counts from database count queries
      setPendingInvoiceCount(pendingInvCount || 0)
      setPendingInvoiceTotal((pendingInvSum || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
      setFulfillmentCount(processingCount || 0)
      setShippedOrderCount(shippedCount || 0)

      // Revenue chart
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0]
      })
      setRevenueData(last7Days.map(date => ({
        name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: ordersData.filter((o: any) => o.created_at?.startsWith(date)).reduce((sum: number, o: any) => sum + (o.total || 0), 0),
      })))

      // Status breakdown
      const sc: Record<string, number> = {}
      ordersData.forEach((o: any) => { sc[o.status] = (sc[o.status] || 0) + 1 })
      setOrderStatusData(Object.entries(sc).map(([name, value]) => ({ name, value })))

      // Invoice aging
      const now = new Date()
      const aging = [
        { name: '0-30', count: 0, color: '#facc15' },
        { name: '31-60', count: 0, color: '#fb923c' },
        { name: '60+', count: 0, color: '#ef4444' },
      ]
      ;(pendingInvData || []).forEach((inv: any) => {
        const days = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / 86400000)
        if (days <= 30) aging[0].count++
        else if (days <= 60) aging[1].count++
        else aging[2].count++
      })
      setInvoiceAgingData(aging)

      // Recent activity
      const activity: ActivityItem[] = []
      ;(recentPaidInv || []).forEach((inv: any) => {
        activity.push({
          id: `paid-${inv.id}`,
          type: 'paid',
          message: `${inv.invoice_number} paid${inv.users?.business_name ? ` by ${inv.users.business_name}` : ''}`,
          time: inv.paid_date || '',
        })
      })
      ;(recentShipped || []).forEach((order: any) => {
        activity.push({
          id: `ship-${order.id}`,
          type: 'shipped',
          message: `${order.po_number} shipped${order.carrier ? ` via ${order.carrier}` : ''}${order.users?.business_name ? ` — ${order.users.business_name}` : ''}`,
          time: order.shipped_date || '',
        })
      })
      ;(recentApps || []).forEach((app: any) => {
        activity.push({
          id: `app-${app.id}`,
          type: 'application',
          message: `New signup: ${app.business_name} (${app.account_type})`,
          time: app.submitted_at || '',
        })
      })
      activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setRecentActivity(activity.slice(0, 8))

      // Overdue reminders
      await checkOverdueInvoices(ordersData, invoicesData, fiveDaysAgo)
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const checkOverdueInvoices = async (ordersData: any[], _invoicesData: any[], _fiveDaysAgo: string) => {
    try {
      const now = new Date()
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
      const { data: pendingInvoices } = await supabase
        .from('invoices').select('id, invoice_number, amount, created_at, reminder_sent_at, reminder_count, order_id')
        .eq('status', 'pending').order('created_at', { ascending: true })
      if (!pendingInvoices?.length) return
      let sent = 0
      for (const inv of pendingInvoices) {
        const createdAt = new Date(inv.created_at)
        const reminderSentAt = inv.reminder_sent_at ? new Date(inv.reminder_sent_at) : null
        const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / fiveDaysMs * 5)
        if (daysSinceCreated < 5) continue
        if (reminderSentAt && Math.floor((now.getTime() - reminderSentAt.getTime()) / fiveDaysMs * 5) < 5) continue
        const order = ordersData.find((o: any) => o.id === inv.order_id)
        if (!order?.users?.email) continue
        await sendInvoiceReminder({
          invoiceNumber: inv.invoice_number, poNumber: order.po_number,
          customerEmail: order.users.email,
          businessName: order.users.business_name || order.users.contact_name || 'Valued Customer',
          total: inv.amount, dueDate: createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          daysOverdue: daysSinceCreated,
        })
        await supabase.from('invoices').update({
          reminder_sent_at: now.toISOString(), reminder_count: ((inv.reminder_count || 0) as number) + 1,
        }).eq('id', inv.id)
        sent++
      }
      if (sent > 0) toast.info(`Sent ${sent} overdue invoice reminder${sent > 1 ? 's' : ''}`)
    } catch (err) { console.error('Overdue check error:', err) }
  }

  const markPaid = async (invoiceId: string, orderId: string, method: 'check' | 'cash' | 'wire') => {
    setPayProcessingId(invoiceId)
    const now = new Date().toISOString()
    const [{ error: invErr }, { error: ordErr }] = await Promise.all([
      supabase.from('invoices').update({ status: 'paid', paid_date: now.split('T')[0], paid_method: method, paid_reference: `Manual: ${method}` }).eq('id', invoiceId),
      supabase.from('orders').update({ status: 'processing', forwarded_to_fulfillment_at: now }).eq('id', orderId),
    ])
    setPayProcessingId(null)
    if (invErr || ordErr) { toast.error('Failed: ' + ((invErr || ordErr)?.message || '')); return }
    toast.success('Marked paid! Auto-forwarded to shipping.')

    try {
      const { data: commResult, error: commErr } = await supabase
        .rpc('generate_order_commissions', { p_order_id: orderId })
      if (commErr) {
        console.error('Commission generation error:', commErr)
      } else if (commResult) {
        const result = typeof commResult === 'string' ? JSON.parse(commResult) : commResult
        if (result?.success && result?.rep_amount > 0) {
          toast.success(`Commission: $${Number(result.rep_amount).toFixed(2)} generated`)
        }
      }
    } catch (commErr: any) {
      console.error('Commission generation failed:', commErr)
    }

    fetchDashboardData()
  }

  const handleApprove = async (appId: string) => {
    const { error } = await supabase.from('applications').update({ status: 'approved' }).eq('id', appId)
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success('Approved!'); fetchDashboardData() }
  }
  const handleReject = async (appId: string) => {
    const { error } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId)
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success('Rejected'); fetchDashboardData() }
  }

  const COLORS: Record<string, string> = { pending: '#facc15', processing: '#60a5fa', shipped: '#a78bfa', cancelled: '#ef4444', delivered: '#4ade80' }

  const activityIcon = (type: string) => {
    switch (type) {
      case 'paid': return <DollarSign className="w-4 h-4 text-emerald-400" />
      case 'shipped': return <Truck className="w-4 h-4 text-purple-400" />
      case 'application': return <Users className="w-4 h-4 text-blue-400" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" /></div>

  return (
    <div className="space-y-6">

      {/* === ROW 1: KPI STAT CARDS (Clickable) === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link
          to="/admin/orders-invoices?tab=pending"
          className="bg-[#150f24] border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-500/40 transition-colors group"
          title="View pending invoices"
        >
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-yellow-400/60 group-hover:text-yellow-400 transition-colors">Pending</span>
          </div>
          <p className="text-2xl font-bold text-white">{pendingInvoiceCount}</p>
          <p className="text-xs text-yellow-400/70">${pendingInvoiceTotal.toFixed(2)} owed</p>
        </Link>

        <Link
          to="/admin/orders-invoices?tab=fulfillment"
          className="bg-[#150f24] border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-colors group"
          title="View orders in fulfillment"
        >
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-blue-400/60 group-hover:text-blue-400 transition-colors">Fulfillment</span>
          </div>
          <p className="text-2xl font-bold text-white">{fulfillmentCount}</p>
          <p className="text-xs text-blue-400/70">orders to pack</p>
        </Link>

        <Link
          to="/admin/orders-invoices?tab=shipped"
          className="bg-[#150f24] border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/40 transition-colors group"
          title="View shipped orders"
        >
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-purple-400/60 group-hover:text-purple-400 transition-colors">Shipped</span>
          </div>
          <p className="text-2xl font-bold text-white">{shippedOrderCount}</p>
          <p className="text-xs text-purple-400/70">shipped orders</p>
        </Link>

        <Link
          to="/admin/applications"
          className="bg-[#150f24] border border-red-500/20 rounded-xl p-4 hover:border-red-500/40 transition-colors group"
          title="View signup applications"
        >
          <div className="flex items-center justify-between mb-2">
            <ClipboardList className="w-5 h-5 text-red-400" />
            <span className="text-xs text-red-400/60 group-hover:text-red-400 transition-colors">Applications</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.pendingApplications}</p>
          <p className="text-xs text-red-400/70">awaiting approval</p>
        </Link>

        <div
          className="bg-[#150f24] border border-[#ff66c4]/20 rounded-xl p-4"
          title="Total revenue"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-[#ff66c4]" />
            <span className="text-xs text-[#ff66c4]/60">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-white">${(stats.totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-[#ff66c4]/70">lifetime total</p>
        </div>
      </div>

      {/* === ROW 2: CHARTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#9a02d0]" />Revenue (7 Days)
          </h3>
          {revenueData.some((d: any) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9a02d0" stopOpacity={0.3}/><stop offset="95%" stopColor="#9a02d0" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1025" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} />
                <Area type="monotone" dataKey="revenue" stroke="#9a02d0" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No revenue data yet</div>
          )}
        </div>

        {/* Order Status Donut */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#44f80c]" />Order Status
          </h3>
          {orderStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                    {orderStatusData.map((e: any) => <Cell key={e.name} fill={COLORS[e.name] || '#6b7280'} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1 justify-center">
                {orderStatusData.map((e: any) => (
                  <div key={e.name} className="flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[e.name] || '#6b7280' }} /><span className="text-gray-400 capitalize">{e.name}</span><span className="text-gray-500">({e.value})</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No orders yet</div>
          )}
        </div>

        {/* Invoice Aging Bar Chart */}
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />Invoice Aging
          </h3>
          {invoiceAgingData.some((d: any) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={invoiceAgingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1025" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {invoiceAgingData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No pending invoices</div>
          )}
        </div>
      </div>

      {/* === ROW 3: ACTION PANELS (2 columns) === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left: Urgent Actions */}
        <div className="space-y-4">

          {/* Pending Invoices */}
          <div className="bg-[#150f24] border border-yellow-500/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-yellow-400" />Invoices Pending Payment</h3>
              <Link to="/admin/orders-invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            {pendingInvoices.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">All caught up!</div>
            ) : (
              <div className="space-y-2">
                {pendingInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-300">{inv.invoice_number}</span>
                        <span className="text-gray-500 text-xs">{inv.users?.business_name || 'Unknown'}</span>
                      </div>
                      <p className="text-gray-500 text-xs">PO: {inv.orders?.po_number || 'N/A'}</p>
                    </div>
                    <div className="text-right mr-3 flex-shrink-0">
                      <p className="text-white font-medium">${(inv.amount || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(['check', 'wire', 'cash'] as const).map(method => (
                        <button
                          key={method}
                          onClick={() => markPaid(inv.id, inv.order_id, method)}
                          disabled={payProcessingId === inv.id}
                          className="px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded text-xs capitalize transition-colors disabled:opacity-50"
                        >
                          {payProcessingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : method}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In Fulfillment */}
          <div className="bg-[#150f24] border border-blue-500/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-blue-400" />In Fulfillment</h3>
              <Link to="/admin/orders-invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            {processingOrders.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No orders in fulfillment.</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {processingOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
                        <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-xs">In Fulfillment</span>
                      </div>
                      <p className="text-gray-400 text-xs">{order.users?.business_name || order.users?.contact_name || 'Unknown'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-medium">${(order.total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Monitoring */}
        <div className="space-y-4">

          {/* Orders In Transit */}
          <div className="bg-[#150f24] border border-purple-500/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-purple-400" />Orders In Transit</h3>
              <Link to="/admin/orders-invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            {shippedOrders.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No orders in transit.</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shippedOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
                        <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded text-xs">Shipped</span>
                      </div>
                      <p className="text-gray-400 text-xs">{order.users?.business_name || 'Unknown'}</p>
                      {order.tracking_number && (
                        <p className="text-gray-500 text-xs">{order.carrier} — {order.tracking_number}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-medium">${(order.total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div className="bg-[#150f24] border border-red-500/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-red-400" />Applications Awaiting Approval</h3>
              <Link to="/admin/applications" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            {pendingApps.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">All caught up!</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {pendingApps.map(app => (
                  <div key={app.id} className="flex items-start justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">{app.business_name}</p>
                      <p className="text-gray-500 text-xs">{app.contact_name} — {app.email}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <span className="bg-white/5 px-1.5 py-0.5 rounded capitalize">{app.account_type}</span>
                        {app.state && <span>{app.state}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button onClick={() => handleApprove(app.id)} className="flex items-center gap-1 px-2 py-1 bg-[#44f80c]/10 text-[#44f80c] rounded hover:bg-[#44f80c]/20 transition-colors text-xs"><Check className="w-3 h-3" />Approve</button>
                      <button onClick={() => handleReject(app.id)} className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors text-xs"><X className="w-3 h-3" />Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === ROW 4: RECENT ACTIVITY === */}
      {recentActivity.length > 0 && (
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />Recent Activity
          </h3>
          <div className="space-y-2">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 bg-[#0a0514] rounded-lg border border-white/5">
                {activityIcon(item.type)}
                <p className="text-sm text-gray-300 flex-1">{item.message}</p>
                <p className="text-xs text-gray-500 flex-shrink-0">{item.time ? new Date(item.time).toLocaleDateString() : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
