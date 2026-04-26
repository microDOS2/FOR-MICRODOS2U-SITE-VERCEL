import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Store,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccountData {
  id: string
  business_name: string
  email: string
  phone: string | null
  role: string
  city: string | null
  state: string | null
  address: string | null
  referral_code: string
  manager_id: string | null
  manager_name: string | null
  manager_city: string | null
  manager_state: string | null
  manager_email: string | null
  manager_phone: string | null
  stores: { id: string; name: string; city: string; state: string }[]
}

export function SalesRepAccounts() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    const { data: me } = await supabase.from('users').select('role').eq('id', repId).single()
    if (me?.role !== 'sales_rep') {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // Get account assignments
    const { data: assignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', repId)

    const accountIds = (assignments || []).map((a: any) => a.account_id)
    if (accountIds.length === 0) {
      setAccounts([])
      setLoading(false)
      return
    }

    // Get account details with manager names
    const { data: accountData } = await supabase
      .from('users')
      .select('id, business_name, email, phone, role, city, state, address, referral_code, manager_id')
      .in('id', accountIds)
      .order('business_name', { ascending: true })

    const { data: storesData } = await supabase
      .from('wholesaler_store_locations')
      .select('id, name, city, state, user_id')
      .in('user_id', accountIds)

    const storesByUser = new Map<string, { id: string; name: string; city: string; state: string }[]>()
    ;(storesData || []).forEach((s: any) => {
      const list = storesByUser.get(s.user_id) || []
      list.push({ id: s.id, name: s.name, city: s.city || '', state: s.state || '' })
      storesByUser.set(s.user_id, list)
    })

    const { data: managersData } = await supabase
      .from('users')
      .select('id, business_name, email, city, state, phone')
      .eq('role', 'sales_manager')

    const managerMap = new Map<string, { name: string; city: string | null; state: string | null; email: string | null; phone: string | null }>()
    ;(managersData || []).forEach((m: any) => {
      managerMap.set(m.id, {
        name: m.business_name || m.email || 'Unknown',
        city: m.city,
        state: m.state,
        email: m.email,
        phone: m.phone,
      })
    })

    const accts: AccountData[] = (accountData || []).map((u: any) => {
      const mgr = u.manager_id ? managerMap.get(u.manager_id) : null
      return {
        id: u.id,
        business_name: u.business_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        city: u.city,
        state: u.state,
        address: u.address,
        referral_code: u.referral_code || '',
        manager_id: u.manager_id || null,
        manager_name: mgr?.name || 'Unassigned',
        manager_city: mgr?.city || null,
        manager_state: mgr?.state || null,
        manager_email: mgr?.email || null,
        manager_phone: mgr?.phone || null,
        stores: storesByUser.get(u.id) || [],
      }
    })

    setAccounts(accts)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading accounts...</div>
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
            <h1 className="text-2xl font-bold text-white">My Accounts</h1>
            <p className="text-gray-400 text-sm">
              {accounts.length} wholesaler / distributor account{accounts.length !== 1 ? 's' : ''} assigned to you
            </p>
          </div>

          {accounts.length === 0 ? (
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No accounts currently assigned</p>
                <p className="text-gray-500 text-sm mt-1">
                  Your manager will assign accounts to you through the admin portal.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map(acct => (
                <Card key={acct.id} className="bg-[#150f24] border-white/10 overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{acct.business_name}</span>
                            <Badge className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full uppercase',
                              acct.role === 'distributor'
                                ? 'bg-[#ff66c4]/20 text-[#ff66c4]'
                                : 'bg-[#44f80c]/20 text-[#44f80c]'
                            )}>
                              {acct.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {acct.city || '—'}, {acct.state || '—'}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Manager: <a href={`mailto:${acct.manager_email || '#'}`} className="text-[#9a02d0] hover:text-[#ff66c4] underline">{acct.manager_name}</a>
                              {acct.manager_city && acct.manager_state && (
                                <span className="text-gray-500">({acct.manager_city}, {acct.manager_state})</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleExpand(acct.id)}
                        className="flex items-center gap-1 text-xs text-[#9a02d0] hover:text-[#ff66c4] transition-colors"
                      >
                        {expanded[acct.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {expanded[acct.id] ? 'Hide details' : 'View details'}
                      </button>
                    </div>

                    {expanded[acct.id] && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-[#0a0514] rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> Email
                            </p>
                            <p className="text-sm text-white">{acct.email}</p>
                          </div>
                          <div className="bg-[#0a0514] rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> Phone
                            </p>
                            <p className="text-sm text-white">{acct.phone || 'Not provided'}</p>
                          </div>
                        </div>

                        {acct.stores.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                              <Store className="w-3 h-3" /> Store Locations ({acct.stores.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {acct.stores.map(s => (
                                <div key={s.id} className="bg-[#0a0514] rounded-lg p-3 border border-white/5 flex items-center gap-2">
                                  <Store className="w-4 h-4 text-[#9a02d0]" />
                                  <div>
                                    <p className="text-sm text-white">{s.name}</p>
                                    <p className="text-xs text-gray-500">{s.city}, {s.state}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
