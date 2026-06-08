import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  LogOut,
  Search,
  Eye,

  Clock,
  AlertCircle,
  Settings as SettingsIcon,
  User,
  ChevronDown,
  ChevronUp,
  Box,

  MapPin,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { sendOrderNotification } from '@/lib/orderNotifications';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

// Types
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'OnTrac', 'Amazon Logistics', 'Other'];

export function ShippingDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const timer = setTimeout(() => {
        navigate('/shipping-portal');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user, navigate]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'settings'>('overview');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');

  // Data state
  const [orders, setOrders] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Tracking input state (per order)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { tracking: string; carrier: string }>>({});

  // Settings state — read only, no password editing for employee accounts
  // (password changes managed by admin only)

  // Fetch orders that need fulfillment attention
  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .rpc('get_shipping_orders');

    if (error) {
      console.error('[ShippingDashboard] orders error:', error);
      toast.error('Failed to load orders');
    } else {
      setOrders(data || []);
    }
    setDataLoading(false);
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleMarkShipped = async (orderId: string) => {
    const inputs = trackingInputs[orderId];
    if (!inputs?.tracking || !inputs?.carrier) {
      toast.error('Please enter tracking number and carrier');
      return;
    }
    setProcessingId(orderId);
    const { error } = await supabase
      .rpc('mark_order_shipped', {
        p_order_id: orderId,
        p_tracking_number: inputs.tracking,
        p_carrier: inputs.carrier,
      });

    if (error) {
      console.error('Mark shipped error:', error);
      toast.error('Failed to mark as shipped: ' + error.message);
    } else {
      toast.success('Order marked as shipped!');

      // Generate commissions silently in background (shipper doesn't need to see this)
      try {
        await supabase.rpc('generate_order_commissions', { p_order_id: orderId })
      } catch {
        // Silently fail — admin will verify commissions in their dashboard
      }

      // Send shipment notification email
      try {
        const order = orders.find((o) => o.id === orderId);
        if (order?.users?.email) {
          await sendOrderNotification({
            status: 'shipped',
            poNumber: order.po_number,
            customerEmail: order.users.email,
            businessName: order.users.business_name || order.users.contact_name || 'Valued Customer',
            total: order.total,
            orderDate: order.created_at,
            trackingNumber: inputs.tracking,
            carrier: inputs.carrier,
          });
        }
      } catch (notifyErr: any) {
        console.error('Notification error:', notifyErr);
      }
      await fetchOrders();
    }
    setProcessingId(null);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status] || styles.pending;
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<string, React.ElementType> = {
      pending: Clock,
      processing: Package,
      shipped: Truck,
      cancelled: AlertCircle,
    };
    return icons[status] || Clock;
  };

  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    processing: orders.filter((o) => o.status === 'processing').length,
    shippedToday: orders.filter((o) => o.status === 'shipped' && o.shipped_date?.startsWith(today)).length,
    totalShipped: orders.filter((o) => o.status === 'shipped').length,
    totalActive: orders.filter((o) => o.status === 'processing' || o.status === 'shipped').length,
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = (order.po_number || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
      ((order.users?.business_name || '').toLowerCase().includes(orderSearch.toLowerCase()));
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    return matchesSearch && matchesFilter;
  });

  const updateTrackingInput = (orderId: string, field: 'tracking' | 'carrier', value: string) => {
    setTrackingInputs(prev => ({
      ...prev,
      [orderId]: { ...(prev[orderId] || { tracking: '', carrier: '' }), [field]: value },
    }));
  };

  // ─── Render Overview ─────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-brand-800 border-brand-700 cursor-pointer hover:border-[#44f80c]/40 transition-colors" onClick={() => { setOrderFilter('processing'); setActiveTab('orders'); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Needs Shipping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.processing}</div>
            <p className="text-xs text-gray-500 mt-1">Processing orders</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 cursor-pointer hover:border-purple-400/40 transition-colors" onClick={() => { setOrderFilter('shipped'); setActiveTab('orders'); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Shipped Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.shippedToday}</div>
            <p className="text-xs text-gray-500 mt-1">Out for delivery</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 cursor-pointer hover:border-green-400/40 transition-colors" onClick={() => { setOrderFilter('shipped'); setActiveTab('orders'); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.totalShipped}</div>
            <p className="text-xs text-gray-500 mt-1">Currently shipped</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 cursor-pointer hover:border-blue-400/40 transition-colors" onClick={() => { setOrderFilter('all'); setActiveTab('orders'); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Active Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.totalActive}</div>
            <p className="text-xs text-gray-500 mt-1">Processing + Shipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer"
          onClick={() => { setOrderFilter('processing'); setActiveTab('orders'); }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Process Orders</h3>
                <p className="text-sm text-gray-400">View orders waiting to be shipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer"
          onClick={() => { setOrderFilter('shipped'); setActiveTab('orders'); }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">In Transit</h3>
                <p className="text-sm text-gray-400">View all shipped orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Processing Orders */}
      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Recent Orders Needing Fulfillment</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setOrderFilter('processing'); setActiveTab('orders'); }}
              className="text-brand-accent hover:text-white"
            >
              View All <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">PO Number</TableHead>
                <TableHead className="text-gray-400">Business</TableHead>
                <TableHead className="text-gray-400">Items</TableHead>
                <TableHead className="text-gray-400">Total</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.filter((o) => o.status === 'processing').slice(0, 5).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">No orders waiting for fulfillment</TableCell>
                </TableRow>
              ) : (
                orders.filter((o) => o.status === 'processing').slice(0, 5).map((order) => (
                  <TableRow key={order.id} className="border-brand-700">
                    <TableCell className="font-medium text-white">{order.po_number}</TableCell>
                    <TableCell className="text-gray-300">{order.account_name || '—'}</TableCell>
                    <TableCell className="text-gray-300">{order.items}</TableCell>
                    <TableCell className="text-gray-300">{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadge(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Render Orders ───────────────────────────────────────────────
  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold text-white">Fulfillment Orders</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search PO or business..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-10 bg-[#150f24] border-white/20 text-white w-full sm:w-64"
            />
          </div>
          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value as OrderStatus | 'all')}
            className="h-10 px-3 rounded-md bg-[#150f24] border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0]"
          >
            <option value="all">All Status</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">PO Number</TableHead>
                <TableHead className="text-gray-400">Business</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Items</TableHead>
                <TableHead className="text-gray-400">Total</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">Loading orders...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">No orders found</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  const isExpanded = expandedOrders.has(order.id);
                  const isProcessingAction = processingId === order.id;
                  return (
                    <>
                      <TableRow key={order.id} className="border-brand-700">
                        <TableCell className="font-medium text-white">{order.po_number}</TableCell>
                        <TableCell className="text-gray-300">
                          <div className="flex flex-col">
                            <span>{order.account_name || '—'}</span>
                            <span className="text-xs text-gray-500">{order.account_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">{order.created_at?.slice(0, 10) || '—'}</TableCell>
                        <TableCell className="text-gray-300">{order.items}</TableCell>
                        <TableCell className="text-gray-300">{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(order.status)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${order.id}-details`} className="border-brand-700 bg-brand-900/30">
                          <TableCell colSpan={7} className="py-4">
                            <div className="space-y-4">
                              {/* Customer & Shipping Info */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                                    <User className="w-3 h-3" /> Contact
                                  </p>
                                  <p className="text-white">{order.contact_person || order.account_name || '—'}</p>
                                  <p className="text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {order.contact_phone || order.account_phone || '—'}
                                  </p>
                                  <p className="text-gray-400 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {order.account_email || '—'}
                                  </p>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Shipping Address
                                  </p>
                                  <p className="text-white">{order.shipping_address || '—'}</p>
                                  {order.tracking_number && (
                                    <p className="text-gray-300">
                                      <span className="text-gray-500">Tracking:</span>{' '}
                                      <span className="text-purple-400 font-mono">{order.tracking_number}</span>
                                      {' via '}{order.carrier}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Order Items */}
                              {order.order_items && order.order_items.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                                    <Box className="w-3 h-3" /> Order Items
                                  </p>
                                  <div className="grid grid-cols-5 gap-2 text-xs text-gray-400 mb-1">
                                    <span>Product</span>
                                    <span>Package</span>
                                    <span>SKU</span>
                                    <span className="text-center">Qty</span>
                                    <span className="text-right">Line Total</span>
                                  </div>
                                  {order.order_items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-5 gap-2 text-sm">
                                      <span className="text-white">{item.product_name}</span>
                                      <span className="text-gray-300">{item.variant_name}</span>
                                      <span className="text-gray-400 font-mono">{item.sku}</span>
                                      <span className="text-center text-gray-300">{item.quantity}</span>
                                      <span className="text-right text-white">{formatCurrency(item.line_total)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : order.notes ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-gray-400 mb-2">Order Notes:</p>
                                  <p className="text-sm text-white">{order.notes}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No detailed order information available.</p>
                              )}

                              {/* Fulfillment Actions */}
                              {order.status === 'processing' && (
                                <div className="pt-2 border-t border-brand-700 space-y-3">
                                  <p className="text-xs font-medium text-gray-400">Fulfillment Action</p>
                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                      placeholder="Tracking number"
                                      value={trackingInputs[order.id]?.tracking || ''}
                                      onChange={(e) => updateTrackingInput(order.id, 'tracking', e.target.value)}
                                      className="bg-[#150f24] border-white/20 text-white sm:w-56"
                                    />
                                    <select
                                      value={trackingInputs[order.id]?.carrier || ''}
                                      onChange={(e) => updateTrackingInput(order.id, 'carrier', e.target.value)}
                                      className="h-10 px-3 rounded-md bg-[#150f24] border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0] sm:w-40"
                                    >
                                      <option value="">Select carrier</option>
                                      {CARRIERS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                    <Button
                                      onClick={() => handleMarkShipped(order.id)}
                                      disabled={isProcessingAction}
                                      className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
                                    >
                                      {isProcessingAction ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <Truck className="w-4 h-4 mr-2" />
                                      )}
                                      Mark as Shipped
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {order.status === 'shipped' && (
                                <div className="pt-2 border-t border-brand-700 space-y-3">
                                  <div className="flex items-center gap-2 text-sm text-purple-400">
                                    <Truck className="w-4 h-4" />
                                    <span>Shipped {order.shipped_date ? new Date(order.shipped_date).toLocaleDateString() : ''}</span>
                                    {order.tracking_number && (
                                      <span className="font-mono text-gray-300">— Tracking: {order.tracking_number} ({order.carrier})</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {order.status === 'cancelled' && (
                                <div className="pt-2 border-t border-brand-700">
                                  <div className="flex items-center gap-2 text-sm text-red-400">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Order cancelled</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Render Settings ───────────────────────────────────────────────
  const renderSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-white">Account Information</h2>

      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#9a02d0]" />
            Profile Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Name</Label>
              <p className="text-white font-medium">{user?.business_name || '—'}</p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Email</Label>
              <p className="text-white font-medium">{user?.email || '—'}</p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Role</Label>
              <p className="text-white font-medium capitalize">{user?.role?.replace(/_/g, ' ') || '—'}</p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Status</Label>
              <p className="text-green-400 font-medium capitalize">{user?.status || '—'}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-brand-700">
            <p className="text-sm text-gray-500">
              Account details are managed by your administrator. 
              To update your name or password, please contact an admin.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Main Layout ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9a02d0]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Please sign in to access the fulfillment dashboard</p>
          <Link to="/shipping-portal">
            <Button className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#150f24] border-r border-white/10 hidden lg:flex flex-col fixed h-full">
        <div className="p-6">
          <Link to="/" className="inline-block">
            <span className="text-xl font-bold text-white">
              micro<span className="text-[#9a02d0]">DOS</span>
              <span className="text-[#44f80c]">(2)</span>
            </span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Shipping &amp; Fulfillment</p>

          {/* Logged-in user profile */}
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="w-10 h-10 rounded-full bg-[#9a02d0]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#9a02d0] font-bold text-sm">
                {(user?.business_name || user?.email || 'SF').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">{user?.business_name || user?.email || 'Shipper'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orders' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Package className="w-5 h-5" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settings' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            Settings
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#150f24] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-white">
          micro<span className="text-[#9a02d0]">DOS</span>
          <span className="text-[#44f80c]">(2)</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Mobile user avatar */}
          <div className="w-8 h-8 rounded-full bg-[#9a02d0]/20 flex items-center justify-center mr-1" title={user?.business_name || user?.email || 'Shipper'}>
            <span className="text-[#9a02d0] font-bold text-xs">
              {(user?.business_name || user?.email || 'SF').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`p-2 rounded-lg ${activeTab === 'overview' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`p-2 rounded-lg ${activeTab === 'orders' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400'}`}
          >
            <Package className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-lg ${activeTab === 'settings' ? 'bg-[#9a02d0]/20 text-white' : 'text-gray-400'}`}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button onClick={async () => { await signOut(); navigate('/'); }} className="p-2 rounded-lg text-gray-400">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-6 lg:p-8 pt-20 lg:pt-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'orders' && renderOrders()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </main>
    </div>
  );
}
