import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Store,
  MapPin,
  TrendingUp,
  Settings,
  LogOut,
  DollarSign,
  Building2,
  ShoppingCart,
  Bell,
  UserCog,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navSections: NavSection[] = [
  {
    label: 'Unified',
    items: [
      { label: 'Unified Dashboard', path: '/sales-manager-rep-dashboard', icon: UserCog },
    ],
  },
  {
    label: 'Manager',
    items: [
      { label: 'Manager Dashboard', path: '/sales-manager-dashboard', icon: LayoutDashboard },
      { label: 'My Team', path: '/sales-manager-team', icon: Users },
      { label: 'Accounts', path: '/sales-manager-accounts', icon: Store },
      { label: 'Store Locations', path: '/sales-manager-stores', icon: MapPin },
      { label: 'Performance', path: '/sales-manager-performance', icon: TrendingUp },
      { label: 'Manager Commissions', path: '/sales-manager-commissions', icon: DollarSign },
    ],
  },
  {
    label: 'Sales Rep',
    items: [
      { label: 'My Accounts', path: '/sales-rep-accounts', icon: Building2 },
      { label: 'My Stores', path: '/sales-rep-stores', icon: Store },
      { label: 'My Orders', path: '/sales-rep-orders', icon: ShoppingCart },
      { label: 'Rep Commissions', path: '/sales-rep-commissions', icon: DollarSign },
      { label: 'Notifications', path: '/sales-rep-notifications', icon: Bell },
    ],
  },
];

export function SalesManagerRepSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Unified: true,
    Manager: true,
    'Sales Rep': true,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const toggleSection = (label: string) => {
    setExpandedSections((p) => ({ ...p, [label]: !p[label] }));
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
        <p className="text-gray-400 text-sm mt-1">Manager + Rep Portal</p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 border border-[#44f80c]/30">
          <div className="w-1.5 h-1.5 rounded-full bg-[#44f80c] animate-pulse" />
          <span className="text-[10px] font-medium text-[#44f80c]">Dual Role Active</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-3">
            <button
              onClick={() => toggleSection(section.label)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
            >
              <span>{section.label}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${expandedSections[section.label] ? '' : '-rotate-90'}`}
              />
            </button>
            {expandedSections[section.label] && (
              <ul className="space-y-0.5 mt-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => sessionStorage.setItem('lastPortal', '/sales-manager-rep-dashboard')}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                          isActive
                            ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#44f80c]' : ''}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}

        {/* Shared Settings */}
        <div className="mt-2">
          <Link
            to="/sales-manager-settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
              location.pathname === '/sales-manager-settings'
                ? 'bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-white border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className={`w-4 h-4 ${location.pathname === '/sales-manager-settings' ? 'text-[#44f80c]' : ''}`} />
            <span>Settings</span>
          </Link>
        </div>
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
