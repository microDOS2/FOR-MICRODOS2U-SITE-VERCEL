import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface CommissionEntry {
  id: string;
  order_id: string;
  order_amount: number;
  rep_earnings: number;
  manager_earnings?: number | null;
  period: string;
  status: 'accrued' | 'processing' | 'paid';
  paid_at: string | null;
  created_at: string;
}

interface CommissionViewProps {
  userId: string;
  role: 'rep' | 'manager';
}

export function CommissionView({ userId, role }: CommissionViewProps) {
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    thisMonth: 0,
    pendingPayment: 0,
    paidToDate: 0,
    estimatedPayout: '',
  });

  useEffect(() => {
    const fetchCommissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('commission_entries')
          .select('*')
          .eq(role === 'rep' ? 'rep_id' : 'manager_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Commission fetch error:', error);
          setLoading(false);
          return;
        }

        const list = (data as CommissionEntry[]) || [];
        setEntries(list);

        // Calculate totals
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
        const payoutDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const earningsField = role === 'rep' ? 'rep_earnings' : 'manager_earnings';

        const thisMonth = list
          .filter(e => e.period === currentPeriod && e.status === 'accrued')
          .reduce((sum, e) => sum + (e[earningsField as keyof CommissionEntry] as number || 0), 0);

        const pendingPayment = list
          .filter(e => e.status === 'processing')
          .reduce((sum, e) => sum + (e[earningsField as keyof CommissionEntry] as number || 0), 0);

        const paidToDate = list
          .filter(e => e.status === 'paid')
          .reduce((sum, e) => sum + (e[earningsField as keyof CommissionEntry] as number || 0), 0);

        setTotals({
          thisMonth,
          pendingPayment,
          paidToDate,
          estimatedPayout: payoutDate,
        });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    fetchCommissions();
  }, [userId, role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-psy-neonPurple" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Commissions Yet</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Commissions are generated when orders from your accounts are paid and shipped.
            They will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const earningsField = role === 'rep' ? 'rep_earnings' : 'manager_earnings';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#44f80c]" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totals.thisMonth.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Accrued, not yet paid</p>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400" />
              Pending Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totals.pendingPayment.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Processing — awaiting payout</p>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#9a02d0]" />
              Paid to Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totals.paidToDate.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Estimated Payout Banner */}
      {totals.thisMonth > 0 && (
        <div className="bg-[#44f80c]/10 border border-[#44f80c]/30 rounded-lg p-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[#44f80c]" />
          <div>
            <p className="text-sm text-[#44f80c] font-medium">
              Estimated Payout: ${totals.thisMonth.toFixed(2)} on {totals.estimatedPayout}
            </p>
            <p className="text-xs text-gray-400">
              Subject to chargebacks and adjustments. Final amount may vary.
            </p>
          </div>
        </div>
      )}

      {/* Commission List */}
      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Commission History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Period</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Order Amount</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">{role === 'rep' ? 'Your Earnings' : 'Override'}</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">{entry.period}</td>
                    <td className="px-4 py-3 text-gray-300">${Number(entry.order_amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[#44f80c] font-medium">
                      ${Number(entry[earningsField as keyof CommissionEntry] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    accrued: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-[#44f80c]/20 text-[#44f80c]',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
