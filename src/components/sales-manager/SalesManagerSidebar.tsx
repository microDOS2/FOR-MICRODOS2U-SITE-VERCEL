import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Store,
  MapPin,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/sales-manager-dashboard', icon: LayoutDashboard },
  { label: 'My Team', path: '/sales-manager-team', icon: Users },
  { label: 'Accounts', path: '/sales-manager-accounts', icon: Store },
  { label: 'Store Locations', path: '/sales-manager-stores', icon: MapPin },
  { label: 'Performance', path: '/sales-manager-performance', icon: TrendingUp },
  { label: 'Settings', path: '/sales-manager-settings', icon: Settings },
];

export function SalesManagerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <aside className="w-64 bg-[#150f24] border-r border-white/10 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-[#44f80c] font-bold text-xl">micro</span>
          <span className="text-[#9a02d0] font-bold text-xl">DOS</span>
          <span className="text-[#ff66c4] font-bold text-xl">(2)</span>
        </Link>
        <p className="text-gray-400 text-sm mt-1">Sales Manager Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#44f80c]' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
