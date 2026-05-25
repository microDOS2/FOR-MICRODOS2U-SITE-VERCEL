import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SalesManagerSidebar } from '@/components/sales-manager/SalesManagerSidebar';
import { RegionalStats } from '@/components/sales-manager/RegionalStats';
import { TeamOverview } from '@/components/sales-manager/TeamOverview';
import { AssignmentDialog } from '@/components/sales-manager/AssignmentDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  TrendingUp,
  ArrowRight,
  Store,
  ShoppingCart,
  DollarSign,
  MapPin,
  Loader2,
  Shield,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  X,
  UserCog,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { DBUser } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserInfoBar } from '@/components/UserInfoBar';

// ─── Audit Log Helper ───
async function logAudit(action: string, table_name: string, record_id: string, old_data: string | null, new_data: string | null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('audit_log').insert({
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      user_id: session?.user?.id || null,
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

interface AssignmentData {
  id: string;
  rep_id: string;
  account_id: string;
  assigned_at: string;
  is_primary: boolean;
}

export function SalesManagerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<DBUser | null>(null);
  const [salesReps, setSalesReps] = useState<DBUser[]>([]);
  const [accounts, setAccounts] = useState<DBUser[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<DBUser | null>(null);

  // Territory + store management state
  const [managerStates, setManagerStates] = useState<string[]>([]);
  const [territoryStores, setTerritoryStores] = useState<any[]>([]);
  const [allReps, setAllReps] = useState<DBUser[]>([]);
  const [selectedStoreRep, setSelectedStoreRep] = useState<Record<string, string>>({});
  const [storeRepAssignments, setStoreRepAssignments] = useState<Map<string, string>>(new Map());
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [resolvingTransfer, setResolvingTransfer] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isDualRole, setIsDualRole] = useState(false);

  // Auth guard + data fetch
  useEffect(() => {
    const init = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        navigate('/sales-manager-portal');
        return;
      }

      // Check sales_manager role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError || userData?.role !== 'sales_manager') {
        toast.error('Access denied: Sales Manager role required');
        await supabase.auth.signOut();
        navigate('/sales-manager-portal');
        return;
      }

      setManager(userData);
      setIsDualRole(userData?.also_rep || false);

      // Fetch manager territory states from dedicated table
      const { data: statesData } = await supabase
        .from('manager_state_assignments')
        .select('state_code')
        .eq('manager_id', session.user.id);
      const myStates: string[] = (statesData || []).map((s: any) => s.state_code).sort();
      setManagerStates(myStates);

      // Fetch sales reps managed by this manager
      const { data: repsData, error: repsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'sales_rep')
        .eq('manager_id', session.user.id)
        .order('business_name', { ascending: true });

      if (repsError) {
        toast.error('Failed to fetch sales reps: ' + repsError.message);
      } else {
        setSalesReps(repsData || []);
      }

      // Fetch all approved reps via RPC (bypasses RLS, for store-level dropdown)
      const { data: allRepsData } = await supabase.rpc('get_all_reps');
      setAllReps((allRepsData || []) as DBUser[]);

      // Fetch accounts assigned to this manager (territory)
      const { data: accountsData, error: accountsError } = await supabase
        .from('users')
        .select('*')
        .in('role', ['wholesaler', 'distributor'])
        .eq('status', 'approved')
        .eq('manager_id', session.user.id)
        .order('business_name', { ascending: true });

      if (accountsError) {
        toast.error('Failed to fetch accounts: ' + accountsError.message);
      } else {
        setAccounts(accountsData || []);
      }



      // Fetch stores for territory accounts
      if (accountsData && accountsData.length > 0) {
        const acctNums = accountsData.map((a: any) => a.referral_code).filter(Boolean);
        if (acctNums.length > 0) {
          const { data: storesData } = await supabase
            .from('wholesaler_store_locations')
            .select('*')
            .order('name', { ascending: true });

          if (storesData) {
            const matchedStores = storesData.filter((s: any) => {
              const name = s.name || '';
              const match = name.match(/^(\d+[a-z])\s*-\s*(.+)$/);
              if (match) {
                const storeNum = match[1];
                const acctNum = storeNum.replace(/[a-z]$/, '');
                return acctNums.includes(acctNum);
              }
              return false;
            }).map((s: any) => {
              const nameMatch = (s.name || '').match(/^(\d+[a-z])\s*-\s*(.+)$/);
              return {
                ...s,
                store_number: nameMatch ? nameMatch[1] : '',
                clean_name: nameMatch ? nameMatch[2] : s.name,
              };
            });
            setTerritoryStores(matchedStores);
          }
        }
      }

      // Fetch store-to-rep assignments from proper junction table
      const { data: storeAssignmentsData } = await supabase
        .from('store_rep_assignments')
        .select('store_id, rep_id')
        .eq('is_primary', true);
      if (storeAssignmentsData) {
        setStoreRepAssignments(new Map(storeAssignmentsData.map((a: any) => [a.store_id, a.rep_id])));
      }

      // Fetch rep_account_assignments
      // This table may not exist yet (migration needs to be applied)
      // Wrap in try/catch to handle gracefully
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('rep_account_assignments')
          .select('*');

        if (!assignmentsError && assignmentsData) {
          setAssignments(assignmentsData);
        }
      } catch {
        // Table doesn't exist yet, use empty assignments
        setAssignments([]);
      }

      // Fetch pending transfers for this manager directly
      try {
        const { data: transfersData, error: transfersError } = await supabase
          .from('assignment_transfers')
          .select('*')
          .eq('new_manager_id', session.user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (transfersError) {
          console.error('get_pending_transfers error:', transfersError);
          setPendingTransfers([]);
        } else {
          setPendingTransfers(transfersData || []);
        }
      } catch (e) {
        console.error('Transfer fetch exception:', e);
        setPendingTransfers([]);
      }

      // Fetch recent activity from audit_log
      try {
        const accountIds = accountsData?.map((a: any) => a.id) || [];
        const repIds = repsData?.map((r: any) => r.id) || [];
        const allIds = [...accountIds, ...repIds, session.user.id];

        const { data: auditData } = await supabase
          .from('audit_log')
          .select('id, action, table_name, record_id, created_at')
          .in('record_id', allIds.map((id: string) => id))
          .or('action.in.(account_transferred,rep_transferred,transfer_created,transfer_accepted,transfer_rejected,account_rep_assigned,store_rep_assigned)')
          .order('created_at', { ascending: false })
          .limit(10);

        const activity = (auditData || []).map((a: any) => {
          let description = '';
          let type = 'info';
          if (a.action === 'account_transferred') {
            description = 'Account transferred between managers';
            type = 'assignment';
          } else if (a.action === 'rep_transferred') {
            description = 'Sales rep reassigned to new manager';
            type = 'assignment';
          } else if (a.action === 'transfer_created') {
            description = 'Transfer request created';
            type = 'transfer';
          } else if (a.action === 'transfer_accepted') {
            description = 'Transfer accepted';
            type = 'transfer';
          } else if (a.action === 'transfer_rejected') {
            description = 'Transfer rejected';
            type = 'transfer';
          } else if (a.action === 'account_rep_assigned') {
            description = 'Account rep assigned';
            type = 'assignment';
          } else if (a.action === 'store_rep_assigned') {
            description = 'Store rep assigned';
            type = 'assignment';
          } else {
            description = `${a.action} on ${a.table_name}`;
          }
          return {
            id: a.id,
            type,
            description,
            time: new Date(a.created_at).toLocaleDateString() + ' at ' + new Date(a.created_at).toLocaleTimeString(),
            created_at: a.created_at,
          };
        });
        setRecentActivity(activity);
      } catch {
        setRecentActivity([]);
      }

      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleAssign = (repId: string) => {
    const rep = salesReps.find((r) => r.id === repId);
    if (rep) {
      setSelectedRep(rep);
      setAssignmentDialogOpen(true);
    }
  };

  const handleView = (repId: string) => {
    const rep = salesReps.find((r) => r.id === repId);
    toast.info('View rep details', {
      description: `Opening details for ${rep?.business_name || rep?.email}`,
    });
  };

  // Fetch store-to-rep assignments from proper junction table
  const fetchStoreRepAssignments = async (): Promise<Map<string, string>> => {
    const { data, error } = await supabase
      .from('store_rep_assignments')
      .select('store_id, rep_id')
      .eq('is_primary', true);
    if (error || !data) return new Map();
    return new Map(data.map((a: any) => [a.store_id, a.rep_id]));
  };

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedStoreRep[storeId];
    if (!repId) { toast.error('Select a Sales Rep'); return; }
    setSavingStore(storeId);
    const store = territoryStores.find(s => s.id === storeId);
    const assignments = await fetchStoreRepAssignments();
    const oldRepId = assignments.get(storeId) || null;
    // Remove any existing assignment for this store
    await supabase.from('store_rep_assignments').delete().eq('store_id', storeId);
    // Insert new assignment
    const { error } = await supabase.from('store_rep_assignments').insert({
      store_id: storeId,
      rep_id: repId,
      assigned_by: manager?.id,
      is_primary: true,
    });
    if (error) { toast.error('Failed: ' + error.message); } else {
      const rep = salesReps.find(r => r.id === repId);
      const oldRep = oldRepId ? salesReps.find(r => r.id === oldRepId) : null;
      await logAudit('store_rep_assigned', 'store_rep_assignments', storeId, oldRep?.business_name || oldRep?.email || null, rep?.business_name || rep?.email || repId);
      toast.success('Assigned!'); window.location.reload();
    }
    setSavingStore(null);
  };

  const handleUnassignStore = async (storeId: string) => {
    if (!confirm('Remove store rep assignment?')) return;
    const assignments = await fetchStoreRepAssignments();
    const oldRepId = assignments.get(storeId) || null;
    const { error } = await supabase.from('store_rep_assignments').delete().eq('store_id', storeId);
    if (error) { toast.error('Error'); } else {
      const oldRep = oldRepId ? salesReps.find(r => r.id === oldRepId) : null;
      await logAudit('store_rep_unassigned', 'store_rep_assignments', storeId, oldRep?.business_name || oldRep?.email || oldRepId || null, null);
      toast.success('Unassigned'); window.location.reload();
    }
  };

  const toggleAccount = (acctId: string) => {
    setExpandedAccounts((p) => ({ ...p, [acctId]: !p[acctId] }));
  };

  const handleAcceptTransfer = async (transferId: string, _accountId: string) => {
    setResolvingTransfer(transferId);
    const now = new Date().toISOString();
    const { error } = await supabase.from('assignment_transfers')
      .update({ status: 'accepted', resolved_at: now })
      .eq('id', transferId);
    if (error) {
      console.error('accept_transfer error:', error);
      toast.error('Failed to accept: ' + error.message);
    } else {
      setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId));
      toast.success('Transfer accepted');
    }
    setResolvingTransfer(null);
  };

  const handleRejectTransfer = async (transferId: string, accountId: string) => {
    if (!confirm('Remove rep assignment from this account?')) return;
    setResolvingTransfer(transferId);
    const now = new Date().toISOString();
    const { error } = await supabase.from('assignment_transfers')
      .update({ status: 'rejected', resolved_at: now })
      .eq('id', transferId);
    if (error) {
      console.error('reject_transfer error:', error);
      toast.error('Failed to reject: ' + error.message);
    } else {
      setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId));
      setAssignments((prev) => prev.filter((a) => a.account_id !== accountId));
      toast.success('Transfer rejected');
    }
    setResolvingTransfer(null);
  };


  // Top accounts sorted by assignment count
  const accountsWithRepCount = accounts
    .map((account) => ({
      ...account,
      assignedRepCount: assignments.filter((a) => a.account_id === account.id).length,
    }))
    .sort((a, b) => b.assignedRepCount - a.assignedRepCount)
    .slice(0, 4);

  // recentActivity now fetched from audit_log in init() — no mock data

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#9a02d0] mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesManagerSidebar />

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                Sales Manager Dashboard
              </h1>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{manager?.city || 'All Regions'}, {manager?.state || ''}</span>
                {managerStates.length > 0 && (
                  <span className="ml-2 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-[#9a02d0]" />
                    Territory: {managerStates.join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-medium">{manager?.business_name || manager?.email}</p>
                <p className="text-gray-400 text-sm">{manager?.email}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#9a02d0] to-[#44f80c] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {(manager?.business_name || manager?.email || '?').split(' ').map((n) => n[0]).join('').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Dual Role Banner */}
          {isDualRole && (
            <div className="mb-6">
              <Link
                to="/sales-manager-rep-dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-[#9a02d0]/15 to-[#44f80c]/15 border border-[#44f80c]/20 hover:border-[#44f80c]/40 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9a02d0]/30 to-[#44f80c]/30 flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-4 h-4 text-[#44f80c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-[#44f80c] transition-colors">
                    You have dual-role access (Manager + Sales Rep)
                  </p>
                  <p className="text-xs text-gray-400">
                    Click to open your unified dashboard with all functions
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#44f80c] group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          )}

          {/* Stats */}
          <div className="mb-8">
            <RegionalStats
              salesRepCount={salesReps.length}
              totalAccountCount={accounts.length}
              pendingAssignmentCount={accounts.filter((a) => !assignments.some((asgn) => asgn.account_id === a.id)).length}
            />
          </div>

          {/* Incoming Transfers */}
          {pendingTransfers.length > 0 && (
            <div className="mb-8">
              <Card className="bg-[#150f24] border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Incoming Transfers ({pendingTransfers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingTransfers.map((transfer: any) => (
                      <div key={transfer.id} className="bg-[#0a0514] rounded-lg p-3 border border-yellow-500/20">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-white text-sm font-medium">
                              Rep: {transfer.rep?.business_name || transfer.rep?.email || 'Unknown'}
                            </p>
                            <p className="text-gray-400 text-sm">
                              Account: {transfer.account?.business_name || 'Unknown'}
                              {' '}
                              {transfer.account?.role && (
                                <Badge className={transfer.account.role === 'distributor' ? 'bg-[#ff66c4]/20 text-[#ff66c4] text-[10px]' : 'bg-[#44f80c]/20 text-[#44f80c] text-[10px]'}>
                                  {transfer.account.role === 'distributor' ? 'Distributor' : 'Wholesaler'}
                                </Badge>
                              )}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              From previous manager — {new Date(transfer.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptTransfer(transfer.id, transfer.account_id)}
                              disabled={resolvingTransfer === transfer.id}
                              className="bg-[#44f80c]/20 text-[#44f80c] hover:bg-[#44f80c]/30 h-7 px-2"
                            >
                              {resolvingTransfer === transfer.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectTransfer(transfer.id, transfer.account_id)}
                              disabled={resolvingTransfer === transfer.id}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2"
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Overview */}
            <div className="lg:col-span-2">
              <TeamOverview
                salesReps={salesReps}
                accounts={accounts}
                assignments={assignments}
                onAssign={handleAssign}
                onView={handleView}
              />
            </div>

            {/* Recent Activity */}
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#9a02d0]" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.type === 'order'
                            ? 'bg-[#44f80c]/20'
                            : activity.type === 'new_account'
                            ? 'bg-[#9a02d0]/20'
                            : 'bg-[#ff66c4]/20'
                        }`}
                      >
                        {activity.type === 'order' ? (
                          <ShoppingCart className="w-4 h-4 text-[#44f80c]" />
                        ) : activity.type === 'new_account' ? (
                          <Store className="w-4 h-4 text-[#9a02d0]" />
                        ) : (
                          <Users className="w-4 h-4 text-[#ff66c4]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">{activity.description}</p>
                        {activity.amount && (
                          <p className="text-[#44f80c] text-sm font-medium">
                            {activity.amount}
                          </p>
                        )}
                        {activity.rep && (
                          <p className="text-gray-400 text-xs">Rep: {activity.rep}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Territory Store Management */}
            <Card className="bg-[#150f24] border-white/10 lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#44f80c]" />
                  My Territory Stores ({territoryStores.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {territoryStores.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Store className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400">No stores in your territory yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {accounts.map((acct) => {
                      const acctStores = territoryStores.filter((s) => {
                        const acctNum = acct.referral_code || '';
                        return s.store_number && s.store_number.replace(/[a-z]$/, '') === acctNum;
                      });
                      const acctRepAssignment = assignments.find((a) => a.account_id === acct.id);
                      const acctRep = acctRepAssignment ? allReps.find((r) => r.id === acctRepAssignment.rep_id) : null;
                      return (
                        <div key={acct.id} className="bg-[#0a0514] rounded-lg border border-white/10 overflow-hidden">
                          <button
                            onClick={() => toggleAccount(acct.id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">Acct #{acct.referral_code}</span>
                              <span className="text-white font-medium">{acct.business_name}</span>
                              <Badge className={acct.role === 'distributor' ? 'bg-[#ff66c4]/20 text-[#ff66c4] text-xs' : 'bg-[#44f80c]/20 text-[#44f80c] text-xs'}>
                                {acct.role === 'distributor' ? 'Distributor' : 'Wholesaler'}
                              </Badge>
                              {manager && (
                                <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs">
                                  <Shield className="w-3 h-3 mr-1" /> Manager: {manager.business_name || manager.email}
                                </Badge>
                              )}
                              {acctRep && (
                                <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                  <Users className="w-3 h-3 mr-1" /> Account Rep: {acctRep.business_name || acctRep.email}
                                </Badge>
                              )}
                              {!acctRep && pendingTransfers.some((t: any) => t.account_id === acct.id) && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> ⚠️ Transfer Pending
                                </Badge>
                              )}
                              <span className="text-gray-400 text-sm">({acctStores.length} stores)</span>
                            </div>
                            {expandedAccounts[acct.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </button>
                          {expandedAccounts[acct.id] && (
                            <div className="border-t border-white/10 px-4 pb-4 space-y-3">
                              {acctStores.map((store) => {
                                const storeRepId = storeRepAssignments.get(store.id) || null;
                                const storeRep = allReps.find((r) => r.id === storeRepId);
                                return (
                                  <div key={store.id} className="bg-[#150f24] rounded-lg p-3 border border-white/5">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono bg-[#ff66c4]/20 text-[#ff66c4] px-2 py-0.5 rounded">{store.store_number}</span>
                                          <span className="text-white font-medium">{store.clean_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-gray-400">
                                          <MapPin className="w-3 h-3 text-gray-600" />
                                          <span>{store.address}{store.city && `, ${store.city}`}{store.state && `, ${store.state}`}</span>
                                        </div>
                                        {storeRep ? (
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                              <Users className="w-3 h-3 mr-1" /> Rep: {storeRep.business_name || storeRep.email}
                                            </Badge>
                                            <button onClick={() => handleUnassignStore(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                                          </div>
                                        ) : (
                                          <Badge className="bg-gray-700 text-gray-400 text-xs mt-1.5">Unassigned</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <Select
                                          value={selectedStoreRep[store.id] || storeRepId || ''}
                                          onValueChange={(val) => setSelectedStoreRep((p) => ({ ...p, [store.id]: val }))}
                                        >
                                          <SelectTrigger className="w-48 bg-[#0a0514] border-white/10 text-white text-sm">
                                            <SelectValue placeholder="Select Rep" />
                                          </SelectTrigger>
                                          <SelectContent className="bg-[#150f24] border-white/10">
                                            {allReps.map((r) => (
                                              <SelectItem key={r.id} value={r.id}>
                                                <span className="block text-white text-sm">{r.business_name || r.email}</span>
                                                <span className="block text-gray-400 text-xs">{r.city && r.state ? `${r.city}, ${r.state}` : ''} {r.phone ? `| ${r.phone}` : ''}</span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          size="sm"
                                          onClick={() => handleAssignStore(store.id)}
                                          disabled={savingStore === store.id}
                                          className="bg-gradient-to-r from-[#44f80c] to-[#9a02d0] text-white"
                                        >
                                          {savingStore === store.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Accounts */}
            <Card className="bg-[#150f24] border-white/10 lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#9a02d0]" />
                  Top Performing Accounts
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[#9a02d0] hover:text-[#ff66c4]">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-gray-400">Account</TableHead>
                      <TableHead className="text-gray-400">Type</TableHead>
                      <TableHead className="text-gray-400">Assigned Reps</TableHead>
                      <TableHead className="text-gray-400 text-right">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsWithRepCount.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          No accounts yet
                        </TableCell>
                      </TableRow>
                    )}
                    {accountsWithRepCount.map((account) => (
                      <TableRow key={account.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white font-medium">{account.business_name || '—'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              account.role === 'distributor'
                                ? 'bg-[#9a02d0]/20 text-[#9a02d0] border-[#9a02d0]/30'
                                : 'bg-[#44f80c]/20 text-[#44f80c] border-[#44f80c]/30'
                            }
                          >
                            {account.role === 'distributor' ? 'Distributor' : 'Wholesaler'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {account.assignedRepCount} rep{account.assignedRepCount !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell className="text-white text-right font-medium">
                          {account.city && account.state ? `${account.city}, ${account.state}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Assignment Dialog */}
      <AssignmentDialog
        isOpen={assignmentDialogOpen}
        onClose={() => {
          setAssignmentDialogOpen(false);
          setSelectedRep(null);
        }}
        salesRep={selectedRep}
        allAccounts={accounts}
        existingAssignments={assignments}
        onAssignmentsChanged={(newAssignments) => setAssignments(newAssignments)}
      />
    </div>
  );
}
