import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Calendar, TrendingUp, Printer, X } from 'lucide-react';

interface CommissionEntry {
  id: string;
  order_id: string;
  order_amount: number;
  amount: number;
  rate_percent: number;
  account_type: string;
  period: string;
  status: 'accrued' | 'processing' | 'paid';
  paid_at: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  created_at: string;
  account_name?: string;
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
  const [statementPeriod, setStatementPeriod] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('commission_payments')
          .select('*, orders!inner(total), users!commission_payments_account_id_fkey(business_name, email)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Commission fetch error:', error);
          setLoading(false);
          return;
        }

        const list: CommissionEntry[] = ((data || []) as any[]).map((row: any) => {
          const acct = row.users || {};
          return {
            id: row.id,
            order_id: row.order_id || '',
            order_amount: row.orders?.total || row.order_amount || 0,
            amount: row.amount || 0,
            rate_percent: row.rate_percent || 0,
            account_type: row.account_type || 'wholesaler',
            period: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
            status: (row.status === 'pending' ? 'accrued' : row.status === 'approved' ? 'processing' : row.status) as CommissionEntry['status'],
            paid_at: row.paid_at,
            paid_method: row.paid_method,
            paid_reference: row.paid_reference,
            created_at: row.created_at,
            account_name: acct.business_name || acct.email || row.account_id?.slice(0, 8),
          };
        });
        setEntries(list);

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
        const payoutDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        setTotals({
          thisMonth: list.filter(e => e.period === currentPeriod && e.status === 'accrued').reduce((sum, e) => sum + e.amount, 0),
          pendingPayment: list.filter(e => e.status === 'processing').reduce((sum, e) => sum + e.amount, 0),
          paidToDate: list.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0),
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
        <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-[#150f24] border-white/10">
        <CardContent className="p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Commissions Yet</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Commissions are generated when orders from your accounts are paid and shipped. They will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group entries by period for statements
  const periods = [...new Set(entries.map(e => e.period))].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#150f24] border-white/10">
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

        <Card className="bg-[#150f24] border-white/10">
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

        <Card className="bg-[#150f24] border-white/10">
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

      {/* Commission History Table */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg">Commission History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Period</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Account</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">Order Amt</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 text-right">{role === 'rep' ? 'Your Earnings' : 'Override'}</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Paid Via</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">{entry.period}</td>
                    <td className="px-4 py-3 text-gray-300">{entry.account_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${entry.account_type === 'distributor' ? 'text-[#ff66c4]' : 'text-blue-400'}`}>
                        {entry.account_type === 'distributor' ? 'D' : 'W'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-right">${Number(entry.order_amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[#44f80c] font-medium text-right">${entry.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{entry.paid_method || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(entry.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Statements Section */}
      {periods.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#9a02d0]" />
            Commission Statements
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {periods.map(period => {
              const periodEntries = entries.filter(e => e.period === period);
              const total = periodEntries.reduce((s, e) => s + e.amount, 0);
              const allPaid = periodEntries.every(e => e.status === 'paid');
              return (
                <Card key={period} className="bg-[#150f24] border-white/10 hover:border-[#9a02d0]/50 transition-colors cursor-pointer" onClick={() => setStatementPeriod(period)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{period}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${allPaid ? 'bg-[#44f80c]/20 text-[#44f80c]' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {allPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#44f80c]">${total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{periodEntries.length} commission{periodEntries.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-[#9a02d0] mt-2 flex items-center gap-1"><Printer className="w-3 h-3" /> Click to view/print</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementPeriod && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#150f24] border border-white/20 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10 print:hidden">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Printer className="w-5 h-5 text-[#44f80c]" />Statement — {statementPeriod}</h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => window.print()} className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514] text-xs"><Printer className="w-3 h-3 mr-1" />Print</Button>
                <button onClick={() => setStatementPeriod(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4" id="commission-statement">
              {(() => {
                const stmtEntries = entries.filter(e => e.period === statementPeriod);
                return (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Commission Statement</h2>
                      <p className="text-gray-400">Period: {statementPeriod}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {role === 'rep' ? 'Sales Representative' : 'Sales Manager'} Commission
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-400 text-xs border-b border-white/10">
                        <th className="py-2">Account</th><th className="py-2 text-right">Order Amount</th>
                        <th className="py-2 text-right">Rate</th><th className="py-2 text-right">Commission</th><th className="py-2">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {stmtEntries.map(e => (
                          <tr key={e.id}>
                            <td className="py-2 text-gray-300">{e.account_name}</td>
                            <td className="py-2 text-gray-300 text-right">${e.order_amount.toFixed(2)}</td>
                            <td className="py-2 text-gray-400 text-right">{e.rate_percent}%</td>
                            <td className="py-2 text-[#44f80c] text-right">${e.amount.toFixed(2)}</td>
                            <td className="py-2"><StatusBadge status={e.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t-2 border-[#44f80c] pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-lg font-bold">Total</span>
                        <span className="text-[#44f80c] text-2xl font-bold">${stmtEntries.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-center text-gray-500 text-xs mt-8">
                      <p>microDOS(2) Commission Statement</p>
                      <p>Generated on {new Date().toLocaleDateString()}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    accrued: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-[#44f80c]/20 text-[#44f80c]',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
