import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { UserInfoBar } from '@/components/UserInfoBar'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCog,
  UserCheck,
  Package,
  ShoppingCart,
  FileText,
  FileSignature,
  Store,
  ClipboardCheck,
  Settings,
  ScrollText,
  ArrowRightLeft,
  Building2,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Shield,
  Loader2,
  Truck
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Pending Applications', path: '/admin/applications', icon: ClipboardList },
  { name: 'Accounts', path: '/admin/accounts', icon: UserCog },
  { name: 'Influencers', path: '/admin/influencers', icon: UserCheck },
  { name: 'Products', path: '/admin/products', icon: Package },
  { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { name: 'Invoices', path: '/admin/invoices', icon: FileText },
  { name: 'Agreements', path: '/admin/agreements', icon: FileSignature },
  { name: 'Orders & Invoices', path: '/admin/orders-invoices', icon: Truck },
  { name: 'Stores', path: '/admin/stores', icon: Store },
  { name: 'Approvals', path: '/admin/approvals', icon: ClipboardCheck },
  { name: 'Config', path: '/admin/config', icon: Settings },
  { name: 'Audit Log', path: '/admin/audit-log', icon: ScrollText },
  { name: 'Transfer History', path: '/admin/transfers', icon: ArrowRightLeft },
  { name: 'Territory Transfer', path: '/admin/territory-transfer', icon: Building2 },
]

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [adminName, setAdminName] = useState('Admin')
  const [adminEmail, setAdminEmail] = useState('admin@microdos2.com')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        navigate('/admin-portal')
        return
      }
      const { data } = await supabase
        .from('users')
        .select('business_name,email,role')
        .eq('id', session.user.id)
        .single()
      if (!data) {
        navigate('/admin-portal')
        return
      }
      // Role-based redirect
      if (data.role === 'admin') {
        setAdminName(data.business_name || 'Admin')
        setAdminEmail(data.email || 'admin@microdos2.com')
        setIsAuthorized(true)
      } else {
        // Not an admin — show access denied instead of redirecting
        setIsAuthorized(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    navigate('/admin-portal')
  }

  const isActiveRoute = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  // Show loading spinner while checking role
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0514]">
        <Loader2 className="w-8 h-8 text-[#9a02d0] animate-spin" />
      </div>
    )
  }

  // Non-admin users — show access denied with logout option
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0514] text-white p-4">
        <Shield className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">
          You are logged in as a non-admin user. Please log out and sign in with an admin account to access this area.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#9a02d0] to-[#ff66c4] rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <LogOut className="w-4 h-4" /> Log Out & Switch Account
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0514] text-white flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-[#150f24] border-r border-white/10 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0 lg:w-20'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
            <div className={cn('flex items-center gap-1', !sidebarOpen ? 'lg:hidden' : '')}>
              <Link to="/" className="flex items-center gap-1">
                <span className="text-[#44f80c] font-bold text-lg">micro</span>
                <span className="text-[#9a02d0] font-bold text-lg">DOS</span>
                <span className="text-[#ff66c4] font-bold text-lg">(2)</span>
              </Link>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActiveRoute(item.path)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    active
                      ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border-l-[3px] border-[#9a02d0]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('w-5 h-5 shrink-0', active ? 'text-[#44f80c]' : '')} />
                  <span className={cn('transition-opacity', !sidebarOpen ? 'lg:hidden lg:opacity-0' : '')}>
                    {item.name}
                  </span>
                  {active && (
                    <ChevronRight className={cn('w-4 h-4 ml-auto text-[#9a02d0]', !sidebarOpen ? 'lg:hidden' : '')} />
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Footer — Logout */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-all duration-200',
                !sidebarOpen ? 'lg:hidden' : ''
              )}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Logout</span>
            </button>
            <div className={cn('flex items-center gap-3 mt-3 pt-3 border-t border-white/10', !sidebarOpen ? 'lg:hidden' : '')}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-white">{adminName}</p>
                <p className="text-xs text-gray-500 truncate">{adminEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-20')}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#150f24]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-white">
              {navItems.find(item => item.path === location.pathname || location.pathname.startsWith(item.path + '/'))?.name || 'Admin'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <UserInfoBar />
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
