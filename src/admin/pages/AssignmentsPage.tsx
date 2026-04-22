import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Loader2, Check, UserPlus, ChevronDown, ChevronRight, Store, MapPin, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface StoreItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  store_number: string
  assigned_rep_id: string | null
  assigned_rep_name: string | null
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
  const [savingStore, setSavingStore] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const parseStoreNumber = (name: string): { number: string; cleanName: string } => {
    const m = name.match(/^(\d+[a-z])\s*-\s*(.+)$/)
    return m ? { number: m[1], cleanName: m[2] } : { number: '', cleanName: name }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // 1. Fetch approved accounts
    const { data: usersData } = await supabase.from('users').select('id, business_name, email, phone, role, city, state, referral_code').eq('status', 'approved').in('role', ['wholesaler', 'distributor']).order('referral_code', { ascending: true })

    // 2. Fetch account-level assignments
    const { data: acctAssignData } = await supabase.from('rep_account_assignments').select('account_id, rep_id')

    // 3. Fetch ALL stores from stores table
    const { data: storesData } = await supabase.from('stores').select('*').order('name', { ascending: true })

    // 4. Fetch store-level assignments
    const { data: storeAssignData } = await supabase.from('store_assignments').select('store_id, rep_id')

    // 5. Fetch reps
    const { data: repsData } = await supabase.from('users').select('id, business_name, email').eq('role', 'sales_rep').eq('status', 'approved')

    const repMap = new Map(); (repsData || []).forEach((r: any) => repMap.set(r.id, r))
    const acctAssignMap = new Map(); (acctAssignData || []).forEach((a: any) => acctAssignMap.set(a.account_id, a.rep_id))
    const storeAssignMap = new Map(); (storeAssignData || []).forEach((a: any) => storeAssignMap.set(a.store_id, a.rep_id))

    // Group stores by account number
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
        const storeRepId = storeAssignMap.get(s.id)
        const storeRep = storeRepId ? repMap.get(storeRepId) : null
        return {
          id: s.id, name: cleanName, address: s.address || '', city: s.city || '', state: s.state || '',
          store_number: sn, assigned_rep_id: storeRepId || null,
          assigned_rep_name: storeRep ? (storeRep.business_name || storeRep.email) : null,
        }
      })

      return {
        id: u.id, business_name: u.business_name, email: u.email, phone: u.phone, role: u.role,
        city: u.city, state: u.state, account_number: acctNum,
        assigned_rep_id: acctRepId || null,
        assigned_rep_name: acctRep ? (acctRep.business_name || acctRep.email) : null,
        stores: storeItems,
      }
    })

    setAccounts(accountItems)
    setReps((repsData || []).map((r: any) => ({ id: r.id, business_name: r.business_name, email: r.email })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAssignAccount = async (accountId: string) => {
    const repId = selectedRep[accountId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSaving(accountId); await supabase.from('rep_account_assignments').delete().eq('account_id', accountId)
    const { error } = await supabase.from('rep_account_assignments').insert([{ account_id: accountId, rep_id: repId }])
    error ? toast.error('Failed: ' + error.message) : (toast.success('Assigned!'), fetchAll())
    setSaving(null)
  }
  const handleUnassignAccount = async (accountId: string) => { if (!confirm('Remove?')) return; const { error } = await supabase.from('rep_account_assignments').delete().eq('account_id', accountId); error ? toast.error('Error') : (toast.success('Unassigned'), fetchAll()) }

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedStoreRep[storeId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSavingStore(storeId); await supabase.from('store_assignments').delete().eq('store_id', storeId)
    const { error } = await supabase.from('store_assignments').insert([{ store_id: storeId, rep_id: repId }])
    error ? toast.error('Failed: ' + error.message) : (toast.success('Assigned!'), fetchAll())
    setSavingStore(null)
  }
  const handleUnassignStore = async (storeId: string) => { if (!confirm('Remove?')) return; const { error } = await supabase.from('store_assignments').delete().eq('store_id', storeId); error ? toast.error('Error') : (toast.success('Unassigned'), fetchAll()) }

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
                        {acct.assigned_rep_name ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className="bg-[#44f80c]/20 text-[#44f80c]"><Users className="w-3 h-3 mr-1" /> Account Rep: {acct.assigned_rep_name}</Badge>
                            <button onClick={() => handleUnassignAccount(acct.id)} className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-0.5"><UserMinus className="w-3 h-3" /> Remove</button>
                          </div>
                        ) : <Badge className="bg-gray-700 text-gray-400 mt-2">Account Unassigned</Badge>}
                        {acct.stores.length > 0 && <button onClick={() => toggle(acct.id)} className="flex items-center gap-1 text-sm text-[#9a02d0] hover:text-[#ff66c4] mt-2">{expanded[acct.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}<Store className="w-4 h-4" />{acct.stores.length} store{acct.stores.length !== 1 ? 's' : ''}</button>}
                      </div>
                      <div className="flex items-center gap-2 w-full lg:w-auto">
                        <Select value={selectedRep[acct.id] || acct.assigned_rep_id || ''} onValueChange={val => setSelectedRep(p => ({ ...p, [acct.id]: val }))}>
                          <SelectTrigger className="w-56 bg-[#0a0514] border-white/10 text-white text-sm"><SelectValue placeholder="Select Account Rep" /></SelectTrigger>
                          <SelectContent className="bg-[#150f24] border-white/10">{reps.map(r => <SelectItem key={r.id} value={r.id}>{r.business_name || r.email}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleAssignAccount(acct.id)} disabled={saving === acct.id} className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">{saving === acct.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
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
                              {store.assigned_rep_name ? (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs"><Users className="w-3 h-3 mr-1" /> Store Rep: {store.assigned_rep_name}</Badge>
                                  <button onClick={() => handleUnassignStore(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                                </div>
                              ) : <Badge className="bg-gray-700 text-gray-400 text-xs mt-1.5">Store Unassigned</Badge>}
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
