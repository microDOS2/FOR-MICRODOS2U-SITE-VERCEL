import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusChart } from './OrderStatusChart';
import { RevenueTrendChart } from './RevenueTrendChart';
import { TopAccountsChart } from './TopAccountsChart';
import { getOrderStatusCounts, getRevenueTrend, getTopAccounts, getTeamPerformance, getPersonalSales } from '@/lib/chartData';
import { BarChart3, TrendingUp, Users, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      try {
        // All modes get order status
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
          const team = await getTeamPerformance(managerId);
          if (!mounted) return;
          setAccountsData(team);
        } else if (mode === 'rep' && repId) {
          const personal = await getPersonalSales(repId);
          if (!mounted) return;
          setRevenueData(personal);
        }
      } catch (err) {
        console.error('Chart data error:', err);
      }
      if (mounted) setLoading(false);
    };
    fetch();
    return () => { mounted = false; };
  }, [mode, managerId, repId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-brand-800 border-brand-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Loading chart...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Order Status - All modes */}
      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#9a02d0]" />
            Orders by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusChart data={statusData} />
        </CardContent>
      </Card>

      {/* Revenue / Personal Sales Trend */}
      {revenueData.length > 0 && (
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#44f80c]" />
              {mode === 'admin' ? 'Revenue Trend' : 'Sales Trend'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={revenueData} />
          </CardContent>
        </Card>
      )}

      {/* Top Accounts / Team Performance */}
      {accountsData.length > 0 && (
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#ff66c4]" />
              {mode === 'admin' ? 'Top Accounts' : mode === 'manager' ? 'Team Performance' : 'Top Accounts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TopAccountsChart data={accountsData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
