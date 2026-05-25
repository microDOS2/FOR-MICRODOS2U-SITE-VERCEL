import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  DollarSign,
  Loader2,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Settings,
  Users,
  Shield,
} from 'lucide-react'

interface CommissionEntry {
  id: string
  order_id: string
  account_id: string
  rep_id: string
  manager_id: string | null
  order_amount: number
  rep_earnings: number
  manager_earnings: number | null
  period: string
  status: 'accrued' | 'processing' | 'paid'
  paid_at: string | null
  created_at: string
  rep_name?: string
  manager_name?: string
  account_name?: string
}

interface RepPerformance {
  id: string
  name: string
  email: string
  accounts: number
  orders: number
  commission: number
  pending: number
}

interface ManagerPerformance {
  id: string
  name: string
  email: string
  team_size: number
  overrides: number
  pending: number
}

export function CommissionsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [payingPeriod, setPayingPeriod] = useState<string | null>(null)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [settings, setSettings] = useState({ rep_rate: 5, manager_override_rate: 2 })
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [reps, setReps] = useState<RepPerformance[]>([])
  const [managers, setManagers] = useState<ManagerPerformance[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)

  // Get current and recent periods
  const now = new Date()
  const periods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchCommissions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('commission_payments')
        .select('*, orders!inner(total)')
        .order('created_at', { ascending: false })

      if (filterPeriod !== 'all') {
        const [year, month] = filterPeriod.split('-')
        query = query.eq('period_year', parseInt(year)).eq('period_month', parseInt(month))
      }
      if (filterStatus !== 'all') {
        // Map display status to DB status
        const dbStatus = filterStatus === 'accrued' ? 'pending' : filterStatus === 'processing' ? 'approved' : filterStatus
        query = query.eq('status', dbStatus)
      }

      const { data, error } = await query
      if (error) throw error

      // Map to CommissionEntry interface and enrich with user names
      const mappedEntries = (data || []).map((row: any) => ({
        id: row.id,
        order_id: row.order_id || '',
        account_id: '',
        rep_id: row.user_id || '',
        manager_id: null,
        order_amount: row.orders?.total || 0,
        rep_earnings: row.amount || 0,
        manager_earnings: null,
        period: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
        status: (row.status === 'pending' ? 'accrued' : row.status === 'approved' ? 'processing' : row.status) as CommissionEntry['status'],
        paid_at: row.paid_at,
        created_at: row.created_at,
      }))
      const entriesWithNames = await enrichWithNames(mappedEntries)
      setEntries(entriesWithNames)
    } catch (e: any) {
      toast.error('Failed to fetch commissions: ' + e.message)
    }
    setLoading(false)
  }

  const enrichWithNames = async (entries: CommissionEntry[]): Promise<CommissionEntry[]> => {
    const userIds = new Set<string>()
    entries.forEach(e => {
      userIds.add(e.rep_id)
      if (e.manager_id) userIds.add(e.manager_id)
      userIds.add(e.account_id)
    })

    const { data: users } = await supabase
      .from('users')
      .select('id, business_name, email')
      .in('id', Array.from(userIds))

    const userMap = new Map(users?.map(u => [u.id, u.business_name || u.email]) || [])

    return entries.map(e => ({
      ...e,
      rep_name: userMap.get(e.rep_id) || e.rep_id.slice(0, 8),
      manager_name: e.manager_id ? (userMap.get(e.manager_id) || e.manager_id.slice(0, 8)) : null,
      account_name: userMap.get(e.account_id) || e.account_id.slice(0, 8),
    }))
  }

  const fetchSettings = async () => {
    try {
      // Use commission_rules table (replaces commission_settings)
      const { data: rules } = await supabase
        .from('commission_rules')
        .select('id, role, rate_percent')
        .order('created_at', { ascending: false })

      if (rules && rules.length > 0) {
        const repRule = rules.find((r: any) => r.role === 'sales_rep')
        const mgrRule = rules.find((r: any) => r.role === 'sales_manager')
        setSettings({
          rep_rate: repRule?.rate_percent || settings.rep_rate,
          manager_override_rate: mgrRule?.rate_percent || settings.manager_override_rate,
        })
        setSettingsId(repRule?.id || rules[0]?.id || null)
      }
    } catch (e: any) {
      // Silently fail - defaults are fine
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      // Upsert commission rules for both roles (replaces commission_settings)
      for (const [role, rate] of [
        ['sales_rep', settings.rep_rate],
        ['sales_manager', settings.manager_override_rate],
      ] as const) {
        const { data: existing } = await supabase
          .from('commission_rules')
          .select('id')
          .eq('role', role)
          .order('created_at', { ascending: false })
          .limit(1)

        if (existing && existing.length > 0) {
          const { error } = await supabase.from('commission_rules').update({
            rate_percent: rate,
            effective_from: new Date().toISOString(),
          }).eq('id', existing[0].id)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('commission_rules').insert({
            role,
            rate_percent: rate,
            tier: 'standard',
          }).select('id').single()
          if (error) throw error
          if (role === 'sales_rep' && data) setSettingsId(data.id)
        }
      }
      toast.success('Commission settings saved!')
    } catch (e: any) {
      toast.error('Failed to save settings: ' + e.message)
    }
    setSavingSettings(false)
  }

  const fetchDirectory = async () => {
    setDirectoryLoading(true)
    try {
      // Fetch all sales reps
      const { data: repsData } = await supabase
        .from('users')
        .select('id, business_name, email, manager_id')
        .eq('role', 'sales_rep')
        .eq('status', 'approved')

      // Fetch all sales managers
      const { data: managersData } = await supabase
        .from('users')
        .select('id, business_name, email')
        .eq('role', 'sales_manager')
        .eq('status', 'approved')

      // Fetch all commission payments for calculations
      const { data: allEntries } = await supabase
        .from('commission_payments')
        .select('user_id, amount, status')

      // Fetch rep account assignments
      const { data: assignments } = await supabase
        .from('rep_account_assignments')
        .select('rep_id, account_id')

      // Build rep performance
      const repMap = new Map<string, RepPerformance>()
      ;(repsData || []).forEach((r: any) => {
        const repEntries = (allEntries || []).filter((e: any) => e.user_id === r.id)
        const repAccounts = new Set((assignments || []).filter((a: any) => a.rep_id === r.id).map((a: any) => a.account_id))
        repMap.set(r.id, {
          id: r.id,
          name: r.business_name || r.email,
          email: r.email,
          accounts: repAccounts.size,
          orders: repEntries.length,
          commission: repEntries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          pending: repEntries.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
        })
      })
      setReps(Array.from(repMap.values()))

      // Build manager performance (manager earnings = all commissions for their team)
      const mgrMap = new Map<string, ManagerPerformance>()
      ;(managersData || []).forEach((m: any) => {
        const teamReps = (repsData || []).filter((r: any) => r.manager_id === m.id)
        const teamRepIds = new Set(teamReps.map((r: any) => r.id))
        const mgrEntries = (allEntries || []).filter((e: any) => teamRepIds.has(e.user_id))
        mgrMap.set(m.id, {
          id: m.id,
          name: m.business_name || m.email,
          email: m.email,
          team_size: teamReps.length,
          overrides: mgrEntries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          pending: mgrEntries.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
        })
      })
      setManagers(Array.from(mgrMap.values()))
    } catch (e: any) {
      // Silently fail
    }
    setDirectoryLoading(false)
  }

  useEffect(() => {
    fetchCommissions()
    fetchSettings()
    fetchDirectory()
  }, [filterPeriod, filterStatus])

  const handlePayPeriod = async (period: string) => {
    if (!confirm(`Pay all accrued commissions for ${period}? This will mark them as "processing" and then "paid".`)) return

    setPayingPeriod(period)
    try {
      const [year, month] = period.split('-')

      // Step 1: Mark as approved (maps to 'processing' display status)
      const { error: procErr } = await supabase
        .from('commission_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('period_year', parseInt(year))
        .eq('period_month', parseInt(month))
        .eq('status', 'pending')

      if (procErr) throw procErr

      // Step 2: Mark as paid
      const { error: payErr } = await supabase
        .from('commission_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('period_year', parseInt(year))
        .eq('period_month', parseInt(month))
        .eq('status', 'approved')

      if (payErr) throw payErr

      toast.success(`Commissions for ${period} have been paid!`)
      await fetchCommissions()
    } catch (e: any) {
      toast.error('Payment failed: ' + e.message)
    }
    setPayingPeriod(null)
  }

  // Calculate totals
  const totalRepEarnings = entries.reduce((sum, e) => sum + (e.rep_earnings || 0), 0)
  const totalManagerEarnings = entries.reduce((sum, e) => sum + (e.manager_earnings || 0), 0)
  const accruedCount = entries.filter(e => e.status === 'accrued').length
  const accruedAmount = entries
    .filter(e => e.status === 'accrued')
    .reduce((sum, e) => sum + e.rep_earnings + (e.manager_earnings || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Commission Report</h2>
          <p className="text-gray-400 text-sm">Manage commissions and payouts</p>
        </div>
      </div>

      {/* Commission Rate Settings */}
      <Card className="bg-[#150f24] border-[#9a02d0]/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-[#9a02d0]" />
                Commission Rates
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Rep Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.rep_rate}
                    onChange={(e) => setSettings({ ...settings, rep_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Manager Override (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.manager_override_rate}
                    onChange={(e) => setSettings({ ...settings, manager_override_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0514] border border-white/10 text-white text-sm focus:border-[#44f80c] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              Save Rates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#44f80c]" />
              Total Rep Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalRepEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#9a02d0]" />
              Total Manager Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalManagerEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Pending (Accrued)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${accruedAmount.toFixed(2)}</div>
            <p className="text-xs text-gray-500">{accruedCount} entries</p>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#44f80c]" />
              Entries Shown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{entries.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pay Period Buttons */}
      <div className="flex flex-wrap gap-2">
        {periods.map(period => {
          const periodEntries = entries.filter(e => e.period === period && e.status === 'accrued')
          const periodAmount = periodEntries.reduce((sum, e) => sum + e.rep_earnings + (e.manager_earnings || 0), 0)
          if (periodEntries.length === 0) return null

          return (
            <Button
              key={period}
              onClick={() => handlePayPeriod(period)}
              disabled={payingPeriod === period}
              className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]"
            >
              {payingPeriod === period ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Pay {period} (${periodAmount.toFixed(0)})
            </Button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Period</label>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[140px] bg-brand-800 border-brand-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-brand-800 border-brand-700">
              <SelectItem value="all">All Periods</SelectItem>
              {periods.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] bg-brand-800 border-brand-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-brand-800 border-brand-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="accrued">Accrued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sales Rep Performance Directory */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#44f80c]" />
          Sales Rep Performance
        </h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {directoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" />
              </div>
            ) : reps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No sales reps found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">Rep</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Accounts</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Orders</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Commission</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reps.map((rep) => (
                      <tr key={rep.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="text-gray-200 font-medium">{rep.name}</div>
                          <div className="text-xs text-gray-500">{rep.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{rep.accounts}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{rep.orders}</td>
                        <td className="px-4 py-3 text-right text-[#44f80c] font-medium">${rep.commission.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-yellow-400">${rep.pending.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Manager Performance Directory */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#9a02d0]" />
          Sales Manager Performance
        </h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {directoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" />
              </div>
            ) : managers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Shield className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No sales managers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">Manager</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">Team Size</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Overrides</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {managers.map((mgr) => (
                      <tr key={mgr.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="text-gray-200 font-medium">{mgr.name}</div>
                          <div className="text-xs text-gray-500">{mgr.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{mgr.team_size}</td>
                        <td className="px-4 py-3 text-right text-[#9a02d0] font-medium">${mgr.overrides.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-yellow-400">${mgr.pending.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Table */}
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-psy-neonPurple" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No commission entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Period</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Account</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Sales Rep</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Manager</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Order Amt</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Rep Earns</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Mgr Override</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{entry.period}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.account_name}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.rep_name}</td>
                      <td className="px-4 py-3 text-gray-400">{entry.manager_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">${Number(entry.order_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#44f80c]">${Number(entry.rep_earnings).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#9a02d0]">${Number(entry.manager_earnings || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    accrued: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-[#44f80c]/20 text-[#44f80c]',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}