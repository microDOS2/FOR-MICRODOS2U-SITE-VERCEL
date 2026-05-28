import { supabase } from './supabase';

export async function getOrderStatusCounts() {
  const { data, error } = await supabase
    .from('orders')
    .select('status');
  if (error) {
    console.error('getOrderStatusCounts error:', error);
    return [];
  }

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
  if (error) {
    console.error('getRevenueTrend error:', error);
    return [];
  }

  // Group by month
  const monthly: Record<string, number> = {};
  for (const row of data || []) {
    const date = new Date(row.created_at);
    const key = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    monthly[key] = (monthly[key] || 0) + (row.total || 0);
  }

  return Object.entries(monthly).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}

export async function getTopAccounts(limit = 5) {
  // Fetch orders with user_id first, then resolve names
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('total, user_id')
    .order('created_at', { ascending: false })
    .limit(200);

  if (ordersError) {
    console.error('getTopAccounts orders error:', ordersError);
    return [];
  }

  // Fetch all users to resolve names
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, business_name, contact_name, email')
    .in('role', ['wholesaler', 'distributor']);

  if (usersError) {
    console.error('getTopAccounts users error:', usersError);
    return [];
  }

  // Build user ID -> name lookup
  const userNames: Record<string, string> = {};
  for (const u of usersData || []) {
    userNames[u.id] = u.business_name || u.contact_name || u.email || 'Unknown';
  }

  // Aggregate totals by user
  const accountTotals: Record<string, number> = {};
  for (const row of ordersData || []) {
    const name = userNames[row.user_id] || 'Unknown';
    accountTotals[name] = (accountTotals[name] || 0) + (row.total || 0);
  }

  return Object.entries(accountTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }));
}

export async function getTeamPerformance(managerId: string) {
  // Get reps managed by this manager
  const { data: reps, error: repsError } = await supabase
    .from('users')
    .select('id, contact_name, business_name, email')
    .eq('manager_id', managerId)
    .eq('role', 'sales_rep');

  if (repsError) {
    console.error('getTeamPerformance reps error:', repsError);
    return [];
  }
  if (!reps || reps.length === 0) return [];

  // Get all assignments for these reps
  const repIds = reps.map((r: any) => r.id);
  const { data: allAssignments, error: assignError } = await supabase
    .from('rep_account_assignments')
    .select('rep_id, account_id')
    .in('rep_id', repIds);

  if (assignError) {
    console.error('getTeamPerformance assignments error:', assignError);
    return [];
  }

  // Get all orders for those accounts
  const accountIds = [...new Set((allAssignments || []).map((a: any) => a.account_id))];
  let allOrders: any[] = [];
  if (accountIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total, user_id')
      .in('user_id', accountIds);
    if (ordersError) {
      console.error('getTeamPerformance orders error:', ordersError);
      return [];
    }
    allOrders = orders || [];
  }

  // Calculate totals per account
  const orderTotals: Record<string, number> = {};
  for (const o of allOrders) {
    orderTotals[o.user_id] = (orderTotals[o.user_id] || 0) + (o.total || 0);
  }

  // Roll up to rep level
  const repTotals: Record<string, number> = {};
  for (const a of allAssignments || []) {
    repTotals[a.rep_id] = (repTotals[a.rep_id] || 0) + (orderTotals[a.account_id] || 0);
  }

  return reps.map((rep: any) => ({
    name: rep.contact_name || rep.business_name || rep.email || 'Unknown',
    total: repTotals[rep.id] || 0,
  })).sort((a: any, b: any) => b.total - a.total);
}

export async function getPersonalSales(repId: string) {
  // Get accounts assigned to this rep
  const { data: assignments, error: assignError } = await supabase
    .from('rep_account_assignments')
    .select('account_id')
    .eq('rep_id', repId);

  if (assignError) {
    console.error('getPersonalSales assignments error:', assignError);
    return [];
  }

  const accountIds = (assignments || []).map((a: any) => a.account_id);
  if (accountIds.length === 0) return [];

  // Get orders from those accounts - limit to last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at')
    .in('user_id', accountIds)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPersonalSales orders error:', error);
    return [];
  }

  const monthly: Record<string, number> = {};
  for (const row of data || []) {
    const date = new Date(row.created_at);
    const key = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    monthly[key] = (monthly[key] || 0) + (row.total || 0);
  }

  return Object.entries(monthly).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}
