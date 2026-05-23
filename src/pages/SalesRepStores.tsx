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
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  account_manager_name: string
  account_manager_email: string | null
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

    const { data: me } = await supabase.from('users').select('role,also_rep,business_name,email').eq('id', repId).single()
    if (me?.role !== 'sales_rep' && !(me?.role === 'sales_manager' && me?.also_rep)) {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // Store rep name for display as Account Manager
    const repName = me?.business_name || me?.email || 'Your Rep'

    // Get stores where this rep is the store rep
    const { data: storeData } = await supabase
      .from('wholesaler_store_locations')
      .select('id, name, address, city, state, license_number, email, phone, contact_name')
      .ilike('license_number', `rep:${repId}%`)
      .order('name', { ascending: true })

    const storeList = storeData || []
    if (storeList.length === 0) {
      setStores([])
      setLoading(false)
      return
    }

    // Helper: extract name from email
    function nameFromEmail(email: string): string {
      if (!email || !email.includes('@')) return ''
      const local = email.split('@')[0]
      const parts = local.split('.')
      if (parts.length >= 2) {
        return parts[0][0].toUpperCase() + parts[0].slice(1) + ' ' + parts[1][0].toUpperCase() + parts[1].slice(1)
      }
      return local[0].toUpperCase() + local.slice(1)
    }

    const storesWithContact: StoreData[] = storeList.map((s: any) => {
      const emailName = nameFromEmail(s.email || '')
      const displayName = s.contact_name || emailName || s.email || 'Unknown'
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city || '',
        state: s.state || '',
        license_number: s.license_number,
        contact_name: displayName,
        contact_email: s.email || null,
        contact_phone: s.phone || null,
        account_manager_name: repName,
        account_manager_email: null,
      }
    })

    setStores(storesWithContact)
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
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Account Owner (Store Contact)</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#44f80c]" />
                        <span className="text-sm text-white">{s.contact_name}</span>
                      </div>
                      {s.contact_email && (
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <a href={`mailto:${s.contact_email}`} className="text-xs text-[#9a02d0] hover:text-[#ff66c4] underline">{s.contact_email}</a>
                        </div>
                      )}
                      {s.contact_phone && (
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs text-gray-400">{s.contact_phone}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Account Manager (Your Rep)</p>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#9a02d0]" />
                          <span className="text-sm text-white">{s.account_manager_name}</span>
                        </div>
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
