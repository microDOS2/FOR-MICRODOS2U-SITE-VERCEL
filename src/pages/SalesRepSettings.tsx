import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Users,
  Store,
  Clock,
  FileText,
} from 'lucide-react'

interface RepProfile {
  id: string
  business_name: string | null
  email: string
  phone: string | null
  role: string
  created_at: string
  manager_name: string | null
  manager_email: string | null
  manager_phone: string | null
  manager_city: string | null
  manager_state: string | null
  accounts_count: number
  stores_count: number
  territory_states: string[]
}

export function SalesRepSettings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<RepProfile | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please log in first')
      navigate('/sales-rep-portal')
      return
    }
    const repId = session.user.id

    // Get my profile
    const { data: me } = await supabase
      .from('users')
      .select('id, business_name, email, phone, role, manager_id, created_at')
      .eq('id', repId)
      .single()

    if (!me || me.role !== 'sales_rep') {
      toast.error('Access denied')
      navigate('/')
      return
    }

    // Get my manager via RPC (bypasses RLS)
    let managerName = 'Unassigned'
    let managerEmail = ''
    let managerPhone: string | null = null
    let managerCity: string | null = null
    let managerState: string | null = null
    const { data: mgrJson } = await supabase
      .rpc('get_my_manager', { p_rep_id: repId })
    if (mgrJson) {
      managerName = mgrJson.manager_name || mgrJson.manager_email || 'Unknown'
      managerEmail = mgrJson.manager_email || ''
      managerPhone = mgrJson.manager_phone || null
      managerCity = mgrJson.manager_city || null
      managerState = mgrJson.manager_state || null
    }

    // Count accounts
    const { count: acctCount } = await supabase
      .from('rep_account_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', repId)

    // Count stores
    const { count: storeCount } = await supabase
      .from('wholesaler_store_locations')
      .select('*', { count: 'exact', head: true })
      .ilike('license_number', `rep:${repId}%`)

    // Get manager states
    const { data: stateData } = await supabase
      .from('manager_state_assignments')
      .select('state_code')
      .eq('manager_id', me.manager_id)

    setProfile({
      id: me.id,
      business_name: me.business_name,
      email: me.email,
      phone: me.phone,
      role: me.role,
      created_at: me.created_at,
      manager_name: managerName,
      manager_email: managerEmail,
      manager_phone: managerPhone,
      manager_city: managerCity,
      manager_state: managerState,
      accounts_count: acctCount || 0,
      stores_count: storeCount || 0,
      territory_states: (stateData || []).map((s: any) => s.state_code),
    })
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading profile...</div>
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center text-gray-400">
          Profile not found
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Profile & Settings</h1>
            <p className="text-gray-400 text-sm">Your account information and assignment summary</p>
          </div>

          {/* Profile Card */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-[#9a02d0]" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Business Name
                  </p>
                  <p className="text-white font-medium">{profile.business_name || 'Not set'}</p>
                </div>
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="text-white font-medium">{profile.email}</p>
                </div>
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </p>
                  <p className="text-white font-medium">{profile.phone || 'Not provided'}</p>
                </div>
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Member Since
                  </p>
                  <p className="text-white font-medium">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manager Card */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#44f80c]" />
                Your Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{profile.manager_name}</p>
                    {profile.manager_email && (
                      <a href={`mailto:${profile.manager_email}`} className="text-xs text-[#9a02d0] hover:text-[#ff66c4] underline">{profile.manager_email}</a>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-[10px]">Sales Manager</Badge>
                      {(profile.manager_city || profile.manager_state) && (
                        <span className="text-xs text-gray-500">
                          {profile.manager_city || '—'}, {profile.manager_state || '—'}
                        </span>
                      )}
                    </div>
                    {profile.manager_phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-400">{profile.manager_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                {profile.territory_states.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Manager's Territory
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.territory_states.map(state => (
                        <Badge key={state} className="bg-[#9a02d0]/20 text-[#9a02d0] text-[10px]">
                          {state}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assignment Summary */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#ff66c4]" />
                Assignment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5 text-center">
                  <Users className="w-6 h-6 text-[#44f80c] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{profile.accounts_count}</p>
                  <p className="text-xs text-gray-400">Account Rep assignments</p>
                </div>
                <div className="bg-[#0a0514] rounded-lg p-4 border border-white/5 text-center">
                  <Store className="w-6 h-6 text-[#9a02d0] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{profile.stores_count}</p>
                  <p className="text-xs text-gray-400">Store Rep assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note */}
          <div className="bg-yellow-500/5 border border-yellow-400/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-400/80">
                <strong>Need changes?</strong> Contact your sales manager to update assignments or profile information. Reps cannot self-assign accounts or stores.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
