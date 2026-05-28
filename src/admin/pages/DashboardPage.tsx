import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Users, ShoppingCart, DollarSign, Package, ClipboardList,
  CreditCard, Truck, MapPin, Check, X, Loader2, ArrowRight
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
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

// Types removed - using any[] for Supabase FK relation data

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0, pendingApplications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderStatusData, setOrderStatusData] = useState<any[]>([])
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  const [processingOrders, setProcessingOrders] = useState<any[]>([])
  const [shippedOrders, setShippedOrders] = useState<any[]>([])
  const [payProcessingId, setPayProcessingId] = useState<string | null>(null)

  useEffect(() => { fetchDashboardData() }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString()

      const [
        { data: allUsers, error: usersErr },
        { data: allOrders, error: ordersErr },
        { data: allInvoices, error: _invoicesErr },
        { count: productCount },
        { data: pendingAppsData },
        { data: pendingInvData },
        { data: procOrders },
        { data: shipOrders },
      ] = await Promise.all([
        supabase.rpc('get_all_users'),
        supabase.rpc('get_all_orders'),
        supabase.from('invoices').select('id, status, total, created_at').limit(1000),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('id, business_name, contact_name, email, account_type, state, phone, submitted_at').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('invoices').select(`
          id, invoice_number, total, created_at, user_id, order_id,
          users!user_id (business_name, email, contact_name),
          orders:order_id (po_number)
        `).eq('status', 'pending').order('created_at', { ascending: true }).limit(10),
        supabase.from('orders').select(`
          id, po_number, total, created_at, status, shipped_date, tracking_number, carrier, forwarded_to_fulfillment_at,
          users!user_id (business_name, email, contact_name)
        `).eq('status', 'processing').order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select(`
          id, po_number, total, created_at, status, shipped_date, tracking_number, carrier, forwarded_to_fulfillment_at,
          users!user_id (business_name, email, contact_name)
        `).eq('status', 'shipped').order('shipped_date', { ascending: false }).limit(10),
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
        .from('invoices').select('id, invoice_number, total, created_at, reminder_sent_at, reminder_count, order_id')
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
          total: inv.total, dueDate: createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" /></div>

  return (
    <div className="space-y-6">

      {/* === MINI BUSINESS SUMMARY === */}
      <div className="flex items-center gap-6 text-sm">
        <Link to="/admin/users" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"><Users className="w-3.5 h-3.5 text-[#44f80c]" />{stats.totalUsers} users</Link>
        <Link to="/admin/orders-invoices" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"><ShoppingCart className="w-3.5 h-3.5 text-[#9a02d0]" />{stats.totalOrders} orders</Link>
        <span className="flex items-center gap-1.5 text-gray-400"><DollarSign className="w-3.5 h-3.5 text-[#ff66c4]" />${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        <Link to="/admin/products" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"><Package className="w-3.5 h-3.5 text-purple-400" />{stats.totalProducts} products</Link>
      </div>

      {/* === PANEL 1: INVOICES PENDING PAYMENT === */}
      <div className="bg-[#150f24] border border-yellow-500/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5 text-yellow-400" />Invoices Pending Payment</h3>
          <Link to="/admin/orders-invoices?tab=invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {pendingInvoices.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No unpaid invoices. All caught up!</div>
        ) : (
          <div className="space-y-2">
            {pendingInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-300">{inv.invoice_number}</span>
                    <span className="text-gray-500 text-xs">PO: {inv.orders?.po_number || 'N/A'}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{inv.users?.business_name || inv.users?.contact_name || 'Unknown'}</p>
                </div>
                <div className="text-right mr-4 flex-shrink-0">
                  <p className="text-white font-medium">${(inv.total || 0).toFixed(2)}</p>
                  <p className="text-gray-600 text-xs">{new Date(inv.created_at).toLocaleDateString()}</p>
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

      {/* === PANEL 2: ORDERS READY TO SHIP === */}
      <div className="bg-[#150f24] border border-blue-500/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2"><Truck className="w-5 h-5 text-blue-400" />Orders Ready to Ship</h3>
          <Link to="/admin/orders-invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {processingOrders.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No orders ready to ship.</div>
        ) : (
          <div className="space-y-2">
            {processingOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
                    <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-xs">Ready to Ship</span>
                  </div>
                  <p className="text-gray-400 text-xs">{order.users?.business_name || order.users?.contact_name || 'Unknown'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-medium">${(order.total || 0).toFixed(2)}</p>
                  <p className="text-gray-600 text-xs">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === PANEL 3: ORDERS IN TRANSIT === */}
      <div className="bg-[#150f24] border border-purple-500/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-400" />Orders In Transit</h3>
          <Link to="/admin/orders-invoices" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {shippedOrders.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No orders currently in transit.</div>
        ) : (
          <div className="space-y-2">
            {shippedOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
                    <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded text-xs">Shipped</span>
                  </div>
                  <p className="text-gray-400 text-xs">{order.users?.business_name || order.users?.contact_name || 'Unknown'}</p>
                  {order.tracking_number && (
                    <p className="text-gray-500 text-xs">{order.carrier} — {order.tracking_number}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-medium">${(order.total || 0).toFixed(2)}</p>
                  <p className="text-gray-600 text-xs">{order.shipped_date ? new Date(order.shipped_date).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === PANEL 4: APPLICATIONS AWAITING APPROVAL === */}
      <div className="bg-[#150f24] border border-red-500/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-red-400" />Applications Awaiting Approval</h3>
          <Link to="/admin/applications" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {pendingApps.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">All caught up! No applications to review.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

      {/* === CHARTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Overview</h3>
          {revenueData.some((d: any) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9a02d0" stopOpacity={0.3}/><stop offset="95%" stopColor="#9a02d0" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1025" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} />
                <Area type="monotone" dataKey="revenue" stroke="#9a02d0" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600 gap-2"><DollarSign className="w-8 h-8" /><p className="text-sm">No revenue data yet</p></div>
          )}
        </div>
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Order Status</h3>
          {orderStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value">
                    {orderStatusData.map((e: any) => <Cell key={e.name} fill={COLORS[e.name] || '#6b7280'} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0a0514', border: '1px solid #1a1025', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {orderStatusData.map((e: any) => (
                  <div key={e.name} className="flex items-center gap-1.5 text-sm"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[e.name] || '#6b7280' }} /><span className="text-gray-400 capitalize">{e.name}</span><span className="text-gray-500">({e.value})</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600 gap-2"><ShoppingCart className="w-8 h-8" /><p className="text-sm">No orders yet</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
