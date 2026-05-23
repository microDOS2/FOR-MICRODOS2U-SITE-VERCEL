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

interface ManagerInfo {
  name: string
  email: string | null
  phone: string | null
}

export function SalesRepStores() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<StoreData[]>([])
  const [myManager, setMyManager] = useState<ManagerInfo | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    const { data: me } = await supabase.from('users').select('role,also_rep,manager_id').eq('id', repId).single()
    if (me?.role !== 'sales_rep' && !(me?.role === 'sales_manager' && me?.also_rep)) {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // Fetch MY manager (the sales manager I report to)
    let myManagerInfo: ManagerInfo | null = null
    if (me?.manager_id) {
      const { data: mgrData } = await supabase
        .from('users')
        .select('business_name,email,phone')
        .eq('id', me.manager_id)
        .single()
      if (mgrData) {
        myManagerInfo = {
          name: mgrData.business_name || mgrData.email || 'Your Manager',
          email: mgrData.email || null,
          phone: mgrData.phone || null,
        }
        setMyManager(myManagerInfo)
      }
    }

    // Get stores for this rep by deriving from assigned accounts
    // Account → Stores (store name prefix matches account referral_code)
    let storeList: any[] = []

    // Step 1: Get account assignments
    const { data: assignmentsData } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', repId)

    const accountIds = (assignmentsData || []).map((a: any) => a.account_id)

    if (accountIds.length > 0) {
      // Step 2: Get referral_codes for those accounts
      const { data: acctsData } = await supabase
        .from('users')
        .select('id, referral_code')
        .in('id', accountIds)

      const refCodes = (acctsData || []).map((a: any) => a.referral_code).filter(Boolean)

      if (refCodes.length > 0) {
        // Step 3: Get all stores whose name starts with any referral_code
        const { data: acctStores } = await supabase
          .from('wholesaler_store_locations')
          .select('id, name, address, city, state, license_number, user_id')
          .order('name', { ascending: true })

        storeList = (acctStores || []).filter((s: any) => {
          const namePrefix = (s.name || '').match(/^(\d+[a-z])/)?.[1]
          if (!namePrefix) return false
          const acctNum = namePrefix.replace(/[a-z]$/, '')
          return refCodes.includes(acctNum)
        })
      }
    }

    // Step 4: Look up account details for the stores
    const storeAccountIds = storeList.map((s: any) => s.user_id).filter(Boolean)
    const { data: accountsData } = storeAccountIds.length > 0
      ? await supabase.from('users').select('id,business_name,email,phone,manager_id').in('id', storeAccountIds)
      : { data: [] }
    const accountMap = new Map((accountsData || []).map((a: any) => [a.id, a]))

    const storesWithAccounts: StoreData[] = storeList.map((s: any) => {
      const acct = accountMap.get(s.user_id)
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city || '',
        state: s.state || '',
        license_number: s.license_number,
        account_name: acct?.business_name || 'Unknown',
        account_email: acct?.email || null,
        account_phone: acct?.phone || null,
        manager_name: myManagerInfo?.name || 'Unassigned',
        manager_email: myManagerInfo?.email || null,
        manager_phone: myManagerInfo?.phone || null,
        manager_city: null,
        manager_state: null,
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

          {/* My Sales Manager */}
          {myManager && (
            <Card className="bg-gradient-to-r from-[#9a02d0]/10 to-[#150f24] border-[#9a02d0]/20">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#9a02d0]/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">My Sales Manager</p>
                    <p className="text-white font-medium">{myManager.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {myManager.email && (
                      <a href={`mailto:${myManager.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0514] border border-white/10 text-xs text-[#9a02d0] hover:text-[#ff66c4] hover:border-[#9a02d0]/30 transition-colors">
                        <Mail className="w-3.5 h-3.5" /> {myManager.email}
                      </a>
                    )}
                    {myManager.phone && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0514] border border-white/10 text-xs text-gray-300">
                        <Phone className="w-3.5 h-3.5" /> {myManager.phone}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
