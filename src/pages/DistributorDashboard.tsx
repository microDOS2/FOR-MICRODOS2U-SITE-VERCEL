import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  LogOut,
  ChevronRight,
  Search,
  Eye,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  Send,
  Settings as SettingsIcon,
  Lock,
  Building2,
  Save,
  Loader2,
  CreditCard,
  Download,
  Upload,
  MapPin,
  Phone,
  Store,
  Globe,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CheckoutModal } from '@/components/payment/CheckoutModal';
import { ExportDropdown } from '@/components/ExportDropdown';
import { EmptyState } from '@/components/EmptyState';
import { AccountRepCard } from '@/components/AccountRepCard';
import { Pagination } from '@/components/Pagination';
import { orderColumns, invoiceColumns, exportData, storeColumns } from '@/lib/exportUtils';
import { StoreUploadModal } from '@/components/StoreUploadModal';

// Types
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'my-account' | 'my-stores' | 'settings'>('overview');
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
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
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

  // Password reset email state
  const [resetEmailSending, setResetEmailSending] = useState(false);
  const [resetEmailMessage, setResetEmailMessage] = useState<string | null>(null);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<{ id: string; amount: number; invoiceNumber: string } | null>(null);

  // Date range filters
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');

  // Pagination state
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(25);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(25);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: o, error: oErr }, { data: i, error: iErr }] = await Promise.all([
        supabase.from('orders').select('id, po_number, items, total, status, notes, created_at, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, invoice_number, order_id, amount, status, date, due_date, orders:order_id(po_number, notes, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total))').eq('user_id', user.id).order('date', { ascending: false }),
      ]);
      if (oErr) console.error('[DistributorDashboard] orders error:', oErr);
      if (iErr) console.error('[DistributorDashboard] invoices error:', iErr);
      setOrders((o as any[]) || []);
      setInvoices((i as any[]) || []);
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

  // ──── MY STORES (Customer Locations) ────

  const [myStores, setMyStores] = useState<any[]>([]);
  const [myStoresLoading, setMyStoresLoading] = useState(false);
  const [showStoreUploadModal, setShowStoreUploadModal] = useState(false);

  useEffect(() => {
    if (!user || activeTab !== 'my-stores') return;
    const fetchMyStores = async () => {
      setMyStoresLoading(true);
      try {
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) console.error(error);
        setMyStores(data || []);
      } catch (e) { console.error(e); }
      setMyStoresLoading(false);
    };
    fetchMyStores();
  }, [user, activeTab]);

  const handleImportStores = async (parsedStores: any[]) => {
    if (!user) return;
    try {
      let inserted = 0;
      let linked = 0;
      let failed = 0;
      for (const s of parsedStores) {
        // Check if this store already exists at this address
        const { data: existing } = await supabase
          .from('wholesaler_store_locations')
          .select('id,name')
          .ilike('address', s.address)
          .ilike('city', s.city || '')
          .eq('state', s.state || '')
          .limit(1);

        if (existing && existing.length > 0) {
          linked++;
        }

        const { error } = await supabase.from('wholesaler_store_locations').insert({
          name: s.name, address: s.address, city: s.city, state: s.state,
          zip: s.zip || null, phone: s.phone || null, email: s.email || null,
          website: s.website || null, stock: s.stock || 'In Stock',
          is_primary: s.is_primary || false, is_active: true,
          lat: s.lat, lng: s.lng, user_id: user.id,
          source: 'distributor',
        });
        if (error) { console.error(error); failed++; } else { inserted++; }
      }
      const parts = [`${inserted} new`];
      if (linked > 0) parts.push(`${linked} linked`);
      if (failed > 0) parts.push(`${failed} failed`);
      toast.success(`Imported: ${parts.join(', ')}`);
      setShowStoreUploadModal(false);
      // Refresh
      const { data } = await supabase.from('wholesaler_store_locations').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMyStores(data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    }
  };

  const stats = {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
    overdueAmount: invoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount || 0), 0),
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(orderSearch.toLowerCase());
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    const orderDate = order.created_at ? order.created_at.slice(0, 10) : '';
    const matchesDateFrom = !orderDateFrom || orderDate >= orderDateFrom;
    const matchesDateTo = !orderDateTo || orderDate <= orderDateTo;
    return matchesSearch && matchesFilter && matchesDateFrom && matchesDateTo;
  });
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);
  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));

  // Filtered invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const invDate = invoice.date ? invoice.date.slice(0, 10) : '';
    const matchesDateFrom = !invoiceDateFrom || invDate >= invoiceDateFrom;
    const matchesDateTo = !invoiceDateTo || invDate <= invoiceDateTo;
    return matchesDateFrom && matchesDateTo;
  });
  const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize);
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / invoicePageSize));


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

  // Send password reset email
  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setResetEmailSending(true);
    setResetEmailMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    setResetEmailSending(false);
    if (error) setResetEmailMessage('Error: ' + error.message);
    else setResetEmailMessage('Password reset email sent! Check your inbox.');
  };

  // ─── Render Functions ──────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Your Sales Rep & Manager */}
      {user && <AccountRepCard accountId={user.id} />}

      {/* Pending Agreements Alert — hidden */}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/products">
          <Card className="bg-brand-800 border-brand-700 cursor-pointer card-hover">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#44f80c]/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-[#44f80c]" />
              </div>
              <div>
                <h3 className="font-bold text-white">Place New Order</h3>
                <p className="text-sm text-gray-400">Browse products and submit a purchase order</p>
              </div>
            </CardContent>
          </Card>
        </Link>
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
          <Select value={orderFilter} onValueChange={setOrderFilter}>
            <SelectTrigger className="w-[140px] bg-brand-900 border-brand-700 text-white">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-brand-900 border-brand-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-2">
        <Input type="date" value={orderDateFrom} onChange={(e) => { setOrderDateFrom(e.target.value); setOrderPage(1); }} className="bg-brand-900 border-brand-700 text-white w-auto" />
        <span className="text-gray-500 self-center">to</span>
        <Input type="date" value={orderDateTo} onChange={(e) => { setOrderDateTo(e.target.value); setOrderPage(1); }} className="bg-brand-900 border-brand-700 text-white w-auto" />
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : paginatedOrders.length === 0 ? (
            <EmptyState type="orders" />
          ) : (
            <>
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
                {paginatedOrders.map((order) => {
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
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => toggleOrderExpand(order.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <ExportDropdown
                              data={[order]}
                              columns={orderColumns}
                              filename={`order-${order.po_number}`}
                              title={`Order ${order.po_number}`}
                              label=""
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-white"
                            />
                          </div>
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
                                {order.order_items.map((item: any) => (
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
                                <pre className="text-sm text-white whitespace-pre-wrap font-sans">{order.notes.replace(/;\s*/g, "\n")}</pre>
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
            <Pagination
              currentPage={orderPage}
              totalPages={orderTotalPages}
              pageSize={orderPageSize}
              onPageChange={setOrderPage}
              onPageSizeChange={(size) => { setOrderPageSize(size); setOrderPage(1); }}
              totalItems={filteredOrders.length}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <ExportDropdown
          data={invoices}
          columns={invoiceColumns}
          filename="all-invoices"
          title="Invoice Export"
          label="Export All"
          variant="default"
          className="btn-primary-gradient border-0"
        />
        <div className="flex gap-2 items-center">
          <Input type="date" value={invoiceDateFrom} onChange={(e) => { setInvoiceDateFrom(e.target.value); setInvoicePage(1); }} className="bg-brand-900 border-brand-700 text-white w-auto" />
          <span className="text-gray-500">to</span>
          <Input type="date" value={invoiceDateTo} onChange={(e) => { setInvoiceDateTo(e.target.value); setInvoicePage(1); }} className="bg-brand-900 border-brand-700 text-white w-auto" />
        </div>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          {dataLoading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-psy-neonPurple" /></div>
          ) : paginatedInvoices.length === 0 ? (
            <EmptyState type="invoices" />
          ) : (
            <>
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
                {paginatedInvoices.map((invoice) => {
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
                          <div className="flex gap-2 justify-end">
                            {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#44f80c] hover:text-[#44f80c]/80 hover:bg-[#44f80c]/10"
                                onClick={() => {
                                  setPaymentInvoice({
                                    id: invoice.id,
                                    amount: invoice.amount,
                                    invoiceNumber: invoice.invoice_number,
                                  });
                                  setPaymentModalOpen(true);
                                }}
                                title="Pay Now"
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => toggleInvoiceExpand(invoice.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
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
                                {invoice.orders.order_items.map((item: any) => (
                                  <div key={item.id} className="grid grid-cols-5 gap-2 text-sm">
                                    <span className="text-white">{item.product_name}</span>
                                    <span className="text-gray-300">{item.variant_name}</span>
                                    <span className="text-gray-400 font-mono">{item.sku}</span>
                                    <span className="text-center text-gray-300">{item.quantity}</span>
                                    <span className="text-right text-white">${item.line_total.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : invoice.orders?.notes ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-400 mb-2">Invoice Details (from Order {invoice.orders.po_number}):</p>
                                <pre className="text-sm text-white whitespace-pre-wrap font-sans">{invoice.orders.notes.replace(/;\s*/g, "\n")}</pre>
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
            <Pagination
              currentPage={invoicePage}
              totalPages={invoiceTotalPages}
              pageSize={invoicePageSize}
              onPageChange={setInvoicePage}
              onPageSizeChange={(size) => { setInvoicePageSize(size); setInvoicePage(1); }}
              totalItems={filteredInvoices.length}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // My Account tab - shows distributor profile info (single location)
  const renderMyAccount = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">My Account</h2>
        <p className="text-gray-400 text-sm">
          Your business information and distribution location
        </p>
      </div>

      <Card className="bg-brand-800 border-brand-700 max-w-2xl">
        <CardContent className="p-6 space-y-6">
          {/* Business Name */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ff66c4]/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-[#ff66c4]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">{user?.business_name || 'Your Business'}</h3>
              <p className="text-gray-400 text-sm">Distributor Account</p>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-white font-medium">Business Location</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
                <p className="text-gray-300">{user?.address || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">City</p>
                <p className="text-gray-300">{user?.city || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">State</p>
                <p className="text-gray-300">{user?.state || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">ZIP</p>
                <p className="text-gray-300">{user?.zip || 'Not set'}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-white font-medium">Contact Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                <p className="text-gray-300">{user?.email || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                <p className="text-gray-300">{user?.phone || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Contact Person</p>
                <p className="text-gray-300">{user?.contact_name || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">License</p>
                <p className="text-gray-300">{user?.license_number || 'Not set'}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Assigned Sales Rep — uses same component as Overview */}
          <AccountRepCard accountId={user.id} />

          <div className="pt-2">
            <p className="text-xs text-gray-500">
              To update your business information, contact your account administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMyStores = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">My Customer Stores</h2>
          <p className="text-gray-400 text-sm">
            Retail locations you distribute to ({myStores.length} stores)
          </p>
        </div>
        <div className="flex gap-2">
          {myStores.length > 0 && (
            <Button variant="outline" onClick={() => exportData('csv', myStores, storeColumns, 'my-customer-stores')} className="border-[#44f80c]/30 text-[#44f80c] hover:bg-[#44f80c]/10 hover:text-[#44f80c]">
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowStoreUploadModal(true)} className="border-[#9a02d0]/30 text-[#9a02d0] hover:bg-[#9a02d0]/10 hover:text-[#9a02d0]">
            <Upload className="w-4 h-4 mr-2" /> Upload CSV
          </Button>
        </div>
      </div>

      {myStoresLoading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-psy-neonPurple mx-auto" /></div>
      ) : myStores.length === 0 ? (
        <Card className="bg-brand-800 border-brand-700">
          <CardContent className="p-12 text-center">
            <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Customer Stores Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Upload a CSV file with your retail customer locations to manage your distribution network.
            </p>
            <Button onClick={() => setShowStoreUploadModal(true)} className="btn-primary-gradient">
              <Upload className="w-4 h-4 mr-2" />
              Upload Store List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myStores.map((store) => (
            <Card key={store.id} className="bg-brand-800 border-brand-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#ff66c4]/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-[#ff66c4]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{store.name || 'Unnamed Store'}</h3>
                      <p className="text-sm text-gray-400">{store.address}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span>{store.city}, {store.state} {store.zip}</span>
                  </div>
                  {store.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      <span>{store.phone}</span>
                    </div>
                  )}
                  {store.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Globe className="w-3.5 h-3.5 text-gray-500" />
                      <span>{store.email}</span>
                    </div>
                  )}
                  {store.contact_name && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>Contact: {store.contact_name}</span>
                    </div>
                  )}
                  {store.lat && store.lng && (
                    <span className="text-xs text-gray-600">Lat: {store.lat}, Lng: {store.lng}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showStoreUploadModal && (
        <StoreUploadModal onClose={() => setShowStoreUploadModal(false)} onImport={handleImportStores} />
      )}
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

        {/* Password Reset Email */}
        <Card className="bg-brand-800 border-brand-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-psy-neonPurple" />
              <CardTitle className="text-white">Forgot Your Password?</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400">
              If you don&apos;t know your current password, we can send a reset link to your email address:
              <span className="text-white font-medium block mt-1">{user?.email}</span>
            </p>
            {resetEmailMessage && (
              <p className={`text-sm ${resetEmailMessage.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{resetEmailMessage}</p>
            )}
            <Button onClick={handleSendResetEmail} disabled={resetEmailSending} variant="outline" className="border-[#9a02d0] text-[#9a02d0] hover:bg-[#9a02d0]/10">
              {resetEmailSending ? 'Sending...' : (<><Send className="w-4 h-4 mr-2" />Send Reset Email</>)}
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
            { tab: 'my-account' as const, icon: Building2, label: 'My Account' },
            { tab: 'my-stores' as const, icon: Store, label: 'My Stores' },
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
            { tab: 'my-account' as const, icon: Building2, label: 'My Account' },
            { tab: 'my-stores' as const, icon: Store, label: 'My Stores', count: myStores.length },
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

          <Link
            to="/products"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-brand-700 transition-colors"
          >
            <Package className="w-5 h-5" />
            <span>Products</span>
          </Link>

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
              {activeTab === 'my-account' && 'My Account'}
              {activeTab === 'my-stores' && 'My Customer Stores'}
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
          {activeTab === 'my-account' && renderMyAccount()}
          {activeTab === 'my-stores' && renderMyStores()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </div>

      {/* Payment Modal — Authorize.net Checkout */}
      {paymentInvoice && (
        <CheckoutModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentInvoice(null);
          }}
          amount={paymentInvoice.amount}
          invoiceId={paymentInvoice.invoiceNumber}
          customerEmail={user?.email || ''}
          description={`Payment for Invoice ${paymentInvoice.invoiceNumber}`}
          onPaymentSuccess={(result) => {
            supabase
              .from('invoices')
              .update({ status: 'paid', transaction_id: result.transactionId })
              .eq('id', paymentInvoice.id)
              .then(({ error }) => {
                if (error) console.error('Failed to update invoice:', error);
                else {
                  setInvoices((prev) =>
                    prev.map((inv) =>
                      inv.id === paymentInvoice.id
                        ? { ...inv, status: 'paid', transaction_id: result.transactionId }
                        : inv
                    )
                  );
                }
              });
          }}
          onPaymentError={(error) => {
            console.error('Payment error:', error);
          }}
        />
      )}

    </div>
  );
}
