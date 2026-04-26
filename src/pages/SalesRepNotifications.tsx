import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { UserInfoBar } from '@/components/UserInfoBar'
import { toast } from 'sonner'
import {
  Bell,
  Users,
  ArrowRightLeft,
  Check,
  X,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  type: 'assignment' | 'transfer' | 'removal' | 'info'
  message: string
  created_at: string
  read: boolean
  account_name?: string
  store_name?: string
  manager_name?: string
  status?: string
}

export function SalesRepNotifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

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

    const items: NotificationItem[] = []

    // 1. Active account assignments
    const { data: acctAssignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id, created_at')
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })

    if (acctAssignments && acctAssignments.length > 0) {
      const accountIds = acctAssignments.map((a: any) => a.account_id)
      const { data: accountData } = await supabase
        .from('users')
        .select('id, business_name')
        .in('id', accountIds)

      const nameMap = new Map<string, string>()
      ;(accountData || []).forEach((a: any) => nameMap.set(a.id, a.business_name))

      acctAssignments.forEach((a: any) => {
        items.push({
          id: `acct-${a.account_id}`,
          type: 'assignment',
          message: `You were assigned as Account Rep to ${nameMap.get(a.account_id) || 'an account'}`,
          created_at: a.created_at,
          read: true,
          account_name: nameMap.get(a.account_id),
        })
      })
    }

    // 2. Store assignments
    const { data: storeAssignments } = await supabase
      .from('wholesaler_store_locations')
      .select('id, name, created_at')
      .ilike('license_number', `rep:${repId}%`)
      .order('created_at', { ascending: false })

    ;(storeAssignments || []).forEach((s: any) => {
      items.push({
        id: `store-${s.id}`,
        type: 'assignment',
        message: `You were assigned as Store Rep to ${s.name}`,
        created_at: s.created_at || new Date().toISOString(),
        read: true,
        store_name: s.name,
      })
    })

    // 3. Transfer queue items (pending transfers involving this rep)
    const { data: transfers } = await supabase
      .from('assignment_transfers')
      .select('id, account_id, old_manager_id, new_manager_id, status, created_at, resolved_at')
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })

    if (transfers && transfers.length > 0) {
      const acctIds = transfers.map((t: any) => t.account_id).filter(Boolean)
      const { data: acctData } = await supabase
        .from('users')
        .select('id, business_name')
        .in('id', acctIds)

      const nameMap = new Map<string, string>()
      ;(acctData || []).forEach((a: any) => nameMap.set(a.id, a.business_name))

      const mgrIds = [...new Set([...(transfers.map((t: any) => t.old_manager_id)), ...(transfers.map((t: any) => t.new_manager_id))])]
      const { data: mgrData } = await supabase
        .from('users')
        .select('id, business_name')
        .in('id', mgrIds)

      const mgrMap = new Map<string, string>()
      ;(mgrData || []).forEach((m: any) => mgrMap.set(m.id, m.business_name))

      transfers.forEach((t: any) => {
        const acctName = nameMap.get(t.account_id) || 'an account'
        const newMgr = mgrMap.get(t.new_manager_id) || 'a new manager'

        if (t.status === 'pending') {
          items.push({
            id: `xfer-pending-${t.id}`,
            type: 'transfer',
            message: `Your assignment to ${acctName} is pending approval by ${newMgr}`,
            created_at: t.created_at,
            read: false,
            account_name: acctName,
            manager_name: newMgr,
            status: 'pending',
          })
        } else if (t.status === 'accepted') {
          items.push({
            id: `xfer-accepted-${t.id}`,
            type: 'transfer',
            message: `Transfer accepted — you remain assigned to ${acctName} under ${newMgr}`,
            created_at: t.resolved_at || t.created_at,
            read: true,
            account_name: acctName,
            manager_name: newMgr,
            status: 'accepted',
          })
        } else if (t.status === 'rejected') {
          items.push({
            id: `xfer-rejected-${t.id}`,
            type: 'removal',
            message: `Transfer rejected — you were unassigned from ${acctName}`,
            created_at: t.resolved_at || t.created_at,
            read: true,
            account_name: acctName,
            manager_name: newMgr,
            status: 'rejected',
          })
        }
      })
    }

    // Sort by date, newest first
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setNotifications(items)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const iconMap: Record<string, any> = {
    assignment: Users,
    transfer: ArrowRightLeft,
    removal: X,
    info: Bell,
  }

  const colorMap: Record<string, string> = {
    assignment: 'bg-[#44f80c]/20 text-[#44f80c]',
    transfer: 'bg-yellow-500/20 text-yellow-400',
    removal: 'bg-red-400/20 text-red-400',
    info: 'bg-[#9a02d0]/20 text-[#9a02d0]',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="animate-pulse text-[#9a02d0] text-lg">Loading notifications...</div>
        </main>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              <p className="text-gray-400 text-sm">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && (
                  <span className="text-yellow-400 ml-1">({unreadCount} unread)</span>
                )}
              </p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No notifications</p>
                <p className="text-gray-500 text-sm mt-1">
                  Notifications will appear when you are assigned or transferred.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map(item => {
                const Icon = iconMap[item.type] || Bell
                return (
                  <Card
                    key={item.id}
                    className={cn(
                      'bg-[#150f24] border-white/10 transition-all',
                      !item.read && 'border-yellow-400/30 bg-yellow-400/5'
                    )}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorMap[item.type])}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-sm', !item.read ? 'text-white font-medium' : 'text-gray-300')}>
                            {item.message}
                          </p>
                          {!item.read && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] border-yellow-400/20 flex-shrink-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()} at{' '}
                            {new Date(item.created_at).toLocaleTimeString()}
                          </span>
                          {item.status === 'pending' && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] border-yellow-400/20">
                              <Clock className="w-2.5 h-2.5 mr-1" /> Pending
                            </Badge>
                          )}
                          {item.status === 'accepted' && (
                            <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-[10px] border-[#44f80c]/20">
                              <Check className="w-2.5 h-2.5 mr-1" /> Accepted
                            </Badge>
                          )}
                          {item.status === 'rejected' && (
                            <Badge className="bg-red-400/20 text-red-400 text-[10px] border-red-400/20">
                              <X className="w-2.5 h-2.5 mr-1" /> Rejected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
