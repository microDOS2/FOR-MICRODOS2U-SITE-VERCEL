import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Loader2, Check, UserPlus, ChevronDown, ChevronRight, Store, MapPin, UserMinus, Shield, Download, Upload, FileUp, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Audit Log Helper ───
async function logAudit(action: string, table_name: string, record_id: string, old_data: string | null, new_data: string | null) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_log').insert({
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      user_id: session?.user?.id || null,
    })
  } catch (e) {
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
  manager_id: string | null
  license_number: string | null
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
  manager_id: string | null
  stores: StoreItem[]
}

interface SalesRep {
  id: string
  business_name: string | null
  email: string
}

interface CsvRow {
  business_name: string
  email: string
  phone: string
  role: string
  city: string
  state: string
  _ok: boolean
  _err?: string
}

const roleBadge: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
}

// CSV helpers
function esc(v: string | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function dlCsv(name: string, csv: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const h = parseCsvLine(lines[0]).map(x => x.trim().toLowerCase())
  const iName = h.indexOf('business_name') >= 0 ? h.indexOf('business_name') : h.indexOf('business name') >= 0 ? h.indexOf('business name') : h.indexOf('name')
  const iEmail = h.indexOf('email')
  const iPhone = h.indexOf('phone')
  const iRole = h.indexOf('role')
  const iCity = h.indexOf('city')
  const iState = h.indexOf('state')
  const out: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i])
    const business_name = iName >= 0 ? (c[iName]?.trim() || '') : ''
    const email = iEmail >= 0 ? (c[iEmail]?.trim() || '') : ''
    const phone = iPhone >= 0 ? (c[iPhone]?.trim() || '') : ''
    const role = iRole >= 0 ? (c[iRole]?.trim() || 'wholesaler') : 'wholesaler'
    const city = iCity >= 0 ? (c[iCity]?.trim() || '') : ''
    const state = iState >= 0 ? (c[iState]?.trim() || '') : ''
    const ok = business_name.length > 0 && email.length > 0 && email.includes('@')
    out.push({ business_name, email, phone, role, city, state, _ok: ok, _err: ok ? undefined : (!business_name ? 'Missing business_name' : !email ? 'Missing email' : 'Invalid email') })
  }
  return out
}
function parseCsvLine(line: string): string[] {
  const r: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQ = !inQ }
    } else if (ch === ',' && !inQ) { r.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  r.push(cur.trim())
  return r
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
  const [repManagerMap, setRepManagerMap] = useState<Map<string, string | null>>(new Map())
  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const repMgrMap = new Map<string, string | null>(); (repsData || []).forEach((r: any) => repMgrMap.set(r.id, r.manager_id || null))
    setRepManagerMap(repMgrMap)
    // Deduplicate managers by name — keep first occurrence of each name
    const seenNames = new Set<string>()
    const uniqueManagers = (managersData || []).filter((m: any) => {
      const name = m.business_name || m.email
      if (seenNames.has(name)) return false
      seenNames.add(name)
      return true
    })
    const managerMap = new Map(); uniqueManagers.forEach((m: any) => managerMap.set(m.id, m))
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
          manager_id: u.manager_id || null,
          license_number: s.license_number || null,
        }
      })

      return {
        id: u.id, business_name: u.business_name, email: u.email, phone: u.phone, role: u.role,
        city: u.city, state: u.state, account_number: acctNum,
        assigned_rep_id: acctRepId || null,
        assigned_rep_name: acctRep ? (acctRep.business_name || acctRep.email) : null,
        manager_name: u.manager_id ? (managerMap.get(u.manager_id)?.business_name || managerMap.get(u.manager_id)?.email || null) : null,
        manager_id: u.manager_id || null,
        stores: storeItems,
      }
    })

    setAccounts(accountItems)
    setReps((repsData || []).map((r: any) => ({ id: r.id, business_name: r.business_name, email: r.email })))
    setManagers(uniqueManagers.map((m: any) => ({ id: m.id, business_name: m.business_name, email: m.email })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAssignAccount = async (accountId: string) => {
    const repId = selectedRep[accountId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSaving(accountId)
    const { error } = await supabase.rpc('assign_rep_to_account', {
      p_rep_id: repId,
      p_account_id: accountId,
      p_assigned_by: (await supabase.auth.getUser()).data.user?.id,
    })
    if (error) { toast.error('Failed: ' + error.message) } else {
      const rep = reps.find(r => r.id === repId)
      await logAudit('account_rep_assigned', 'rep_account_assignments', accountId, null, rep?.business_name || rep?.email || repId)
      toast.success('Assigned!')
      fetchAll()
    }
    setSaving(null)
  }
  const handleUnassignAccount = async (accountId: string) => { 
    if (!confirm('Remove?')) return
    const { error } = await supabase.from('rep_account_assignments').delete().eq('account_id', accountId)
    if (error) { toast.error('Error') } else {
      await logAudit('account_rep_unassigned', 'rep_account_assignments', accountId, null, null)
      toast.success('Unassigned')
      fetchAll()
    }
  }

  const handleAssignManager = async (accountId: string) => {
    // If dropdown wasn't changed, use the account's current manager
    let managerId = selectedManager[accountId]
    const acct = accounts.find(a => a.id === accountId)
    if (!managerId && acct?.manager_id) {
      // User clicked checkmark without changing dropdown — keep current manager
      toast.info('Manager already assigned')
      setSavingManager(null)
      return
    }
    setSavingManager(accountId)
    try {
      const oldManager = acct?.manager_name
      const newMgr = managers.find(m => m.id === managerId)

      // 1. Update the account's manager_id
      const { error: acctErr } = await supabase.from('users').update({
        manager_id: managerId || null
      }).eq('id', accountId)
      if (acctErr) throw acctErr

      // 2. Update the assigned rep's manager_id (check error!)
      const repId = acct?.assigned_rep_id
      if (repId && managerId) {
        const { error: repErr } = await supabase.from('users').update({
          manager_id: managerId
        }).eq('id', repId)
        if (repErr) console.warn('Rep manager update failed:', repErr.message)
        // Don't throw — rep update is best-effort, not critical
      }

      // 3. Update React state — include BOTH manager_name AND manager_id
      setAccounts(prev => prev.map(a => a.id === accountId ? {
        ...a,
        manager_name: managerId ? (newMgr?.business_name || newMgr?.email || 'Unknown') : null,
        manager_id: managerId || null
      } : a))

      // 4. Refresh rep-manager map
      if (repId) {
        setRepManagerMap(prev => {
          const next = new Map(prev)
          next.set(repId as string, managerId || null)
          return next
        })
      }

      await logAudit(
        managerId ? 'manager_assigned' : 'manager_unassigned',
        'users',
        accountId,
        oldManager || null,
        newMgr?.business_name || newMgr?.email || managerId || null
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
      await logAudit('store_rep_assigned', 'wholesaler_store_locations', storeId, oldRep?.business_name || oldRep?.email || null, rep?.business_name || rep?.email || repId)
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
      await logAudit('store_rep_unassigned', 'wholesaler_store_locations', storeId, oldRep?.business_name || oldRep?.email || oldRepId || null, null)
      toast.success('Unassigned')
      fetchAll()
    }
  }

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))
  const assignedCount = accounts.filter(a => a.assigned_rep_id).length
  const totalStores = accounts.reduce((s, a) => s + a.stores.length, 0)

  const downloadAccounts = () => {
    const h = ['Account #', 'Business Name', 'Email', 'Phone', 'Role', 'City', 'State', 'Assigned Rep', 'Manager', 'Store Count']
    const rows = accounts.map(a => [esc(a.account_number), esc(a.business_name), esc(a.email), esc(a.phone), esc(a.role), esc(a.city), esc(a.state), esc(a.assigned_rep_name), esc(a.manager_name), String(a.stores.length)])
    dlCsv(`accounts-${new Date().toISOString().slice(0, 10)}.csv`, [h.join(','), ...rows.map(r => r.join(','))].join('\n'))
    toast.success(`Downloaded ${accounts.length} accounts`)
  }
  const downloadStores = () => {
    const h = ['Account #', 'Business Name', 'Store #', 'Store Name', 'Address', 'City', 'State', 'Store Rep']
    const rows: string[][] = []
    accounts.forEach(a => a.stores.forEach(s => rows.push([esc(a.account_number), esc(a.business_name), esc(s.store_number), esc(s.name), esc(s.address), esc(s.city), esc(s.state), esc(s.assigned_rep_name)])))
    dlCsv(`stores-${new Date().toISOString().slice(0, 10)}.csv`, [h.join(','), ...rows.map(r => r.join(','))].join('\n'))
    toast.success(`Downloaded ${rows.length} stores`)
  }

  // Upload handlers
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => { setCsvRows(parseCsv(String(ev.target?.result || ''))) }
    r.readAsText(f)
  }
  const doUpload = async () => {
    const valid = csvRows.filter(r => r._ok)
    if (!valid.length) { toast.error('No valid rows'); return }
    setUploading(true)
    let ok = 0, fail = 0
    for (const row of valid) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-auth-user`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ email: row.email, password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), business_name: row.business_name, role: row.role === 'distributor' ? 'distributor' : 'wholesaler', site_url: window.location.origin })
        })
        let uid: string
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (err.error?.includes('already') || err.error?.includes('exists')) {
            const { data: ex } = await supabase.from('users').select('id').eq('email', row.email).single()
            if (ex) uid = ex.id; else { fail++; continue }
          } else { fail++; continue }
        } else { uid = (await res.json()).user.id }
        const { error: insErr } = await supabase.rpc('insert_user', { p_id: uid, p_email: row.email, p_business_name: row.business_name, p_role: row.role === 'distributor' ? 'distributor' : 'wholesaler', p_status: 'approved', p_phone: row.phone || null, p_city: row.city || null, p_state: row.state || null })
        if (insErr) { fail++ } else { ok++ }
      } catch { fail++ }
    }
    setUploading(false)
    toast.success(`${ok} imported, ${fail} failed`)
    if (ok > 0) fetchAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Accounts</h2>
          <p className="text-gray-400">{accounts.length} accounts, {totalStores} stores</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadAccounts} title="Download accounts as CSV" className="border-white/10 text-white hover:bg-white/5"><Download className="w-4 h-4 mr-1.5" />Accounts CSV</Button>
          <Button size="sm" variant="outline" onClick={downloadStores} title="Download stores as CSV" className="border-white/10 text-white hover:bg-white/5"><Download className="w-4 h-4 mr-1.5" />Stores CSV</Button>
          <Button size="sm" onClick={() => { setShowUpload(true); setCsvRows([]) }} title="Upload accounts from CSV" className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white"><Upload className="w-4 h-4 mr-1.5" />Upload CSV</Button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowUpload(false)}>
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FileUp className="w-5 h-5 text-[#9a02d0]" /> Upload Accounts CSV</h3>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {csvRows.length === 0 ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-[#9a02d0]/50 transition-colors">
                    <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-300 mb-1">Select a CSV file to upload</p>
                    <p className="text-gray-500 text-sm mb-4">Required: business_name, email | Optional: phone, role, city, state</p>
                    <input ref={fileRef} type="file" accept=".csv" onChange={onPickFile} className="hidden" />
                    <Button onClick={() => fileRef.current?.click()} className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">Select CSV File</Button>
                  </div>
                  <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                    <p className="text-sm text-gray-400 mb-2"><strong className="text-white">Template:</strong></p>
                    <code className="text-xs text-[#44f80c] font-mono block">business_name,email,phone,role,city,state</code>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-300">{csvRows.length} rows ({csvRows.filter(r => r._ok).length} valid, {csvRows.filter(r => !r._ok).length} invalid)</p>
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0a0514]"><tr><th className="text-left px-3 py-2 text-gray-400">Status</th><th className="text-left px-3 py-2 text-gray-400">Business Name</th><th className="text-left px-3 py-2 text-gray-400">Email</th><th className="text-left px-3 py-2 text-gray-400">Phone</th><th className="text-left px-3 py-2 text-gray-400">Role</th><th className="text-left px-3 py-2 text-gray-400">City</th><th className="text-left px-3 py-2 text-gray-400">State</th></tr></thead>
                      <tbody>
                        {csvRows.map((row, i) => (
                          <tr key={i} className={row._ok ? 'border-t border-white/5' : 'border-t border-red-500/20 bg-red-500/5'}>
                            <td className="px-3 py-2">{row._ok ? <Check className="w-4 h-4 text-[#44f80c]" /> : <AlertCircle className="w-4 h-4 text-red-400" />}</td>
                            <td className="px-3 py-2 text-white">{row.business_name}</td><td className="px-3 py-2 text-gray-300">{row.email}</td><td className="px-3 py-2 text-gray-400">{row.phone}</td><td className="px-3 py-2 text-gray-400">{row.role}</td><td className="px-3 py-2 text-gray-400">{row.city}</td><td className="px-3 py-2 text-gray-400">{row.state}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setCsvRows([]); fileRef.current && (fileRef.current.value = '') }} className="border-white/10 text-white hover:bg-white/5">Choose Different File</Button>
                    <Button onClick={doUpload} disabled={uploading || !csvRows.filter(r => r._ok).length} className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">{uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Importing...</> : <>Import {csvRows.filter(r => r._ok).length} Accounts</>}</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                            const repMgrId = acct.assigned_rep_id ? repManagerMap.get(acct.assigned_rep_id) : null
                            const hasMgr = repMgrId !== null && repMgrId !== undefined
                            // Compare by manager NAME too, in case duplicate manager records have different IDs
                            const repMgrName = repMgrId ? (managerMap.get(repMgrId)?.business_name || managerMap.get(repMgrId)?.email) : null
                            const acctMgrName = acct.manager_name
                            const sameManager = repMgrId === acct.manager_id || (repMgrName && acctMgrName && repMgrName === acctMgrName)
                            const isCrossTerritory = hasMgr && acct.manager_id && !sameManager
                            if (acct.assigned_rep_name && !hasMgr) {
                              return <Badge className="bg-yellow-500/20 text-yellow-400">⚠️ Unmanaged</Badge>
                            }
                            if (acct.assigned_rep_name && isCrossTerritory) {
                              return <><Badge className="bg-yellow-500/20 text-yellow-400"><Users className="w-3 h-3 mr-1" /> ⚠️ Cross-territory: {acct.assigned_rep_name}</Badge><button onClick={() => handleUnassignAccount(acct.id)} className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-0.5"><UserMinus className="w-3 h-3" /> Remove</button></>
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
                                  const repMgrId = store.assigned_rep_id ? repManagerMap.get(store.assigned_rep_id) : null
                                  const hasMgr = repMgrId !== null && repMgrId !== undefined
                                  const isCrossTerritory = hasMgr && store.manager_id && repMgrId !== store.manager_id
                                  if (store.assigned_rep_name && !hasMgr) {
                                    return <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">⚠️ Unmanaged</Badge>
                                  }
                                  if (store.assigned_rep_name && isCrossTerritory) {
                                    return <><Badge className="bg-yellow-500/20 text-yellow-400 text-xs"><Users className="w-3 h-3 mr-1" /> ⚠️ Cross-territory: {store.assigned_rep_name}</Badge><button onClick={() => handleUnassignStore(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button></>
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
