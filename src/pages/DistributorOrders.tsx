import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DistributorSidebar } from '@/components/distributor/DistributorSidebar';
import { UserInfoBar } from '@/components/UserInfoBar';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  Package,
  Loader2,
  ShoppingCart,
} from 'lucide-react';

export function DistributorOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

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

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, total, status, shipping_address, created_at, tracking_number, carrier, shipped_date')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setOrders(ordersData || []);
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
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Orders</h1>
            <p className="text-gray-400 text-sm">
              {orders.length} order{orders.length !== 1 ? 's' : ''} total
            </p>
          </div>

          <Card className="bg-[#150f24] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#9a02d0]" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No orders found</p>
                  <p className="text-gray-500 text-sm mt-1">Orders will appear here when placed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-[#0a0514] rounded-lg border border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">
                            #{order.id.slice(0, 8)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            order.status === 'completed' ? 'bg-[#44f80c]/20 text-[#44f80c]' :
                            order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            order.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">
                          {formatDate(order.created_at)}
                        </p>
                        {order.shipping_address && (
                          <p className="text-gray-600 text-xs">{order.shipping_address}</p>
                        )}
                        {order.tracking_number && (
                          <p className="text-xs mt-1">
                            <span className="text-gray-500">Tracking:</span>{' '}
                            <a
                              href={order.carrier?.toLowerCase().includes('ups') ? `https://www.ups.com/track?tracknum=${order.tracking_number}` :
                                    order.carrier?.toLowerCase().includes('fedex') ? `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}` :
                                    order.carrier?.toLowerCase().includes('usps') ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}` :
                                    `https://www.google.com/search?q=${order.tracking_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#44f80c] font-mono hover:underline"
                            >
                              {order.tracking_number} ↗
                            </a>
                          </p>
                        )}
                      </div>
                      <p className="text-white font-bold text-lg">${order.total?.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
