import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  DollarSign, Loader2, Calendar, TrendingUp, CheckCircle, AlertTriangle,
  Settings, Users, Shield, UserCog, Store, Warehouse, List, LayoutGrid,
  CreditCard, Printer, X, Eye, Trash2, Square, SquareCheck
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────

interface CommissionEntry {
  id: string
  order_id: string
  account_id: string
  rep_id: string
  role_type: string
  account_type: string
  order_amount: number
  amount: number
  rate_percent: number
  period: string
  status: 'accrued' | 'processing' | 'paid'
  paid_at: string | null
  paid_method: string | null
  paid_reference: string | null
  created_at: string
  rep_name?: string
  account_name?: string
}

interface ReviewEntry {
  entry: CommissionEntry
  selected: boolean
}

interface RepPerformance {
  id: string; name: string; email: string
  accounts: number; orders: number
  commission: number; pending: number
  rate_wholesaler: number; rate_distributor: number
}

interface ManagerPerformance {
  id: string; name: string; email: string
  team_size: number; overrides: number; pending: number
  rate_wholesaler: number; rate_distributor: number
}

interface UserRateRow {
  id: string; name: string; email: string; role: string
  wholesaler_rate: number; distributor_rate: number
  has_wholesaler_override: boolean; has_distributor_override: boolean
}

const PAY_METHODS = ['Check', 'ACH', 'PayPal', 'Venmo', 'Zelle', 'Cash App', 'Other']

