import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusChart } from './OrderStatusChart';
import { RevenueTrendChart } from './RevenueTrendChart';
import { TopAccountsChart } from './TopAccountsChart';
import { getOrderStatusCounts, getRevenueTrend, getTopAccounts, getTeamPerformance, getPersonalSales } from '@/lib/chartData';
import { BarChart3, TrendingUp, Users, Loader2, AlertCircle } from 'lucide-react';

interface DashboardChartsProps {
  mode: 'admin' | 'manager' | 'rep';
  managerId?: string;
  repId?: string;
}

export function DashboardCharts({ mode, managerId, repId }: DashboardChartsProps) {
  const [statusData, setStatusData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [accountsData, setAccountsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const status = await getOrderStatusCounts();
        if (!mounted) return;
        setStatusData(status);

        if (mode === 'admin') {
          const [revenue, accounts] = await Promise.all([
            getRevenueTrend(),
            getTopAccounts(),
          ]);
          if (!mounted) return;
          setRevenueData(revenue);
          setAccountsData(accounts);
        } else if (mode === 'manager' && managerId) {
          const [revenue, team] = await Promise.all([
            getRevenueTrend(),
            getTeamPerformance(managerId),
          ]);
          if (!mounted) return;
          setRevenueData(revenue);
          setAccountsData(team);
        } else if (mode === 'rep' && repId) {
          const [revenue] = await Promise.all([
            getPersonalSales(repId),
          ]);
          if (!mounted) return;
          setRevenueData(revenue);
        }
      } catch (err: any) {
        console.error('Chart data error:', err);
        if (mounted) setError(err?.message || 'Failed to load chart data');
      }
      if (mounted) setLoading(false);
    };
    fetch();
    return () => { mounted = false; };
  }, [mode, managerId, repId]);

  const EmptyState = ({ message, icon: Icon }: { message: string; icon: any }) => (
    <div className="h-48 flex flex-col items-center justify-center text-gray-500 gap-2">
      <Icon className="w-8 h-8 text-gray-600" />
      <p className="text-sm">{message}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Loading chart...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        <span>Error loading charts: {error}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Order Status - All modes */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#9a02d0]" />
            Orders by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <OrderStatusChart data={statusData} />
          ) : (
            <EmptyState message="No orders yet" icon={BarChart3} />
          )}
        </CardContent>
      </Card>

      {/* Revenue / Sales Trend */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#44f80c]" />
            {mode === 'admin' ? 'Revenue Trend' : 'Sales Trend'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <RevenueTrendChart data={revenueData} />
          ) : (
            <EmptyState message="No revenue data yet" icon={TrendingUp} />
          )}
        </CardContent>
      </Card>

      {/* Top Accounts / Team Performance */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ff66c4]" />
            {mode === 'admin' ? 'Top Accounts' : mode === 'manager' ? 'Team Performance' : 'Top Accounts'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountsData.length > 0 ? (
            <TopAccountsChart data={accountsData} />
          ) : (
            <EmptyState message="No account data yet" icon={Users} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
