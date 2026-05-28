import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, MapPin, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RepData {
  id: string;
  contact_name: string | null;
  business_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  manager_id: string | null;
}

interface AccountRepCardProps {
  userId: string;
  managerId: string | null;
}

export function AccountRepCard({ userId, managerId }: AccountRepCardProps) {
  const [repData, setRepData] = useState<RepData | null>(null);
  const [managerData, setManagerData] = useState<RepData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepData = async () => {
      setLoading(true);

      // Fetch assigned rep via RPC (bypasses RLS)
      const { data: repJson, error: repErr } = await supabase.rpc(
        'get_rep_for_account',
        { p_account_id: userId }
      );
      if (repErr) console.error('get_rep_for_account error:', repErr);
      if (repJson && repJson !== 'null') {
        setRepData(repJson as RepData);
      }

      // Fetch manager
      if (managerId) {
        const { data: allUsers } = await supabase.rpc('get_all_users');
        if (allUsers) {
          const manager = allUsers.find((u: any) => u.id === managerId);
          if (manager) {
            setManagerData(manager);
          }
        }
      }

      setLoading(false);
    };

    fetchRepData();
  }, [userId, managerId]);

  if (loading) {
    return (
      <>
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-6 flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-[#44f80c]" />
          </CardContent>
        </Card>
        {managerId && (
          <Card className="bg-[#150f24] border-white/10">
            <CardContent className="p-6 flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" />
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  // No rep and no manager
  if (!repData && !managerData) return null;

  return (
    <>
      {/* Sales Rep Card */}
      {repData && (
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#44f80c]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#44f80c]" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Your Sales Rep</h3>
                <p className="text-xs text-gray-400">Direct point of contact</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-white font-medium">{repData.contact_name || repData.business_name || 'Not assigned'}</p>
              {repData.email && (
                <a href={`mailto:${repData.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#44f80c] transition-colors">
                  <Mail className="w-3.5 h-3.5" />{repData.email}
                </a>
              )}
              {repData.phone && (
                <a href={`tel:${repData.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#44f80c] transition-colors">
                  <Phone className="w-3.5 h-3.5" />{repData.phone}
                </a>
              )}
              {(repData.city || repData.state) && (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="w-3.5 h-3.5" />{[repData.city, repData.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Manager Card */}
      {managerData && (
        <Card className="bg-[#150f24] border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#9a02d0]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#9a02d0]" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Sales Manager</h3>
                <p className="text-xs text-gray-400">Territory oversight</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-white font-medium">{managerData.contact_name || managerData.business_name || 'Not assigned'}</p>
              {managerData.email && (
                <a href={`mailto:${managerData.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#9a02d0] transition-colors">
                  <Mail className="w-3.5 h-3.5" />{managerData.email}
                </a>
              )}
              {managerData.phone && (
                <a href={`tel:${managerData.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#9a02d0] transition-colors">
                  <Phone className="w-3.5 h-3.5" />{managerData.phone}
                </a>
              )}
              {(managerData.city || managerData.state) && (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="w-3.5 h-3.5" />{[managerData.city, managerData.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
