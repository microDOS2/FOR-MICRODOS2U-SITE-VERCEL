import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SalesManagerSidebar } from '@/components/sales-manager/SalesManagerSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Store, Loader2, Phone, Mail, MapPin, ChevronDown, ChevronUp, Building2, ShoppingCart, DollarSign, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DBUser } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserInfoBar } from '@/components/UserInfoBar';

interface RepData {
  rep: DBUser;
  accounts: { id: string; business_name: string | null; email: string; role: string; referral_code: string | null }[];
  stores: { id: string; name: string; address: string; city: string | null; state: string | null; phone: string | null }[];
  totalOrderAmount: number;
  orderCount: number;
}

export function SalesManagerTeam() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState('');
  const [repDataList, setRepDataList] = useState<RepData[]>([]);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        navigate('/sales-manager-portal');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError || userData?.role !== 'sales_manager') {
        toast.error('Access denied');
        navigate('/sales-manager-portal');
        return;
      }

      setManagerName(userData?.business_name || userData?.email || '');

      // Fetch ALL sales reps managed by this manager
      const { data: repsData, error: repsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'sales_rep')
        .eq('manager_id', session.user.id)
        .order('business_name', { ascending: true });

      if (repsError) {
        toast.error('Failed to fetch sales reps: ' + repsError.message);
        setLoading(false);
        return;
      }

      const reps = repsData || [];
      if (reps.length === 0) {
        setRepDataList([]);
        setLoading(false);
        return;
      }

      // Build full data for each rep
      const repIds = reps.map(r => r.id);

      // Get account assignments
      const { data: assignmentsData } = await supabase
        .from('rep_account_assignments')
        .select('rep_id, account_id')
        .in('rep_id', repIds);

      const accountIds = [...new Set((assignmentsData || []).map((a: any) => a.account_id))];

      // Get account details
      let accountsData: any[] = [];
      if (accountIds.length > 0) {
        const { data } = await supabase
          .from('users')
          .select('id, business_name, email, role, referral_code')
          .in('id', accountIds);
        accountsData = data || [];
      }

      // Get stores for those accounts (with address + phone)
      let storesData: any[] = [];
      if (accountIds.length > 0) {
        const { data } = await supabase
          .from('wholesaler_store_locations')
          .select('id, name, address, city, state, phone, user_id')
          .in('user_id', accountIds)
          .eq('is_active', true)
          .order('name', { ascending: true });
        storesData = data || [];
      }

      // Get order data for volume calc
      let ordersData: any[] = [];
      if (accountIds.length > 0) {
        const { data } = await supabase
          .from('orders')
          .select('user_id, total')
          .in('user_id', accountIds)
          .eq('status', 'shipped');
        ordersData = data || [];
      }

      // Build per-rep data
      const repDataArray: RepData[] = reps.map((rep: DBUser) => {
        const repAssignments = (assignmentsData || []).filter((a: any) => a.rep_id === rep.id);
        const repAccountIds = repAssignments.map((a: any) => a.account_id);
        const repAccounts = accountsData.filter(a => repAccountIds.includes(a.id));
        const repStores = storesData.filter(s => repAccountIds.includes(s.user_id));
        const repOrders = ordersData.filter(o => repAccountIds.includes(o.user_id));
        const totalAmount = repOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        return {
          rep,
          accounts: repAccounts,
          stores: repStores,
          totalOrderAmount: totalAmount,
          orderCount: repOrders.length,
        };
      });

      setRepDataList(repDataArray);
      setLoading(false);
    };

    init();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesManagerSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/sales-manager-dashboard">
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">My Team</h1>
            <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] border-[#9a02d0]/30">
              {repDataList.length} Rep{repDataList.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {repDataList.length === 0 && (
            <div className="bg-[#150f24] rounded-xl border border-white/10 p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No sales reps on your team yet.</p>
              <p className="text-gray-500 text-sm mt-2">
                Ask your admin to assign sales reps to you{managerName ? ` (${managerName})` : ''}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {repDataList.map(({ rep, accounts, stores, totalOrderAmount, orderCount }) => (
              <Card key={rep.id} className="bg-[#150f24] border-white/10">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#9a02d0] to-[#44f80c] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {(rep.business_name || rep.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-white text-lg truncate">{rep.business_name || 'Unnamed Rep'}</CardTitle>
                      <p className="text-gray-400 text-sm truncate">{rep.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact Info */}
                  <div className="space-y-2">
                    {rep.phone && (
                      <a
                        href={`tel:${rep.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-300 hover:text-[#44f80c] transition-colors"
                      >
                        <Phone className="w-4 h-4 text-[#44f80c]" />
                        {rep.phone}
                      </a>
                    )}
                    <a
                      href={`mailto:${rep.email}`}
                      className="flex items-center gap-2 text-sm text-[#9a02d0] hover:text-[#ff66c4] transition-colors"
                    >
                      <Mail className="w-4 h-4 text-[#9a02d0]" />
                      {rep.email}
                    </a>
                    {(rep.city || rep.state) && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-400">{[rep.city, rep.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[#0a0514] rounded-lg p-2 text-center">
                      <Building2 className="w-4 h-4 text-[#44f80c] mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{accounts.filter(a => a.role === 'wholesaler').length}</p>
                      <p className="text-gray-500 text-[10px]">Wholesale</p>
                    </div>
                    <div className="bg-[#0a0514] rounded-lg p-2 text-center">
                      <Store className="w-4 h-4 text-[#9a02d0] mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{accounts.filter(a => a.role === 'distributor').length}</p>
                      <p className="text-gray-500 text-[10px]">Distrib</p>
                    </div>
                    <div className="bg-[#0a0514] rounded-lg p-2 text-center">
                      <ShoppingCart className="w-4 h-4 text-[#ff66c4] mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{orderCount}</p>
                      <p className="text-gray-500 text-[10px]">Orders</p>
                    </div>
                    <div className="bg-[#0a0514] rounded-lg p-2 text-center">
                      <DollarSign className="w-4 h-4 text-[#44f80c] mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">${(totalOrderAmount / 1000).toFixed(0)}k</p>
                      <p className="text-gray-500 text-[10px]">Volume</p>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <button
                    onClick={() => setExpandedRep(expandedRep === rep.id ? null : rep.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white bg-[#0a0514] rounded-lg transition-colors"
                  >
                    {expandedRep === rep.id ? (
                      <><ChevronUp className="w-4 h-4" /> Hide Details</>
                    ) : (
                      <><ChevronDown className="w-4 h-4" /> View Accounts & Stores ({accounts.length} accounts, {stores.length} stores)</>
                    )}
                  </button>

                  {expandedRep === rep.id && (
                    <div className="space-y-4 mt-2">
                      {/* Accounts */}
                      {accounts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#44f80c]" /> Accounts ({accounts.length})
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {accounts.map(acct => (
                              <div key={acct.id} className="flex items-center justify-between px-3 py-2 bg-[#0a0514] rounded-lg text-sm">
                                <span className="text-gray-300 truncate">{acct.business_name || acct.email}</span>
                                <Badge className={`text-[10px] ${acct.role === 'wholesaler' ? 'bg-[#44f80c]/20 text-[#44f80c]' : 'bg-[#9a02d0]/20 text-[#9a02d0]'}`}>
                                  {acct.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stores */}
                      {stores.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <Store className="w-4 h-4 text-[#9a02d0]" /> Stores ({stores.length})
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {stores.map(store => (
                              <div key={store.id} className="px-3 py-2 bg-[#0a0514] rounded-lg text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300 truncate">{store.name}</span>
                                  <span className="text-gray-500 text-xs ml-2">{[store.city, store.state].filter(Boolean).join(', ')}</span>
                                </div>
                                {store.address && (
                                  <p className="text-gray-600 text-xs mt-1 truncate">{store.address}</p>
                                )}
                                {store.phone && (
                                  <a
                                    href={`tel:${store.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-500 text-xs hover:text-[#44f80c] transition-colors flex items-center gap-1 mt-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {store.phone}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Badge className="w-full justify-center bg-[#44f80c]/20 text-[#44f80c]">
                    Active Sales Rep
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
