import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { User, Shield, Users, Store, MapPin, Crown, Loader2 } from 'lucide-react'

const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
  admin:         { label: 'Admin',         color: 'bg-[#9a02d0]/20 text-[#9a02d0]', icon: Crown },
  sales_manager: { label: 'Sales Manager', color: 'bg-[#44f80c]/20 text-[#44f80c]', icon: Shield },
  sales_rep:     { label: 'Sales Rep',     color: 'bg-[#ff66c4]/20 text-[#ff66c4]', icon: Users },
  wholesaler:    { label: 'Wholesaler',    color: 'bg-[#44f80c]/20 text-[#44f80c]', icon: Store },
  distributor:   { label: 'Distributor',   color: 'bg-[#ff66c4]/20 text-[#ff66c4]', icon: Store },
}

export function UserInfoBar() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="bg-[#150f24] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-[#9a02d0] animate-spin" />
        <span className="text-sm text-gray-500">Loading user...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-[#150f24] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
        <User className="w-4 h-4 text-gray-600" />
        <span className="text-sm text-gray-500">Not logged in</span>
      </div>
    )
  }

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
            {'manager_name' in user && (user as any).manager_name && (
              <p className="text-xs text-gray-400 truncate">
                Manager: <span className="text-[#44f80c]">{(user as any).manager_name}</span>
              </p>
            )}
          </div>
        </div>
        {'states' in user && (user as any).states?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#9a02d0]" />
            <span className="text-xs text-gray-400">
              Territory: <span className="text-white font-medium">{(user as any).states.join(', ')}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
