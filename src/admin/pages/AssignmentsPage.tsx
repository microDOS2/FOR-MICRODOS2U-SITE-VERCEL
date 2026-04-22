import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Loader2, Check, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { DBUser } from '@/lib/supabase'

interface ApprovedAccount {
  id: string
  business_name: string
  email: string
  phone: string | null
  role: string
  city: string | null
  state: string | null
  status: string
}

interface RepAssignment {
  id: string
  rep_id: string
  account_id: string
  assigned_by: string | null
  assigned_at: string
  rep?: DBUser | null
}

const roleBadgeClasses: Record<string, string> = {
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-400',
}

export function AssignmentsPage() {
  const [accounts, setAccounts] = useState<ApprovedAccount[]>([])
  const [salesReps, setSalesReps] = useState<DBUser[]>([])
  const [assignments, setAssignments] = useState<RepAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRep, setSelectedRep] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const fetchAll = async () => {
    setLoading(true)

    // 1. Fetch approved business accounts (wholesaler/distributor/influencer)
    const { data: accountsData } = await supabase
      .from('users')
      .select('id, business_name, email, phone, role, city, state, status')
      .eq('status', 'approved')
      .in('role', ['wholesaler', 'distributor', 'influencer'])
      .order('business_name', { ascending: true })

    // 2. Fetch all Sales Reps
    const { data: repsData } = await supabase
      .from('users')
      .select('id, full_name, business_name, email, city, state')
      .eq('role', 'sales_rep')
      .eq('status', 'approved')
      .order('business_name', { ascending: true })

    // 3. Fetch existing assignments
    const { data: assignData } = await supabase
      .rpc('get_rep_assignments')

    setAccounts((accountsData || []) as ApprovedAccount[])
    setSalesReps((repsData || []) as unknown as DBUser[])
    setAssignments((assignData || []) as RepAssignment[])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const getAssignedRep = (accountId: string): string | null => {
    const a = assignments.find((x) => x.account_id === accountId)
    return a?.rep_id || null
  }

  const getRepName = (repId: string): string => {
    const r = salesReps.find((x) => x.id === repId)
    return r?.business_name || r?.email || 'Unknown'
  }

  const handleAssign = async (accountId: string) => {
    const repId = selectedRep[accountId]
    if (!repId) {
      toast.error('Select a Sales Rep first')
      return
    }

    setSaving(accountId)
    const { error } = await supabase.rpc('insert_rep_assignment', {
      p_rep_id: repId,
      p_account_id: accountId,
    })

    if (error) {
      toast.error('Failed to assign: ' + error.message)
    } else {
      toast.success('Sales Rep assigned!')
      await fetchAll()
    }
    setSaving(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Account Assignments</h2>
        <p className="text-gray-400">Assign business accounts to Sales Reps</p>
      </div>

      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#9a02d0]" />
            Approved Business Accounts ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No business accounts</p>
              <p className="text-sm">Approve applications first</p>
            </div>
          ) : salesReps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-medium text-gray-400">No Sales Reps</p>
              <p className="text-sm">Create Sales Rep users in User Management first</p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((acct) => {
                const currentRep = getAssignedRep(acct.id)

                return (
                  <div
                    key={acct.id}
                    className="p-4 bg-[#0a0514] rounded-lg border border-white/10"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-white font-medium">{acct.business_name}</h4>
                          <Badge className={roleBadgeClasses[acct.role] || 'bg-gray-500/20 text-gray-400'}>
                            {acct.role}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm">
                          {acct.email}
                          {acct.city && acct.state ? ` • ${acct.city}, ${acct.state}` : ''}
                        </p>
                        {currentRep && (
                          <p className="text-sm text-[#44f80c] mt-1">
                            Assigned to: {getRepName(currentRep)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedRep[acct.id] || currentRep || ''}
                          onValueChange={(val) =>
                            setSelectedRep((prev) => ({ ...prev, [acct.id]: val }))
                          }
                        >
                          <SelectTrigger className="w-48 bg-[#0a0514] border-white/10 text-white text-sm">
                            <SelectValue placeholder="Select Sales Rep" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#150f24] border-white/10">
                            {salesReps.map((rep) => (
                              <SelectItem key={rep.id} value={rep.id}>
                                {rep.business_name || rep.email}
                                {rep.city && rep.state ? ` — ${rep.city}, ${rep.state}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => handleAssign(acct.id)}
                          disabled={saving === acct.id}
                          className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white"
                        >
                          {saving === acct.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
