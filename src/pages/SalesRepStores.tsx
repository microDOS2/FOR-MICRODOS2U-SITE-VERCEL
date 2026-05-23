import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Building2,
  Shield,
} from 'lucide-react'

interface StoreData {
  id: string
  name: string
  address: string | null
  city: string
  state: string
  license_number: string | null
  account_name: string
  account_email: string | null
  account_phone: string | null
  manager_name: string | null
  manager_email: string | null
  manager_phone: string | null
  manager_city: string | null
  manager_state: string | null
}

export function SalesRepStores() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<StoreData[]>([])

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    const { data: me } = await supabase.from('users').select('role,also_rep').eq('id', repId).single()
    if (me?.role !== 'sales_rep' && !(me?.role === 'sales_manager' && me?.also_rep)) {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // Get stores where this rep is the store rep
    const { data: storeData } = await supabase
      .from('wholesaler_store_locations')
      .select('id, name, address, city, state, license_number')
      .ilike('license_number', `rep:${repId}%`)
      .order('name', { ascending: true })

    const storeList = storeData || []
    if (storeList.length === 0) {
      setStores([])
      setLoading(false)
      return
    }

    // Parse account numbers from store names (e.g. "100a - Store Name" → "100")
    function parseStoreNumber(name: string): { number: string; cleanName: string } {
      const match = name.match(/^(\d+[a-z])\s*-\s*(.+)$/)
      if (match) {
        return { number: match[1], cleanName: match[2].trim() }
      }
      return { number: '', cleanName: name }
    }

    const acctNums = storeList.map((s: any) => {
      const { number } = parseStoreNumber(s.name || '')
      return number.replace(/[a-z]$/, '') // "100a" → "100"
    }).filter(Boolean)

    // Fetch all approved wholesalers/distributors to find account owners by referral_code
    const { data: accountsData } = await supabase
      .from('users')
      .select('id,referral_code,business_name,email,phone,manager_id')
      .eq('status', 'approved')
      .in('role', ['wholesaler', 'distributor'])

    // Build referral_code → account map
    const accountByRefCode = new Map<string, any>()
    ;(accountsData || []).forEach((a: any) => {
      if (a.referral_code) accountByRefCode.set(a.referral_code, a)
    })

    // Get manager details
    const managerIds = (accountsData || []).map((a: any) => a.manager_id).filter(Boolean)
    const { data: managersData } = managerIds.length > 0
      ? await supabase.from('users').select('id,business_name,email,phone,city,state').in('id', managerIds)
      : { data: [] }
    const managersMap = new Map((managersData || []).map((m: any) => [m.id, m]))

    const storesWithAccounts: StoreData[] = storeList.map((s: any) => {
      const acctNum = s.name.match(/^(\d+[a-z])/)?.[0]?.replace(/[a-z]$/, '') || ''
      const account = acctNum ? accountByRefCode.get(acctNum) : null
      const mgr = account?.manager_id ? managersMap.get(account.manager_id) : null

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city || '',
        state: s.state || '',
        license_number: s.license_number,
        account_name: account?.business_name || 'Unknown',
        account_email: account?.email || null,
        account_phone: account?.phone || null,
        manager_name: mgr?.business_name || 'Unassigned',
        manager_email: mgr?.email || null,
        manager_phone: mgr?.phone || null,
        manager_city: mgr?.city || null,
        manager_state: mgr?.state || null,
      }
    })

    setStores(storesWithAccounts)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading stores...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Stores</h1>
            <p className="text-gray-400 text-sm">
              {stores.length} store location{stores.length !== 1 ? 's' : ''} assigned to you as Store Rep
            </p>
          </div>

          {stores.length === 0 ? (
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="py-12 text-center">
                <Store className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No stores currently assigned</p>
                <p className="text-gray-500 text-sm mt-1">
                  Store assignments are managed by your manager through the admin portal.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stores.map(s => (
                <Card key={s.id} className="bg-[#150f24] border-white/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{s.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {s.city}, {s.state}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#0a0514] rounded-lg p-3 border border-white/5 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Account Owner</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#44f80c]" />
                        <span className="text-sm text-white">{s.account_name}</span>
                      </div>
                      {s.account_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <a href={`mailto:${s.account_email}`} className="text-xs text-[#9a02d0] hover:text-[#ff66c4] underline">{s.account_email}</a>
                        </div>
                      )}
                      {s.account_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs text-gray-400">{s.account_phone}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Account Manager</p>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#9a02d0]" />
                          <span className="text-sm text-white">{s.manager_name}</span>
                        </div>
                        {s.manager_email && (
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className="w-3.5 h-3.5 text-gray-500" />
                            <a href={`mailto:${s.manager_email}`} className="text-xs text-[#9a02d0] hover:text-[#ff66c4] underline">{s.manager_email}</a>
                          </div>
                        )}
                        {s.manager_phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <Phone className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-xs text-gray-400">{s.manager_phone}</span>
                          </div>
                        )}
                        {(s.manager_city || s.manager_state) && (
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-xs text-gray-400">{s.manager_city || '—'}, {s.manager_state || '—'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
