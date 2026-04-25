import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Loader2, Check, UserPlus, ChevronDown, ChevronRight, Store, MapPin, UserMinus, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Audit Log Helper ───
async function logAudit(action: string, entity_type: string, entity_id: string, details: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_log').insert({
      action,
      entity_type,
      entity_id,
      user_id: session?.user?.id || null,
      details,
    })
  } catch {
    // Silent fail
  }
}

interface StoreItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  store_number: string
  assigned_rep_id: string | null
  assigned_rep_name: string | null
  manager_name: string | null
}

interface AccountItem {
  id: string
  business_name: string
  email: string
  phone: string | null
  role: string
  city: string | null
  state: string | null
  account_number: string
  assigned_rep_id: string | null
  assigned_rep_name: string | null
  manager_name: string | null
  stores: StoreItem[]
}

interface SalesRep {
  id: string
  business_name: string | null
  email: string
}

const roleBadge: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRep, setSelectedRep] = useState<Record<string, string>>({})
  const [selectedStoreRep, setSelectedStoreRep] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [managers, setManagers] = useState<SalesRep[]>([])
  const [selectedManager, setSelectedManager] = useState<Record<string, string>>({})
  const [savingManager, setSavingManager] = useState<string | null>(null)
  const [savingStore, setSavingStore] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [repHasManager, setRepHasManager] = useState<Map<string, boolean>>(new Map())

  const parseStoreNumber = (name: string): { number: string; cleanName: string } => {
    const m = name.match(/^(\d+[a-z])\s*-\s*(.+)$/)
    return m ? { number: m[1], cleanName: m[2] } : { number: '', cleanName: name }
  }

  const extractRepFromLicense = (license: string | null): string | null => {
    return license && license.startsWith('rep:') ? license.slice(4) : null
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: usersData } = await supabase.from('users').select('id, business_name, email, phone, role, city, state, referral_code, manager_id').eq('status', 'approved').in('role', ['wholesaler', 'distributor']).order('referral_code', { ascending: true })
    const { data: acctAssignData } = await supabase.from('rep_account_assignments').select('account_id, rep_id')
    const { data: storesData } = await supabase.from('wholesaler_store_locations').select('*').order('name', { ascending: true })
    const { data: repsData } = await supabase.from('users').select('id, business_name, email, manager_id').eq('role', 'sales_rep').eq('status', 'approved')
    const { data: managersData } = await supabase.from('users').select('id, business_name, email').eq('role', 'sales_manager').eq('status', 'approved')

    const repMap = new Map(); (repsData || []).forEach((r: any) => repMap.set(r.id, r))
    const managerCheckMap = new Map<string, boolean>(); (repsData || []).forEach((r: any) => managerCheckMap.set(r.id, !!r.manager_id))
    setRepHasManager(managerCheckMap)
    const managerMap = new Map(); (managersData || []).forEach((m: any) => managerMap.set(m.id, m))
    const acctAssignMap = new Map(); (acctAssignData || []).forEach((a: any) => acctAssignMap.set(a.account_id, a.rep_id))

    const storesByAcctNum = new Map<string, any[]>()
    ;(storesData || []).forEach((s: any) => {
      const { number: sn } = parseStoreNumber(s.name || '')
      const acctNum = sn.replace(/[a-z]$/, '')
      const list = storesByAcctNum.get(acctNum) || []
      list.push(s)
      storesByAcctNum.set(acctNum, list)
    })

    const accountItems: AccountItem[] = (usersData || []).map((u: any) => {
      const acctRepId = acctAssignMap.get(u.id)
      const acctRep = acctRepId ? repMap.get(acctRepId) : null
      const acctNum = u.referral_code || ''
      const userStores = storesByAcctNum.get(acctNum) || []

      const storeItems: StoreItem[] = userStores.map((s: any) => {
        const { number: sn, cleanName } = parseStoreNumber(s.name || '')
        const storeRepId = extractRepFromLicense(s.license_number)
        const storeRep = storeRepId ? repMap.get(storeRepId) : null
        return {
          id: s.id, name: cleanName, address: s.address || '', city: s.city || '', state: s.state || '',
          store_number: sn, assigned_rep_id: storeRepId,
          assigned_rep_name: storeRep ? (storeRep.business_name || storeRep.email) : null,
          manager_name: u.manager_id ? (managerMap.get(u.manager_id)?.business_name || managerMap.get(u.manager_id)?.email || null) : null,
        }
      })

      return {
        id: u.id, business_name: u.business_name, email: u.email, phone: u.phone, role: u.role,
        city: u.city, state: u.state, account_number: acctNum,
        assigned_rep_id: acctRepId || null,
        assigned_rep_name: acctRep ? (acctRep.business_name || acctRep.email) : null,
        manager_name: u.manager_id ? (managerMap.get(u.manager_id)?.business_name || managerMap.get(u.manager_id)?.email || null) : null,
        stores: storeItems,
      }
    })

    setAccounts(accountItems)
    setReps((repsData || []).map((r: any) => ({ id: r.id, business_name: r.business_name, email: r.email })))
    setManagers((managersData || []).map((m: any) => ({ id: m.id, business_name: m.business_name, email: m.email })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAssignAccount = async (accountId: string) => {
    const repId = selectedRep[accountId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSaving(accountId); await supabase.from('rep_account_assignments').delete().eq('account_id', accountId)
    const { error } = await supabase.from('rep_account_assignments').insert([{ account_id: accountId, rep_id: repId }])
    if (error) { toast.error('Failed: ' + error.message) } else {
      const acct = accounts.find(a => a.id === accountId)
      const rep = reps.find(r => r.id === repId)
      await logAudit('account_rep_assigned', 'account', accountId, `Account: ${acct?.business_name || accountId} | Rep: ${rep?.business_name || rep?.email || repId}`)
      toast.success('Assigned!')
      fetchAll()
    }
    setSaving(null)
  }
  const handleUnassignAccount = async (accountId: string) => { 
    if (!confirm('Remove?')) return
    const acct = accounts.find(a => a.id === accountId)
    const { error } = await supabase.from('rep_account_assignments').delete().eq('account_id', accountId)
    if (error) { toast.error('Error') } else {
      await logAudit('account_rep_unassigned', 'account', accountId, `Account: ${acct?.business_name || accountId} | Rep removed`)
      toast.success('Unassigned')
      fetchAll()
    }
  }

  const handleAssignManager = async (accountId: string) => {
    const managerId = selectedManager[accountId]
    setSavingManager(accountId)
    try {
      const acct = accounts.find(a => a.id === accountId)
      const oldManager = acct?.manager_name
      const { error } = await supabase.rpc('assign_manager', {
        target_user_id: accountId,
        new_manager_id: managerId || null
      })
      if (error) throw error
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, manager_name: managerId ? (managers.find(m => m.id === managerId)?.business_name || managers.find(m => m.id === managerId)?.email || 'Unknown') : null } : a))
      const newMgr = managers.find(m => m.id === managerId)
      await logAudit(
        managerId ? 'manager_assigned' : 'manager_unassigned',
        'user',
        accountId,
        `${acct?.business_name || accountId} | ${managerId ? `New manager: ${newMgr?.business_name || newMgr?.email || managerId}` : `Removed manager (was: ${oldManager || 'none'})`}`
      )
      toast.success(managerId ? 'Manager assigned!' : 'Manager removed')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update manager')
      await fetchAll()
    }
    setSavingManager(null)
  }

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedStoreRep[storeId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSavingStore(storeId)
    const store = accounts.flatMap(a => a.stores).find(s => s.id === storeId)
    const oldRepId = store ? extractRepFromLicense(store.license_number) : null
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: `rep:${repId}` }).eq('id', storeId)
    if (error) { toast.error('Failed: ' + error.message) } else {
      const rep = reps.find(r => r.id === repId)
      const oldRep = oldRepId ? reps.find(r => r.id === oldRepId) : null
      await logAudit('store_rep_assigned', 'store', storeId, `Store: ${store?.name || storeId} | Assigned: ${rep?.business_name || rep?.email || repId}${oldRep ? ` (was: ${oldRep.business_name || oldRep.email})` : ''}`)
      toast.success('Assigned!')
      fetchAll()
    }
    setSavingStore(null)
  }
  const handleUnassignStore = async (storeId: string) => {
    if (!confirm('Remove?')) return
    const store = accounts.flatMap(a => a.stores).find(s => s.id === storeId)
    const oldRepId = store ? extractRepFromLicense(store.license_number) : null
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: null }).eq('id', storeId)
    if (error) { toast.error('Error') } else {
      const oldRep = oldRepId ? reps.find(r => r.id === oldRepId) : null
      await logAudit('store_rep_unassigned', 'store', storeId, `Store: ${store?.name || storeId} | Removed: ${oldRep?.business_name || oldRep?.email || oldRepId || 'unknown'}`)
      toast.success('Unassigned')
      fetchAll()
    }
  }

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))
  const assignedCount = accounts.filter(a => a.assigned_rep_id).length
  const totalStores = accounts.reduce((s, a) => s + a.stores.length, 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-1">Accounts</h2><p className="text-gray-400">{accounts.length} accounts, {totalStores} stores</p></div>
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#9a02d0]" />Accounts ({assignedCount} assigned, {accounts.length - assignedCount} unassigned)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" /></div> : accounts.length === 0 ? <div className="text-center py-12 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p className="text-lg text-gray-400">No accounts</p></div> : reps.length === 0 ? <div className="text-center py-12 text-gray-500"><UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p className="text-lg text-gray-400">No Sales Reps</p></div> : (
            <div className="space-y-4">
              {accounts.map(acct => (
                <div key={acct.id} className="bg-[#0a0514] rounded-lg border border-white/10 overflow-hidden">
                  <div className="p-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">Acct #{acct.account_number}</span>
                          <h4 className="text-white font-medium text-lg">{acct.business_name}</h4>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase', roleBadge[acct.role] || 'bg-gray-500/20')}>{acct.role}</span>
                        </div>
                        <p className="text-gray-400 text-sm">{acct.email}{acct.city && acct.state && ` • ${acct.city}, ${acct.state}`}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {acct.manager_name && (
                            <Badge className="bg-[#9a02d0]/20 text-[#9a02d0]"><Shield className="w-3 h-3 mr-1" /> Manager: {acct.manager_name}</Badge>
                          )}
                          {(() => {
                            const hasMgr = acct.assigned_rep_id ? repHasManager.get(acct.assigned_rep_id) : true
                            if (acct.assigned_rep_name && hasMgr === false) {
                              return <Badge className="bg-yellow-500/20 text-yellow-400">⚠️ Unmanaged</Badge>
                            }
                            if (acct.assigned_rep_name) {
                              return <><Badge className="bg-[#44f80c]/20 text-[#44f80c]"><Users className="w-3 h-3 mr-1" /> Account Rep: {acct.assigned_rep_name}</Badge><button onClick={() => handleUnassignAccount(acct.id)} className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-0.5"><UserMinus className="w-3 h-3" /> Remove</button></>
                            }
                            return <Badge className="bg-gray-700 text-gray-400">Account Unassigned</Badge>
                          })()}
                        </div>
                        {acct.stores.length > 0 && <button onClick={() => toggle(acct.id)} className="flex items-center gap-1 text-sm text-[#9a02d0] hover:text-[#ff66c4] mt-2">{expanded[acct.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}<Store className="w-4 h-4" />{acct.stores.length} store{acct.stores.length !== 1 ? 's' : ''}</button>}
                      </div>
                      <div className="flex flex-col gap-2 w-full lg:w-auto">
                        <div className="flex items-center gap-2">
                          <Select value={selectedRep[acct.id] || acct.assigned_rep_id || ''} onValueChange={val => setSelectedRep(p => ({ ...p, [acct.id]: val }))}>
                            <SelectTrigger className="w-56 bg-[#0a0514] border-white/10 text-white text-sm"><SelectValue placeholder="Select Account Rep" /></SelectTrigger>
                            <SelectContent className="bg-[#150f24] border-white/10">{reps.map(r => <SelectItem key={r.id} value={r.id}>{r.business_name || r.email}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" onClick={() => handleAssignAccount(acct.id)} disabled={saving === acct.id} className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">{saving === acct.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="w-56 bg-[#0a0514] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#9a02d0]/50"
                            value={selectedManager[acct.id] || (() => { const m = managers.find(mgr => mgr.business_name === acct.manager_name || mgr.email === acct.manager_name); return m?.id || '' })()}
                            onChange={e => setSelectedManager(p => ({ ...p, [acct.id]: e.target.value }))}
                          >
                            <option value="">— No Manager —</option>
                            {managers.map(m => <option key={m.id} value={m.id}>{m.business_name || m.email}</option>)}
                          </select>
                          <Button size="sm" onClick={() => handleAssignManager(acct.id)} disabled={savingManager === acct.id} className="bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">{savingManager === acct.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded[acct.id] && acct.stores.length > 0 && <div className="border-t border-white/10 px-4 pb-4">
                    <div className="mt-3 space-y-3">
                      {acct.stores.map(store => (
                        <div key={store.id} className="bg-[#150f24] rounded-lg p-3 border border-white/5">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono bg-[#ff66c4]/20 text-[#ff66c4] px-2 py-0.5 rounded">{store.store_number}</span>
                                <span className="text-white font-medium">{store.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-gray-400"><MapPin className="w-3 h-3 text-gray-600" /><span>{store.address}{store.city && `, ${store.city}`}{store.state && `, ${store.state}`}</span></div>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {store.manager_name && (
                                  <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs"><Shield className="w-3 h-3 mr-1" /> Manager: {store.manager_name}</Badge>
                                )}
                                {(() => {
                                  const hasMgr = store.assigned_rep_id ? repHasManager.get(store.assigned_rep_id) : true
                                  if (store.assigned_rep_name && hasMgr === false) {
                                    return <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">⚠️ Unmanaged</Badge>
                                  }
                                  if (store.assigned_rep_name) {
                                    return <><Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs"><Users className="w-3 h-3 mr-1" /> Store Rep: {store.assigned_rep_name}</Badge><button onClick={() => handleUnassignStore(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button></>
                                  }
                                  return <Badge className="bg-gray-700 text-gray-400 text-xs">Store Unassigned</Badge>
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <Select value={selectedStoreRep[store.id] || store.assigned_rep_id || ''} onValueChange={val => setSelectedStoreRep(p => ({ ...p, [store.id]: val }))}>
                                <SelectTrigger className="w-48 bg-[#0a0514] border-white/10 text-white text-sm"><SelectValue placeholder="Select Store Rep" /></SelectTrigger>
                                <SelectContent className="bg-[#150f24] border-white/10">{reps.map(r => <SelectItem key={r.id} value={r.id}>{r.business_name || r.email}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button size="sm" onClick={() => handleAssignStore(store.id)} disabled={savingStore === store.id} className="bg-gradient-to-r from-[#44f80c] to-[#9a02d0] text-white">{savingStore === store.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
