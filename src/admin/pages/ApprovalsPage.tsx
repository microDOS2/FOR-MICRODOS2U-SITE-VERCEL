import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, MapPin, Globe, Loader2 } from 'lucide-react'
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
}

const typeBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-400',
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovedAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      // Fetch from applications table
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })

      if (appError) {
        toast.error('Failed to fetch applications: ' + appError.message)
      }

      // Fetch from users table (accounts created without applications)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'approved')
        .in('role', ['wholesaler', 'distributor'])
        .order('updated_at', { ascending: false })

      if (userError) {
        toast.error('Failed to fetch users: ' + userError.message)
      }

      // Transform applications
      const fromApps: ApprovedAccount[] = (appData || []).map((a: any) => ({
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
      }))

      // Transform users — only add ones NOT already in applications
      const appEmails = new Set(fromApps.map((a) => a.email.toLowerCase()))
      const fromUsers: ApprovedAccount[] = (userData || [])
        .filter((u: any) => !appEmails.has(u.email.toLowerCase()))
        .map((u: any) => ({
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
        }))

      // Merge and sort by reviewed_at descending
      const merged = [...fromApps, ...fromUsers].sort((a, b) => {
        return new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
      })

      setApprovals(merged)
    } catch (err: any) {
      toast.error('Failed to fetch approvals: ' + err.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchApprovals()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Approved Applications</h2>
        <p className="text-gray-400">All approved business accounts ({approvals.length})</p>
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
              <p className="text-sm">Approved applications will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map((app) => (
                <div
                  key={`${app.source}-${app.id}`}
                  className="p-4 bg-[#0a0514] rounded-lg border border-white/10"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-white font-medium">{app.business_name}</h4>
                        <Badge className={typeBadgeClasses[app.account_type] || 'bg-gray-500/20 text-gray-400'}>
                          {app.account_type}
                        </Badge>
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
                          <a
                            href={app.website.startsWith('http') ? app.website : `https://${app.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#44f80c] hover:underline flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3" />
                            Website
                          </a>
                        )}
                        {app.license_number && (
                          <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs">
                            License: {app.license_number}
                          </Badge>
                        )}
                        {app.ein && (
                          <Badge className="bg-gray-700 text-gray-400 text-xs">
                            EIN/TaxID: {app.ein}
                          </Badge>
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
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.location.hash = '/admin/assignments'
                      }}
                      className="border-[#9a02d0]/30 text-[#9a02d0] hover:bg-[#9a02d0]/10"
                    >
                      Assign Rep
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
