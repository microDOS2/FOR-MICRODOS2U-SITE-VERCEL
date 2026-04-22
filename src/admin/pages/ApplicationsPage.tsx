import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Store, Check, X, Loader2, Clock, Globe, MapPin, Key, Copy, CheckCheck, Mail } from 'lucide-react'
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
  account_type: 'wholesaler' | 'distributor' | 'influencer'
  business_type: string | null
  volume_estimate: string | null
  status: 'pending' | 'approved' | 'rejected' | 'more_info_needed'
  admin_notes: string | null
  submitted_at: string
}

const typeLabels: Record<string, string> = {
  wholesaler: 'Wholesaler',
  distributor: 'Distributor',
  influencer: 'Influencer',
}

const typeBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-400',
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let pwd = ''
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pwd
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Approval modal state
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approvedApp, setApprovedApp] = useState<Application | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

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

  // FULL approval: creates auth user + users table row + links application
  const handleApprove = async (app: Application) => {
    setActionLoading(app.id + '-approve')

    const password = generatePassword()

    try {
      // 1. Create auth user via Edge Function (NO welcome email sent)
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-auth-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: app.email,
          password,
          business_name: app.business_name,
          role: app.account_type,
        }),
      })

      let userId: string

      if (resp.ok) {
        const result = await resp.json()
        userId = result.user.id
      } else {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
        toast.error('Auth error: ' + (err.error || resp.statusText))
        setActionLoading(null)
        return
      }

      // 2. Insert into users table via RPC (bypasses RLS)
      const { error: userError } = await supabase.rpc('insert_user', {
        p_id: userId,
        p_email: app.email,
        p_business_name: app.business_name,
        p_role: app.account_type,
        p_status: 'approved',
        p_phone: app.phone,
        p_address: app.address,
        p_city: app.city,
        p_state: app.state,
        p_zip: app.zip,
        p_license_number: app.license_number,
        p_ein: app.ein,
        p_website: app.website,
        p_volume_estimate: app.volume_estimate,
      })

      if (userError) {
        toast.error('Failed to create user profile: ' + userError.message)
        setActionLoading(null)
        return
      }

      // 3. Update application via RPC (bypasses RLS)
      const { error: appError } = await supabase.rpc('update_application_status', {
        p_id: app.id,
        p_status: 'approved',
        p_auth_user_id: userId,
      })

      if (appError) {
        toast.error('Failed to update application: ' + appError.message)
        setActionLoading(null)
        return
      }

      // 4. Show success + password modal
      toast.success(`${app.business_name} approved! Account created.`)
      setGeneratedPassword(password)
      setApprovedApp(app)
      setShowApproveModal(true)

      await fetchApplications()
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed')
    }

    setActionLoading(null)
  }

  const handleReject = async (appId: string) => {
    setActionLoading(appId + '-reject')
    const { error } = await supabase.rpc('update_application_status', {
      p_id: appId,
      p_status: 'rejected',
    })
    if (error) {
      toast.error('Failed to reject: ' + error.message)
    } else {
      toast.success('Application rejected')
      await fetchApplications()
    }
    setActionLoading(null)
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
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
                          Business License #: {app.license_number}
                        </Badge>
                      )}
                      {app.ein && (
                        <Badge className="bg-gray-700 text-gray-400 text-xs">
                          EIN/TaxID #: {app.ein}
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
                      onClick={() => handleApprove(app)}
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

      {/* Approval Success Modal - Shows generated credentials */}
      {showApproveModal && approvedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-[#44f80c]/30 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <CheckCheck className="w-5 h-5 text-[#44f80c]" />
                <h3 className="text-lg font-semibold text-white">Account Created</h3>
              </div>
              <p className="text-gray-400 text-sm">
                {approvedApp.business_name} has been approved and their account is ready.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* No email sent notice */}
              <div className="bg-[#44f80c]/10 border border-[#44f80c]/20 rounded-lg p-3 flex items-center gap-3">
                <Mail className="w-5 h-5 text-[#44f80c]" />
                <p className="text-sm text-[#44f80c]">
                  Account created for {approvedApp.email}. No welcome email sent — share the password below with the user.
                </p>
              </div>

              {/* Portal info */}
              <div className="text-sm text-gray-400">
                <p>Portal access:</p>
                <p className="text-white font-medium">
                  {approvedApp.account_type === 'wholesaler' && '/wholesaler-portal'}
                  {approvedApp.account_type === 'distributor' && '/distributor-portal'}
                  {approvedApp.account_type === 'influencer' && '/influencer-portal'}
                </p>
              </div>

              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email (Username)</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white font-mono">
                    {approvedApp.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(approvedApp.email, 'email')}
                    className="px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Copy email"
                  >
                    {copiedField === 'email' ? (
                      <CheckCheck className="w-4 h-4 text-[#44f80c]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  <Key className="w-3.5 h-3.5 inline mr-1" />
                  Generated Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 bg-[#0a0514] border border-[#9a02d0]/30 rounded-lg text-sm text-white font-mono">
                    {generatedPassword}
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedPassword, 'password')}
                    className="px-3 py-2.5 bg-[#0a0514] border border-[#9a02d0]/30 rounded-lg text-[#9a02d0] hover:bg-[#9a02d0]/10 transition-colors"
                    title="Copy password"
                  >
                    {copiedField === 'password' ? (
                      <CheckCheck className="w-4 h-4 text-[#44f80c]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Share this password with the business owner. They can change it after logging in.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setApprovedApp(null)
                  setGeneratedPassword('')
                }}
                className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
