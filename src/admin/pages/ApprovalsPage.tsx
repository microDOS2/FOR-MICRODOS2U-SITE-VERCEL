import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, MapPin, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ApprovedApp {
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
}

const typeBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-400',
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovedApp[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApprovals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch: ' + error.message)
    } else {
      setApprovals((data || []) as ApprovedApp[])
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
                  key={app.id}
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
                        // Navigate to assignments page
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
