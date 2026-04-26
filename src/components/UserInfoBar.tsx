import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { User, Shield, Users, Store, MapPin, Crown, Sparkles } from 'lucide-react'

interface UserInfo {
  id: string
  business_name: string | null
  email: string
  role: string
  states: string[]
  manager_name: string | null
}

const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
  admin:        { label: 'Admin',        color: 'bg-[#9a02d0]/20 text-[#9a02d0]', icon: Crown },
  sales_manager:{ label: 'Sales Manager',color: 'bg-[#44f80c]/20 text-[#44f80c]', icon: Shield },
  sales_rep:    { label: 'Sales Rep',    color: 'bg-[#ff66c4]/20 text-[#ff66c4]', icon: Users },
  wholesaler:   { label: 'Wholesaler',   color: 'bg-[#44f80c]/20 text-[#44f80c]', icon: Store },
  distributor:  { label: 'Distributor',  color: 'bg-[#ff66c4]/20 text-[#ff66c4]', icon: Store },
  influencer:   { label: 'Influencer',   color: 'bg-[#ff66c4]/20 text-[#ff66c4]', icon: Sparkles },
}

export function UserInfoBar() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('users')
        .select('id, business_name, email, role, manager_id')
        .eq('id', session.user.id)
        .single()
      if (!data) {
        setLoading(false)
        return
      }
      let states: string[] = []
      let manager_name: string | null = null
      if (data.role === 'sales_manager') {
        const { data: stateData } = await supabase
          .from('manager_state_assignments')
          .select('state_code')
          .eq('manager_id', data.id)
        states = (stateData || []).map((s: any) => s.state_code)
      }
      if (data.role === 'sales_rep' && data.manager_id) {
        const { data: mgrJson } = await supabase
          .rpc('get_my_manager', { p_rep_id: session.user.id })
        manager_name = mgrJson?.manager_name || mgrJson?.manager_email || 'Unknown'
      }
      setUser({ ...data, states, manager_name } as UserInfo)
      setLoading(false)
    }
    fetchUser()
  }, [])

  if (loading) {
    return (
      <div className="h-14 bg-[#150f24] border-b border-white/10 flex items-center px-4 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="ml-3 space-y-1">
          <div className="w-24 h-3 bg-white/10 rounded" />
          <div className="w-16 h-2 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  if (!user) return null

  const config = roleConfig[user.role] || { label: user.role, color: 'bg-gray-500/20 text-gray-400', icon: User }
  const RoleIcon = config.icon

  return (
    <div className="bg-[#150f24] border-b border-white/10 px-4 py-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">
                {user.business_name || user.email}
              </span>
              <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium uppercase', config.color)}>
                <RoleIcon className="w-3 h-3" />
                {config.label}
              </span>
            </div>
            {user.email && user.business_name && (
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            )}
            {user.role === 'sales_rep' && user.manager_name && (
              <p className="text-xs text-gray-400 truncate">
                Manager: <span className="text-[#44f80c]">{user.manager_name}</span>
              </p>
            )}
          </div>
        </div>
        {user.states.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#9a02d0]" />
            <span className="text-xs text-gray-400">
              Territory: <span className="text-white font-medium">{user.states.join(', ')}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
