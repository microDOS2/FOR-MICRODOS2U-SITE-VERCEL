import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, Archive, Loader2, Calendar, User, Mail, Phone, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface CommissionPayment {
  id: string
  user_id: string
  order_id: string
  amount: number
  period_year: number
  period_month: number
  role_type: string
  status: string
  paid_at: string | null
  approved_at: string | null
  rate_percent: number
  order_amount: number
  users?: {
    business_name: string | null
    email: string | null
    phone: string | null
    role: string | null
    contact_name: string | null
  }
  orders?: {
    po_number: string | null
  }
}

type DateRange = 'all' | '30days' | 'quarter' | 'year' | 'custom'

export function CommissionPayoutsPage() {
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [filtered, setFiltered] = useState<CommissionPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [groupByRecipient, setGroupByRecipient] = useState(false)
  const [expandedRecipients, setExpandedRecipients] = useState<Record<string, boolean>>({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch ALL sales reps and managers (even those with $0 commissions)
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, business_name, email, phone, role, contact_name, status')
        .in('role', ['sales_rep', 'sales_manager'])
        .eq('status', 'approved')

      if (usersError) throw usersError

      // Fetch ALL commission payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('commission_payments')
        .select(`
          id, user_id, order_id, amount, period_year, period_month, role_type, status,
          paid_at, approved_at, rate_percent, order_amount,
          orders!order_id (po_number)
        `)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (paymentsError) throw paymentsError

      const usersList = (allUsers as any) || []
      const paymentsList = (paymentsData as any) || []

      // Create $0 placeholder payments for every rep/manager with no commissions
      // so they ALWAYS appear in the list
      const existingUserIds = new Set(paymentsList.map((p: any) => p.user_id))
      const placeholderPayments: any[] = usersList
        .filter((u: any) => !existingUserIds.has(u.id))
        .map((u: any) => ({
          id: `placeholder-${u.id}`,
          user_id: u.id,
          order_id: null,
          amount: 0,
          period_year: new Date().getFullYear(),
          period_month: new Date().getMonth() + 1,
          role_type: u.role,
          status: 'pending',
          paid_at: null,
          approved_at: null,
          rate_percent: 0,
          order_amount: 0,
          users: {
            business_name: u.business_name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            contact_name: u.contact_name,
          },
          orders: { po_number: null },
        }))

      // Merge real payments with placeholders
      const allPayments = [...paymentsList, ...placeholderPayments]
      setPayments(allPayments)
      setFiltered(allPayments)
    } catch (e: any) {
      console.error('Unexpected error:', e)
      toast.error('Failed to load commission payouts')
      setPayments([])
      setFiltered([])
    }
    setLoading(false)
  }

  useEffect(() => {
    let result = [...payments]
    const now = new Date()

    switch (dateRange) {
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        result = result.filter(p => p.paid_at && new Date(p.paid_at) >= thirtyDaysAgo)
        break
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        result = result.filter(p => {
          if (!p.paid_at) return false
          const d = new Date(p.paid_at)
          return d >= quarterStart
        })
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        result = result.filter(p => p.paid_at && new Date(p.paid_at) >= yearStart)
        break
      case 'custom':
        if (customStart) result = result.filter(p => p.paid_at && new Date(p.paid_at) >= new Date(customStart))
        if (customEnd) {
          const end = new Date(customEnd); end.setHours(23, 59, 59)
          result = result.filter(p => p.paid_at && new Date(p.paid_at) <= end)
        }
        break
    }

    setFiltered(result)
  }, [payments, dateRange, customStart, customEnd])

  // Group payments by recipient (user_id)
  const groupedByRecipient = filtered.reduce<Record<string, { user: CommissionPayment['users']; role: string; payments: CommissionPayment[]; total: number }>>((acc, p) => {
    const key = p.user_id
    if (!acc[key]) {
      acc[key] = { user: p.users, role: p.role_type || p.users?.role || '', payments: [], total: 0 }
    }
    acc[key].payments.push(p)
    acc[key].total += p.amount || 0
    return acc
  }, {})

  const toggleRecipient = (userId: string) => {
    setExpandedRecipients(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  const formatPeriod = (year: number, month: number) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[month - 1] || month} ${year}`
  }

  const exportCSV = () => {
    const headers = ['Recipient', 'Role', 'Contact Name', 'Email', 'Phone', 'Amount', 'Rate %', 'Period', 'Order Amount', 'PO Number', 'Paid Date']
    const rows = filtered.map(p => [
      p.users?.business_name || '',
      p.role_type || p.users?.role || '',
      p.users?.contact_name || '',
      p.users?.email || '',
      p.users?.phone || '',
      (p.amount || 0).toFixed(2),
      (p.rate_percent || 0).toFixed(2) + '%',
      formatPeriod(p.period_year, p.period_month),
      (p.order_amount || 0).toFixed(2),
      p.orders?.po_number || '',
      p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const rangeLabel = dateRange === 'custom' ? `${customStart}_to_${customEnd}` : dateRange
    a.download = `microDOS_commission_payouts_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} commission payouts`)
  }

  const totalPaid = filtered.reduce((sum, p) => sum + (p.amount || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2" title="All commission payments with date filter, CSV export, and group by recipient">
            <Archive className="w-5 h-5 text-gray-400" />
            Commission Payouts
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} commission records — ${totalPaid.toFixed(2)} total
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          title="Export to CSV"
          className="flex items-center gap-2 px-4 py-2 bg-[#44f80c]/10 hover:bg-[#44f80c]/20 text-[#44f80c] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-[#150f24] border border-white/10 rounded-lg p-3">
        <Calendar className="w-4 h-4 text-gray-400" />
        {(['all', '30days', 'quarter', 'year', 'custom'] as DateRange[]).map((val) => {
          const labels: Record<DateRange, string> = {
            all: 'All Time',
            '30days': 'Last 30 Days',
            quarter: 'This Quarter',
            year: 'This Year',
            custom: 'Custom',
          }
          return (
            <button
              key={val}
              onClick={() => setDateRange(val)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                dateRange === val
                  ? 'bg-[#9a02d0]/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {labels[val]}
            </button>
          )
        })}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setGroupByRecipient(!groupByRecipient)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              groupByRecipient
                ? 'bg-[#9a02d0]/20 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Group commissions by recipient"
          >
            <Users className="w-3.5 h-3.5" />
            {groupByRecipient ? 'Grouped' : 'Group by Recipient'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-[#150f24] border border-white/10 rounded-xl">
          No commission records found. Commissions are generated when orders are shipped.
        </div>
      ) : (
        <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Contact Info</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Order Amount</th>
                  <th className="px-4 py-3 font-medium">PO #</th>
                  <th className="px-4 py-3 font-medium">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {groupByRecipient ? (
                  // Grouped view: recipient rows with expandable details
                  Object.entries(groupedByRecipient).map(([userId, group]) => (
                    <>
                      <tr
                        key={userId}
                        className="hover:bg-white/5 transition-colors cursor-pointer bg-white/[0.02]"
                        onClick={() => toggleRecipient(userId)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {expandedRecipients[userId] ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="text-white font-medium">
                              {group.user?.business_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-600">({group.payments.length})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-[#9a02d0]/10 text-[#9a02d0] rounded text-xs capitalize">
                            {group.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {group.user?.contact_name && (
                              <p className="text-gray-300 text-xs">{group.user.contact_name}</p>
                            )}
                            {group.user?.email && (
                              <div className="flex items-center gap-1 text-gray-400 text-xs">
                                <Mail className="w-3 h-3" />
                                {group.user.email}
                              </div>
                            )}
                            {group.user?.phone && (
                              <div className="flex items-center gap-1 text-gray-400 text-xs">
                                <Phone className="w-3 h-3" />
                                {group.user.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#ff66c4] font-bold">
                          ${group.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs" colSpan={5}>
                          Click to {expandedRecipients[userId] ? 'hide' : 'show'} {group.payments.length} commission{group.payments.length > 1 ? 's' : ''}
                        </td>
                      </tr>
                      {expandedRecipients[userId] && group.payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2 pl-12">
                            <span className="text-gray-500 text-xs">{payment.orders?.po_number || '—'}</span>
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-right text-[#ff66c4]">
                            ${(payment.amount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-gray-400">{(payment.rate_percent || 0).toFixed(1)}%</td>
                          <td className="px-4 py-2 text-gray-400">
                            {formatPeriod(payment.period_year, payment.period_month)}
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            ${(payment.order_amount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 font-mono text-gray-400 text-xs">
                            {payment.orders?.po_number || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))
                ) : (
                  // Flat view: individual commission rows
                  filtered.map((payment) => (
                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-white font-medium">
                            {payment.users?.business_name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-[#9a02d0]/10 text-[#9a02d0] rounded text-xs capitalize">
                          {payment.role_type || payment.users?.role || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {payment.users?.contact_name && (
                            <p className="text-gray-300 text-xs">{payment.users.contact_name}</p>
                          )}
                          {payment.users?.email && (
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Mail className="w-3 h-3" />
                              {payment.users.email}
                            </div>
                          )}
                          {payment.users?.phone && (
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Phone className="w-3 h-3" />
                              {payment.users.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[#ff66c4] font-bold">
                        ${(payment.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{(payment.rate_percent || 0).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-gray-400">
                        {formatPeriod(payment.period_year, payment.period_month)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        ${(payment.order_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-400 text-xs">
                        {payment.orders?.po_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
