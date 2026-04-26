import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  TrendingUp,
  Store,
  Building2,
  ShoppingCart,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', path: '/sales-rep-dashboard', icon: TrendingUp },
  { name: 'My Accounts', path: '/sales-rep-accounts', icon: Building2 },
  { name: 'My Stores', path: '/sales-rep-stores', icon: Store },
  { name: 'My Orders', path: '/sales-rep-orders', icon: ShoppingCart },
  { name: 'Notifications', path: '/sales-rep-notifications', icon: Bell },
  { name: 'Settings', path: '/sales-rep-settings', icon: Settings },
]

export function SalesRepSidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    navigate('/sales-rep-portal')
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#150f24] border-r border-white/10 min-h-screen">
      <div className="p-6 border-b border-white/10">
        <span className="text-[#44f80c] font-bold text-xl">micro</span>
        <span className="text-[#9a02d0] font-bold text-xl">DOS</span>
        <span className="text-[#ff66c4] font-bold text-xl">(2)</span>
        <p className="text-gray-400 text-sm mt-1">Sales Rep Portal</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
