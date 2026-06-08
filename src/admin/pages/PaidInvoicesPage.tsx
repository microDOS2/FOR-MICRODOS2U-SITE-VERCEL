import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, CreditCard, Loader2, Calendar, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface PaidInvoice {
  id: string
  invoice_number: string
  amount: number
  paid_date: string | null
  paid_method: string | null
  paid_reference: string | null
  created_at: string
  users?: { business_name: string; email: string }
  orders?: { po_number: string }
}

type DateRange = 'all' | '30days' | 'quarter' | 'year' | 'custom'

export function PaidInvoicesPage() {
  const [invoices, setInvoices] = useState<PaidInvoice[]>([])
  const [filtered, setFiltered] = useState<PaidInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)
  const [invoiceDetails, setInvoiceDetails] = useState<Record<string, any[]>>({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, amount, paid_date, paid_method, paid_reference, created_at,
        users!user_id (business_name, email),
        orders:order_id (po_number)
      `)
      .eq('status', 'paid')
      .order('paid_date', { ascending: false })
      .limit(1000)

    if (error) {
      toast.error('Failed to load paid invoices')
      console.error(error)
    } else {
      setInvoices((data as any) || [])
      setFiltered((data as any) || [])
    }
    setLoading(false)
  }

  const fetchOrderItems = async (orderId: string) => {
    if (invoiceDetails[orderId]) return
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('product_name, variant_sku, quantity, unit_price, total_price')
        .eq('order_id', orderId)
      if (error) throw error
      setInvoiceDetails(prev => ({ ...prev, [orderId]: data || [] }))
    } catch (e) {
      console.error('Failed to fetch order items:', e)
    }
  }

  const toggleExpand = (invoiceId: string, orderId?: string) => {
    if (expandedInvoice === invoiceId) {
      setExpandedInvoice(null)
    } else {
      setExpandedInvoice(invoiceId)
      if (orderId) fetchOrderItems(orderId)
    }
  }

  useEffect(() => {
    let result = [...invoices]
    const now = new Date()

    switch (dateRange) {
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        result = result.filter(i => i.paid_date && new Date(i.paid_date) >= thirtyDaysAgo)
        break
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        result = result.filter(i => i.paid_date && new Date(i.paid_date) >= quarterStart)
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        result = result.filter(i => i.paid_date && new Date(i.paid_date) >= yearStart)
        break
      case 'custom':
        if (customStart) {
          const start = new Date(customStart)
          result = result.filter(i => i.paid_date && new Date(i.paid_date) >= start)
        }
        if (customEnd) {
          const end = new Date(customEnd)
          end.setHours(23, 59, 59)
          result = result.filter(i => i.paid_date && new Date(i.paid_date) <= end)
        }
        break
    }

    setFiltered(result)
  }, [invoices, dateRange, customStart, customEnd])

  const exportCSV = () => {
    const headers = ['Invoice #', 'PO #', 'Business', 'Amount', 'Paid Date', 'Method', 'Reference']
    const rows = filtered.map(inv => [
      inv.invoice_number,
      inv.orders?.po_number || '',
      inv.users?.business_name || '',
      inv.amount?.toFixed(2) || '0.00',
      inv.paid_date || '',
      inv.paid_method || '',
      inv.paid_reference || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const rangeLabel = dateRange === 'custom' ? `${customStart}_to_${customEnd}` : dateRange
    a.download = `microDOS_paid_invoices_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} paid invoices`)
  }

  const totalAmount = filtered.reduce((sum, i) => sum + (i.amount || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2" title="All paid invoices with date filter and CSV export">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            Paid Invoices
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} records — ${totalAmount.toFixed(2)} total
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          title="Export to CSV"
          className="flex items-center gap-2 px-4 py-2 bg-[#44f80c]/10 hover:bg-[#44f80c]/20 text-[#44f80c] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2 bg-[#150f24] border border-white/10 rounded-lg p-3">
        <Calendar className="w-4 h-4 text-gray-400" />
        {([['all', 'All Time'], ['30days', 'Last 30 Days'], ['quarter', 'This Quarter'], ['year', 'This Year'], ['custom', 'Custom']] as [DateRange, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setDateRange(val)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              dateRange === val
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-[#150f24] border border-white/10 rounded-xl">
          No paid invoices found for the selected period.
        </div>
      ) : (
        <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">PO #</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Paid Date</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(inv => {
                  const isExpanded = expandedInvoice === inv.id
                  return (
                    <>
                      <tr
                        key={inv.id}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(inv.id, inv.orders?.po_number ? undefined : inv.id)}
                      >
                        <td className="px-4 py-3">
                          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-300">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-400">{inv.orders?.po_number || '—'}</td>
                        <td className="px-4 py-3 text-white">{inv.users?.business_name || '—'}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">${(inv.amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-400">{inv.paid_date || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs capitalize">
                            {inv.paid_method || '—'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${inv.id}-details`}>
                          <td colSpan={7} className="px-4 py-3 bg-white/[0.02]">
                            <p className="text-gray-500 text-sm">Order details feature coming soon.</p>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
