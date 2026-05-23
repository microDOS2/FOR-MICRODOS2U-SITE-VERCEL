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

export function CommissionsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [payingPeriod, setPayingPeriod] = useState<string | null>(null)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [settings, setSettings] = useState({ rep_rate: 5, manager_override_rate: 2 })
  const [savingSettings, setSavingSettings] = useState(false)

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
        .from('commission_entries')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterPeriod !== 'all') {
        query = query.eq('period', filterPeriod)
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error

      // Enrich with user names
      const entriesWithNames = await enrichWithNames(data || [])
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
      const { data } = await supabase.from('commission_settings').select('rep_rate, manager_override_rate').maybeSingle()
      if (data) {
        setSettings({ rep_rate: data.rep_rate, manager_override_rate: data.manager_override_rate })
      }
      // If no row exists, keep default values (5% / 2%)
    } catch (e: any) {
      // Silently fail - defaults are fine
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      // Try upsert - inserts if no row exists, updates if it does
      const { error } = await supabase.from('commission_settings').upsert({
        id: 1,
        rep_rate: settings.rep_rate,
        manager_override_rate: settings.manager_override_rate,
      }, { onConflict: 'id' })
      if (error) throw error
      toast.success('Commission settings saved!')
    } catch (e: any) {
      toast.error('Failed to save settings: ' + e.message)
    }
    setSavingSettings(false)
  }

  useEffect(() => {
    fetchCommissions()
    fetchSettings()
  }, [filterPeriod, filterStatus])

  const handlePayPeriod = async (period: string) => {
    if (!confirm(`Pay all accrued commissions for ${period}? This will mark them as "processing" and then "paid".`)) return

    setPayingPeriod(period)
    try {
      // Step 1: Mark as processing
      const { error: procErr } = await supabase
        .from('commission_entries')
        .update({ status: 'processing' })
        .eq('period', period)
        .eq('status', 'accrued')

      if (procErr) throw procErr

      // Step 2: Mark as paid
      const { error: payErr } = await supabase
        .from('commission_entries')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('period', period)
        .eq('status', 'processing')

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