function getNextPayoutDate(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getPeriodFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Component ──────────────────────────────────────────────────

export function CommissionsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat')

  // Settings
  const [settings, setSettings] = useState({
    rep_wholesaler: 10, rep_distributor: 12,
    manager_wholesaler: 3, manager_distributor: 4,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Performance directories
  const [reps, setReps] = useState<RepPerformance[]>([])
  const [managers, setManagers] = useState<ManagerPerformance[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)

  // User overrides
  const [userRates, setUserRates] = useState<UserRateRow[]>([])
  const [userRatesLoading, setUserRatesLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserRateRow | null>(null)
  const [editWholesalerRate, setEditWholesalerRate] = useState('')
  const [editDistributorRate, setEditDistributorRate] = useState('')
  const [savingUserRate, setSavingUserRate] = useState(false)

  // Review & Approve dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewPeriod, setReviewPeriod] = useState('')
  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [approvingSelected, setApprovingSelected] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  // Period workflow
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payDialogPeriod, setPayDialogPeriod] = useState('')
  const [payDate, setPayDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}-15`
  })
  const [payMethod, setPayMethod] = useState('Check')
  const [payReference, setPayReference] = useState('')
  const [paying, setPaying] = useState(false)

  // Individual pay dialog
  const [indPayOpen, setIndPayOpen] = useState(false)
  const [indPayEntry, setIndPayEntry] = useState<CommissionEntry | null>(null)
  const [indPayDate, setIndPayDate] = useState('')
  const [indPayMethod, setIndPayMethod] = useState('Check')
  const [indPayReference, setIndPayReference] = useState('')
  const [indPaying, setIndPaying] = useState(false)

  // Statement view
  const [statementPeriod, setStatementPeriod] = useState<string | null>(null)

  const now = new Date()
  const periods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return getPeriodFromDate(d)
  })

  // ─── Fetch ────────────────────────────────────────────────────

  const fetchCommissions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('commission_payments')
        .select('*, orders!inner(total), users!commission_payments_user_id_fkey(business_name, email)')
        .order('created_at', { ascending: false })

      if (filterPeriod !== 'all') {
        const [year, month] = filterPeriod.split('-')
        query = query.eq('period_year', parseInt(year)).eq('period_month', parseInt(month))
      }
      if (filterStatus !== 'all') {
        const dbStatus = filterStatus === 'accrued' ? 'pending' : filterStatus === 'processing' ? 'approved' : filterStatus
        query = query.eq('status', dbStatus)
      }

      const { data, error } = await query
      if (error) throw error

      const mapped: CommissionEntry[] = (data || []).map((row: any) => {
        const user = row.users || {}
        return {
          id: row.id,
          order_id: row.order_id || '',
          account_id: row.account_id || '',
          rep_id: row.user_id || '',
          role_type: row.role_type || 'sales_rep',
          account_type: row.account_type || 'wholesaler',
          order_amount: row.order_amount || row.orders?.total || 0,
          amount: row.amount || 0,
          rate_percent: row.rate_percent || 0,
          period: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
          status: (row.status === 'pending' ? 'accrued' : row.status === 'approved' ? 'processing' : row.status) as CommissionEntry['status'],
          paid_at: row.paid_at,
          paid_method: row.paid_method,
          paid_reference: row.paid_reference,
          created_at: row.created_at,
          rep_name: user.business_name || user.email || row.user_id?.slice(0, 8),
          account_name: row.account_id?.slice(0, 8),
        }
      })

      // Enrich account names
      const accountIds = [...new Set(mapped.filter(e => e.account_id).map(e => e.account_id))]
      if (accountIds.length > 0) {
        const { data: accts } = await supabase.from('users').select('id, business_name, email').in('id', accountIds)
        const acctMap = new Map((accts || []).map((a: any) => [a.id, a.business_name || a.email]))
        mapped.forEach(e => { e.account_name = acctMap.get(e.account_id) || e.account_id.slice(0, 8) })
      }

      setEntries(mapped)
    } catch (e: any) {
      toast.error('Failed to fetch commissions: ' + e.message)
    }
    setLoading(false)
  }

  const fetchSettings = async () => {
    try {
      const { data: rules } = await supabase.from('commission_rules').select('role, account_type, rate_percent')
      if (rules && rules.length > 0) {
        const next = { ...settings }
        rules.forEach((r: any) => {
          const key = `${r.role}_${r.account_type}`.replace(/-/g, '_') as keyof typeof next
          if (key in next) (next as any)[key] = r.rate_percent
        })
        setSettings(next)
      }
    } catch { /* silent */ }
  }

  const fetchUserRates = async () => {
    setUserRatesLoading(true)
    try {
      const { data: allUsers } = await supabase.from('users').select('id, business_name, email, role').in('role', ['sales_rep', 'sales_manager']).eq('status', 'approved')
      const { data: overrides } = await supabase.from('user_commission_overrides').select('user_id, role_type, account_type, override_rate_percent')
      const oMap = new Map((overrides || []).map((o: any) => [`${o.user_id}-${o.role_type}-${o.account_type}`, o.override_rate_percent]))

      setUserRates((allUsers || []).map((u: any) => {
        const rt = u.role === 'sales_manager' ? 'sales_manager' : 'sales_rep'
        const ow = oMap.get(`${u.id}-${rt}-wholesaler`)
        const od = oMap.get(`${u.id}-${rt}-distributor`)
        return {
          id: u.id, name: u.business_name || u.email, email: u.email, role: u.role,
          wholesaler_rate: ow ?? (rt === 'sales_manager' ? settings.manager_wholesaler : settings.rep_wholesaler),
          distributor_rate: od ?? (rt === 'sales_manager' ? settings.manager_distributor : settings.rep_distributor),
          has_wholesaler_override: ow !== undefined, has_distributor_override: od !== undefined,
        }
      }))
    } catch { /* silent */ }
    setUserRatesLoading(false)
  }

  const fetchDirectory = async () => {
    setDirectoryLoading(true)
    try {
      const [{ data: repsData }, { data: managersData }, { data: allEntries }, { data: assignments }, { data: overrides }] = await Promise.all([
        supabase.from('users').select('id, business_name, email, manager_id').eq('role', 'sales_rep').eq('status', 'approved'),
        supabase.from('users').select('id, business_name, email').eq('role', 'sales_manager').eq('status', 'approved'),
        supabase.from('commission_payments').select('user_id, amount, status, role_type, account_type'),
        supabase.from('rep_account_assignments').select('rep_id, account_id'),
        supabase.from('user_commission_overrides').select('user_id, role_type, account_type, override_rate_percent'),
      ])
      const oMap = new Map((overrides || []).map((o: any) => [`${o.user_id}-${o.role_type}-${o.account_type}`, o.override_rate_percent]))

      const repMap = new Map<string, RepPerformance>()
      ;(repsData || []).forEach((r: any) => {
        const re = (allEntries || []).filter((e: any) => e.user_id === r.id && e.role_type === 'sales_rep')
        const ra = new Set((assignments || []).filter((a: any) => a.rep_id === r.id).map((a: any) => a.account_id))
        repMap.set(r.id, {
          id: r.id, name: r.business_name || r.email, email: r.email,
          accounts: ra.size, orders: re.length,
          commission: re.reduce((s: number, e: any) => s + (e.amount || 0), 0),
          pending: re.filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + (e.amount || 0), 0),
          rate_wholesaler: oMap.get(`${r.id}-sales_rep-wholesaler`) ?? settings.rep_wholesaler,
          rate_distributor: oMap.get(`${r.id}-sales_rep-distributor`) ?? settings.rep_distributor,
        })
      })
      setReps(Array.from(repMap.values()))

      const mgrMap = new Map<string, ManagerPerformance>()
      ;(managersData || []).forEach((m: any) => {
        const tr = (repsData || []).filter((r: any) => r.manager_id === m.id)
        const me = (allEntries || []).filter((e: any) => e.user_id === m.id && e.role_type === 'sales_manager')
        mgrMap.set(m.id, {
          id: m.id, name: m.business_name || m.email, email: m.email,
          team_size: tr.length,
          overrides: me.reduce((s: number, e: any) => s + (e.amount || 0), 0),
          pending: me.filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + (e.amount || 0), 0),
          rate_wholesaler: oMap.get(`${m.id}-sales_manager-wholesaler`) ?? settings.manager_wholesaler,
          rate_distributor: oMap.get(`${m.id}-sales_manager-distributor`) ?? settings.manager_distributor,
        })
      })
      setManagers(Array.from(mgrMap.values()))
    } catch { /* silent */ }
    setDirectoryLoading(false)
  }

  useEffect(() => { fetchCommissions(); fetchSettings() }, [filterPeriod, filterStatus])
  useEffect(() => { fetchDirectory(); fetchUserRates() }, [settings])

  // ─── Settings Save ────────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      for (const rule of [
        { role: 'sales_rep', account_type: 'wholesaler', rate_percent: settings.rep_wholesaler },
        { role: 'sales_rep', account_type: 'distributor', rate_percent: settings.rep_distributor },
        { role: 'sales_manager', account_type: 'wholesaler', rate_percent: settings.manager_wholesaler },
        { role: 'sales_manager', account_type: 'distributor', rate_percent: settings.manager_distributor },
      ]) {
        const { data: existing } = await supabase.from('commission_rules').select('id').eq('role', rule.role).eq('account_type', rule.account_type).limit(1)
        if (existing && existing.length > 0) {
          await supabase.from('commission_rules').update({ rate_percent: rule.rate_percent, effective_from: new Date().toISOString() }).eq('id', existing[0].id)
        } else {
          await supabase.from('commission_rules').insert({ role: rule.role, account_type: rule.account_type, rate_percent: rule.rate_percent, tier: 'standard' })
        }
      }
      toast.success('Commission settings saved!')
    } catch (e: any) {
      toast.error('Failed to save settings: ' + e.message)
    }
    setSavingSettings(false)
  }

  // ─── User Overrides ───────────────────────────────────────────

  const handleSaveUserOverrides = async (userId: string, roleType: string) => {
    setSavingUserRate(true)
    try {
      const wVal = editWholesalerRate === '' ? null : parseFloat(editWholesalerRate)
      if (wVal === null) {
        await supabase.from('user_commission_overrides').delete().eq('user_id', userId).eq('role_type', roleType).eq('account_type', 'wholesaler')
      } else {
        await supabase.from('user_commission_overrides').upsert({ user_id: userId, role_type: roleType, account_type: 'wholesaler', override_rate_percent: wVal }, { onConflict: 'user_id,role_type,account_type' })
      }
      const dVal = editDistributorRate === '' ? null : parseFloat(editDistributorRate)
      if (dVal === null) {
        await supabase.from('user_commission_overrides').delete().eq('user_id', userId).eq('role_type', roleType).eq('account_type', 'distributor')
      } else {
        await supabase.from('user_commission_overrides').upsert({ user_id: userId, role_type: roleType, account_type: 'distributor', override_rate_percent: dVal }, { onConflict: 'user_id,role_type,account_type' })
      }
      toast.success('Rate overrides saved!')
      setEditingUser(null)
      setEditWholesalerRate(''); setEditDistributorRate('')
      await fetchUserRates(); await fetchDirectory()
    } catch (e: any) {
      toast.error('Failed to save override: ' + e.message)
    }
    setSavingUserRate(false)
  }

  // ─── Review & Approve Dialog ──────────────────────────────────

  const openReviewDialog = async (period: string) => {
    setReviewPeriod(period)
    setReviewDialogOpen(true)
    setReviewLoading(true)
    try {
      const [year, month] = period.split('-')
      const { data, error } = await supabase
        .from('commission_payments')
        .select('*, orders!inner(total), users!commission_payments_user_id_fkey(business_name, email)')
        .eq('period_year', parseInt(year))
        .eq('period_month', parseInt(month))
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: CommissionEntry[] = (data || []).map((row: any) => {
        const user = row.users || {}
        return {
          id: row.id,
          order_id: row.order_id || '',
          account_id: row.account_id || '',
          rep_id: row.user_id || '',
          role_type: row.role_type || 'sales_rep',
          account_type: row.account_type || 'wholesaler',
          order_amount: row.order_amount || row.orders?.total || 0,
          amount: row.amount || 0,
          rate_percent: row.rate_percent || 0,
          period,
          status: 'accrued' as const,
          paid_at: row.paid_at,
          paid_method: row.paid_method,
          paid_reference: row.paid_reference,
          created_at: row.created_at,
          rep_name: user.business_name || user.email || row.user_id?.slice(0, 8),
          account_name: row.account_id?.slice(0, 8),
        }
      })

      // Enrich account names
      const accountIds = [...new Set(mapped.filter(e => e.account_id).map(e => e.account_id))]
      if (accountIds.length > 0) {
        const { data: accts } = await supabase.from('users').select('id, business_name, email').in('id', accountIds)
        const acctMap = new Map((accts || []).map((a: any) => [a.id, a.business_name || a.email]))
        mapped.forEach(e => { e.account_name = acctMap.get(e.account_id) || e.account_id.slice(0, 8) })
      }

      setReviewEntries(mapped.map(e => ({ entry: e, selected: true })))
    } catch (e: any) {
      toast.error('Failed to load review data: ' + e.message)
    }
    setReviewLoading(false)
  }

  const toggleReviewEntry = (id: string) => {
    setReviewEntries(prev => prev.map(re => re.entry.id === id ? { ...re, selected: !re.selected } : re))
  }

  const selectAllReview = () => setReviewEntries(prev => prev.map(re => ({ ...re, selected: true })))
  const deselectAllReview = () => setReviewEntries(prev => prev.map(re => ({ ...re, selected: false })))

  const deleteReviewEntry = async (id: string) => {
    if (!confirm('Delete this commission entry permanently? This cannot be undone.')) return
    setDeletingReviewId(id)
    try {
      const { error } = await supabase.from('commission_payments').delete().eq('id', id)
      if (error) throw error
      setReviewEntries(prev => prev.filter(re => re.entry.id !== id))
      toast.success('Commission entry deleted')
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message)
    }
    setDeletingReviewId(null)
  }

  const handleApproveSelected = async () => {
    const selectedIds = reviewEntries.filter(re => re.selected).map(re => re.entry.id)
    if (selectedIds.length === 0) { toast.error('Select at least one commission to approve'); return }

    if (!confirm(`Approve ${selectedIds.length} commission${selectedIds.length > 1 ? 's' : ''} for ${reviewPeriod}?\n\nExcluded entries will remain as 'accrued' for later review.`)) return

    setApprovingSelected(true)
    try {
      const { error } = await supabase
        .from('commission_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .in('id', selectedIds)

      if (error) throw error
      toast.success(`${selectedIds.length} commission${selectedIds.length > 1 ? 's' : ''} approved!`)
      setReviewDialogOpen(false)
      await fetchCommissions()
    } catch (e: any) {
      toast.error('Approval failed: ' + e.message)
    }
    setApprovingSelected(false)
  }

  const selectedCount = reviewEntries.filter(re => re.selected).length
  const selectedAmount = reviewEntries.filter(re => re.selected).reduce((s, re) => s + re.entry.amount, 0)
  const totalCount = reviewEntries.length

  // ─── Pay Period Dialog ────────────────────────────────────────

  const openPayDialog = (period: string) => {
    setPayDialogPeriod(period)
    setPayDate(() => {
      const [y, m] = period.split('-').map(Number)
      const next = new Date(y, m, 15)
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-15`
    })
    setPayMethod('Check')
    setPayReference('')
    setPayDialogOpen(true)
  }

  const handlePayPeriodConfirm = async () => {
    if (!payMethod) { toast.error('Select a payment method'); return }
    setPaying(true)
    try {
      const [year, month] = payDialogPeriod.split('-')
      const { data, error } = await supabase.rpc('pay_commissions_for_period', {
        p_period_year: parseInt(year),
        p_period_month: parseInt(month),
        p_paid_method: payMethod,
        p_paid_reference: payReference || null,
      })
      if (error) throw error
      toast.success(`${data || 0} commissions paid for ${payDialogPeriod}!`)
      setPayDialogOpen(false)
      await fetchCommissions()
    } catch (e: any) {
      toast.error('Payment failed: ' + e.message)
    }
    setPaying(false)
  }

  // ─── Individual Pay ───────────────────────────────────────────

  const openIndPayDialog = (entry: CommissionEntry) => {
    setIndPayEntry(entry)
    setIndPayDate(new Date().toISOString().split('T')[0])
    setIndPayMethod('Check')
    setIndPayReference('')
    setIndPayOpen(true)
  }

  const handleIndPayConfirm = async () => {
    if (!indPayEntry || !indPayMethod) return
    setIndPaying(true)
    try {
      const { data, error } = await supabase.rpc('pay_single_commission', {
        p_commission_id: indPayEntry.id,
        p_paid_method: indPayMethod,
        p_paid_reference: indPayReference || null,
      })
      if (error) throw error
      if (data) {
        toast.success(`Commission paid: $${indPayEntry.amount.toFixed(2)} for ${indPayEntry.rep_name}`)
      } else {
        toast.error('Commission not found or already paid')
      }
      setIndPayOpen(false)
      setIndPayEntry(null)
      await fetchCommissions()
    } catch (e: any) {
      toast.error('Payment failed: ' + e.message)
    }
    setIndPaying(false)
  }

  // ─── Statement View ───────────────────────────────────────────

  const openStatement = (period: string) => { setStatementPeriod(period) }
  const closeStatement = () => { setStatementPeriod(null) }

  // ─── Derived ──────────────────────────────────────────────────

  const totalRepEarnings = entries.filter(e => e.role_type === 'sales_rep').reduce((s, e) => s + e.amount, 0)
  const totalManagerEarnings = entries.filter(e => e.role_type === 'sales_manager').reduce((s, e) => s + e.amount, 0)
  const accruedCount = entries.filter(e => e.status === 'accrued').length
  const accruedAmount = entries.filter(e => e.status === 'accrued').reduce((s, e) => s + e.amount, 0)

  const groupedEntries = viewMode === 'grouped'
    ? Object.entries(entries.reduce((acc, e) => {
        const name = e.rep_name || 'Unknown'
        if (!acc[name]) acc[name] = []
        acc[name].push(e)
        return acc
      }, {} as Record<string, CommissionEntry[]>))
    : null

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Commission Report</h2>
          <p className="text-gray-400 text-sm">Manage commissions, rates, and payouts</p>
        </div>
      </div>

      {/* Payout Date Banner */}
      <div className="bg-[#44f80c]/10 border border-[#44f80c]/30 rounded-lg p-4 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-[#44f80c] shrink-0" />
        <div>
          <p className="text-sm text-[#44f80c] font-medium">
            Next Payout Date: {getNextPayoutDate()}
          </p>
          <p className="text-xs text-gray-400">
            Commissions are paid on the 15th of the following month. Current period: {getPeriodFromDate(now)}
          </p>
        </div>
      </div>

      {/* Default Rate Settings */}
      <Card className="bg-[#150f24] border-[#9a02d0]/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-[#9a02d0]" />
            Default Commission Rates
          </h3>
          <p className="text-xs text-gray-400 mb-4">Set default rates for each role + account type combination.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Rep', icon: Users, color: 'text-[#44f80c]', type: 'Wholesale', icon2: Store, val: settings.rep_wholesaler, key: 'rep_wholesaler' as const },
              { label: 'Rep', icon: Users, color: 'text-[#44f80c]', type: 'Distributor', icon2: Warehouse, val: settings.rep_distributor, key: 'rep_distributor' as const },
              { label: 'Manager', icon: Shield, color: 'text-[#9a02d0]', type: 'Wholesale', icon2: Store, val: settings.manager_wholesaler, key: 'manager_wholesaler' as const },
              { label: 'Manager', icon: Shield, color: 'text-[#9a02d0]', type: 'Distributor', icon2: Warehouse, val: settings.manager_distributor, key: 'manager_distributor' as const },
            ].map((r) => (
              <div key={r.key} className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <r.icon className={`w-3.5 h-3.5 ${r.color}`} />
                  <span className="text-xs text-gray-300 font-medium">{r.label}</span>
                  <span className="text-gray-600">/</span>
                  <r.icon2 className={`w-3.5 h-3.5 ${r.type === 'Wholesale' ? 'text-blue-400' : 'text-[#ff66c4]'}`} />
                  <span className="text-xs text-gray-300">{r.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="0.5" value={r.val}
                    onChange={(e) => setSettings({ ...settings, [r.key]: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1.5 rounded bg-[#150f24] border border-white/10 text-white text-sm text-center focus:border-[#44f80c] focus:outline-none" />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <span title="Save the 4 default commission rates. These apply to all reps and managers unless individually overridden.">
              <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">
                {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                Save Default Rates
              </Button>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Overrides */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#44f80c]" />
          Per-User Commission Rate Overrides
        </h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {userRatesLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" /></div>
            ) : userRates.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><Users className="w-10 h-10 mx-auto mb-2 text-gray-600" /><p className="text-sm">No sales reps or managers found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">User</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">Role</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Store className="w-3 h-3 inline text-blue-400" />Wholesale</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Warehouse className="w-3 h-3 inline text-[#ff66c4]" />Distributor</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userRates.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5">
                        <td className="px-4 py-3"><div className="text-gray-200 font-medium">{user.name}</div><div className="text-xs text-gray-500">{user.email}</div></td>
                        <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                        <td className="px-4 py-3 text-center">
                          {editingUser?.id === user.id ? (
                            <input type="number" min="0" max="100" step="0.5" value={editWholesalerRate} onChange={(e) => setEditWholesalerRate(e.target.value)} placeholder="Default"
                              className="w-20 px-2 py-1 rounded bg-[#0a0514] border border-white/20 text-white text-center text-sm focus:border-[#44f80c] focus:outline-none" />
                          ) : (<span className={`font-medium ${user.has_wholesaler_override ? 'text-[#ff66c4]' : 'text-blue-400'}`}>{user.wholesaler_rate}%</span>)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingUser?.id === user.id ? (
                            <input type="number" min="0" max="100" step="0.5" value={editDistributorRate} onChange={(e) => setEditDistributorRate(e.target.value)} placeholder="Default"
                              className="w-20 px-2 py-1 rounded bg-[#0a0514] border border-white/20 text-white text-center text-sm focus:border-[#44f80c] focus:outline-none" />
                          ) : (<span className={`font-medium ${user.has_distributor_override ? 'text-[#ff66c4]' : 'text-[#ff66c4]'}`}>{user.distributor_rate}%</span>)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingUser?.id === user.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span title="Save this user's custom rates. Leave blank to revert to role default.">
                                <Button size="sm" onClick={() => handleSaveUserOverrides(user.id, user.role === 'sales_manager' ? 'sales_manager' : 'sales_rep')} disabled={savingUserRate} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514] h-7 text-xs px-2">
                                  {savingUserRate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </Button>
                              </span>
                              <span title="Cancel editing. No changes will be saved.">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingUser(null); setEditWholesalerRate(''); setEditDistributorRate('') }} className="text-gray-400 hover:text-white h-7 text-xs px-2">Cancel</Button>
                              </span>
                            </div>
                          ) : (
                            <span title="Set custom commission rates for this specific user. Overrides the role defaults.">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingUser(user); setEditWholesalerRate(user.has_wholesaler_override ? String(user.wholesaler_rate) : ''); setEditDistributorRate(user.has_distributor_override ? String(user.distributor_rate) : '') }} className="text-[#9a02d0] hover:text-[#ff66c4] h-7 text-xs px-2">Edit</Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-gray-500 mt-2 ml-1">Pink = custom override. Leave blank to revert to default.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#44f80c]" />Total Rep Earnings</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-white">${totalRepEarnings.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#9a02d0]" />Total Manager Overrides</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-white">${totalManagerEarnings.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" />Pending (Accrued)</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-white">${accruedAmount.toFixed(2)}</div><p className="text-xs text-gray-500">{accruedCount} entries</p></CardContent>
        </Card>
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#44f80c]" />Entries Shown</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-white">{entries.length}</div></CardContent>
        </Card>
      </div>

      {/* Period Workflow Buttons */}
      <div className="flex flex-wrap gap-2">
        {periods.map(period => {
          const accrued = entries.filter(e => e.period === period && e.status === 'accrued')
          const processing = entries.filter(e => e.period === period && e.status === 'processing')
          const accruedAmt = accrued.reduce((s, e) => s + e.amount, 0)
          const procAmt = processing.reduce((s, e) => s + e.amount, 0)

          return (
            <div key={period} className="flex items-center gap-2">
              {accrued.length > 0 && (
                <span title="Review every commission for this period. You can exclude or delete individual entries before approving.">
                  <Button onClick={() => openReviewDialog(period)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-[#0a0514]">
                    <Eye className="w-4 h-4 mr-2" />
                    Review & Approve {period} (${accruedAmt.toFixed(0)})
                  </Button>
                </span>
              )}
              {processing.length > 0 && (
                <span title="Pay all approved commissions for this period. You will enter payment method and reference.">
                  <Button onClick={() => openPayDialog(period)} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {period} (${procAmt.toFixed(0)})
                  </Button>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Period</label>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[140px] bg-[#150f24] border-white/10 text-white" title="Filter commissions by pay period"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#150f24] border-white/10">
              <SelectItem value="all">All Periods</SelectItem>
              {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] bg-[#150f24] border-white/10 text-white" title="Filter commissions by payment status"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#150f24] border-white/10">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="accrued">Accrued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">View</label>
          <div className="flex bg-[#0a0514] rounded-lg border border-white/10 overflow-hidden">
            <span title="Show all commissions in a single flat list.">
              <button onClick={() => setViewMode('flat')} className={`px-3 py-2 text-xs flex items-center gap-1 ${viewMode === 'flat' ? 'bg-[#9a02d0] text-white' : 'text-gray-400 hover:text-white'}`}><List className="w-3 h-3" /> Flat</button>
            </span>
            <span title="Group commissions by sales rep for easier review.">
              <button onClick={() => setViewMode('grouped')} className={`px-3 py-2 text-xs flex items-center gap-1 ${viewMode === 'grouped' ? 'bg-[#9a02d0] text-white' : 'text-gray-400 hover:text-white'}`}><LayoutGrid className="w-3 h-3" /> By Rep</button>
            </span>
          </div>
        </div>
        {filterPeriod !== 'all' && (
          <span title="Open a printable commission statement for this period.">
            <Button size="sm" variant="ghost" onClick={() => openStatement(filterPeriod)} className="text-[#44f80c] hover:text-[#3ad60a] h-9">
              <Printer className="w-4 h-4 mr-1" /> View Statement
            </Button>
          </span>
        )}
      </div>

      {/* Commission Entry Table */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-[#44f80c]" />Commission Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p>No commission entries found</p><p className="text-xs text-gray-600 mt-1">Commissions are auto-generated when orders are marked as paid.</p></div>
          ) : viewMode === 'grouped' && groupedEntries ? (
            // Grouped view
            <div className="divide-y divide-white/5">
              {groupedEntries.map(([repName, repEntries]) => (
                <div key={repName} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{repName}</h4>
                    <span className="text-[#44f80c] font-medium">${repEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-white/10 text-left">
                        <th className="px-3 py-2 text-xs font-medium text-gray-400">Period</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400">Account</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400">Type</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Order</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Rate</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Earns</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400">Status</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400">Paid Via</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Action</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {repEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-white/5">
                            <td className="px-3 py-2 text-gray-300">{entry.period}</td>
                            <td className="px-3 py-2 text-gray-300">{entry.account_name}</td>
                            <td className="px-3 py-2"><AccountTypeBadge type={entry.account_type} /></td>
                            <td className="px-3 py-2 text-gray-300 text-right">${entry.order_amount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-gray-400 text-right">{entry.rate_percent}%</td>
                            <td className="px-3 py-2 text-[#44f80c] font-medium text-right">${entry.amount.toFixed(2)}</td>
                            <td className="px-3 py-2"><StatusBadge status={entry.status} /></td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{entry.paid_method || '—'}</td>
                            <td className="px-3 py-2 text-right">
                              {(entry.status === 'accrued' || entry.status === 'processing') && (
                                <span title="Pay this single commission immediately instead of waiting for batch payout.">
                                  <Button size="sm" variant="ghost" onClick={() => openIndPayDialog(entry)} className="text-[#44f80c] hover:text-[#3ad60a] h-6 text-xs px-1">Pay</Button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat view
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Period</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Account</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Sales Rep</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Order Amt</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Rate</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Earns</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Paid Via</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{entry.period}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.account_name}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.rep_name}</td>
                      <td className="px-4 py-3"><AccountTypeBadge type={entry.account_type} /></td>
                      <td className="px-4 py-3 text-gray-300 text-right">${entry.order_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-400 text-right">{entry.rate_percent}%</td>
                      <td className="px-4 py-3 text-[#44f80c] font-medium text-right">${entry.amount.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{entry.paid_method || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {(entry.status === 'accrued' || entry.status === 'processing') && (
                          <span title="Pay this single commission immediately instead of waiting for batch payout.">
                            <Button size="sm" variant="ghost" onClick={() => openIndPayDialog(entry)} className="text-[#44f80c] hover:text-[#3ad60a] h-6 text-xs px-1">Pay</Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rep Performance */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-[#44f80c]" />Sales Rep Performance</h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {directoryLoading ? (<div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" /></div>
            ) : reps.length === 0 ? (<div className="text-center py-8 text-gray-500"><Users className="w-10 h-10 mx-auto mb-2 text-gray-600" /><p className="text-sm">No sales reps found</p></div>
            ) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400">Rep</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Store className="w-3 h-3 inline text-blue-400" />W</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Warehouse className="w-3 h-3 inline text-[#ff66c4]" />D</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Accounts</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Orders</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Commission</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Pending</th>
            </tr></thead><tbody className="divide-y divide-white/5">
              {reps.map((rep) => (<tr key={rep.id} className="hover:bg-white/5">
                <td className="px-4 py-3"><div className="text-gray-200 font-medium">{rep.name}</div><div className="text-xs text-gray-500">{rep.email}</div></td>
                <td className="px-4 py-3 text-center text-blue-400">{rep.rate_wholesaler}%</td>
                <td className="px-4 py-3 text-center text-[#ff66c4]">{rep.rate_distributor}%</td>
                <td className="px-4 py-3 text-center text-gray-300">{rep.accounts}</td>
                <td className="px-4 py-3 text-center text-gray-300">{rep.orders}</td>
                <td className="px-4 py-3 text-right text-[#44f80c] font-medium">${rep.commission.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-yellow-400">${rep.pending.toFixed(2)}</td>
              </tr>))}
            </tbody></table></div>)}
          </CardContent>
        </Card>
      </div>

      {/* Manager Performance */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-[#9a02d0]" />Sales Manager Performance</h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {directoryLoading ? (<div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" /></div>
            ) : managers.length === 0 ? (<div className="text-center py-8 text-gray-500"><Shield className="w-10 h-10 mx-auto mb-2 text-gray-600" /><p className="text-sm">No sales managers found</p></div>
            ) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400">Manager</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Store className="w-3 h-3 inline text-blue-400" />W</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Warehouse className="w-3 h-3 inline text-[#ff66c4]" />D</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Team Size</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Overrides</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Pending</th>
            </tr></thead><tbody className="divide-y divide-white/5">
              {managers.map((mgr) => (<tr key={mgr.id} className="hover:bg-white/5">
                <td className="px-4 py-3"><div className="text-gray-200 font-medium">{mgr.name}</div><div className="text-xs text-gray-500">{mgr.email}</div></td>
                <td className="px-4 py-3 text-center text-blue-400">{mgr.rate_wholesaler}%</td>
                <td className="px-4 py-3 text-center text-[#ff66c4]">{mgr.rate_distributor}%</td>
                <td className="px-4 py-3 text-center text-gray-300">{mgr.team_size}</td>
                <td className="px-4 py-3 text-right text-[#9a02d0] font-medium">${mgr.overrides.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-yellow-400">${mgr.pending.toFixed(2)}</td>
              </tr>))}
            </tbody></table></div>)}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          REVIEW & APPROVE DIALOG
          ═══════════════════════════════════════════════════════════ */}
      {reviewDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#150f24] border border-white/20 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-yellow-400" />
                Review & Approve — {reviewPeriod}
              </h3>
              <button onClick={() => setReviewDialogOpen(false)} className="text-gray-400 hover:text-white" title="Close without approving anything"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Instructions */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  Uncheck commissions to exclude them from this batch. Click the trash icon to delete bad entries permanently.
                  Only checked commissions will be approved.
                </p>
              </div>

              {/* Select All / None */}
              <div className="flex gap-2">
                <span title="Select all commissions in this review"><Button size="sm" variant="ghost" onClick={selectAllReview} className="text-[#44f80c] hover:text-[#3ad60a] text-xs h-7"><SquareCheck className="w-3.5 h-3.5 mr-1" /> Select All</Button></span>
                <span title="Deselect all commissions"><Button size="sm" variant="ghost" onClick={deselectAllReview} className="text-gray-400 hover:text-white text-xs h-7"><Square className="w-3.5 h-3.5 mr-1" /> Select None</Button></span>
              </div>

              {/* Review Table */}
              {reviewLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" /></div>
              ) : reviewEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><p>No accrued commissions to review for this period.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10 text-left">
                      <th className="px-3 py-2 text-xs font-medium text-gray-400"></th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400">Rep</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400">Account</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400">Type</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Order</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Rate</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400 text-right">Commission</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-400 text-center">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {reviewEntries.map((re) => (
                        <tr key={re.entry.id} className={`hover:bg-white/5 ${!re.selected ? 'opacity-40' : ''}`}>
                          <td className="px-3 py-2">
                            <button onClick={() => toggleReviewEntry(re.entry.id)}
                              title={re.selected ? 'Include this commission in the approval batch' : 'Exclude this commission from the approval batch. It will remain as accrued for later review.'}
                              className="text-[#44f80c] hover:text-[#3ad60a]">
                              {re.selected ? <SquareCheck className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-500" />}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-gray-300">{re.entry.rep_name}</td>
                          <td className="px-3 py-2 text-gray-300">{re.entry.account_name}</td>
                          <td className="px-3 py-2"><AccountTypeBadge type={re.entry.account_type} /></td>
                          <td className="px-3 py-2 text-gray-300 text-right">${re.entry.order_amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-gray-400 text-right">{re.entry.rate_percent}%</td>
                          <td className="px-3 py-2 text-[#44f80c] font-medium text-right">${re.entry.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            <span title="Permanently delete this commission entry. Use only for bad data or test orders.">
                              <button onClick={() => deleteReviewEntry(re.entry.id)} disabled={deletingReviewId === re.entry.id}
                                className="text-red-400 hover:text-red-300 disabled:opacity-50 p-1">
                                {deletingReviewId === re.entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary */}
              <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10 flex items-center justify-between">
                <span className="text-sm text-gray-300">
                  <span className="text-[#44f80c] font-medium">{selectedCount}</span> of {totalCount} selected
                </span>
                <span className="text-[#44f80c] font-medium text-lg">${selectedAmount.toFixed(2)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <span title={`Approve ${selectedCount} commission${selectedCount !== 1 ? 's' : ''} for ${reviewPeriod}. Excluded entries will remain as accrued for later review.`}>
                  <Button onClick={handleApproveSelected} disabled={approvingSelected || selectedCount === 0}
                    className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">
                    {approvingSelected ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Approve {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </Button>
                </span>
                <span title="Close without approving anything.">
                  <Button variant="ghost" onClick={() => setReviewDialogOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PAY PERIOD DIALOG
          ═══════════════════════════════════════════════════════════ */}
      {payDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#150f24] border border-white/20 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#44f80c]" />Pay Commissions for {payDialogPeriod}</h3>
              <button onClick={() => setPayDialogOpen(false)} className="text-gray-400 hover:text-white" title="Close without paying."><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Summary */}
              {(() => {
                const processingEntries = entries.filter(e => e.period === payDialogPeriod && e.status === 'processing')
                const byRep = processingEntries.reduce((acc, e) => {
                  const name = e.rep_name || 'Unknown'
                  if (!acc[name]) acc[name] = 0
                  acc[name] += e.amount
                  return acc
                }, {} as Record<string, number>)
                return (
                  <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-gray-400 mb-2">Payment Summary ({processingEntries.length} commissions)</p>
                    {Object.entries(byRep).map(([name, amt]) => (
                      <div key={name} className="flex justify-between text-sm py-0.5"><span className="text-gray-300">{name}</span><span className="text-[#44f80c]">${amt.toFixed(2)}</span></div>
                    ))}
                    <div className="border-t border-white/10 mt-2 pt-2 flex justify-between font-medium"><span className="text-white">Total</span><span className="text-[#44f80c]">${processingEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span></div>
                  </div>
                )
              })()}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pay Date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Payment Method</label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="w-full bg-[#0a0514] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0a0514] border-white/10">
                    {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Reference # (optional)</label>
                <input type="text" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Check #1234, Confirmation code, etc."
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <span title="Confirm payment for all approved commissions in this period.">
                  <Button onClick={handlePayPeriodConfirm} disabled={paying} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">
                    {paying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                    Confirm Payment
                  </Button>
                </span>
                <span title="Cancel and close this dialog without paying.">
                  <Button variant="ghost" onClick={() => setPayDialogOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          INDIVIDUAL PAY DIALOG
          ═══════════════════════════════════════════════════════════ */}
      {indPayOpen && indPayEntry && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#150f24] border border-white/20 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Pay Commission</h3>
              <button onClick={() => setIndPayOpen(false)} className="text-gray-400 hover:text-white" title="Close without paying this commission."><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
                <p className="text-sm text-gray-300"><span className="text-white font-medium">{indPayEntry.rep_name}</span> — {indPayEntry.period}</p>
                <p className="text-xs text-gray-400">{indPayEntry.account_name} | {indPayEntry.account_type}</p>
                <p className="text-lg text-[#44f80c] font-bold mt-1">${indPayEntry.amount.toFixed(2)} <span className="text-xs text-gray-400 font-normal">at {indPayEntry.rate_percent}%</span></p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pay Date</label>
                <input type="date" value={indPayDate} onChange={(e) => setIndPayDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Payment Method</label>
                <Select value={indPayMethod} onValueChange={setIndPayMethod}>
                  <SelectTrigger className="w-full bg-[#0a0514] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0a0514] border-white/10">{PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Reference #</label>
                <input type="text" value={indPayReference} onChange={(e) => setIndPayReference(e.target.value)} placeholder="Check #, confirmation code"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <span title="Pay this single commission now.">
                  <Button onClick={handleIndPayConfirm} disabled={indPaying} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">
                    {indPaying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                    Pay ${indPayEntry.amount.toFixed(2)}
                  </Button>
                </span>
                <span title="Close without paying.">
                  <Button variant="ghost" onClick={() => setIndPayOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          STATEMENT VIEW
          ═══════════════════════════════════════════════════════════ */}
      {statementPeriod && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#150f24] border border-white/20 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10 print:hidden">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Printer className="w-5 h-5 text-[#44f80c]" />Commission Statement — {statementPeriod}</h3>
              <div className="flex gap-2">
                <span title="Print this commission statement."><Button size="sm" onClick={() => window.print()} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514] text-xs"><Printer className="w-3 h-3 mr-1" />Print</Button></span>
                <button onClick={closeStatement} className="text-gray-400 hover:text-white" title="Close statement view."><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4" id="commission-statement">
              {(() => {
                const stmtEntries = entries.filter(e => e.period === statementPeriod)
                const byRep = stmtEntries.reduce((acc, e) => {
                  const name = e.rep_name || 'Unknown'
                  if (!acc[name]) acc[name] = []
                  acc[name].push(e)
                  return acc
                }, {} as Record<string, CommissionEntry[]>)
                return (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Commission Statement</h2>
                      <p className="text-gray-400">Period: {statementPeriod}</p>
                      <p className="text-[#44f80c] font-medium mt-1">Payout Date: {getNextPayoutDate()}</p>
                    </div>
                    {Object.entries(byRep).map(([name, repEntries]) => (
                      <div key={name} className="mb-6">
                        <h4 className="text-white font-semibold border-b border-white/20 pb-1 mb-2">{name}</h4>
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-gray-400 text-xs">
                            <th className="py-1">Account</th><th className="py-1 text-right">Order</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Commission</th><th className="py-1">Status</th>
                          </tr></thead>
                          <tbody>
                            {repEntries.map(e => (
                              <tr key={e.id} className="border-b border-white/5">
                                <td className="py-1 text-gray-300">{e.account_name}</td>
                                <td className="py-1 text-gray-300 text-right">${e.order_amount.toFixed(2)}</td>
                                <td className="py-1 text-gray-400 text-right">{e.rate_percent}%</td>
                                <td className="py-1 text-[#44f80c] text-right">${e.amount.toFixed(2)}</td>
                                <td className="py-1"><StatusBadge status={e.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-end mt-1">
                          <span className="text-white font-medium text-sm">Subtotal: ${repEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t-2 border-[#44f80c] pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-lg font-bold">Grand Total</span>
                        <span className="text-[#44f80c] text-2xl font-bold">${stmtEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    accrued: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-[#44f80c]/20 text-[#44f80c]',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = { sales_rep: 'bg-[#44f80c]/20 text-[#44f80c]', sales_manager: 'bg-[#9a02d0]/20 text-[#9a02d0]' }
  const labels: Record<string, string> = { sales_rep: 'Rep', sales_manager: 'Manager' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-500/20 text-gray-400'}`}>
      {labels[role] || role}
    </span>
  )
}

function AccountTypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-xs font-medium ${type === 'distributor' ? 'text-[#ff66c4]' : 'text-blue-400'}`}>
      {type === 'distributor' ? 'D' : 'W'}
    </span>
  )
}
