import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Store, Loader2, Check, UserPlus, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface StoreItem {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  user_id: string
  store_number: string
  account_number: string
  owner_name: string
  owner_role: string
  assigned_rep_id: string | null
  assigned_rep_name: string | null
}

interface SalesRep {
  id: string
  business_name: string | null
  email: string
  city: string | null
  state: string | null
}

const roleBadge: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
}

export function AssignmentsPage() {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRep, setSelectedRep] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // 1. Fetch all approved accounts with their numbers
    const { data: usersData } = await supabase
      .from('users')
      .select('id, business_name, email, role, referral_code, city, state')
      .eq('status', 'approved')
      .in('role', ['wholesaler', 'distributor'])

    // 2. Fetch all stores
    const { data: storesData } = await supabase
      .from('wholesaler_store_locations')
      .select('*')
      .order('name', { ascending: true })

    // 3. Fetch sales reps
    const { data: repsData } = await supabase
      .from('users')
      .select('id, business_name, email, city, state')
      .eq('role', 'sales_rep')
      .eq('status', 'approved')

    // 4. Fetch store-level assignments
    const { data: assignData } = await supabase
      .from('store_assignments')
      .select('store_id, rep_id')

    // Build lookup maps
    const userMap = new Map()
    ;(usersData || []).forEach((u: any) => userMap.set(u.id, u))

    const repMap = new Map()
    ;(repsData || []).forEach((r: any) => repMap.set(r.id, r))

    const assignmentMap = new Map()
    ;(assignData || []).forEach((a: any) => assignmentMap.set(a.store_id, a.rep_id))

    // Build store items
    const storeItems: StoreItem[] = (storesData || []).map((s: any) => {
      const owner = userMap.get(s.user_id) || {}
      const assignedRepId = assignmentMap.get(s.id)
      const assignedRep = assignedRepId ? repMap.get(assignedRepId) : null
      const m = s.name?.match(/^(\d+[a-z])\s*-\s*/)
      return {
        id: s.id,
        name: m ? s.name.replace(m[0], '') : s.name,
        address: s.address || '',
        city: s.city || '',
        state: s.state || '',
        zip: s.zip || '',
        user_id: s.user_id,
        store_number: m ? m[1] : '',
        account_number: owner.referral_code || '',
        owner_name: owner.business_name || owner.email || 'Unknown',
        owner_role: owner.role || '',
        assigned_rep_id: assignedRepId || null,
        assigned_rep_name: assignedRep ? (assignedRep.business_name || assignedRep.email) : null,
      }
    })

    setStores(storeItems)
    setReps((repsData || []).map((r: any) => ({
      id: r.id,
      business_name: r.business_name,
      email: r.email,
      city: r.city,
      state: r.state,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAssign = async (storeId: string) => {
    const repId = selectedRep[storeId]
    if (!repId) { toast.error('Select a Sales Rep first'); return }

    setSaving(storeId)

    // Upsert assignment (insert or replace)
    const { error: delError } = await supabase
      .from('store_assignments')
      .delete()
      .eq('store_id', storeId)

    if (delError) console.error('Delete error:', delError)

    const { error: insError } = await supabase
      .from('store_assignments')
      .insert([{ store_id: storeId, rep_id: repId }])

    if (insError) {
      toast.error('Failed to assign: ' + insError.message)
    } else {
      toast.success('Rep assigned to store!')
      await fetchAll()
    }
    setSaving(null)
  }

  const handleUnassign = async (storeId: string) => {
    if (!confirm('Remove rep assignment from this store?')) return
    const { error } = await supabase.from('store_assignments').delete().eq('store_id', storeId)
    if (error) { toast.error('Error: ' + error.message) } else { toast.success('Unassigned'); fetchAll() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Store Assignments</h2>
        <p className="text-gray-400">Assign a Sales Rep to each store location</p>
      </div>

      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-[#9a02d0]" />
            Stores ({stores.length}) — {stores.filter((s) => s.assigned_rep_id).length} assigned, {stores.filter((s) => !s.assigned_rep_id).length} unassigned
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" /></div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No stores found</p>
              <p className="text-sm">Add stores in the Stores page first</p>
            </div>
          ) : reps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No Sales Reps</p>
              <p className="text-sm">Create Sales Rep accounts in User Management first</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => (
                <div key={store.id} className="p-4 bg-[#0a0514] rounded-lg border border-white/10">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono bg-[#ff66c4]/20 text-[#ff66c4] px-2 py-0.5 rounded">{store.store_number}</span>
                        <h4 className="text-white font-medium">{store.name}</h4>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase', roleBadge[store.owner_role] || 'bg-gray-500/20 text-gray-400')}>{store.owner_role}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <MapPin className="w-3 h-3 text-gray-600" />
                        <span>{store.address}{store.city&&`, ${store.city}`}{store.state&&`, ${store.state}`}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-1.5 py-0.5 rounded">Acct #{store.account_number}</span>
                        <span>{store.owner_name}</span>
                      </div>
                      {store.assigned_rep_name ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-[#44f80c]/20 text-[#44f80c]">Assigned to: {store.assigned_rep_name}</Badge>
                          <button onClick={() => handleUnassign(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                        </div>
                      ) : (
                        <Badge className="bg-gray-700 text-gray-400 mt-2">Unassigned</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                      <Select
                        value={selectedRep[store.id] || store.assigned_rep_id || ''}
                        onValueChange={(val) => setSelectedRep((prev) => ({ ...prev, [store.id]: val }))}
                      >
                        <SelectTrigger className="w-56 bg-[#0a0514] border-white/10 text-white text-sm">
                          <SelectValue placeholder="Select Sales Rep" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#150f24] border-white/10">
                          {reps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.id}>
                              {rep.business_name || rep.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => handleAssign(store.id)}
                        disabled={saving === store.id}
                        className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white"
                      >
                        {saving === store.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
