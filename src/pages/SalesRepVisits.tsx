import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar';
import { StoreVisitForm } from '@/components/store-visits/StoreVisitForm';
import { VisitHistory } from '@/components/store-visits/VisitHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, FileText, Loader2, Phone, User } from 'lucide-react';

interface Store {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  phone: string;
  contact_name: string;
}

export default function SalesRepVisits() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('log');

  useEffect(() => {
    const fetchStores = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Get stores assigned to this rep via store_rep_assignments
        const { data: assignments } = await supabase
          .from('store_rep_assignments')
          .select('store_id')
          .eq('rep_id', user.id);

        const storeIds = (assignments || []).map((a: any) => a.store_id);

        // Also get stores from rep_account_assignments (accounts the rep manages)
        const { data: accountAssignments } = await supabase
          .from('rep_account_assignments')
          .select('account_id')
          .eq('rep_id', user.id);

        const accountIds = (accountAssignments || []).map((a: any) => a.account_id);

        // Fetch stores matching either assignment method
        let query = supabase
          .from('wholesaler_store_locations')
          .select('id, name, city, state, address, zip, phone, contact_name')
          .eq('is_active', true);

        if (storeIds.length > 0) {
          query = query.in('id', storeIds);
        } else if (accountIds.length > 0) {
          query = query.in('user_id', accountIds);
        } else {
          // Fallback: show all active wholesaler stores
          query = query.eq('source', 'wholesaler');
        }

        const { data, error } = await query;
        if (error) throw error;
        setStores(data || []);
      } catch (err) {
        console.error('Error fetching stores:', err);
      }
      setLoading(false);
    };
    fetchStores();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0514]">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0514]">
      <SalesRepSidebar />

      <div className="flex-1 lg:ml-0 overflow-y-auto">
        {/* Mobile sidebar placeholder */}
        <div className="lg:hidden">
          <SalesRepSidebar />
        </div>

        <main className="p-4 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MapPin className="w-8 h-8 text-[#9a02d0]" />
              Store Visits
            </h1>
            <p className="text-gray-400 mt-2">
              Log and track your store visits. Your manager can view all team visits.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-[#150f24] border border-white/10">
              <TabsTrigger value="log" className="data-[state=active]:bg-[#9a02d0] data-[state=active]:text-white">
                <MapPin className="w-4 h-4 mr-2" /> Log Visit
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[#9a02d0] data-[state=active]:text-white">
                <FileText className="w-4 h-4 mr-2" /> My History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="log" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2">
                  <StoreVisitForm
                    stores={stores}
                    onSuccess={() => setActiveTab('history')}
                  />
                </div>

                {/* Store list */}
                <div>
                  <Card className="bg-brand-800 border-brand-700">
                    <CardHeader>
                      <CardTitle className="text-white text-base">My Stores ({stores.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                      {stores.map((store) => (
                        <div key={store.id} className="p-3 rounded-lg bg-[#0a0514] border border-white/5 space-y-2">
                          {/* Store name */}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-[#9a02d0] mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-white text-sm font-medium">{store.name}</p>
                            </div>
                          </div>
                          {/* Full address */}
                          <div className="pl-6">
                            <p className="text-gray-400 text-xs">{store.address}</p>
                            <p className="text-gray-400 text-xs">{store.city}, {store.state} {store.zip}</p>
                          </div>
                          {/* Phone */}
                          {store.phone && (
                            <div className="flex items-center gap-2 pl-6">
                              <Phone className="w-3 h-3 text-[#44f80c]" />
                              <a href={`tel:${store.phone}`} className="text-[#44f80c] text-xs hover:underline">
                                {store.phone}
                              </a>
                            </div>
                          )}
                          {/* Contact person */}
                          {store.contact_name && (
                            <div className="flex items-center gap-2 pl-6">
                              <User className="w-3 h-3 text-[#ff66c4]" />
                              <span className="text-gray-300 text-xs">Contact: {store.contact_name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <VisitHistory mode="mine" />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
