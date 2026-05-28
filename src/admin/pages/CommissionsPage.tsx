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
  UserCog,
  Store,
  Warehouse,
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
  rate_wholesaler: number
  rate_distributor: number
}

interface ManagerPerformance {
  id: string
  name: string
  email: string
  team_size: number
  overrides: number
  pending: number
  rate_wholesaler: number
  rate_distributor: number
}

interface UserRateRow {
  id: string
  name: string
  email: string
  role: string
  wholesaler_rate: number
  distributor_rate: number
  has_wholesaler_override: boolean
  has_distributor_override: boolean
}

export function CommissionsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [payingPeriod, setPayingPeriod] = useState<string | null>(null)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // 4 default rates: rep_wholesaler, rep_distributor, manager_wholesaler, manager_distributor
  const [settings, setSettings] = useState({
    rep_wholesaler: 10,
    rep_distributor: 12,
    manager_wholesaler: 3,
    manager_distributor: 4,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  const [reps, setReps] = useState<RepPerformance[]>([])
  const [managers, setManagers] = useState<ManagerPerformance[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)

  const [userRates, setUserRates] = useState<UserRateRow[]>([])
  const [userRatesLoading, setUserRatesLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserRateRow | null>(null)
  const [editWholesalerRate, setEditWholesalerRate] = useState('')
  const [editDistributorRate, setEditDistributorRate] = useState('')
  const [savingUserRate, setSavingUserRate] = useState(false)

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
        const dbStatus = filterStatus === 'accrued' ? 'pending' : filterStatus === 'processing' ? 'approved' : filterStatus
        query = query.eq('status', dbStatus)
      }

      const { data, error } = await query
      if (error) throw error

      const mappedEntries = (data || []).map((row: any) => ({
        id: row.id,
        order_id: row.order_id || '',
        account_id: row.account_id || '',
        rep_id: row.user_id || '',
        manager_id: null,
        order_amount: row.orders?.total || row.order_amount || 0,
        rep_earnings: row.role_type === 'sales_rep' ? (row.amount || 0) : 0,
        manager_earnings: row.role_type === 'sales_manager' ? (row.amount || 0) : null,
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
      if (e.account_id) userIds.add(e.account_id)
    })

    if (userIds.size === 0) return entries

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
      const { data: rules } = await supabase
        .from('commission_rules')
        .select('role, account_type, rate_percent')

      if (rules && rules.length > 0) {
        const next = { ...settings }
        rules.forEach((r: any) => {
          const key = `${r.role}_${r.account_type}`.replace(/-/g, '_') as keyof typeof next
          if (key in next) {
            (next as any)[key] = r.rate_percent
          }
        })
        setSettings(next)
      }
    } catch (e: any) {
      // Silently fail
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const rulesToSave = [
        { role: 'sales_rep', account_type: 'wholesaler', rate_percent: settings.rep_wholesaler },
        { role: 'sales_rep', account_type: 'distributor', rate_percent: settings.rep_distributor },
        { role: 'sales_manager', account_type: 'wholesaler', rate_percent: settings.manager_wholesaler },
        { role: 'sales_manager', account_type: 'distributor', rate_percent: settings.manager_distributor },
      ]

      for (const rule of rulesToSave) {
        const { data: existing } = await supabase
          .from('commission_rules')
          .select('id')
          .eq('role', rule.role)
          .eq('account_type', rule.account_type)
          .limit(1)

        if (existing && existing.length > 0) {
          const { error } = await supabase.from('commission_rules').update({
            rate_percent: rule.rate_percent,
            effective_from: new Date().toISOString(),
          }).eq('id', existing[0].id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('commission_rules').insert({
            role: rule.role,
            account_type: rule.account_type,
            rate_percent: rule.rate_percent,
            tier: 'standard',
          }).select('id').single()
          if (error) throw error
        }
      }
      toast.success('Commission settings saved!')
      await fetchUserRates()
      await fetchDirectory()
    } catch (e: any) {
      toast.error('Failed to save settings: ' + e.message)
    }
    setSavingSettings(false)
  }

  const fetchUserRates = async () => {
    setUserRatesLoading(true)
    try {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, business_name, email, role')
        .in('role', ['sales_rep', 'sales_manager'])
        .eq('status', 'approved')

      const { data: overrides } = await supabase
        .from('user_commission_overrides')
        .select('user_id, role_type, account_type, override_rate_percent')

      const overrideMap = new Map(
        (overrides || []).map((o: any) => [`${o.user_id}-${o.role_type}-${o.account_type}`, o.override_rate_percent])
      )

      const rows: UserRateRow[] = (allUsers || []).map((u: any) => {
        const roleType = u.role === 'sales_manager' ? 'sales_manager' : 'sales_rep'
        const defW = roleType === 'sales_manager' ? settings.manager_wholesaler : settings.rep_wholesaler
        const defD = roleType === 'sales_manager' ? settings.manager_distributor : settings.rep_distributor
        const owKey = `${u.id}-${roleType}-wholesaler`
        const odKey = `${u.id}-${roleType}-distributor`
        const ow = overrideMap.get(owKey)
        const od = overrideMap.get(odKey)

        return {
          id: u.id,
          name: u.business_name || u.email,
          email: u.email,
          role: u.role,
          wholesaler_rate: ow ?? defW,
          distributor_rate: od ?? defD,
          has_wholesaler_override: ow !== undefined,
          has_distributor_override: od !== undefined,
        }
      })

      setUserRates(rows)
    } catch (e: any) {
      // Silently fail
    }
    setUserRatesLoading(false)
  }

  const handleSaveUserOverrides = async (userId: string, roleType: string) => {
    setSavingUserRate(true)
    try {
      // Wholesaler override
      const wVal = editWholesalerRate === '' ? null : parseFloat(editWholesalerRate)
      if (wVal === null) {
        await supabase.from('user_commission_overrides')
          .delete()
          .eq('user_id', userId)
          .eq('role_type', roleType)
          .eq('account_type', 'wholesaler')
      } else {
        await supabase.from('user_commission_overrides').upsert({
          user_id: userId, role_type: roleType, account_type: 'wholesaler', override_rate_percent: wVal,
        }, { onConflict: 'user_id,role_type,account_type' })
      }

      // Distributor override
      const dVal = editDistributorRate === '' ? null : parseFloat(editDistributorRate)
      if (dVal === null) {
        await supabase.from('user_commission_overrides')
          .delete()
          .eq('user_id', userId)
          .eq('role_type', roleType)
          .eq('account_type', 'distributor')
      } else {
        await supabase.from('user_commission_overrides').upsert({
          user_id: userId, role_type: roleType, account_type: 'distributor', override_rate_percent: dVal,
        }, { onConflict: 'user_id,role_type,account_type' })
      }

      toast.success('Rate overrides saved!')
      setEditingUser(null)
      setEditWholesalerRate('')
      setEditDistributorRate('')
      await fetchUserRates()
      await fetchDirectory()
    } catch (e: any) {
      toast.error('Failed to save override: ' + e.message)
    }
    setSavingUserRate(false)
  }

  const fetchDirectory = async () => {
    setDirectoryLoading(true)
    try {
      const { data: repsData } = await supabase
        .from('users')
        .select('id, business_name, email, manager_id')
        .eq('role', 'sales_rep')
        .eq('status', 'approved')

      const { data: managersData } = await supabase
        .from('users')
        .select('id, business_name, email')
        .eq('role', 'sales_manager')
        .eq('status', 'approved')

      const { data: allEntries } = await supabase
        .from('commission_payments')
        .select('user_id, amount, status, role_type, account_type')

      const { data: assignments } = await supabase
        .from('rep_account_assignments')
        .select('rep_id, account_id')

      const { data: overrides } = await supabase
        .from('user_commission_overrides')
        .select('user_id, role_type, account_type, override_rate_percent')

      const overrideMap = new Map(
        (overrides || []).map((o: any) => [`${o.user_id}-${o.role_type}-${o.account_type}`, o.override_rate_percent])
      )

      // Build rep performance
      const repMap = new Map<string, RepPerformance>()
      ;(repsData || []).forEach((r: any) => {
        const repEntries = (allEntries || []).filter((e: any) => e.user_id === r.id && e.role_type === 'sales_rep')
        const repAccounts = new Set((assignments || []).filter((a: any) => a.rep_id === r.id).map((a: any) => a.account_id))
        const ow = overrideMap.get(`${r.id}-sales_rep-wholesaler`)
        const od = overrideMap.get(`${r.id}-sales_rep-distributor`)
        repMap.set(r.id, {
          id: r.id,
          name: r.business_name || r.email,
          email: r.email,
          accounts: repAccounts.size,
          orders: repEntries.length,
          commission: repEntries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          pending: repEntries.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          rate_wholesaler: ow ?? settings.rep_wholesaler,
          rate_distributor: od ?? settings.rep_distributor,
        })
      })
      setReps(Array.from(repMap.values()))

      // Build manager performance
      const mgrMap = new Map<string, ManagerPerformance>()
      ;(managersData || []).forEach((m: any) => {
        const teamReps = (repsData || []).filter((r: any) => r.manager_id === m.id)
        const mgrEntries = (allEntries || []).filter((e: any) => e.user_id === m.id && e.role_type === 'sales_manager')
        const ow = overrideMap.get(`${m.id}-sales_manager-wholesaler`)
        const od = overrideMap.get(`${m.id}-sales_manager-distributor`)
        mgrMap.set(m.id, {
          id: m.id,
          name: m.business_name || m.email,
          email: m.email,
          team_size: teamReps.length,
          overrides: mgrEntries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          pending: mgrEntries.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          rate_wholesaler: ow ?? settings.manager_wholesaler,
          rate_distributor: od ?? settings.manager_distributor,
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
  }, [filterPeriod, filterStatus])

  useEffect(() => {
    fetchDirectory()
    fetchUserRates()
  }, [settings.rep_wholesaler, settings.rep_distributor, settings.manager_wholesaler, settings.manager_distributor])

  const handlePayPeriod = async (period: string) => {
    if (!confirm(`Pay all accrued commissions for ${period}? This will mark them as "processing" and then "paid".`)) return

    setPayingPeriod(period)
    try {
      const [year, month] = period.split('-')

      const { error: procErr } = await supabase
        .from('commission_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('period_year', parseInt(year))
        .eq('period_month', parseInt(month))
        .eq('status', 'pending')

      if (procErr) throw procErr

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
          <p className="text-gray-400 text-sm">Manage commissions, rates, and payouts</p>
        </div>
      </div>

      {/* Default Commission Rate Settings — 4 Rates */}
      <Card className="bg-[#150f24] border-[#9a02d0]/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-[#9a02d0]" />
            Default Commission Rates
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Set default rates for each role + account type combination. Per-user overrides can be set below.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Rep - Wholesaler */}
            <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-[#44f80c]" />
                <span className="text-xs text-gray-300 font-medium">Rep</span>
                <span className="text-gray-600">/</span>
                <Store className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-gray-300">Wholesale</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.rep_wholesaler}
                  onChange={(e) => setSettings({ ...settings, rep_wholesaler: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-2 py-1.5 rounded bg-[#150f24] border border-white/10 text-white text-sm text-center focus:border-[#44f80c] focus:outline-none"
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
            </div>

            {/* Rep - Distributor */}
            <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-[#44f80c]" />
                <span className="text-xs text-gray-300 font-medium">Rep</span>
                <span className="text-gray-600">/</span>
                <Warehouse className="w-3.5 h-3.5 text-[#ff66c4]" />
                <span className="text-xs text-gray-300">Distributor</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.rep_distributor}
                  onChange={(e) => setSettings({ ...settings, rep_distributor: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-2 py-1.5 rounded bg-[#150f24] border border-white/10 text-white text-sm text-center focus:border-[#44f80c] focus:outline-none"
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
            </div>

            {/* Manager - Wholesaler */}
            <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-[#9a02d0]" />
                <span className="text-xs text-gray-300 font-medium">Manager</span>
                <span className="text-gray-600">/</span>
                <Store className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-gray-300">Wholesale</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.manager_wholesaler}
                  onChange={(e) => setSettings({ ...settings, manager_wholesaler: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-2 py-1.5 rounded bg-[#150f24] border border-white/10 text-white text-sm text-center focus:border-[#44f80c] focus:outline-none"
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
            </div>

            {/* Manager - Distributor */}
            <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-[#9a02d0]" />
                <span className="text-xs text-gray-300 font-medium">Manager</span>
                <span className="text-gray-600">/</span>
                <Warehouse className="w-3.5 h-3.5 text-[#ff66c4]" />
                <span className="text-xs text-gray-300">Distributor</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.manager_distributor}
                  onChange={(e) => setSettings({ ...settings, manager_distributor: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-2 py-1.5 rounded bg-[#150f24] border border-white/10 text-white text-sm text-center focus:border-[#44f80c] focus:outline-none"
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
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
              Save Default Rates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Commission Rate Overrides */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#44f80c]" />
          Per-User Commission Rate Overrides
        </h3>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-0">
            {userRatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" />
              </div>
            ) : userRates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No sales reps or managers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">User</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400">Role</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">
                        <span className="flex items-center justify-center gap-1"><Store className="w-3 h-3 text-blue-400" />Wholesale</span>
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center">
                        <span className="flex items-center justify-center gap-1"><Warehouse className="w-3 h-3 text-[#ff66c4]" />Distributor</span>
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userRates.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="text-gray-200 font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingUser?.id === user.id ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={editWholesalerRate}
                              onChange={(e) => setEditWholesalerRate(e.target.value)}
                              placeholder={`${user.wholesaler_rate}`}
                              className="w-20 px-2 py-1 rounded bg-[#0a0514] border border-white/20 text-white text-center text-sm focus:border-[#44f80c] focus:outline-none"
                            />
                          ) : (
                            <span className={`font-medium ${user.has_wholesaler_override ? 'text-[#ff66c4]' : 'text-blue-400'}`}>
                              {user.wholesaler_rate}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingUser?.id === user.id ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={editDistributorRate}
                              onChange={(e) => setEditDistributorRate(e.target.value)}
                              placeholder={`${user.distributor_rate}`}
                              className="w-20 px-2 py-1 rounded bg-[#0a0514] border border-white/20 text-white text-center text-sm focus:border-[#44f80c] focus:outline-none"
                            />
                          ) : (
                            <span className={`font-medium ${user.has_distributor_override ? 'text-[#ff66c4]' : 'text-[#ff66c4]'}`}>
                              {user.distributor_rate}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingUser?.id === user.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveUserOverrides(user.id, user.role === 'sales_manager' ? 'sales_manager' : 'sales_rep')}
                                disabled={savingUserRate}
                                className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514] h-7 text-xs px-2"
                              >
                                {savingUserRate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingUser(null); setEditWholesalerRate(''); setEditDistributorRate('') }}
                                className="text-gray-400 hover:text-white h-7 text-xs px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingUser(user)
                                setEditWholesalerRate(user.has_wholesaler_override ? String(user.wholesaler_rate) : '')
                                setEditDistributorRate(user.has_distributor_override ? String(user.distributor_rate) : '')
                              }}
                              className="text-[#9a02d0] hover:text-[#ff66c4] h-7 text-xs px-2"
                            >
                              Edit
                            </Button>
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
        <p className="text-xs text-gray-500 mt-2 ml-1">
          Pink = custom override. Blue/Neon = using default. Leave blank to revert to default.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#150f24] border-white/10">
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

        <Card className="bg-[#150f24] border-white/10">
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

        <Card className="bg-[#150f24] border-white/10">
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

        <Card className="bg-[#150f24] border-white/10">
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
            <SelectTrigger className="w-[140px] bg-[#150f24] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#150f24] border-white/10">
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
            <SelectTrigger className="w-[140px] bg-[#150f24] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#150f24] border-white/10">
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
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Store className="w-3 h-3 inline text-blue-400" /> W</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Warehouse className="w-3 h-3 inline text-[#ff66c4]" /> D</th>
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
                        <td className="px-4 py-3 text-center text-blue-400">{rep.rate_wholesaler}%</td>
                        <td className="px-4 py-3 text-center text-[#ff66c4]">{rep.rate_distributor}%</td>
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
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Store className="w-3 h-3 inline text-blue-400" /> W</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 text-center"><Warehouse className="w-3 h-3 inline text-[#ff66c4]" /> D</th>
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
                        <td className="px-4 py-3 text-center text-blue-400">{mgr.rate_wholesaler}%</td>
                        <td className="px-4 py-3 text-center text-[#ff66c4]">{mgr.rate_distributor}%</td>
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

      {/* Commission Entry Table */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#44f80c]" />
            Commission Entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No commission entries found</p>
              <p className="text-xs text-gray-600 mt-1">Commissions are auto-generated when orders are marked as paid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Period</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Account</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Sales Rep</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Order Amt</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Earns</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{entry.period}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.account_name}</td>
                      <td className="px-4 py-3 text-gray-300">{entry.rep_name}</td>
                      <td className="px-4 py-3 text-gray-300">${Number(entry.order_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#44f80c] font-medium">
                        ${Number(entry.rep_earnings + (entry.manager_earnings || 0)).toFixed(2)}
                      </td>
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    sales_rep: 'bg-[#44f80c]/20 text-[#44f80c]',
    sales_manager: 'bg-[#9a02d0]/20 text-[#9a02d0]',
  }
  const labels: Record<string, string> = {
    sales_rep: 'Rep',
    sales_manager: 'Manager',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-500/20 text-gray-400'}`}>
      {labels[role] || role}
    </span>
  )
}
