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
} from 'lucide-react';
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

      // Fetch all wholesaler and distributor accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('users')
        .select('*')
        .in('role', ['wholesaler', 'distributor'])
        .eq('status', 'approved')
        .order('business_name', { ascending: true });

      if (accountsError) {
        toast.error('Failed to fetch accounts: ' + accountsError.message);
      } else {
        setAccounts(accountsData || []);
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
