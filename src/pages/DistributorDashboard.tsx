import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  LogOut,
  ChevronRight,
  Search,
  Download,
  Eye,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  PenTool,
  FileSignature,
  Send,
  Settings as SettingsIcon,
  Lock,
  Building2,
  Save,
  Loader2,
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

// Types
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
type AgreementStatus = 'pending' | 'sent' | 'signed' | 'active' | 'expired';
type AgreementType = 'wholesale' | 'terms' | 'nda' | 'compliance';

interface OrderRow {
  id: string;
  po_number: string;
  items: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  notes?: string | null;
  order_items?: {
    id: string;
    product_name: string;
    variant_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  order_id: string | null;
  amount: number;
  status: InvoiceStatus;
  date: string;
  due_date: string;
  orders?: any;
}
}

interface AgreementRow {
  id: string;
  title: string;
  type: AgreementType;
  version: string;
  sent_date: string;
  signed_date: string | null;
  expires_date: string | null;
  status: AgreementStatus;
  signed_by: string | null;
  document_url: string | null;
}

export function DistributorDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const timer = setTimeout(() => {
        navigate('/distributor-portal');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user, navigate]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'agreements' | 'settings'>('overview');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleInvoiceExpand = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  // Data state
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Orders filter state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    business_name: '', phone: '', address: '',
    city: '', state: '', zip: '', website: '', license_number: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Password state
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: o, error: oErr }, { data: i, error: iErr }, { data: a, error: aErr }] = await Promise.all([
        supabase.from('orders').select('id, po_number, items, total, status, created_at, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, invoice_number, order_id, amount, status, date, due_date, orders:order_id(po_number, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total))').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('agreements').select('id, title, type, version, sent_date, signed_date, expires_date, status, signed_by, document_url').eq('user_id', user.id).order('sent_date', { ascending: false }),
      ]);
      if (oErr) console.error('[DistributorDashboard] orders error:', oErr);
      if (iErr) console.error('[DistributorDashboard] invoices error:', iErr);
      if (aErr) console.error('[DistributorDashboard] agreements error:', aErr);
      setOrders((o as OrderRow[]) || []);
      setInvoices((i as InvoiceRow[]) || []);
      setAgreements((a as AgreementRow[]) || []);
      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  // Populate settings
  useEffect(() => {
    if (user) {
      setSettingsForm({
        business_name: user.business_name || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zip: user.zip || '',
        website: user.website || '',
        license_number: user.license_number || '',
      });
    }
  }, [user]);

  // Refresh profile on settings tab open
  useEffect(() => {
    if (activeTab !== 'settings' || !user?.id) return;
    async function refreshProfile() {
      const { data, error } = await supabase
        .from('users')
        .select('business_name, phone, address, city, state, zip, website, license_number')
        .eq('id', user!.id).maybeSingle();
      if (error) { console.error('[Settings] refreshProfile error:', error); return; }
      if (data) {
        setSettingsForm({
          business_name: data.business_name || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          website: data.website || '',
          license_number: data.license_number || '',
        });
      }
    }
    refreshProfile();
  }, [activeTab, user?.id]);

  // Stats
  const stats = {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
    overdueAmount: invoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount || 0), 0),
    pendingAgreements: agreements.filter((a) => a.status === 'pending' || a.status === 'sent').length,
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(orderSearch.toLowerCase());
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    return matchesSearch && matchesFilter;
  });

  const pendingAgreementsCount = agreements.filter((a) => a.status === 'pending' || a.status === 'sent').length;

  // Status helpers
  const getStatusBadge = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status];
  };

  const getInvoiceStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, string> = {
      paid: 'bg-green-500/10 text-green-400 border-green-500/20',
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
    return styles[status];
  };

  const getAgreementStatusBadge = (status: AgreementStatus) => {
    const styles: Record<AgreementStatus, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      signed: 'bg-green-500/10 text-green-400 border-green-500/20',
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      expired: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status];
  };

  const getAgreementTypeLabel = (type: AgreementType) => {
    const labels: Record<AgreementType, string> = {
      wholesale: 'Wholesale',
      terms: 'Terms of Service',
      nda: 'NDA',
      compliance: 'Compliance',
    };
    return labels[type];
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<OrderStatus, typeof Clock> = {
      pending: Clock,
      processing: Package,
      shipped: Truck,
      delivered: CheckCircle,
      cancelled: AlertCircle,
    };
    return icons[status];
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!user) return;
    setSettingsSaving(true);
    setSettingsMessage(null);
    const { error } = await supabase.from('users').update({
      business_name: settingsForm.business_name,
      phone: settingsForm.phone,
      address: settingsForm.address,
      city: settingsForm.city,
      state: settingsForm.state,
      zip: settingsForm.zip,
      website: settingsForm.website,
      license_number: settingsForm.license_number,
    }).eq('id', user.id);
    setSettingsSaving(false);
    if (error) setSettingsMessage('Error: ' + error.message);
    else setSettingsMessage('Profile updated successfully!');
  };

  // Change password
  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage('Passwords do not match.'); return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordMessage('Must be at least 6 characters.'); return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '', password: passwordForm.current,
    });
    if (signInError) {
      setPasswordSaving(false);
      setPasswordMessage('Current password is incorrect.'); return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.new });
    setPasswordSaving(false);
    if (updateError) setPasswordMessage('Error: ' + updateError.message);
    else {
      setPasswordMessage('Password updated!');
      setPasswordForm({ current: '', new: '', confirm: '' });
    }
  };

  // ─── Render Functions ──────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalOrders}</div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">${stats.totalSpent.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pending Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400">{stats.pendingInvoices}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">${stats.overdueAmount.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Past due</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pending Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-psy-neonPurple">{stats.pendingAgreements}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting signature</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Agreements Alert */}
      {pendingAgreementsCount > 0 && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-white">Action Required: Pending Agreements</h3>
              <p className="text-sm text-gray-400">You have {pendingAgreementsCount} agreement(s) awaiting your signature</p>
              <Button
                variant="link"
                className="text-yellow-400 p-0 h-auto mt-1"
                onClick={() => setActiveTab('agreements')}
              >
                Review Now <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand-800 border-brand-700 cursor-pointer card-hover" onClick={() => setActiveTab('orders')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#44f80c]/10 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-[#44f80c]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Place New Order</h3>
              <p className="text-sm text-gray-400">Submit a purchase order</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 cursor-pointer card-hover" onClick={() => setActiveTab('invoices')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#9a02d0]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#9a02d0]" />
            </div>
            <div>
              <h3 className="font-bold text-white">View Invoices</h3>
              <p className="text-sm text-gray-400">Check payment status</p>
            </div>
          </CardContent>
        </Card>
        <Link to="/products">
          <Card className="bg-brand-800 border-brand-700 cursor-pointer card-hover">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ff66c4]/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#ff66c4]" />
              </div>
              <div>
                <h3 className="font-bold text-white">Browse Products</h3>
                <p className="text-sm text-gray-400">View catalog and pricing</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders */}
      <Card className="bg-brand-800 border-brand-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Recent Orders</CardTitle>
          <Button variant="link" className="text-[#9a02d0]" onClick={() => setActiveTab('orders')}>
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No orders yet</div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                return (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-brand-900/50 border border-brand-700">
                    <div className="flex items-center gap-3">
                      <StatusIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-white font-medium">{order.po_number}</p>
                        <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">${(order.total || 0).toLocaleString()}</p>
                      <Badge variant="outline" className={getStatusBadge(order.status)}>{order.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <p className="text-gray-400 text-sm">Manage your purchase orders</p>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search PO number..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-10 bg-brand-900 border-brand-700 text-white w-full sm:w-64"
            />
          </div>
          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            className="bg-brand-900 border border-brand-700 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-brand-700 hover:bg-transparent">
                  <TableHead className="text-gray-400">PO Number</TableHead>
                  <TableHead className="text-gray-400">Items</TableHead>
                  <TableHead className="text-gray-400">Total</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  const isExpanded = expandedOrders.has(order.id);
                  return (
                    <>
                      <TableRow key={order.id} className="border-brand-700 hover:bg-brand-700/50">
                        <TableCell className="text-white font-medium">{order.po_number}</TableCell>
                        <TableCell className="text-gray-400">{order.items}</TableCell>
                        <TableCell className="text-white">${(order.total || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(order.status)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => toggleOrderExpand(order.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${order.id}-details`} className="border-brand-700 bg-brand-900/30">
                          <TableCell colSpan={6} className="py-3">
                            {order.order_items && order.order_items.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-400 mb-2">Order Details:</p>
                                <div className="grid grid-cols-5 gap-2 text-xs text-gray-400 mb-1">
                                  <span>Product</span>
                                  <span>Package</span>
                                  <span>SKU</span>
                                  <span className="text-center">Qty</span>
                                  <span className="text-right">Line Total</span>
                                </div>
                                {order.order_items.map((item) => (
                                  <div key={item.id} className="grid grid-cols-5 gap-2 text-sm">
                                    <span className="text-white">{item.product_name}</span>
                                    <span className="text-gray-300">{item.variant_name}</span>
                                    <span className="text-gray-400 font-mono">{item.sku}</span>
                                    <span className="text-center text-gray-300">{item.quantity}</span>
                                    <span className="text-right text-white">${item.line_total.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : order.notes ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-400 mb-2">Order Details (from notes):</p>
                                <p className="text-sm text-white">{order.notes}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No detailed order information available.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button className="btn-primary-gradient">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No invoices found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-brand-700 hover:bg-transparent">
                  <TableHead className="text-gray-400">Invoice #</TableHead>
                  <TableHead className="text-gray-400">Order</TableHead>
                  <TableHead className="text-gray-400">Amount</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Due Date</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const isInvExpanded = expandedInvoices.has(invoice.id);
                  return (
                    <>
                      <TableRow key={invoice.id} className="border-brand-700 hover:bg-brand-700/50">
                        <TableCell className="text-white font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell className="text-gray-400">{invoice.orders?.po_number || (invoice.order_id ? invoice.order_id.slice(0, 8) : 'N/A')}</TableCell>
                        <TableCell className="text-white">${(invoice.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getInvoiceStatusBadge(invoice.status)}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">{new Date(invoice.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-gray-400">{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => toggleInvoiceExpand(invoice.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isInvExpanded && (
                        <TableRow key={`${invoice.id}-details`} className="border-brand-700 bg-brand-900/30">
                          <TableCell colSpan={7} className="py-3">
                            {invoice.orders?.order_items && invoice.orders.order_items.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-400 mb-2">Invoice Details (from Order {invoice.orders.po_number}):</p>
                                <div className="grid grid-cols-5 gap-2 text-xs text-gray-400 mb-1">
                                  <span>Product</span>
                                  <span>Package</span>
                                  <span>SKU</span>
                                  <span className="text-center">Qty</span>
                                  <span className="text-right">Line Total</span>
                                </div>
                                {invoice.orders.order_items.map((item) => (
                                  <div key={item.id} className="grid grid-cols-5 gap-2 text-sm">
                                    <span className="text-white">{item.product_name}</span>
                                    <span className="text-gray-300">{item.variant_name}</span>
                                    <span className="text-gray-400 font-mono">{item.sku}</span>
                                    <span className="text-center text-gray-300">{item.quantity}</span>
                                    <span className="text-right text-white">${item.line_total.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No detailed invoice items available.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAgreements = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" className="border-brand-700 text-gray-300 hover:text-white hover:bg-brand-700">
            <Download className="w-4 h-4 mr-2" />
            Export History
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#9a02d0]/10 flex items-center justify-center shrink-0">
              <PenTool className="w-5 h-5 text-[#9a02d0]" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">E-Signature Integration</h3>
              <p className="text-sm text-gray-400">
                Agreements are sent via DocuSign for electronic signature. Once signed, they will be automatically marked as completed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : agreements.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No agreements found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-brand-700 hover:bg-transparent">
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Version</TableHead>
                  <TableHead className="text-gray-400">Sent Date</TableHead>
                  <TableHead className="text-gray-400">Signed</TableHead>
                  <TableHead className="text-gray-400">Expires</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreements.map((agreement) => (
                  <TableRow key={agreement.id} className="border-brand-700 hover:bg-brand-700/50">
                    <TableCell className="text-white font-medium">{agreement.title}</TableCell>
                    <TableCell className="text-gray-400">{getAgreementTypeLabel(agreement.type)}</TableCell>
                    <TableCell className="text-gray-400">{agreement.version}</TableCell>
                    <TableCell className="text-gray-400">{new Date(agreement.sent_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-gray-400">
                      {agreement.signed_date ? new Date(agreement.signed_date).toLocaleDateString() : 'Not signed'}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {agreement.expires_date ? new Date(agreement.expires_date).toLocaleDateString() : 'No expiry'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getAgreementStatusBadge(agreement.status)}>{agreement.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {agreement.document_url && (
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" asChild>
                            <a href={agreement.document_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {(agreement.status === 'pending' || agreement.status === 'sent') && (
                          <Button variant="ghost" size="sm" className="text-[#44f80c] hover:text-[#44f80c]/80">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => {
    if (!user) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      );
    }
    return (
      <div className="space-y-8">
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-psy-neonPurple" />
              <CardTitle className="text-white">Business Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Business Name</Label>
                <Input value={settingsForm.business_name} onChange={e => setSettingsForm({...settingsForm, business_name: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="Your business name" />
              </div>
              <div>
                <Label className="text-gray-400">Phone</Label>
                <Input value={settingsForm.phone} onChange={e => setSettingsForm({...settingsForm, phone: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="(555) 000-0000" />
              </div>
              <div>
                <Label className="text-gray-400">Website</Label>
                <Input value={settingsForm.website} onChange={e => setSettingsForm({...settingsForm, website: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="https://yourbusiness.com" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-400">Street Address</Label>
                <Input value={settingsForm.address} onChange={e => setSettingsForm({...settingsForm, address: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="123 Main St" />
              </div>
              <div>
                <Label className="text-gray-400">City</Label>
                <Input value={settingsForm.city} onChange={e => setSettingsForm({...settingsForm, city: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="City" />
              </div>
              <div>
                <Label className="text-gray-400">State</Label>
                <Input value={settingsForm.state} onChange={e => setSettingsForm({...settingsForm, state: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="CA" />
              </div>
              <div>
                <Label className="text-gray-400">ZIP Code</Label>
                <Input value={settingsForm.zip} onChange={e => setSettingsForm({...settingsForm, zip: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="12345" />
              </div>
              <div>
                <Label className="text-gray-400">License Number</Label>
                <Input value={settingsForm.license_number} onChange={e => setSettingsForm({...settingsForm, license_number: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1" placeholder="License #" />
              </div>
            </div>
            {settingsMessage && (
              <p className={`text-sm ${settingsMessage.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{settingsMessage}</p>
            )}
            <Button onClick={handleSaveSettings} disabled={settingsSaving} className="btn-primary-gradient">
              {settingsSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-psy-neonPurple" />
              <CardTitle className="text-white">Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-400">Current Password</Label>
                <PasswordInput
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label className="text-gray-400">New Password</Label>
                <PasswordInput
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label className="text-gray-400">Confirm</Label>
                <PasswordInput
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className="bg-brand-900 border-brand-700 text-white mt-1"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.startsWith('Error') || passwordMessage.startsWith('Password') || passwordMessage.startsWith('Must') || passwordMessage.startsWith('Current') ? 'text-red-400' : 'text-green-400'}`}>{passwordMessage}</p>
            )}
            <Button onClick={handleChangePassword} disabled={passwordSaving} className="btn-primary-gradient">
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0514]">
        <Loader2 className="w-8 h-8 text-psy-neonPurple animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-brand-800 border-t border-brand-700 z-50 px-2 py-2">
        <div className="flex justify-around">
          {[
            { tab: 'overview' as const, icon: LayoutDashboard, label: 'Overview' },
            { tab: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
            { tab: 'invoices' as const, icon: FileText, label: 'Invoices' },
            { tab: 'agreements' as const, icon: FileSignature, label: 'Agreements' },
            { tab: 'settings' as const, icon: SettingsIcon, label: 'Settings' },
          ].map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === tab ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-1">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-col fixed h-full bg-brand-800 border-r border-brand-700 z-40">
        {/* Logo */}
        <div className="p-6 border-b border-brand-700">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-[#44f80c] font-bold text-xl">micro</span>
            <span className="text-[#9a02d0] font-bold text-xl">DOS</span>
            <span className="text-[#ff66c4] font-bold text-xl">(2)</span>
          </Link>
          <p className="text-gray-400 text-sm mt-1">Distributor Portal</p>
          {user && (
            <p className="text-gray-500 text-xs mt-1 truncate">{user.email}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { tab: 'overview' as const, icon: LayoutDashboard, label: 'Overview' },
            { tab: 'orders' as const, icon: ShoppingCart, label: 'Orders', count: orders.length },
            { tab: 'invoices' as const, icon: FileText, label: 'Invoices', count: stats.pendingInvoices },
            { tab: 'agreements' as const, icon: FileSignature, label: 'Agreements', count: pendingAgreementsCount },
          ].map(({ tab, icon: Icon, label, count }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                  : 'text-gray-400 hover:text-white hover:bg-brand-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              {count !== undefined && count > 0 && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-psy-neonPurple text-white' : 'bg-brand-700 text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}

          <div className="pt-4 border-t border-brand-700 mt-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                  : 'text-gray-400 hover:text-white hover:bg-brand-700'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'orders' && 'Orders'}
              {activeTab === 'invoices' && 'Invoices'}
              {activeTab === 'agreements' && 'Agreements'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <Link to="/products">
              <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
                <Package className="w-4 h-4 mr-2" />
                Browse Products
              </Button>
            </Link>
          </div>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'orders' && renderOrders()}
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'agreements' && renderAgreements()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </div>
    </div>
  );
}
