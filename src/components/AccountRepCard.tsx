import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Users, UserCircle, Phone, Mail, MapPin, Loader2 } from 'lucide-react';

interface RepInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface ManagerInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface AccountRepCardProps {
  accountId: string;
}

export function AccountRepCard({ accountId }: AccountRepCardProps) {
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepAndManager = async () => {
      setLoading(true);
      try {
        // Step 1: Find rep assignment for this account
        const { data: assignment } = await supabase
          .from('rep_account_assignments')
          .select('rep_id')
          .eq('account_id', accountId)
          .maybeSingle();

        if (assignment?.rep_id) {
          // Step 2: Fetch rep details
          const { data: repData } = await supabase
            .from('users')
            .select('id, business_name, email, phone, city, state, manager_id')
            .eq('id', assignment.rep_id)
            .maybeSingle();

          if (repData) {
            setRep({
              id: repData.id,
              name: repData.business_name || repData.email,
              email: repData.email,
              phone: repData.phone,
              city: repData.city,
              state: repData.state,
            });

            // Step 3: Fetch manager details
            if (repData.manager_id) {
              const { data: mgrData } = await supabase
                .from('users')
                .select('id, business_name, email, phone, city, state')
                .eq('id', repData.manager_id)
                .maybeSingle();

              if (mgrData) {
                setManager({
                  id: mgrData.id,
                  name: mgrData.business_name || mgrData.email,
                  email: mgrData.email,
                  phone: mgrData.phone,
                  city: mgrData.city,
                  state: mgrData.state,
                });
              }
            }
          }
        } else {
          // No rep assignment — check direct manager_id on the account
          const { data: acctData } = await supabase
            .from('users')
            .select('manager_id')
            .eq('id', accountId)
            .maybeSingle();

          if (acctData?.manager_id) {
            const { data: mgrData } = await supabase
              .from('users')
              .select('id, business_name, email, phone, city, state')
              .eq('id', acctData.manager_id)
              .maybeSingle();

            if (mgrData) {
              setManager({
                id: mgrData.id,
                name: mgrData.business_name || mgrData.email,
                email: mgrData.email,
                phone: mgrData.phone,
                city: mgrData.city,
                state: mgrData.state,
              });
            }
          }
        }
      } catch (e) {
        console.error('Error fetching rep/manager:', e);
      }
      setLoading(false);
    };

    if (accountId) {
      fetchRepAndManager();
    }
  }, [accountId]);

  if (loading) {
    return (
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-psy-neonPurple animate-spin" />
          <span className="text-gray-400 text-sm">Loading your team...</span>
        </CardContent>
      </Card>
    );
  }

  if (!rep && !manager) {
    return (
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-6">
          <p className="text-gray-500 text-sm">No Sales Rep assigned yet.</p>
          <p className="text-gray-600 text-xs mt-1">Contact your administrator for assignment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sales Rep Card */}
      {rep && (
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#44f80c]" />
              Your Sales Rep
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-[#44f80c]" />
              <span className="text-white font-medium">{rep.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${rep.email}`} className="hover:text-white transition-colors">{rep.email}</a>
            </div>
            {rep.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone className="w-4 h-4" />
                <a href={`tel:${rep.phone}`} className="hover:text-white transition-colors">{rep.phone}</a>
              </div>
            )}
            {(rep.city || rep.state) && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{[rep.city, rep.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Manager Card */}
      {manager && (
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-[#9a02d0]" />
              Sales Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#9a02d0]" />
              <span className="text-white font-medium">{manager.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${manager.email}`} className="hover:text-white transition-colors">{manager.email}</a>
            </div>
            {manager.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone className="w-4 h-4" />
                <a href={`tel:${manager.phone}`} className="hover:text-white transition-colors">{manager.phone}</a>
              </div>
            )}
            {(manager.city || manager.state) && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{[manager.city, manager.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
