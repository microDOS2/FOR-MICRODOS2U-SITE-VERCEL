import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SalesManagerRepSidebar } from '@/components/sales-manager/SalesManagerRepSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserInfoBar } from '@/components/UserInfoBar';
import { CommissionView } from '@/components/CommissionView';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Users,
  Store,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Building2,
  Package,
  ArrowRight,
  Loader2,
  Shield,
  UserCog,
  LayoutDashboard,
} from 'lucide-react';

interface OrderSummary {
  total_orders: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
}

export function SalesManagerRepDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [managerData, setManagerData] = useState({
    teamSize: 0,
    territoryAccounts: 0,
    territoryStores: 0,
  });
  const [repData, setRepData] = useState({
    accountCount: 0,
    storeCount: 0,
    notifications: 0,
  });
  const [orderSummary, setOrderSummary] = useState<OrderSummary>({
    total_orders: 0,
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
  });

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in first');
      navigate('/sales-manager-portal');
      return;
    }
    const userId = session.user.id;

    // Verify role
    const { data: me } = await supabase
      .from('users')
      .select('role,also_rep,business_name,email,manager_id')
      .eq('id', userId)
      .single();

    if (me?.role !== 'sales_manager' || !me?.also_rep) {
      toast.error('Access denied: Dual-role manager access only');
      navigate('/sales-manager-dashboard');
      return;
    }

    setUser(me);

    // Manager Data: team size
    const { data: repsData } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'sales_rep')
      .eq('manager_id', userId);
    const teamSize = (repsData || []).length;

    // Manager Data: territory accounts
    const { data: accountsData } = await supabase
      .from('users')
      .select('id,referral_code')
      .in('role', ['wholesaler', 'distributor'])
      .eq('status', 'approved')
      .eq('manager_id', userId);
    const territoryAccounts = (accountsData || []).length;

    // Manager Data: territory stores
    let territoryStores = 0;
    if (accountsData && accountsData.length > 0) {
      const acctNums = accountsData.map((a: any) => a.referral_code).filter(Boolean);
      if (acctNums.length > 0) {
        const { data: storesData } = await supabase
          .from('wholesaler_store_locations')
          .select('id,name');
        if (storesData) {
          territoryStores = storesData.filter((s: any) => {
            const name = s.name || '';
            const match = name.match(/^(\d+[a-z])\s*-\s*(.+)$/);
            if (match) {
              const storeNum = match[1];
              const acctNum = storeNum.replace(/[a-z]$/, '');
              return acctNums.includes(acctNum);
            }
            return false;
          }).length;
        }
      }
    }

    setManagerData({ teamSize, territoryAccounts, territoryStores });

    // Rep Data: account assignments
    const { data: acctAssignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', userId);
    const accountIds = (acctAssignments || []).map((a: any) => a.account_id);

    // Rep Data: store assignments
    const { data: storeData } = await supabase
      .from('wholesaler_store_locations')
      .select('id')
      .ilike('license_number', `rep:${userId}%`);
    const storeIds = (storeData || []).map((s: any) => s.id);

    // Orders from assigned accounts
    let ordersData: any[] = [];
    if (accountIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select('id, total_amount, status, user_id, created_at')
        .in('user_id', accountIds)
        .order('created_at', { ascending: false });
      ordersData = data || [];
    }

    // Invoices
    const orderIds = ordersData.map((o: any) => o.id);
    let invoiceMap = new Map<string, string>();
    if (orderIds.length > 0) {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('order_id, status, amount')
        .in('order_id', orderIds);
      (invoiceData || []).forEach((inv: any) => {
        invoiceMap.set(inv.order_id, inv.status);
      });
    }

    let total = 0;
    let paid = 0;
    let pending = 0;
    ordersData.forEach((o: any) => {
      total += o.total_amount || 0;
      const invStatus = invoiceMap.get(o.id);
      if (invStatus === 'paid') {
        paid += o.total_amount || 0;
      } else {
        pending += o.total_amount || 0;
      }
    });

    setOrderSummary({
      total_orders: ordersData.length,
      total_amount: total,
      paid_amount: paid,
      pending_amount: pending,
    });

    // Pending notifications
    const { count: transferCount } = await supabase
      .from('assignment_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', userId)
      .eq('status', 'pending');

    setRepData({
      accountCount: accountIds.length,
      storeCount: storeIds.length,
      notifications: transferCount || 0,
    });

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesManagerRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#9a02d0] mx-auto mb-4" />
            <p className="text-gray-400">Loading dual-role dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesManagerRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                Unified Dashboard
              </h1>
              <p className="text-gray-400 text-sm">
                Manage your team and your own accounts in one place
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-[#9a02d0]/20 to-[#44f80c]/20 text-[#44f80c] border-[#44f80c]/30 px-3 py-1">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Manager
              </Badge>
              <Badge className="bg-gradient-to-r from-[#44f80c]/20 to-[#9a02d0]/20 text-[#9a02d0] border-[#9a02d0]/30 px-3 py-1">
                <UserCog className="w-3.5 h-3.5 mr-1.5" />
                Sales Rep
              </Badge>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#150f24] border-[#9a02d0]/20 hover:border-[#9a02d0]/40 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <LayoutDashboard className="w-5 h-5 text-[#9a02d0]" />
                  Manager Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <QuickLink to="/sales-manager-dashboard" icon={LayoutDashboard} label="Dashboard" />
                  <QuickLink to="/sales-manager-team" icon={Users} label="My Team" />
                  <QuickLink to="/sales-manager-accounts" icon={Store} label="Accounts" />
                  <QuickLink to="/sales-manager-commissions" icon={DollarSign} label="Overrides" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#150f24] border-[#44f80c]/20 hover:border-[#44f80c]/40 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <UserCog className="w-5 h-5 text-[#44f80c]" />
                  Sales Rep Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <QuickLink to="/sales-rep-accounts" icon={Building2} label="My Accounts" />
                  <QuickLink to="/sales-rep-stores" icon={Store} label="My Stores" />
                  <QuickLink to="/sales-rep-orders" icon={ShoppingCart} label="My Orders" />
                  <QuickLink to="/sales-rep-commissions" icon={DollarSign} label="My Earnings" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Manager Stats */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#9a02d0]" />
              Manager Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Team Size" value={managerData.teamSize} icon={Users} color="#9a02d0" />
              <StatCard label="Territory Accounts" value={managerData.territoryAccounts} icon={Store} color="#ff66c4" />
              <StatCard label="Territory Stores" value={managerData.territoryStores} icon={Package} color="#44f80c" />
              <StatCard label="Team Performance" value="—" icon={TrendingUp} color="#9a02d0" />
            </div>
          </div>

          {/* Rep Stats */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-[#44f80c]" />
              Sales Rep Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="My Accounts" value={repData.accountCount} icon={Building2} color="#44f80c" />
              <StatCard label="My Stores" value={repData.storeCount} icon={Store} color="#9a02d0" />
              <StatCard label="Total Orders" value={orderSummary.total_orders} icon={ShoppingCart} color="#ff66c4" />
              <StatCard label="Notifications" value={repData.notifications} icon={Package} color={repData.notifications > 0 ? '#fbbf24' : '#44f80c'} />
            </div>
          </div>

          {/* Order Summary */}
          {orderSummary.total_orders > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-[#150f24] border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-xs">Total Volume (Rep)</p>
                      <p className="text-xl font-bold text-white">${orderSummary.total_amount.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-5 h-5 text-[#44f80c]" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#150f24] border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-xs">Paid / Cleared</p>
                      <p className="text-xl font-bold text-[#44f80c]">${orderSummary.paid_amount.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-[#44f80c]" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#150f24] border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-xs">Pending Payment</p>
                      <p className="text-xl font-bold text-yellow-400">${orderSummary.pending_amount.toLocaleString()}</p>
                    </div>
                    <Package className="w-5 h-5 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Dual Commission Views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#9a02d0]" />
                Manager Overrides
              </h2>
              <CommissionView userId={user?.id} role="manager" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[#44f80c]" />
                Rep Commissions
              </h2>
              <CommissionView userId={user?.id} role="rep" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* Sub-components */

function QuickLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#0a0514] border border-white/5 text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors text-sm"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
      <ArrowRight className="w-3 h-3 ml-auto flex-shrink-0 text-gray-500" />
    </Link>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <Card className="bg-[#150f24] border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-xs">{label}</p>
            <p className="text-2xl font-bold text-white mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
