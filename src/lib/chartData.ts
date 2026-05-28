import { supabase } from './supabase';

export async function getOrderStatusCounts() {
  const { data, error } = await supabase
    .from('orders')
    .select('status');
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

export async function getRevenueTrend(_months = 6) {
  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Group by month
  const monthly: Record<string, number> = {};
  for (const row of data || []) {
    const date = new Date(row.created_at);
    const key = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    monthly[key] = (monthly[key] || 0) + row.total;
  }

  return Object.entries(monthly).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}

export async function getTopAccounts(limit = 5) {
  const { data, error } = await supabase
    .from('orders')
    .select('total, user_id(users(business_name))')
    .order('total', { ascending: false });
  if (error) throw error;

  const accountTotals: Record<string, number> = {};
  for (const row of data || []) {
    const user = row.user_id as any;
    const name = user?.business_name || 'Unknown';
    accountTotals[name] = (accountTotals[name] || 0) + row.total;
  }

  return Object.entries(accountTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }));
}

export async function getTeamPerformance(managerId: string) {
  // Get reps under this manager
  const { data: reps } = await supabase
    .from('users')
    .select('id, contact_name, business_name')
    .eq('manager_id', managerId)
    .eq('role', 'sales_rep');

  if (!reps || reps.length === 0) return [];

  // For each rep, find their assigned accounts, then sum those accounts' orders
  const results = [];
  for (const rep of reps) {
    // Get accounts assigned to this rep
    const { data: assignments } = await supabase
      .from('rep_account_assignments')
      .select('account_id')
      .eq('rep_id', rep.id);

    const accountIds = (assignments || []).map((a: any) => a.account_id);
    let total = 0;

    if (accountIds.length > 0) {
      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .in('user_id', accountIds);
      total = (orders || []).reduce((sum, o) => sum + o.total, 0);
    }

    const displayName = rep.contact_name || rep.business_name || 'Unknown';
    results.push({ name: displayName, total });
  }
  return results.sort((a, b) => b.total - a.total);
}

export async function getPersonalSales(repId: string) {
  // Get accounts assigned to this rep
  const { data: assignments } = await supabase
    .from('rep_account_assignments')
    .select('account_id')
    .eq('rep_id', repId);

  const accountIds = (assignments || []).map((a: any) => a.account_id);
  if (accountIds.length === 0) return [];

  // Get orders from those accounts
  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at')
    .in('user_id', accountIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const monthly: Record<string, number> = {};
  for (const row of data || []) {
    const date = new Date(row.created_at);
    const key = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    monthly[key] = (monthly[key] || 0) + row.total;
  }

  return Object.entries(monthly).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}
