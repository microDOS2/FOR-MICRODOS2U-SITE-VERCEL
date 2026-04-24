import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { SalesManagerSidebar } from '@/components/sales-manager/SalesManagerSidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Search, Loader2, MapPin, Users, Check, Shield,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DBUser } from '@/lib/supabase';
import { toast } from 'sonner';

interface StoreItem {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  store_number: string;
  clean_name: string;
  license_number: string | null;
  assigned_rep_id: string | null;
  assigned_rep_name: string | null;
}

export function SalesManagerAccounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<DBUser[]>([]);
  const [managerStates, setManagerStates] = useState<string[]>([]);
  const [managerName, setManagerName] = useState<string>('');
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [allReps, setAllReps] = useState<DBUser[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedAccountRep, setSelectedAccountRep] = useState<Record<string, string>>({});
  const [savingAccountRep, setSavingAccountRep] = useState<string | null>(null);

  // Account-level rep assignments lookup
  const [accountRepMap, setAccountRepMap] = useState<Map<string, DBUser>>(new Map());

  const extractRepFromLicense = (license: string | null): string | null => {
    return license && license.startsWith('rep:') ? license.slice(4) : null;
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        navigate('/sales-manager-portal');
        return;
      }

      // Check role
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

      // Fetch manager territory states from dedicated table
      const { data: statesData } = await supabase
        .from('manager_state_assignments')
        .select('state_code')
        .eq('manager_id', session.user.id)
      const myStates: string[] = (statesData || []).map((s: any) => s.state_code).sort()
      setManagerStates(myStates);
      setManagerName(userData?.business_name || '');

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

      // Fetch all approved reps for assignment dropdown
      const { data: repsData } = await supabase
        .from('users')
        .select('id, business_name, email')
        .eq('role', 'sales_rep')
        .eq('status', 'approved')
        .order('business_name', { ascending: true });
      setAllReps((repsData || []) as DBUser[]);

      // Fetch account-level rep assignments for territory accounts
      if (accountsData && accountsData.length > 0) {
        const acctIds = accountsData.map((a: any) => a.id);
        const { data: assignData } = await supabase
          .from('rep_account_assignments')
          .select('account_id, rep_id')
          .in('account_id', acctIds);

        // Build lookup: account_id → rep
        const repMap = new Map<string, DBUser>();
        (repsData || []).forEach((r: any) => repMap.set(r.id, r));
        const assignmentMap = new Map<string, DBUser>();
        (assignData || []).forEach((a: any) => {
          const rep = repMap.get(a.rep_id);
          if (rep) assignmentMap.set(a.account_id, rep);
        });
        setAccountRepMap(assignmentMap);
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
            const repMap = new Map();
            (repsData || []).forEach((r: any) => repMap.set(r.id, r));

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
              const storeNum = nameMatch ? nameMatch[1] : '';
              const storeRepId = extractRepFromLicense(s.license_number);
              const storeRep = storeRepId ? repMap.get(storeRepId) : null;
              return {
                id: s.id,
                name: s.name,
                address: s.address || '',
                city: s.city || '',
                state: s.state || '',
                store_number: storeNum,
                clean_name: nameMatch ? nameMatch[2] : s.name,
                license_number: s.license_number,
                assigned_rep_id: storeRepId,
                assigned_rep_name: storeRep ? (storeRep.business_name || storeRep.email) : null,
              };
            });
            setStores(matchedStores);
          }
        }
      }

      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleAssignAccountRep = async (accountId: string) => {
    const repId = selectedAccountRep[accountId];
    if (!repId) { toast.error('Select a Sales Rep'); return; }
    setSavingAccountRep(accountId);
    try {
      const { error: delError } = await supabase.from('rep_account_assignments').delete().eq('account_id', accountId);
      if (delError) throw delError;
      const { error: insError } = await supabase.from('rep_account_assignments').insert([{ account_id: accountId, rep_id: repId }]);
      if (insError) throw insError;
      setAccountRepMap(prev => {
        const next = new Map(prev);
        const rep = allReps.find(r => r.id === repId);
        if (rep) next.set(accountId, rep);
        return next;
      });
      setSelectedAccountRep(prev => { const next = { ...prev }; delete next[accountId]; return next; });
      toast.success('Account Rep assigned!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign rep');
    }
    setSavingAccountRep(null);
  };

  const handleUnassignAccountRep = async (accountId: string) => {
    if (!confirm('Remove account rep assignment?')) return;
    setSavingAccountRep(accountId);
    try {
      const { error } = await supabase.from('rep_account_assignments').delete().eq('account_id', accountId);
      if (error) throw error;
      setAccountRepMap(prev => { const next = new Map(prev); next.delete(accountId); return next; });
      toast.success('Account Rep removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove rep');
    }
    setSavingAccountRep(null);
  };

  const handleAssignStore = async (storeId: string) => {
    const repId = selectedStoreRep[storeId];
    if (!repId) { toast.error('Select a Sales Rep'); return; }
    setSavingStore(storeId);
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: `rep:${repId}` }).eq('id', storeId);
    if (error) { toast.error('Failed: ' + error.message); } else { toast.success('Assigned!'); window.location.reload(); }
    setSavingStore(null);
  };

  const handleUnassignStore = async (storeId: string) => {
    if (!confirm('Remove store rep assignment?')) return;
    const { error } = await supabase.from('wholesaler_store_locations').update({ license_number: null }).eq('id', storeId);
    if (error) { toast.error('Error'); } else { toast.success('Unassigned'); window.location.reload(); }
  };

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const filteredAccounts = accounts.filter((a) =>
    (a.business_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.city?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

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
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link to="/sales-manager-dashboard">
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">My Territory Accounts ({accounts.length})</h1>
          </div>

          {(managerStates.length > 0 || managerName) && (
            <div className="mb-6 ml-[72px] flex items-center gap-2 flex-wrap">
              {managerStates.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-base font-medium text-[#9a02d0] bg-[#9a02d0]/10 px-3 py-1 rounded-full">
                  <Shield className="w-4 h-4" />
                  Territory: {managerStates.join(', ')}
                </span>
              )}
              {managerName && (
                <span className="inline-flex items-center gap-1.5 text-base font-medium text-[#44f80c] bg-[#44f80c]/10 px-3 py-1 rounded-full">
                  <Users className="w-4 h-4" />
                  Manager: {managerName}
                </span>
              )}
            </div>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#150f24] border-white/10 text-white"
            />
          </div>

          {filteredAccounts.length === 0 && (
            <div className="bg-[#150f24] rounded-xl border border-white/10 p-8 text-center">
              <p className="text-gray-400">No accounts in your territory.</p>
              <p className="text-gray-500 text-sm mt-1">Ask the admin to assign accounts to you.</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredAccounts.map((account) => {
              const acctStores = stores.filter((s) => {
                const acctNum = account.referral_code || '';
                return s.store_number && s.store_number.replace(/[a-z]$/, '') === acctNum;
              });
              return (
                <Card key={account.id} className="bg-[#150f24] border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggle(account.id)}
                    className="w-full text-left p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expanded[account.id] ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">Acct #{account.referral_code}</span>
                            <span className="text-white font-medium text-lg">{account.business_name || '—'}</span>
                            <Badge className={account.role === 'distributor' ? 'bg-[#ff66c4]/20 text-[#ff66c4]' : 'bg-[#44f80c]/20 text-[#44f80c]'}>
                              {account.role === 'distributor' ? 'Distributor' : 'Wholesaler'}
                            </Badge>
                            {managerName && (
                              <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs">
                                <Shield className="w-3 h-3 mr-1" /> Manager: {managerName}
                              </Badge>
                            )}
                            {(() => {
                              const rep = accountRepMap.get(account.id);
                              return rep ? (
                                <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                  <Users className="w-3 h-3 mr-1" /> Account Rep: {rep.business_name || rep.email}
                                </Badge>
                              ) : null;
                            })()}
                            <div className="flex items-center gap-2 mt-1">
                              <select
                                className="text-xs bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#44f80c]/50 w-40"
                                value={selectedAccountRep[account.id] || ''}
                                onChange={e => setSelectedAccountRep(prev => ({ ...prev, [account.id]: e.target.value }))}
                                disabled={savingAccountRep === account.id}
                              >
                                <option value="">— Select Rep —</option>
                                {allReps.map(r => <option key={r.id} value={r.id}>{r.business_name || r.email}</option>)}
                              </select>
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleAssignAccountRep(account.id); }}
                                disabled={savingAccountRep === account.id || !selectedAccountRep[account.id]}
                                className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white h-6 px-2"
                              >
                                {savingAccountRep === account.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </Button>
                              {accountRepMap.has(account.id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnassignAccountRep(account.id); }}
                                  className="text-xs text-red-400 hover:text-red-300 underline"
                                  disabled={savingAccountRep === account.id}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm">{account.email}</p>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            {account.city && account.state ? `${account.city}, ${account.state}` : 'No location'}
                          </div>
                        </div>
                      </div>
                      <span className="text-gray-500 text-sm">{acctStores.length} stores</span>
                    </div>
                  </button>

                  {expanded[account.id] && acctStores.length > 0 && (
                    <div className="border-t border-white/10 px-4 pb-4">
                      <div className="mt-3 space-y-3">
                        {acctStores.map((store) => (
                          <div key={store.id} className="bg-[#0a0514] rounded-lg p-3 border border-white/5">
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
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  {managerName && (
                                    <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs">
                                      <Shield className="w-3 h-3 mr-1" /> Manager: {managerName}
                                    </Badge>
                                  )}
                                  {store.assigned_rep_name ? (
                                    <>
                                      <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                        <Users className="w-3 h-3 mr-1" /> Rep: {store.assigned_rep_name}
                                      </Badge>
                                      <button onClick={() => handleUnassignStore(store.id)} className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                                    </>
                                  ) : (
                                    <Badge className="bg-gray-700 text-gray-400 text-xs">Unassigned</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Select
                                  value={selectedStoreRep[store.id] || store.assigned_rep_id || ''}
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
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
