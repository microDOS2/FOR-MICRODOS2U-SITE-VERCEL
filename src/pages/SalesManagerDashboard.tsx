import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  UserMinus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { DBUser } from '@/lib/supabase';
import { toast } from 'sonner';

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
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

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

      // Parse manager territory states from volume_estimate
      const myStates: string[] = userData?.volume_estimate ? JSON.parse(userData.volume_estimate) : [];
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

      // Fetch all approved reps (for store-level assignment dropdown)
      const { data: allRepsData } = await supabase
        .from('users')
        .select('id, business_name, email')
        .eq('role', 'sales_rep')
        .eq('status', 'approved')
        .order('business_name', { ascending: true });
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
          // Fetch stores and match by account number prefix in store name
          const { data: storesData } = await supabase
            .from('wholesaler_store_locations')
            .select('*')
            .order('name', { ascending: true });

          if (storesData) {
            // Parse store numbers and filter to territory account numbers
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

  // Store-level rep assignment
  const extractRepFromLicense = (license: string | null): string | null => {
    return license && license.startsWith('rep:') ? license.slice(4) : null;
  };

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedStoreRep[storeId];
    if (!repId) { toast.error('Select a Sales Rep'); return; }
    setSavingStore(storeId);
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: `rep:${repId}` }).eq('id', storeId);
    if (error) { toast.error('Failed: ' + error.message); } else {
      toast.success('Assigned!');
      // Refresh stores
      const { data: refreshed } = await supabase.from('wholesaler_store_locations').select('*').order('name', { ascending: true });
      if (refreshed) {
        const acctNums = accounts.map((a: any) => a.referral_code).filter(Boolean);
        const matched = refreshed.filter((s: any) => {
          const m = (s.name || '').match(/^(\d+[a-z])\s*-\s*(.+)$/);
          return m ? acctNums.includes(m[1].replace(/[a-z]$/, '')) : false;
        }).map((s: any) => {
          const nm = (s.name || '').match(/^(\d+[a-z])\s*-\s*(.+)$/);
          return { ...s, store_number: nm ? nm[1] : '', clean_name: nm ? nm[2] : s.name };
        });
        setTerritoryStores(matched);
      }
    }
    setSavingStore(null);
  };

  const handleUnassignStore = async (storeId: string) => {
    if (!confirm('Remove store rep assignment?')) return;
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: null }).eq('id', storeId);
    if (error) { toast.error('Error'); } else {
      toast.success('Unassigned');
      setTerritoryStores((prev) => prev.map((s) => s.id === storeId ? { ...s, license_number: null } : s));
    }
  };

  const toggleAccount = (acctId: string) => {
    setExpandedAccounts((p) => ({ ...p, [acctId]: !p[acctId] }));
  };

  // Top accounts sorted by assignment count
  const accountsWithRepCount = accounts
    .map((account) => ({
      ...account,
      assignedRepCount: assignments.filter((a) => a.account_id === account.id).length,
    }))
    .sort((a, b) => b.assignedRepCount - a.assignedRepCount)
    .slice(0, 4);

  // Recent activity (mock for now - could be fetched from orders/activity table)
  const recentActivity = [
    { id: 1, type: 'order' as const, description: 'New order placed by West Coast Distribution', amount: '$2,500', time: '2 hours ago' },
    { id: 2, type: 'new_account' as const, description: `New ${accounts[0]?.role || 'wholesaler'} approved: ${accounts[0]?.business_name || 'Mystic Moments'}`, rep: salesReps[0]?.business_name || 'Sales Rep', time: '4 hours ago' },
    { id: 3, type: 'order' as const, description: 'Order from Psychedelic Wellness Center', amount: '$1,850', time: '6 hours ago' },
    { id: 4, type: 'assignment' as const, description: `${salesReps[0]?.business_name || 'Rep'} assigned to ${accounts[0]?.business_name || 'account'}`, time: '1 day ago' },
    { id: 5, type: 'order' as const, description: 'Pacific Northwest Supply placed an order', amount: '$4,200', time: '1 day ago' },
  ];

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

          {/* Stats */}
          <div className="mb-8">
            <RegionalStats
              salesRepCount={salesReps.length}
              totalAccountCount={accounts.length}
              pendingAssignmentCount={accounts.filter((a) => !assignments.some((asgn) => asgn.account_id === a.id)).length}
            />
          </div>

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
                      if (acctStores.length === 0) return null;
                      return (
                        <div key={acct.id} className="bg-[#0a0514] rounded-lg border border-white/10 overflow-hidden">
                          <button
                            onClick={() => toggleAccount(acct.id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">Acct #{acct.referral_code}</span>
                              <span className="text-white font-medium">{acct.business_name}</span>
                              <span className="text-gray-400 text-sm">({acctStores.length} stores)</span>
                            </div>
                            {expandedAccounts[acct.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </button>
                          {expandedAccounts[acct.id] && (
                            <div className="border-t border-white/10 px-4 pb-4 space-y-3">
                              {acctStores.map((store) => {
                                const storeRepId = extractRepFromLicense(store.license_number);
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
                                              <SelectItem key={r.id} value={r.id}>{r.business_name || r.email}</SelectItem>
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
