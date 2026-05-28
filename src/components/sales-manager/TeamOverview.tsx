import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Store, ArrowRight, UserPlus } from 'lucide-react';
import type { DBUser } from '@/lib/supabase';

interface AssignmentData {
  id: string;
  rep_id: string;
  account_id: string;
  assigned_at: string;
  is_primary: boolean;
}

interface TeamOverviewProps {
  salesReps: DBUser[];
  accounts: DBUser[];
  assignments: AssignmentData[];
  onAssign: (salesRepId: string) => void;
  onView: (salesRepId: string) => void;
  onAddRep?: () => void;
}

export function TeamOverview({ salesReps, accounts, assignments, onAssign, onView, onAddRep }: TeamOverviewProps) {
  // Get accounts assigned to a specific rep
  const getRepAccounts = (repId: string) => {
    const assignmentAccountIds = assignments
      .filter((a) => a.rep_id === repId)
      .map((a) => a.account_id);
    return accounts.filter((a) => assignmentAccountIds.includes(a.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#9a02d0]" />
          My Sales Team ({salesReps.length})
        </h3>
        <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5" onClick={onAddRep}>
          <UserPlus className="w-4 h-4 mr-1" />
          Add Rep
        </Button>
      </div>

      {salesReps.length === 0 && (
        <div className="bg-[#150f24] rounded-xl border border-white/10 p-8 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No sales reps assigned yet</p>
          <p className="text-gray-500 text-sm">Sales reps will appear here once they are added to your team.</p>
          <p className="text-gray-500 text-sm mt-2">
            Ask your admin to assign reps with your manager ID.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {salesReps.map((rep) => {
          const repAccounts = getRepAccounts(rep.id);
          const repWholesalers = repAccounts.filter((a) => a.role === 'wholesaler');
          const repDistributors = repAccounts.filter((a) => a.role === 'distributor');
          const totalAccounts = repAccounts.length;

          return (
            <div
              key={rep.id}
              className="bg-[#150f24] rounded-xl border border-white/10 p-5 hover:border-[#9a02d0]/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-white font-semibold">{rep.business_name || rep.email}</h4>
                  <p className="text-gray-400 text-sm">{rep.email}</p>
                  {rep.city && rep.state && (
                    <p className="text-gray-500 text-xs">{rep.city}, {rep.state}</p>
                  )}
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#9a02d0] to-[#44f80c] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {(rep.business_name || rep.email).split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0a0514] rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Store className="w-4 h-4" />
                    Wholesalers
                  </div>
                  <p className="text-white font-semibold text-lg">{repWholesalers.length}</p>
                </div>
                <div className="bg-[#0a0514] rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Store className="w-4 h-4" />
                    Distributors
                  </div>
                  <p className="text-white font-semibold text-lg">{repDistributors.length}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <Badge className="bg-[#44f80c]/20 text-[#44f80c] border-[#44f80c]/30">
                  {totalAccounts} Total Accounts
                </Badge>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(rep.id)}
                    className="text-gray-400 hover:text-white flex-1 sm:flex-none"
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onAssign(rep.id)}
                    className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90 flex-1 sm:flex-none"
                  >
                    Assign
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
