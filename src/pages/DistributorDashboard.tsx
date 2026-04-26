import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DistributorSidebar } from '@/components/distributor/DistributorSidebar';
import { DistributorStats } from '@/components/distributor/DistributorStats';
import { UserInfoBar } from '@/components/UserInfoBar';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  ShoppingCart,
  FileText,
  Receipt,
  ArrowRight,
  Loader2,
  Package,
  FileCheck,
} from 'lucide-react';

export function DistributorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [pendingAgreements, setPendingAgreements] = useState<any[]>([]);

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
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!userData || userData.role !== 'distributor') {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    setUser(userData);

    // Recent orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, total_amount, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentOrders(ordersData || []);

    // Open invoices
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id, order_id, amount, status, due_date')
      .eq('user_id', session.user.id)
      .eq('status', 'open')
      .order('due_date', { ascending: true })
      .limit(5);
    setOpenInvoices(invoicesData || []);

    // Pending agreements
    const { data: agreementsData } = await supabase
      .from('agreements')
      .select('id, title, version, status, sent_date')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('sent_date', { ascending: false })
      .limit(5);
    setPendingAgreements(agreementsData || []);

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

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <DistributorSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <UserInfoBar />
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Distributor Dashboard</h1>
              <p className="text-gray-400">Welcome back, {user?.business_name || user?.email}</p>
            </div>
            <Button
              onClick={() => navigate('/distributor-orders')}
              className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </div>

          {/* Stats */}
          <DistributorStats userId={user?.id} />

          {/* Recent Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#44f80c]" />
                  Recent Orders
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/distributor-orders')}
                  className="text-[#9a02d0] hover:text-[#ff66c4]"
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-gray-500 text-xs">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">${order.total_amount?.toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            order.status === 'completed' ? 'bg-[#44f80c]/20 text-[#44f80c]' :
                            order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open Invoices */}
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#9a02d0]" />
                  Open Invoices
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/distributor-invoices')}
                  className="text-[#9a02d0] hover:text-[#ff66c4]"
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {openInvoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p>No open invoices</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">Invoice #{invoice.id.slice(0, 8)}</p>
                          <p className="text-gray-500 text-xs">Due: {formatDate(invoice.due_date)}</p>
                        </div>
                        <p className="text-white font-medium">${invoice.amount?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Agreements */}
            <Card className="bg-[#150f24] border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#ff66c4]" />
                  Pending Agreements
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/distributor-agreements')}
                  className="text-[#9a02d0] hover:text-[#ff66c4]"
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {pendingAgreements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p>No pending agreements</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingAgreements.map((agreement) => (
                      <div key={agreement.id} className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">{agreement.title}</p>
                          <p className="text-gray-500 text-xs">Version {agreement.version} • Sent: {formatDate(agreement.sent_date)}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
