import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesManagerSidebar } from '@/components/sales-manager/SalesManagerSidebar';
import { UserInfoBar } from '@/components/UserInfoBar';
import { toast } from 'sonner';
import {
  DollarSign,
  ShoppingCart,
  Target,
  Award,
  Users,
  Loader2,
} from 'lucide-react';

interface RepPerformance {
  id: string;
  name: string;
  accounts: number;
  orders: number;
  revenue: number;
  target: number;
}

export function SalesManagerPerformance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [teamData, setTeamData] = useState<RepPerformance[]>([]);
  const [editingTargetRepId, setEditingTargetRepId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState('');

  const saveTarget = async (repId: string, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num) || num < 0) {
      toast.error('Invalid target amount');
      setEditingTargetRepId(null);
      return;
    }
    const { error } = await supabase
      .from('users')
      .update({ monthly_target: num })
      .eq('id', repId);
    if (error) {
      toast.error('Failed to update target: ' + error.message);
    } else {
      toast.success('Target updated');
      setTeamData(prev => prev.map(r => r.id === repId ? { ...r, target: num } : r));
    }
    setEditingTargetRepId(null);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in');
      navigate('/sales-manager-portal');
      return;
    }

    // Verify role
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (me?.role !== 'sales_manager') {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    // 2. Get all orders via RPC (bypasses RLS)
    const { data: ordersData = [] } = await supabase
      .rpc('get_manager_orders', { p_manager_id: session.user.id });

    // 3. Calculate totals
    const revenue = ordersData.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const orderCount = ordersData.length;
    const avg = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

    setTotalRevenue(revenue);
    setTotalOrders(orderCount);
    setAvgOrderValue(avg);

    // 4. Get team reps
    const { data: repsData } = await supabase
      .from('users')
      .select('id, business_name, email, monthly_target')
      .eq('role', 'sales_rep')
      .eq('manager_id', session.user.id);

    // 5. Get account assignments per rep
    const repIds = (repsData || []).map((r: any) => r.id);
    let assignments: any[] = [];
    if (repIds.length > 0) {
      const { data } = await supabase
        .from('rep_account_assignments')
        .select('rep_id, account_id')
        .in('rep_id', repIds);
      assignments = data || [];
    }

    // 6. Calculate per-rep performance
    const repPerf: RepPerformance[] = (repsData || []).map((rep: any) => {
      const repAssignments = assignments.filter((a: any) => a.rep_id === rep.id);
      const repAccountIds = repAssignments.map((a: any) => a.account_id);
      const repOrders = ordersData.filter((o: any) => repAccountIds.includes(o.user_id));
      const repRevenue = repOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      return {
        id: rep.id,
        name: rep.business_name || rep.email,
        accounts: repAssignments.length,
        orders: repOrders.length,
        revenue: repRevenue,
        target: rep.monthly_target || 10000,
      };
    });

    setTeamData(repPerf);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesManagerSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesManagerSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Performance Overview</h1>
            <p className="text-gray-400 text-sm">Real-time metrics for your territory</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="p-2 bg-[#44f80c]/20 rounded-lg">
                    <DollarSign className="w-5 h-5 text-[#44f80c]" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-white">{totalOrders.toLocaleString()}</p>
                  </div>
                  <div className="p-2 bg-[#9a02d0]/20 rounded-lg">
                    <ShoppingCart className="w-5 h-5 text-[#9a02d0]" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#150f24] border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Avg. Order Value</p>
                    <p className="text-2xl font-bold text-white">${avgOrderValue.toLocaleString()}</p>
                  </div>
                  <div className="p-2 bg-[#ff66c4]/20 rounded-lg">
                    <Target className="w-5 h-5 text-[#ff66c4]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Performance Table */}
          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#9a02d0]" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-400">No sales reps on your team yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Sales Rep</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Accounts</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Orders</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Revenue</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Target</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {teamData.map((rep) => (
                        <tr key={rep.id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9a02d0] to-[#44f80c] flex items-center justify-center">
                                <Award className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-white text-sm">{rep.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">{rep.accounts}</td>
                          <td className="px-4 py-3 text-center text-gray-400">{rep.orders}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">${rep.revenue.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {editingTargetRepId === rep.id ? (
                              <input
                                type="text"
                                value={editingTargetValue}
                                onChange={(e) => setEditingTargetValue(e.target.value)}
                                onBlur={() => saveTarget(rep.id, editingTargetValue)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(rep.id, editingTargetValue); if (e.key === 'Escape') setEditingTargetRepId(null); }}
                                autoFocus
                                className="w-24 px-2 py-1 bg-[#0a0514] border border-[#9a02d0]/50 rounded text-right text-white text-sm"
                              />
                            ) : (
                              <span
                                onClick={() => { setEditingTargetRepId(rep.id); setEditingTargetValue(String(rep.target)); }}
                                className="text-gray-400 cursor-pointer hover:text-[#44f80c] hover:underline"
                                title="Click to edit target"
                              >
                                ${rep.target.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] rounded-full"
                                  style={{ width: `${Math.min((rep.revenue / rep.target) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-10 text-right">
                                {rep.target > 0 ? Math.round((rep.revenue / rep.target) * 100) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
  );
}
