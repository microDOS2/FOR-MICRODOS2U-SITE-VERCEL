import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Store, Check, X, Loader2, Clock, Globe, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface Application {
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
  account_type: 'wholesaler' | 'distributor'
  business_type: string | null
  volume_estimate: string | null
  status: 'pending' | 'approved' | 'rejected' | 'more_info_needed'
  admin_notes: string | null
  submitted_at: string
}

const typeLabels: Record<string, string> = {
  wholesaler: 'Wholesaler',
  distributor: 'Distributor',
}

const typeBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch applications: ' + error.message)
    } else {
      setApplications((data || []) as Application[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const handleApprove = async (appId: string) => {
    setActionLoading(appId + '-approve')
    const { error } = await supabase
      .from('applications')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', appId)
    if (error) {
      toast.error('Failed to approve: ' + error.message)
    } else {
      toast.success('Application approved successfully')
      await fetchApplications()
    }
    setActionLoading(null)
  }

  const handleReject = async (appId: string) => {
    setActionLoading(appId + '-reject')
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', appId)
    if (error) {
      toast.error('Failed to reject: ' + error.message)
    } else {
      toast.success('Application rejected')
      await fetchApplications()
    }
    setActionLoading(null)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Pending Applications</h2>
        <p className="text-gray-400">Review and approve pending account applications</p>
      </div>

      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-[#9a02d0]" />
            Applications ({applications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No pending applications</p>
              <p className="text-sm">All applications have been reviewed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#0a0514] rounded-lg border border-white/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-white font-medium">{app.business_name}</h4>
                      <Badge className={typeBadgeClasses[app.account_type] || 'bg-gray-500/20 text-gray-400'}>
                        {typeLabels[app.account_type] || app.account_type}
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
                      {app.phone && (
                        <span className="text-gray-400">{app.phone}</span>
                      )}
                      {app.website && (
                        <a
                          href={app.website.startsWith('http') ? app.website : `https://${app.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#44f80c] hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
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
                          EIN: {app.ein}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-gray-500">
                      {app.business_type && <span>{app.business_type}</span>}
                      {app.volume_estimate && <span>• {app.volume_estimate}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Applied {formatDate(app.submitted_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(app.id)}
                      disabled={actionLoading === app.id + '-approve'}
                      className="bg-[#44f80c]/20 text-[#44f80c] hover:bg-[#44f80c]/30"
                    >
                      {actionLoading === app.id + '-approve' ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(app.id)}
                      disabled={actionLoading === app.id + '-reject'}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      {actionLoading === app.id + '-reject' ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <X className="w-3 h-3 mr-1" />
                      )}
                      Reject
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
