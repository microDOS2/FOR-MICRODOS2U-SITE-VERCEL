import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DistributorSidebar } from '@/components/distributor/DistributorSidebar';
import { UserInfoBar } from '@/components/UserInfoBar';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Loader2,
  FileCheck,
  Clock,
  AlertCircle,
  Download,
} from 'lucide-react';

export function DistributorAgreements() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in first');
      navigate('/distributor-portal');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', session.user.id)
      .single();

    if (!userData || userData.role !== 'distributor') {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    const { data: agreementsData } = await supabase
      .from('agreements')
      .select('id, title, version, status, file_url, sent_date, signed_date, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setAgreements(agreementsData || []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    signed: { icon: FileCheck, color: 'text-[#44f80c] bg-[#44f80c]/10', label: 'Signed' },
    pending: { icon: Clock, color: 'text-yellow-400 bg-yellow-400/10', label: 'Pending' },
    expired: { icon: AlertCircle, color: 'text-red-400 bg-red-400/10', label: 'Expired' },
  };

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <DistributorSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Agreements</h1>
            <p className="text-gray-400 text-sm">
              {agreements.length} agreement{agreements.length !== 1 ? 's' : ''} total
            </p>
          </div>

          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#ff66c4]" />
                Agreement History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agreements.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No agreements found</p>
                  <p className="text-gray-500 text-sm mt-1">Agreements will appear when sent by your admin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agreements.map((agreement) => {
                                      return (
                      <div key={agreement.id} className="flex items-center justify-between p-4 bg-[#0a0514] rounded-lg border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${statusConfig[agreement.status]?.color || 'bg-gray-700'}`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{agreement.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[agreement.status]?.color || 'bg-gray-700'}`}>
                                {statusConfig[agreement.status]?.label || agreement.status}
                              </span>
                            </div>
                            <p className="text-gray-500 text-xs mt-0.5">
                              Version {agreement.version} • Sent: {formatDate(agreement.sent_date)}
                            </p>
                            {agreement.signed_date && (
                              <p className="text-[#44f80c] text-xs mt-0.5">Signed on {formatDate(agreement.signed_date)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {agreement.file_url && (
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
