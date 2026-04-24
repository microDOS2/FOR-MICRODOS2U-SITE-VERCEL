import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, Store, MapPin, Phone, Loader2, PauseCircle, PlayCircle, Users, UserMinus, Check, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface StoreItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  email: string | null
  is_active: boolean
  store_number: string
  account_number: string
  owner_name: string
  owner_role: string
  assigned_rep_id: string | null
  assigned_rep_name: string | null
  manager_name: string | null
}

export function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null)
  const [reps, setReps] = useState<any[]>([])
  const [selectedRep, setSelectedRep] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [repHasManager, setRepHasManager] = useState<Map<string, boolean>>(new Map())
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', zip: '', lat: '', lng: '', phone: '', email: '' })
  const pageSize = 10

  const parseStoreNumber = (name: string): { number: string; cleanName: string } => {
    const m = name.match(/^(\d+[a-z])\s*-\s*(.+)$/)
    return m ? { number: m[1], cleanName: m[2] } : { number: '', cleanName: name }
  }

  const extractRepFromLicense = (license: string | null): string | null => {
    return license && license.startsWith('rep:') ? license.slice(4) : null
  }

  const fetchStores = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('wholesaler_store_locations').select('*', { count: 'exact' }).order('name', { ascending: true })
      if (search) query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`)
      const { data: storeData, count, error } = await query
      if (error) { console.error(error); setStores([]); setLoading(false); return }

      const { data: usersData } = await supabase.from('users').select('id, business_name, email, role, referral_code, manager_id').eq('status', 'approved').in('role', ['wholesaler', 'distributor'])
      const userMap = new Map(); (usersData || []).forEach((u: any) => userMap.set(u.referral_code, u))

      const { data: managersData } = await supabase.from('users').select('id, business_name, email').eq('role', 'sales_manager').eq('status', 'approved')
      const managerMap = new Map(); (managersData || []).forEach((m: any) => managerMap.set(m.id, m))

      const { data: repsData } = await supabase.from('users').select('id, business_name, email, manager_id').eq('role', 'sales_rep').eq('status', 'approved')
      setReps(repsData || [])

      // Build repHasManager lookup
      const managerCheckMap = new Map<string, boolean>()
      ;(repsData || []).forEach((r: any) => managerCheckMap.set(r.id, !!r.manager_id))
      setRepHasManager(managerCheckMap)
      const repMap = new Map(); (repsData || []).forEach((r: any) => repMap.set(r.id, r))

      const transformed = (storeData || []).map((s: any) => {
        const { number: sn, cleanName } = parseStoreNumber(s.name || '')
        const acctNum = sn.replace(/[a-z]$/, '')
        let owner: any = userMap.get(acctNum)
        // Fallback: match store name directly against wholesaler business_name
        if (!owner && s.name) {
          const storeNameLower = (s.name || '').toLowerCase().trim()
          owner = (usersData || []).find((u: any) => u.business_name && u.business_name.toLowerCase().trim() === storeNameLower)
        }
        const repId = extractRepFromLicense(s.license_number)
        const rep = repId ? repMap.get(repId) : null
        return {
          id: s.id, name: cleanName, address: s.address || '', city: s.city || '', state: s.state || '',
          zip: s.zip || '', lat: s.lat, lng: s.lng, phone: s.phone || '', email: s.email || '',
          is_active: s.is_active ?? true, store_number: sn, account_number: acctNum,
          owner_name: owner ? (owner.business_name || owner.email) : 'Unknown',
          owner_role: owner?.role || '', assigned_rep_id: repId,
          assigned_rep_name: rep ? (rep.business_name || rep.email) : null,
          manager_name: owner?.manager_id ? (managerMap.get(owner.manager_id)?.business_name || managerMap.get(owner.manager_id)?.email || 'Unknown') : null,
        }
      })
      setStores(transformed); setTotalCount(count || 0)
    } catch (err) { console.error(err); setStores([]) }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchStores() }, [fetchStores])

  const handleSave = async () => {
    const payload: any = { name: formData.name, address: formData.address, city: formData.city, state: formData.state, zip: formData.zip, lat: formData.lat ? parseFloat(formData.lat) : null, lng: formData.lng ? parseFloat(formData.lng) : null, phone: formData.phone || null, email: formData.email || null }
    if (editingStore) { const { error } = await supabase.from('wholesaler_store_locations').update(payload).eq('id', editingStore.id); error ? toast.error('Error') : toast.success('Updated') }
    else { const { error } = await supabase.from('wholesaler_store_locations').insert([{ ...payload, stock: 'In Stock', is_active: true, source: 'admin' }]); error ? toast.error('Error') : toast.success('Created') }
    setShowModal(false); setEditingStore(null); setFormData({ name: '', address: '', city: '', state: '', zip: '', lat: '', lng: '', phone: '', email: '' }); fetchStores()
  }
  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; const { error } = await supabase.from('wholesaler_store_locations').delete().eq('id', id); error ? toast.error('Error') : toast.success('Deleted'); fetchStores() }
  const handleSetPending = async (id: string) => { if (!confirm('Set to Pending?')) return; const { error } = await supabase.from('wholesaler_store_locations').update({ is_active: false }).eq('id', id); error ? toast.error('Error') : toast.success('Pending'); fetchStores() }
  const handleReactivate = async (id: string) => { const { error } = await supabase.from('wholesaler_store_locations').update({ is_active: true }).eq('id', id); error ? toast.error('Error') : toast.success('Active'); fetchStores() }
  const openEdit = (s: StoreItem) => { setEditingStore(s); setFormData({ name: s.name, address: s.address, city: s.city, state: s.state, zip: s.zip || '', lat: s.lat != null ? String(s.lat) : '', lng: s.lng != null ? String(s.lng) : '', phone: s.phone || '', email: s.email || '' }); setShowModal(true) }

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedRep[storeId]; if (!repId) { toast.error('Select a Sales Rep'); return }
    setSaving(storeId)
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: `rep:${repId}` }).eq('id', storeId)
    error ? toast.error('Failed: ' + error.message) : (toast.success('Assigned!'), fetchStores())
    setSaving(null)
  }
  const handleUnassignStore = async (storeId: string) => { if (!confirm('Remove?')) return; const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: null }).eq('id', storeId); error ? toast.error('Error') : (toast.success('Unassigned'), fetchStores()) }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder="Search stores..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" /></div>
        <button onClick={() => { setEditingStore(null); setFormData({ name: '', address: '', city: '', state: '', zip: '', lat: '', lng: '', phone: '', email: '' }); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white"><Store className="w-4 h-4" /> Add</button>
      </div>
      <p className="text-sm text-gray-500">{totalCount} store{totalCount !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-12 text-gray-500 flex justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading...</div> : stores.length === 0 ? <div className="col-span-full text-center py-12 text-gray-500">No stores</div> : stores.map((s) => (
          <Card key={s.id} className="bg-[#150f24] border-white/10 hover:border-[#9a02d0]/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#9a02d0]/10 rounded-lg"><Store className="w-5 h-5 text-[#44f80c]" /></div>
                  {s.store_number && <span className="text-xs font-mono bg-[#ff66c4]/20 text-[#ff66c4] px-2 py-1 rounded">{s.store_number}</span>}
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', s.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400')}>{s.is_active ? 'Active' : 'Pending'}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{s.name}</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-1.5 py-0.5 rounded">Acct #{s.account_number || '?'}</span>
                <span className="text-sm text-gray-400">{s.owner_name}</span>
                {s.owner_role && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase', s.owner_role === 'wholesaler' ? 'bg-[#44f80c]/20 text-[#44f80c]' : 'bg-[#ff66c4]/20 text-[#ff66c4]')}>{s.owner_role}</span>}
              </div>
              <div className="flex flex-col gap-2 mt-2 mb-3">
                {s.manager_name && (
                  <span className="text-xs text-[#9a02d0] bg-[#9a02d0]/10 px-2 py-0.5 rounded flex items-center gap-1 w-fit"><Shield className="w-3 h-3" /> Manager: {s.manager_name}</span>
                )}
                {(() => {
                  const hasMgr = s.assigned_rep_id ? repHasManager.get(s.assigned_rep_id) : true
                  if (s.assigned_rep_name && hasMgr === false) {
                    return <div className="flex items-center gap-2"><span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded flex items-center gap-1">⚠️ Unmanaged</span><button onClick={() => handleUnassignStore(s.id)} className="text-xs text-red-400 hover:text-red-300 underline"><UserMinus className="w-3 h-3 inline" /></button></div>
                  }
                  if (s.assigned_rep_name) {
                    return <div className="flex items-center gap-2"><span className="text-xs text-[#44f80c] bg-[#44f80c]/10 px-2 py-0.5 rounded flex items-center gap-1"><Users className="w-3 h-3" /> {s.assigned_rep_name}</span><button onClick={() => handleUnassignStore(s.id)} className="text-xs text-red-400 hover:text-red-300 underline"><UserMinus className="w-3 h-3 inline" /></button></div>
                  }
                  return <span className="text-xs text-gray-500">Unassigned</span>
                })()}
                <div className="flex items-center gap-1">
                  <Select value={selectedRep[s.id] || ''} onValueChange={(val) => setSelectedRep(p => ({ ...p, [s.id]: val }))}>
                    <SelectTrigger className="h-8 text-xs bg-[#0a0514] border-white/10 text-white flex-1"><SelectValue placeholder="Assign Rep" /></SelectTrigger>
                    <SelectContent className="bg-[#150f24] border-white/10">{reps.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.business_name || r.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleAssignStore(s.id)} disabled={saving === s.id} className="h-8 w-8 p-0 bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514]">{saving === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-500 mb-3">
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-600 shrink-0" /><span>{s.address}{s.city && `, ${s.city}`}{s.state && `, ${s.state}`}</span></div>
                {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-600 shrink-0" /><span>{s.phone}</span></div>}
                {s.email && <p className="truncate">{s.email}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                {s.is_active ? <button onClick={() => handleSetPending(s.id)} title="Pending" className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-yellow-400"><PauseCircle className="w-4 h-4" /></button> : <button onClick={() => handleReactivate(s.id)} title="Activate" className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-emerald-400"><PlayCircle className="w-4 h-4" /></button>}
                <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {totalCount > pageSize && <div className="flex justify-between bg-[#150f24] border border-white/10 rounded-xl px-4 py-3"><span className="text-sm text-gray-500">{totalCount} total</span><div className="flex gap-2"><button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><span className="text-sm text-gray-400">Page {page + 1} of {totalPages || 1}</span><button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div></div>}
      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between p-5 border-b border-white/10"><h3 className="text-lg font-semibold text-white">{editingStore ? 'Edit' : 'Add'} Store</h3><button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-5 space-y-4">
          <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div>
          <div className="grid grid-cols-3 gap-3"><div><label className="block text-sm text-gray-400 mb-1.5">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div><div><label className="block text-sm text-gray-400 mb-1.5">State</label><input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div><div><label className="block text-sm text-gray-400 mb-1.5">ZIP</label><input type="text" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm text-gray-400 mb-1.5">Lat</label><input type="text" value={formData.lat} onChange={(e) => setFormData({ ...formData, lat: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div><div><label className="block text-sm text-gray-400 mb-1.5">Lng</label><input type="text" value={formData.lng} onChange={(e) => setFormData({ ...formData, lng: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm text-gray-400 mb-1.5">Phone</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div><div><label className="block text-sm text-gray-400 mb-1.5">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white" /></div></div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-white/10"><button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button><button onClick={handleSave} disabled={!formData.name || !formData.address} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white disabled:opacity-50">{editingStore ? 'Update' : 'Create'}</button></div>
      </div></div>}
    </div>
  )
}
