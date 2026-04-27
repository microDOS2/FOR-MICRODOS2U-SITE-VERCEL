import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  LogOut,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings as SettingsIcon,
  Lock,
  Save,
  Loader2,
  MapPin,
  Phone,
  Mail,
  User,
  ChevronDown,
  ChevronUp,
  Box,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

// Types
type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

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

  // Settings state
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // Fetch orders that need fulfillment attention
  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, po_number, items, total, status, notes, created_at, updated_at,
        shipping_address, contact_person, contact_phone,
        forwarded_to_fulfillment_at, shipped_date, delivered_date,
        tracking_number, carrier,
        order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total),
        users!orders_user_id_fkey(business_name, email, phone)
      `)
      .in('status', ['processing', 'shipped', 'delivered'])
      .order('created_at', { ascending: false });

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
      .from('orders')
      .update({
        status: 'shipped',
        tracking_number: inputs.tracking,
        carrier: inputs.carrier,
        shipped_date: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Mark shipped error:', error);
      toast.error('Failed to mark as shipped: ' + error.message);
    } else {
      toast.success('Order marked as shipped!');
      await fetchOrders();
    }
    setProcessingId(null);
  };

  const handleMarkDelivered = async (orderId: string) => {
    setProcessingId(orderId);
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_date: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Mark delivered error:', error);
      toast.error('Failed to mark as delivered: ' + error.message);
    } else {
      toast.success('Order marked as delivered!');
      await fetchOrders();
    }
    setProcessingId(null);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      paid: 'bg-green-500/10 text-green-400 border-green-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status] || styles.pending;
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<string, React.ElementType> = {
      pending: Clock,
      paid: CheckCircle,
      processing: Package,
      shipped: Truck,
      delivered: CheckCheck,
      cancelled: AlertCircle,
    };
    return icons[status] || Clock;
  };

  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    processing: orders.filter((o) => o.status === 'processing').length,
    shippedToday: orders.filter((o) => o.status === 'shipped' && o.shipped_date?.startsWith(today)).length,
    deliveredToday: orders.filter((o) => o.status === 'delivered' && o.delivered_date?.startsWith(today)).length,
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
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Needs Shipping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.processing}</div>
            <p className="text-xs text-gray-500 mt-1">Processing orders</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Shipped Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.shippedToday}</div>
            <p className="text-xs text-gray-500 mt-1">Out for delivery</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Delivered Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.deliveredToday}</div>
            <p className="text-xs text-gray-500 mt-1">Completed today</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
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
                <p className="text-sm text-gray-400">Mark shipped orders as delivered</p>
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
                    <TableCell className="text-gray-300">{order.users?.business_name || '—'}</TableCell>
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
              className="pl-10 bg-brand-900 border-brand-700 text-white w-full sm:w-64"
            />
          </div>
          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value as OrderStatus | 'all')}
            className="h-10 px-3 rounded-md bg-brand-900 border border-brand-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0]"
          >
            <option value="all">All Status</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
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
                            <span>{order.users?.business_name || '—'}</span>
                            <span className="text-xs text-gray-500">{order.users?.email}</span>
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
                                  <p className="text-white">{order.contact_person || order.users?.business_name || '—'}</p>
                                  <p className="text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {order.contact_phone || order.users?.phone || '—'}
                                  </p>
                                  <p className="text-gray-400 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {order.users?.email || '—'}
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
                                      className="bg-brand-900 border-brand-700 text-white sm:w-56"
                                    />
                                    <select
                                      value={trackingInputs[order.id]?.carrier || ''}
                                      onChange={(e) => updateTrackingInput(order.id, 'carrier', e.target.value)}
                                      className="h-10 px-3 rounded-md bg-brand-900 border border-brand-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0] sm:w-40"
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
                                  <Button
                                    onClick={() => handleMarkDelivered(order.id)}
                                    disabled={isProcessingAction}
                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                                  >
                                    {isProcessingAction ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <CheckCheck className="w-4 h-4 mr-2" />
                                    )}
                                    Mark as Delivered
                                  </Button>
                                </div>
                              )}

                              {order.status === 'delivered' && (
                                <div className="pt-2 border-t border-brand-700">
                                  <div className="flex items-center gap-2 text-sm text-green-400">
                                    <CheckCheck className="w-4 h-4" />
                                    <span>Delivered {order.delivered_date ? new Date(order.delivered_date).toLocaleDateString() : ''}</span>
                                    {order.tracking_number && (
                                      <span className="text-gray-500">— Tracking: {order.tracking_number} ({order.carrier})</span>
                                    )}
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
      <h2 className="text-2xl font-bold text-white">Account Settings</h2>

      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#9a02d0]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordMessage && (
            <div className={`p-3 rounded-md text-sm ${passwordMessage.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {passwordMessage}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-gray-300">Current Password</Label>
            <PasswordInput
              id="current-password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
              className="bg-brand-900 border-brand-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-gray-300">New Password</Label>
            <PasswordInput
              id="new-password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
              className="bg-brand-900 border-brand-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-gray-300">Confirm New Password</Label>
            <PasswordInput
              id="confirm-password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
              className="bg-brand-900 border-brand-700 text-white"
            />
          </div>
          <Button
            onClick={async () => {
              if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
                setPasswordMessage('Please fill in all password fields');
                return;
              }
              if (passwordForm.new !== passwordForm.confirm) {
                setPasswordMessage('New passwords do not match');
                return;
              }
              setPasswordSaving(true);
              setPasswordMessage(null);
              const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
              if (error) {
                setPasswordMessage('Error: ' + error.message);
              } else {
                setPasswordMessage('Password updated successfully');
                setPasswordForm({ current: '', new: '', confirm: '' });
              }
              setPasswordSaving(false);
            }}
            disabled={passwordSaving}
            className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
          >
            {passwordSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Password
              </>
            )}
          </Button>
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
