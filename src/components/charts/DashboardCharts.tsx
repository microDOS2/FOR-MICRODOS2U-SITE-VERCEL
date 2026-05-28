import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusChart } from './OrderStatusChart';
import { RevenueTrendChart } from './RevenueTrendChart';
import { TopAccountsChart } from './TopAccountsChart';
import { getOrderStatusCounts, getRevenueTrend, getTopAccounts, getTeamPerformance, getPersonalSales } from '@/lib/chartData';
import { BarChart3, TrendingUp, Users, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DashboardChartsProps {
  mode: 'admin' | 'manager' | 'rep';
  managerId?: string;
  repId?: string;
}

// Demo data for visual testing when no real data exists
const DEMO_STATUS_DATA = [
  { status: 'pending', count: 5 },
  { status: 'processing', count: 8 },
  { status: 'shipped', count: 12 },
  { status: 'cancelled', count: 2 },
];

const DEMO_REVENUE_DATA = [
  { month: 'Jan 25', revenue: 4200 },
  { month: 'Feb 25', revenue: 3800 },
  { month: 'Mar 25', revenue: 5600 },
  { month: 'Apr 25', revenue: 4800 },
  { month: 'May 25', revenue: 7200 },
  { month: 'Jun 25', revenue: 6500 },
];

const DEMO_ACCOUNTS_DATA = [
  { name: 'GreenLeaf Dispensary', total: 15400 },
  { name: 'Urban Gardens', total: 12300 },
  { name: 'Wellness Center LV', total: 9800 },
  { name: 'Herbal Remedies', total: 7600 },
  { name: 'Desert Bloom', total: 5400 },
];

const DEMO_TEAM_DATA = [
  { name: 'Alice Johnson', total: 18200 },
  { name: 'Bob Smith', total: 14500 },
  { name: 'Carol White', total: 11200 },
  { name: 'David Lee', total: 8900 },
];

export function DashboardCharts({ mode, managerId, repId }: DashboardChartsProps) {
  const [statusData, setStatusData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [accountsData, setAccountsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [useDemo, setUseDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
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
          setHasRealData(status.length > 0 || revenue.length > 0 || accounts.length > 0);
        } else if (mode === 'manager' && managerId) {
          const team = await getTeamPerformance(managerId);
          if (!mounted) return;
          setAccountsData(team);
          // Manager also gets overall order status + revenue
          const revenue = await getRevenueTrend();
          if (!mounted) return;
          setRevenueData(revenue);
          setHasRealData(status.length > 0 || team.length > 0 || revenue.length > 0);
        } else if (mode === 'rep' && repId) {
          const personal = await getPersonalSales(repId);
          if (!mounted) return;
          setRevenueData(personal);
          setHasRealData(status.length > 0 || personal.length > 0);
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

  // Determine which data to display
  const displayStatusData = (hasRealData || !useDemo) ? statusData : DEMO_STATUS_DATA;
  const displayRevenueData = (hasRealData || !useDemo) ? revenueData : DEMO_REVENUE_DATA;
  const displayAccountsData = (hasRealData || !useDemo)
    ? accountsData
    : (mode === 'manager' ? DEMO_TEAM_DATA : DEMO_ACCOUNTS_DATA);

  // Show demo toggle when no real data exists
  const showDemoToggle = !hasRealData && !loading;

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
    <div>
      {/* Demo data toggle */}
      {showDemoToggle && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <Switch
              id="demo-mode"
              checked={useDemo}
              onCheckedChange={setUseDemo}
            />
            <Label htmlFor="demo-mode" className="text-gray-400 text-sm cursor-pointer">
              {useDemo ? 'Hide demo data' : 'Show demo data'}
            </Label>
          </div>
          {error && (
            <p className="text-yellow-400 text-xs">Data fetch failed — showing demo</p>
          )}
          {!error && (
            <p className="text-gray-500 text-xs">
              {mode === 'manager'
                ? 'No order data for your territory yet. Toggle to see demo.'
                : mode === 'rep'
                ? 'No sales data for your accounts yet. Toggle to see demo.'
                : 'No order data yet. Toggle to see demo.'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status - All modes */}
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#9a02d0]" />
              Orders by Status
              {useDemo && <span className="text-xs text-gray-500 font-normal">(Demo)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusChart data={displayStatusData} />
          </CardContent>
        </Card>

        {/* Revenue / Sales Trend - Always show */}
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#44f80c]" />
              {mode === 'admin' ? 'Revenue Trend' : 'Sales Trend'}
              {useDemo && <span className="text-xs text-gray-500 font-normal">(Demo)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={displayRevenueData} />
          </CardContent>
        </Card>

        {/* Top Accounts / Team Performance - Always show */}
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#ff66c4]" />
              {mode === 'admin' ? 'Top Accounts' : mode === 'manager' ? 'Team Performance' : 'Top Accounts'}
              {useDemo && <span className="text-xs text-gray-500 font-normal">(Demo)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TopAccountsChart data={displayAccountsData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
