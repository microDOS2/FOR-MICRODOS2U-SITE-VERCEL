import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, XCircle, Loader2, Calendar, ShoppingCart, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface CancelledItem {
  id: string
  type: 'order' | 'invoice'
  number: string
  amount: number
  status: string
  cancelled_reason: string | null
  created_at: string
  updated_at: string
  users?: { business_name: string; email: string }
  order_po?: string
}

type DateRange = 'all' | '30days' | 'quarter' | 'year' | 'custom'

export function CancelledItemsPage() {
  const [items, setItems] = useState<CancelledItem[]>([])
  const [filtered, setFiltered] = useState<CancelledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const combined: CancelledItem[] = []

    // Fetch cancelled orders (has cancelled_reason, cancelled_at columns)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`id, po_number, total, status, cancelled_reason, cancelled_at, created_at, users!user_id (business_name, email)`)
        .eq('status', 'cancelled')
        .order('cancelled_at', { ascending: false })
        .limit(500)
      if (error) {
        console.error('Orders query error:', error)
      } else {
        (data || []).forEach((o: any) => {
          combined.push({
            id: o.id, type: 'order' as const, number: o.po_number,
            amount: o.total || 0, status: o.status,
            cancelled_reason: o.cancelled_reason, created_at: o.created_at,
            updated_at: o.cancelled_at || o.created_at, users: o.users,
          })
        })
      }
    } catch (e: any) {
      console.error('Orders fetch failed:', e)
    }

    // Fetch cancelled invoices (may not have cancelled_reason column)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`id, invoice_number, amount, status, created_at, users!user_id (business_name, email), orders:order_id (po_number)`)
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) {
        console.error('Invoices query error:', error)
      } else {
        (data || []).forEach((i: any) => {
          combined.push({
            id: i.id, type: 'invoice' as const, number: i.invoice_number,
            amount: i.amount || 0, status: i.status,
            cancelled_reason: null, created_at: i.created_at,
            updated_at: i.created_at, users: i.users,
            order_po: i.orders?.po_number,
          })
        })
      }
    } catch (e: any) {
      console.error('Invoices fetch failed:', e)
    }

    combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    setItems(combined)
    setFiltered(combined)
    setLoading(false)
  }

  useEffect(() => {
    let result = [...items]
    const now = new Date()

    switch (dateRange) {
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        result = result.filter(i => new Date(i.updated_at) >= thirtyDaysAgo)
        break
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        result = result.filter(i => new Date(i.updated_at) >= quarterStart)
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        result = result.filter(i => new Date(i.updated_at) >= yearStart)
        break
      case 'custom':
        if (customStart) result = result.filter(i => new Date(i.updated_at) >= new Date(customStart))
        if (customEnd) {
          const end = new Date(customEnd); end.setHours(23, 59, 59)
          result = result.filter(i => new Date(i.updated_at) <= end)
        }
        break
    }

    setFiltered(result)
  }, [items, dateRange, customStart, customEnd])

  const exportCSV = () => {
    const headers = ['Type', 'Number', 'PO #', 'Business', 'Amount', 'Cancelled Date', 'Reason']
    const rows = filtered.map(i => [
      i.type, i.number, i.order_po || '', i.users?.business_name || '',
      i.amount.toFixed(2), i.updated_at ? new Date(i.updated_at).toLocaleDateString() : '',
      i.cancelled_reason || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const rangeLabel = dateRange === 'custom' ? `${customStart}_to_${customEnd}` : dateRange
    a.download = `microDOS_cancelled_items_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} cancelled items`)
  }

  const orderCount = filtered.filter(i => i.type === 'order').length
  const invoiceCount = filtered.filter(i => i.type === 'invoice').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            Cancelled Items
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} items — {orderCount} orders, {invoiceCount} invoices
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          title="Export cancelled items to CSV"
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
          No cancelled items found for the selected period.
        </div>
      ) : (
        <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Cancelled Date</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(item => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                        item.type === 'order'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-pink-500/10 text-pink-400'
                      }`}>
                        {item.type === 'order' ? <ShoppingCart className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {item.type === 'order' ? 'Order' : 'Invoice'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-300">{item.number}</td>
                    <td className="px-4 py-3 text-white">{item.users?.business_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium">${item.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{item.cancelled_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
