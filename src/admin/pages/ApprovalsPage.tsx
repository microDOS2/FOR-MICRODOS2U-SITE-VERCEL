import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, MapPin, Globe, Loader2, Users, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface ApprovedAccount {
  id: string
  business_name: string
  contact_name: string | null
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  license_number: string | null
  ein: string | null
  website: string | null
  account_type: string
  business_type: string | null
  volume_estimate: string | null
  reviewed_at: string
  submitted_at: string
  auth_user_id: string | null
  source: 'applications' | 'users'
  account_number: string
  assigned_rep_name: string | null
  assigned_rep_id: string | null
  manager_name: string | null
}

const typeBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-400',
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [repHasManager, setRepHasManager] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    async function fetchApprovals() {
      setLoading(true)
      try {
        // Fetch applications
        const { data: appData } = await supabase
          .from('applications')
          .select('*')
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false })

        // Fetch users (accounts without applications)
        const { data: userData } = await supabase
          .from('users')
          .select('*, manager_id')
          .eq('status', 'approved')
          .in('role', ['wholesaler', 'distributor'])
          .order('updated_at', { ascending: false })

        // Fetch sales managers for name lookup
        const { data: managersData } = await supabase
          .from('users')
          .select('id, business_name, email')
          .eq('role', 'sales_manager')
          .eq('status', 'approved')

        const managerMap = new Map()
        ;(managersData || []).forEach((m: any) => managerMap.set(m.id, m))

        // Fetch account-level assignments
        const { data: assignData } = await supabase
          .from('rep_account_assignments')
          .select('account_id, rep_id')

        // Fetch sales reps for name lookup + manager check
        const { data: repsData } = await supabase
          .from('users')
          .select('id, business_name, email, manager_id')
          .eq('role', 'sales_rep')
          .eq('status', 'approved')

        // Build rep lookup
        const repMap = new Map()
        ;(repsData || []).forEach((r: any) => repMap.set(r.id, r))

        // Build repHasManager lookup
        const managerCheckMap = new Map<string, boolean>()
        ;(repsData || []).forEach((r: any) => managerCheckMap.set(r.id, !!r.manager_id))
        setRepHasManager(managerCheckMap)

        // Build assignment lookup
        const assignMap = new Map()
        ;(assignData || []).forEach((a: any) => assignMap.set(a.account_id, a.rep_id))

        // Build user lookup for account numbers
        const userMap = new Map()
        ;(userData || []).forEach((u: any) => userMap.set(u.id, u))

        const fromApps: ApprovedAccount[] = (appData || []).map((a: any) => {
          const user = userMap.get(a.auth_user_id)
          const repId = assignMap.get(a.auth_user_id || a.id)
          const rep = repId ? repMap.get(repId) : null
          return {
            id: a.id,
            business_name: a.business_name,
            contact_name: a.contact_name,
            email: a.email,
            phone: a.phone,
            address: a.address,
            city: a.city,
            state: a.state,
            zip: a.zip,
            license_number: a.license_number,
            ein: a.ein,
            website: a.website,
            account_type: a.account_type,
            business_type: a.business_type,
            volume_estimate: a.volume_estimate,
            reviewed_at: a.reviewed_at || a.submitted_at,
            submitted_at: a.submitted_at,
            auth_user_id: a.auth_user_id,
            source: 'applications' as const,
            account_number: user?.referral_code || '',
            assigned_rep_id: repId || null,
            assigned_rep_name: rep ? (rep.business_name || rep.email) : null,
            manager_name: user?.manager_id ? (managerMap.get(user.manager_id)?.business_name || managerMap.get(user.manager_id)?.email || null) : null,
          }
        })

        const appIds = new Set((appData || []).map((a: any) => a.auth_user_id).filter(Boolean))
        const fromUsers: ApprovedAccount[] = (userData || [])
          .filter((u: any) => !appIds.has(u.id))
          .map((u: any) => {
            const repId = assignMap.get(u.id)
            const rep = repId ? repMap.get(repId) : null
            return {
              id: u.id,
              business_name: u.business_name,
              contact_name: u.business_name,
              email: u.email,
              phone: u.phone,
              address: u.address,
              city: u.city,
              state: u.state,
              zip: u.zip,
              license_number: u.license_number,
              ein: u.ein,
              website: u.website,
              account_type: u.role,
              business_type: null,
              volume_estimate: u.volume_estimate,
              reviewed_at: u.updated_at || u.created_at,
              submitted_at: u.created_at,
              auth_user_id: u.id,
              source: 'users' as const,
              account_number: u.referral_code || '',
              assigned_rep_id: repId || null,
              assigned_rep_name: rep ? (rep.business_name || rep.email) : null,
              manager_name: u.manager_id ? (managerMap.get(u.manager_id)?.business_name || managerMap.get(u.manager_id)?.email || null) : null,
            }
          })

        const merged = [...fromApps, ...fromUsers].sort((a, b) =>
          new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
        )
        setApprovals(merged)
      } catch (err: any) {
        toast.error('Failed to fetch approvals: ' + err.message)
      }
      setLoading(false)
    }
    fetchApprovals()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Approved Applications</h2>
        <p className="text-gray-400">{approvals.length} approved accounts</p>
      </div>

      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#44f80c]" />
            Approved Accounts ({approvals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No approved accounts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map((app) => (
                <div key={`${app.source}-${app.id}`} className="p-4 bg-[#0a0514] rounded-lg border border-white/10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-white font-medium">{app.business_name}</h4>
                        <Badge className={typeBadgeClasses[app.account_type] || 'bg-gray-500/20 text-gray-400'}>
                          {app.account_type}
                        </Badge>
                        {app.account_number && (
                          <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">
                            Acct #{app.account_number}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {app.contact_name} • {app.email}
                      </p>
                      <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {app.address || ''}
                          {app.city && app.state ? `, ${app.city}, ${app.state} ${app.zip || ''}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-sm">
                        {app.phone && <span className="text-gray-400">{app.phone}</span>}
                        {app.website && (
                          <a href={app.website.startsWith('http') ? app.website : `https://${app.website}`} target="_blank" rel="noopener noreferrer" className="text-[#44f80c] hover:underline flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Website
                          </a>
                        )}
                        {app.license_number && (
                          <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs">License: {app.license_number}</Badge>
                        )}
                        {app.ein && (
                          <Badge className="bg-gray-700 text-gray-400 text-xs">EIN/TaxID: {app.ein}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        {app.business_type && <span>{app.business_type}</span>}
                        {app.volume_estimate && <span>• {app.volume_estimate}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Approved {formatDate(app.reviewed_at || app.submitted_at)}
                        </span>
                      </div>

                      {/* Assignment Status */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {app.manager_name && (
                          <Badge className="bg-[#9a02d0]/20 text-[#9a02d0]">
                            <Users className="w-3 h-3 mr-1" />
                            Manager: {app.manager_name}
                          </Badge>
                        )}
                        {(() => {
                          const hasMgr = app.assigned_rep_id ? repHasManager.get(app.assigned_rep_id) : true
                          if (app.assigned_rep_name && hasMgr === false) {
                            return <Badge className="bg-yellow-500/20 text-yellow-400">⚠️ Unmanaged</Badge>
                          }
                          if (app.assigned_rep_name) {
                            return <Badge className="bg-[#44f80c]/20 text-[#44f80c]"><Users className="w-3 h-3 mr-1" />Rep: {app.assigned_rep_name}</Badge>
                          }
                          return <Badge className="bg-gray-700 text-gray-400">Unassigned</Badge>
                        })()}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { window.location.hash = '/admin/accounts' }}
                      className="border-[#9a02d0]/30 text-[#9a02d0] hover:bg-[#9a02d0]/10 shrink-0"
                    >
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
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
