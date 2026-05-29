import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, CheckCircle, Loader2, Calendar, Truck } from 'lucide-react'
import { toast } from 'sonner'

interface CompletedOrder {
  id: string
  po_number: string
  total: number
  shipped_date: string | null
  carrier: string | null
  tracking_number: string | null
  shipping_address: string | null
  created_at: string
  users?: { business_name: string; email: string }
  invoices?: { invoice_number: string; amount: number }[]
}

type DateRange = 'all' | '30days' | 'quarter' | 'year' | 'custom'

export function CompletedOrdersPage() {
  const [orders, setOrders] = useState<CompletedOrder[]>([])
  const [filtered, setFiltered] = useState<CompletedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, po_number, total, shipped_date, carrier, tracking_number, shipping_address, created_at,
        users!user_id (business_name, email),
        invoices(id, invoice_number, amount)
      `)
      .eq('status', 'shipped')
      .order('shipped_date', { ascending: false })
      .limit(1000)

    if (error) {
      toast.error('Failed to load completed orders')
      console.error(error)
    } else {
      setOrders((data as any) || [])
      setFiltered((data as any) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    let result = [...orders]
    const now = new Date()

    switch (dateRange) {
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        result = result.filter(o => o.shipped_date && new Date(o.shipped_date) >= thirtyDaysAgo)
        break
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        result = result.filter(o => o.shipped_date && new Date(o.shipped_date) >= quarterStart)
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        result = result.filter(o => o.shipped_date && new Date(o.shipped_date) >= yearStart)
        break
      case 'custom':
        if (customStart) result = result.filter(o => o.shipped_date && new Date(o.shipped_date) >= new Date(customStart))
        if (customEnd) {
          const end = new Date(customEnd); end.setHours(23, 59, 59)
          result = result.filter(o => o.shipped_date && new Date(o.shipped_date) <= end)
        }
        break
    }

    setFiltered(result)
  }, [orders, dateRange, customStart, customEnd])

  const exportCSV = () => {
    const headers = ['PO #', 'Business', 'Total', 'Shipped Date', 'Carrier', 'Tracking #', 'Shipping Address']
    const rows = filtered.map(o => [
      o.po_number, o.users?.business_name || '', (o.total || 0).toFixed(2),
      o.shipped_date || '', o.carrier || '', o.tracking_number || '', o.shipping_address || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const rangeLabel = dateRange === 'custom' ? `${customStart}_to_${customEnd}` : dateRange
    a.download = `microDOS_completed_orders_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} completed orders`)
  }

  const totalRevenue = filtered.reduce((sum, o) => sum + (o.total || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2" title="All shipped orders with date filter and CSV export">
            <CheckCircle className="w-5 h-5 text-purple-400" />
            Completed Orders
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} orders — ${totalRevenue.toFixed(2)} total revenue
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          title="Export completed orders to CSV"
          className="flex items-center gap-2 px-4 py-2 bg-[#44f80c]/10 hover:bg-[#44f80c]/20 text-[#44f80c] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-[#150f24] border border-white/10 rounded-lg p-3">
        <Calendar className="w-4 h-4 text-gray-400" />
        {([['all', 'All Time'], ['30days', 'Last 30 Days'], ['quarter', 'This Quarter'], ['year', 'This Year'], ['custom', 'Custom']] as [DateRange, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setDateRange(val)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${dateRange === val ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white" />
            <span className="text-gray-500">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white" />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-[#150f24] border border-white/10 rounded-xl">
          No completed orders found for the selected period.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <div key={order.id} className="bg-[#150f24] border border-white/10 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-300">{order.po_number}</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                    <Truck className="w-3 h-3" /> Shipped
                  </span>
                </div>
                <p className="text-lg font-bold text-white">${(order.total || 0).toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Business</p>
                  <p className="text-white">{order.users?.business_name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Shipped Date</p>
                  <p className="text-white">{order.shipped_date ? new Date(order.shipped_date).toLocaleDateString() : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Carrier</p>
                  <p className="text-white">{order.carrier || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Tracking</p>
                  <p className="text-purple-300 font-mono">{order.tracking_number || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
