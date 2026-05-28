import { supabase } from './supabase';

export async function getOrderStatusCounts() {
  // Use RPC to bypass RLS and get all orders
  const { data: orders, error } = await supabase.rpc('get_all_orders');
  if (error) {
    console.error('getOrderStatusCounts error:', error);
    return [];
  }

  const counts: Record<string, number> = {};
  for (const row of orders || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

export async function getRevenueTrend(_months = 6) {
  // Use RPC to bypass RLS and get all orders
  const { data: orders, error } = await supabase.rpc('get_all_orders');
  if (error) {
    console.error('getRevenueTrend error:', error);
    return [];
  }

  // Group by month
  const monthly: Record<string, number> = {};
  for (const row of orders || []) {
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
  // Use RPC to bypass RLS
  const { data: ordersData, error: ordersError } = await supabase.rpc('get_all_orders');
  if (ordersError) {
    console.error('getTopAccounts orders error:', ordersError);
    return [];
  }

  // Use RPC to get all users
  const { data: usersData, error: usersError } = await supabase.rpc('get_all_users');
  if (usersError) {
    console.error('getTopAccounts users error:', usersError);
    return [];
  }

  // Build user ID -> name lookup (filter to wholesaler/distributor)
  const userNames: Record<string, string> = {};
  for (const u of usersData || []) {
    if (u.role === 'wholesaler' || u.role === 'distributor') {
      userNames[u.id] = u.business_name || u.contact_name || u.email || 'Unknown';
    }
  }

  // Aggregate totals by user
  const accountTotals: Record<string, number> = {};
  for (const row of ordersData || []) {
    const name = userNames[row.user_id];
    if (name) {
      accountTotals[name] = (accountTotals[name] || 0) + (row.total || 0);
    }
  }

  return Object.entries(accountTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }));
}

export async function getTeamPerformance(managerId: string) {
  // Use RPC to get all users, then filter to reps for this manager
  const { data: allUsers, error: usersError } = await supabase.rpc('get_all_users');
  if (usersError) {
    console.error('getTeamPerformance users error:', usersError);
    return [];
  }

  const reps = (allUsers || []).filter((u: any) => u.role === 'sales_rep' && u.manager_id === managerId);
  if (reps.length === 0) return [];

  // Get rep assignments directly
  const repIds = reps.map((r: any) => r.id);
  const { data: allAssignments, error: assignError } = await supabase
    .from('rep_account_assignments')
    .select('rep_id, account_id')
    .in('rep_id', repIds);

  if (assignError) {
    console.error('getTeamPerformance assignments error:', assignError);
    return [];
  }

  // Use RPC to get all orders
  const { data: allOrders, error: ordersError } = await supabase.rpc('get_all_orders');
  if (ordersError) {
    console.error('getTeamPerformance orders error:', ordersError);
    return [];
  }

  // Calculate totals per account
  const assignmentAccountIds = [...new Set((allAssignments || []).map((a: any) => a.account_id))];
  const orderTotals: Record<string, number> = {};
  for (const o of allOrders || []) {
    if (assignmentAccountIds.includes(o.user_id)) {
      orderTotals[o.user_id] = (orderTotals[o.user_id] || 0) + (o.total || 0);
    }
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

  // Use RPC to get all orders, then filter
  const { data: allOrders, error } = await supabase.rpc('get_all_orders');
  if (error) {
    console.error('getPersonalSales orders error:', error);
    return [];
  }

  // Filter to this rep's accounts and last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthly: Record<string, number> = {};
  for (const row of allOrders || []) {
    if (accountIds.includes(row.user_id) && new Date(row.created_at) >= sixMonthsAgo) {
      const date = new Date(row.created_at);
      const key = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthly[key] = (monthly[key] || 0) + (row.total || 0);
    }
  }

  return Object.entries(monthly).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}
