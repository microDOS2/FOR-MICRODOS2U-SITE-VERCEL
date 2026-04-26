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
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  PenTool,
  FileSignature,
  Send,
  Store,
  Plus,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { UserInfoBar } from '@/components/UserInfoBar';

interface Order {
  id: string;
  poNumber: string;
  date: string;
  items: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
}

interface Agreement {
  id: string;
  title: string;
  type: 'wholesale' | 'terms' | 'nda' | 'compliance';
  version: string;
  sentDate: string;
  signedDate?: string;
  expiresDate?: string;
  status: 'pending' | 'signed' | 'expired' | 'declined';
  signedBy?: string;
}

interface StoreLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

const mockOrders: Order[] = [
  { id: '1', poNumber: 'PO-2026-001', date: '2026-04-10', items: 50, total: 2450, status: 'delivered' },
  { id: '2', poNumber: 'PO-2026-002', date: '2026-04-08', items: 100, total: 4900, status: 'shipped' },
  { id: '3', poNumber: 'PO-2026-003', date: '2026-04-05', items: 25, total: 1225, status: 'processing' },
  { id: '4', poNumber: 'PO-2026-004', date: '2026-04-01', items: 75, total: 3675, status: 'pending' },
  { id: '5', poNumber: 'PO-2026-005', date: '2026-03-28', items: 200, total: 9800, status: 'delivered' },
];

const mockInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-2026-001', poNumber: 'PO-2026-001', date: '2026-04-10', dueDate: '2026-05-10', amount: 2450, status: 'paid' },
  { id: '2', invoiceNumber: 'INV-2026-002', poNumber: 'PO-2026-002', date: '2026-04-08', dueDate: '2026-05-08', amount: 4900, status: 'pending' },
  { id: '3', invoiceNumber: 'INV-2026-003', poNumber: 'PO-2026-003', date: '2026-04-05', dueDate: '2026-05-05', amount: 1225, status: 'pending' },
  { id: '4', invoiceNumber: 'INV-2026-004', poNumber: 'PO-2026-005', date: '2026-03-28', dueDate: '2026-04-28', amount: 9800, status: 'overdue' },
];

const mockAgreements: Agreement[] = [
  {
    id: '1',
    title: 'Wholesale Distribution Agreement',
    type: 'wholesale',
    version: 'v2.1',
    sentDate: '2026-04-01',
    signedDate: '2026-04-03',
    expiresDate: '2027-04-03',
    status: 'signed',
    signedBy: 'John Smith',
  },
  {
    id: '2',
    title: 'Terms of Service - Retail Partners',
    type: 'terms',
    version: 'v1.5',
    sentDate: '2026-04-10',
    status: 'pending',
  },
  {
    id: '3',
    title: 'Non-Disclosure Agreement',
    type: 'nda',
    version: 'v1.0',
    sentDate: '2026-03-15',
    signedDate: '2026-03-18',
    expiresDate: '2028-03-18',
    status: 'signed',
    signedBy: 'John Smith',
  },
  {
    id: '4',
    title: 'State Compliance Certification',
    type: 'compliance',
    version: 'v3.0',
    sentDate: '2026-04-12',
    status: 'pending',
  },
];

export function WholesalerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  // Auth guard: redirect to portal if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/wholesaler-portal');
    }
  }, [authLoading, user, navigate]);

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'agreements' | 'store-locations'>('overview');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null);
  const [storeForm, setStoreForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    license_number: '',
    is_primary: false,
  });

  const getStatusBadge = (status: Order['status']) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status];
  };

  const getInvoiceStatusBadge = (status: Invoice['status']) => {
    const styles = {
      paid: 'bg-green-500/10 text-green-400 border-green-500/20',
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status];
  };

  const getAgreementStatusBadge = (status: Agreement['status']) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      signed: 'bg-green-500/10 text-green-400 border-green-500/20',
      expired: 'bg-red-500/10 text-red-400 border-red-500/20',
      declined: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
    return styles[status];
  };

  const getAgreementTypeLabel = (type: Agreement['type']) => {
    const labels = {
      wholesale: 'Wholesale',
      terms: 'Terms of Service',
      nda: 'NDA',
      compliance: 'Compliance',
    };
    return labels[type];
  };

  const getStatusIcon = (status: Order['status']) => {
    const icons = {
      pending: Clock,
      processing: Package,
      shipped: Truck,
      delivered: CheckCircle,
      cancelled: AlertCircle,
    };
    return icons[status];
  };

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch = order.poNumber.toLowerCase().includes(orderSearch.toLowerCase());
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    return matchesSearch && matchesFilter;
  });

  const pendingAgreements = mockAgreements.filter((a) => a.status === 'pending').length;

  // Fetch store locations for the logged-in wholesaler
  useEffect(() => {
    const fetchStores = async () => {
      setStoresLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Fallback: load from localStorage for demo
          const saved = localStorage.getItem('wholesaler_stores');
          if (saved) {
            try { setStores(JSON.parse(saved)); } catch { setStores([]); }
          }
          setStoresLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .select('*')
          .eq('user_id', user.id)
          .order('is_primary', { ascending: false });
        if (error) {
          // Fallback to localStorage on error
          const saved = localStorage.getItem('wholesaler_stores');
          if (saved) {
            try { setStores(JSON.parse(saved)); } catch { setStores([]); }
          }
        } else if (data) {
          setStores(data as StoreLocation[]);
          localStorage.setItem('wholesaler_stores', JSON.stringify(data));
        }
      } catch {
        const saved = localStorage.getItem('wholesaler_stores');
        if (saved) {
          try { setStores(JSON.parse(saved)); } catch { setStores([]); }
        }
      }
      setStoresLoading(false);
    };
    if (activeTab === 'store-locations') {
      fetchStores();
    }
  }, [activeTab]);

  const openStoreDialog = (store?: StoreLocation) => {
    if (store) {
      setEditingStore(store);
      setStoreForm({
        name: store.name || '',
        address: store.address || '',
        city: store.city || '',
        state: store.state || '',
        zip: store.zip || '',
        phone: store.phone || '',
        email: store.email || '',
        license_number: store.license_number || '',
        is_primary: store.is_primary || false,
      });
    } else {
      setEditingStore(null);
      setStoreForm({ name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', license_number: '', is_primary: false });
    }
    setStoreDialogOpen(true);
  };

  const saveStore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'demo-user';
      const payload = {
        user_id: userId,
        name: storeForm.name,
        address: storeForm.address,
        city: storeForm.city,
        state: storeForm.state,
        zip: storeForm.zip,
        phone: storeForm.phone || null,
        email: storeForm.email || null,
        license_number: storeForm.license_number || null,
        is_primary: storeForm.is_primary,
        is_active: true,
      };
      if (editingStore) {
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .update(payload)
          .eq('id', editingStore.id)
          .select()
          .single();
        if (!error && data) {
          setStores((prev) => prev.map((s) => (s.id === editingStore.id ? data as StoreLocation : s)));
        } else {
          // Local fallback
          const updated: StoreLocation = { ...editingStore, ...payload, created_at: editingStore.created_at };
          setStores((prev) => prev.map((s) => (s.id === editingStore.id ? updated : s)));
          localStorage.setItem('wholesaler_stores', JSON.stringify(stores.map((s) => (s.id === editingStore.id ? updated : s))));
        }
      } else {
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .insert({ ...payload, lat: null, lng: null })
          .select()
          .single();
        if (!error && data) {
          setStores((prev) => [...prev, data as StoreLocation]);
        } else {
          // Local fallback
          const newStore: StoreLocation = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
          setStores((prev) => [...prev, newStore]);
          localStorage.setItem('wholesaler_stores', JSON.stringify([...stores, newStore]));
        }
      }
      setStoreDialogOpen(false);
    } catch {
      // Local fallback
      if (editingStore) {
        const updated: StoreLocation = { ...editingStore, name: storeForm.name, address: storeForm.address, city: storeForm.city, state: storeForm.state, zip: storeForm.zip, phone: storeForm.phone || null, email: storeForm.email || null, license_number: storeForm.license_number || null, is_primary: storeForm.is_primary };
        setStores((prev) => prev.map((s) => (s.id === editingStore.id ? updated : s)));
        localStorage.setItem('wholesaler_stores', JSON.stringify(stores.map((s) => (s.id === editingStore.id ? updated : s))));
      } else {
        const newStore: StoreLocation = { user_id: 'demo-user', name: storeForm.name, address: storeForm.address, city: storeForm.city, state: storeForm.state, zip: storeForm.zip, phone: storeForm.phone || null, email: storeForm.email || null, license_number: storeForm.license_number || null, is_primary: storeForm.is_primary, is_active: true, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        setStores((prev) => [...prev, newStore]);
        localStorage.setItem('wholesaler_stores', JSON.stringify([...stores, newStore]));
      }
      setStoreDialogOpen(false);
    }
  };

  const deleteStore = async (storeId: string) => {
    if (!confirm('Delete this store location?')) return;
    try {
      const { error } = await supabase.from('wholesaler_store_locations').delete().eq('id', storeId);
      if (!error) {
        setStores((prev) => prev.filter((s) => s.id !== storeId));
      } else {
        setStores((prev) => prev.filter((s) => s.id !== storeId));
        localStorage.setItem('wholesaler_stores', JSON.stringify(stores.filter((s) => s.id !== storeId)));
      }
    } catch {
      setStores((prev) => prev.filter((s) => s.id !== storeId));
      localStorage.setItem('wholesaler_stores', JSON.stringify(stores.filter((s) => s.id !== storeId)));
    }
  };

  const stats = {
    totalOrders: mockOrders.length,
    totalSpent: mockOrders.reduce((acc, order) => acc + order.total, 0),
    pendingInvoices: mockInvoices.filter((inv) => inv.status === 'pending').length,
    overdueAmount: mockInvoices.filter((inv) => inv.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0),
    pendingAgreements,
  };

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
            <p className="text-xs text-gray-500 mt-1">Lifetime purchases</p>
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
            <p className="text-xs text-gray-500 mt-1">Action required</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 cursor-pointer hover:bg-brand-700/50 transition-colors" onClick={() => setActiveTab('agreements')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pending Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-psy-neonPurple">{stats.pendingAgreements}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting signature</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="bg-brand-800 border-brand-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Recent Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('orders')}
              className="text-brand-accent hover:text-white"
            >
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">PO Number</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Items</TableHead>
                <TableHead className="text-gray-400">Total</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOrders.slice(0, 3).map((order) => (
                <TableRow key={order.id} className="border-brand-700">
                  <TableCell className="font-medium text-white">{order.poNumber}</TableCell>
                  <TableCell className="text-gray-300">{order.date}</TableCell>
                  <TableCell className="text-gray-300">{order.items}</TableCell>
                  <TableCell className="text-gray-300">${order.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadge(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Agreements Alert */}
      {pendingAgreements > 0 && (
        <Card className="bg-psy-neonPurple/10 border-psy-neonPurple/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-psy-neonPurple/20 flex items-center justify-center">
                  <FileSignature className="w-6 h-6 text-psy-neonPurple" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Action Required: Pending Agreements</h3>
                  <p className="text-sm text-gray-400">You have {pendingAgreements} agreement(s) awaiting your signature</p>
                </div>
              </div>
              <Button 
                className="btn-primary-gradient"
                onClick={() => setActiveTab('agreements')}
              >
                Review & Sign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-psy-neonPurple/20 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-psy-neonPurple" />
              </div>
              <div>
                <h3 className="font-bold text-white">Place New Order</h3>
                <p className="text-sm text-gray-400">Create a new purchase order</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-psy-neonGreen/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-psy-neonGreen" />
              </div>
              <div>
                <h3 className="font-bold text-white">View Invoices</h3>
                <p className="text-sm text-gray-400">Check payment status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-psy-neonPink/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-psy-neonPink" />
              </div>
              <div>
                <h3 className="font-bold text-white">Browse Products</h3>
                <p className="text-sm text-gray-400">View catalog & pricing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold text-white">Purchase Orders</h2>
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
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-brand-800 border-brand-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">PO Number</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Items</TableHead>
                <TableHead className="text-gray-400">Total</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                return (
                  <TableRow key={order.id} className="border-brand-700">
                    <TableCell className="font-medium text-white">{order.poNumber}</TableCell>
                    <TableCell className="text-gray-300">{order.date}</TableCell>
                    <TableCell className="text-gray-300">{order.items}</TableCell>
                    <TableCell className="text-gray-300">${order.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadge(order.status)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Invoices</h2>
        <Button className="btn-primary-gradient">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">Invoice #</TableHead>
                <TableHead className="text-gray-400">PO Reference</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Due Date</TableHead>
                <TableHead className="text-gray-400">Amount</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-brand-700">
                  <TableCell className="font-medium text-white">{invoice.invoiceNumber}</TableCell>
                  <TableCell className="text-gray-300">{invoice.poNumber}</TableCell>
                  <TableCell className="text-gray-300">{invoice.date}</TableCell>
                  <TableCell className="text-gray-300">{invoice.dueDate}</TableCell>
                  <TableCell className="text-gray-300">${invoice.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getInvoiceStatusBadge(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderStoreLocations = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Store Locations</h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage your retail store locations
          </p>
        </div>
        <Button onClick={() => openStoreDialog()} className="btn-primary-gradient">
          <Plus className="w-4 h-4 mr-2" />
          Add Store
        </Button>
      </div>

      {storesLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-psy-neonPurple border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-3">Loading stores...</p>
        </div>
      ) : stores.length === 0 ? (
        <Card className="bg-brand-800 border-brand-700">
          <CardContent className="p-12 text-center">
            <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Store Locations</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Add your retail store locations so customers can find you and sales reps can be assigned.
            </p>
            <Button onClick={() => openStoreDialog()} className="btn-primary-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Store
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className={`bg-brand-800 border-brand-700 ${store.is_primary ? 'ring-1 ring-psy-neonPurple/50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-psy-neonPurple/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-psy-neonPurple" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {store.name || 'Unnamed Store'}
                        {store.is_primary && (
                          <span className="text-[10px] bg-psy-neonPurple/20 text-psy-neonPurple px-2 py-0.5 rounded-full uppercase tracking-wide">Primary</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400">{store.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openStoreDialog(store)} className="text-gray-400 hover:text-white h-8 w-8 p-0">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteStore(store.id)} className="text-gray-400 hover:text-red-400 h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span>{store.city}, {store.state} {store.zip}</span>
                  </div>
                  {store.license_number && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                      <span>License: {store.license_number}</span>
                    </div>
                  )}
                  {store.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      <span>{store.phone}</span>
                    </div>
                  )}
                  {store.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-3.5 h-3.5 text-gray-500" />
                      <span>{store.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAgreements = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Agreements & Contracts</h2>
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
            <div className="w-10 h-10 rounded-lg bg-psy-neonPurple/20 flex items-center justify-center shrink-0">
              <PenTool className="w-5 h-5 text-psy-neonPurple" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">E-Signature Integration</h3>
              <p className="text-sm text-gray-400">
                All agreements are sent via our secure e-signature platform. You'll receive an email notification 
                when a new agreement is ready for your signature. Click "Review & Sign" to open the document 
                in our signing portal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-700">
                <TableHead className="text-gray-400">Document</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400">Version</TableHead>
                <TableHead className="text-gray-400">Sent Date</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAgreements.map((agreement) => (
                <TableRow key={agreement.id} className="border-brand-700">
                  <TableCell>
                    <div className="font-medium text-white">{agreement.title}</div>
                    {agreement.signedBy && (
                      <div className="text-xs text-gray-500">Signed by: {agreement.signedBy}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-brand-900 text-gray-300 border-brand-700">
                      {getAgreementTypeLabel(agreement.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">{agreement.version}</TableCell>
                  <TableCell className="text-gray-300">{agreement.sentDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getAgreementStatusBadge(agreement.status)}>
                      {agreement.status === 'signed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {agreement.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {agreement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {agreement.status === 'pending' ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="btn-primary-gradient"
                            >
                              <FileSignature className="w-4 h-4 mr-1" />
                              Review & Sign
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#150f24] border border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto !z-[9999]">
                            <DialogHeader>
                              <DialogTitle className="text-xl">{agreement.title}</DialogTitle>
                              <DialogDescription className="text-gray-400">
                                Version {agreement.version} • Sent on {agreement.sentDate}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="bg-[#0a0514] border border-white/10 rounded-lg p-6">
                                <h4 className="font-bold text-white mb-4">Document Preview</h4>
                                <div className="space-y-4 text-sm text-gray-300">
                                  <p>
                                    This is a preview of the agreement document. In a production environment, 
                                    this would display the actual PDF document with the full terms and conditions.
                                  </p>
                                  <div className="border-t border-white/10 pt-4">
                                    <h5 className="font-semibold text-white mb-2">Key Terms:</h5>
                                    <ul className="space-y-2 list-disc list-inside">
                                      <li>Minimum order quantities apply</li>
                                      <li>Net 30 payment terms</li>
                                      <li>Authorized reseller status required</li>
                                      <li>Compliance with state regulations mandatory</li>
                                      <li>Product returns subject to approval</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                <p className="text-sm text-yellow-400">
                                  <strong>Important:</strong> By signing this agreement, you acknowledge that you have 
                                  read and agree to all terms and conditions. This is a legally binding document.
                                </p>
                              </div>
                              <div className="flex gap-3">
                                <Button className="flex-1 bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold">
                                  <Send className="w-4 h-4 mr-2" />
                                  Proceed to Sign
                                </Button>
                                <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
                                  Download PDF
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agreement Types Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Wholesale</div>
          <div className="text-xs text-gray-500">Distribution partnership terms</div>
        </div>
        <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Terms of Service</div>
          <div className="text-xs text-gray-500">Platform usage policies</div>
        </div>
        <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">NDA</div>
          <div className="text-xs text-gray-500">Confidentiality agreements</div>
        </div>
        <div className="bg-brand-800 border border-brand-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Compliance</div>
          <div className="text-xs text-gray-500">Regulatory certifications</div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="pt-16 min-h-screen bg-brand-900">
      <UserInfoBar />
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-brand-800 border-r border-brand-700 min-h-screen fixed left-0 top-16 hidden lg:block">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-psy-neonPurple/20 flex items-center justify-center">
                <span className="text-psy-neonPurple font-bold">
                  {(user?.business_name || user?.email || 'W').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{user?.business_name || 'Wholesaler'}</p>
                <p className="text-xs text-gray-400">{user?.email || ''}</p>
              </div>
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'orders'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Orders
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'invoices'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <FileText className="w-5 h-5" />
                Invoices
              </button>
              <Link
                to="/products"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-brand-700"
              >
                <Package className="w-5 h-5" />
                Products
              </Link>
              <button
                onClick={() => setActiveTab('agreements')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'agreements'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <FileSignature className="w-5 h-5" />
                Agreements
                {pendingAgreements > 0 && (
                  <span className="ml-auto bg-psy-neonPurple text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingAgreements}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('store-locations')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'store-locations'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <Store className="w-5 h-5" />
                Store Locations
                {stores.length > 0 && (
                  <span className="ml-auto bg-brand-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                    {stores.length}
                  </span>
                )}
              </button>
            </nav>

            <div className="mt-8 pt-8 border-t border-brand-700">
              <button
                onClick={async () => { await signOut(); window.location.href = '/'; }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-brand-700 transition-colors text-left"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-brand-800 border-t border-brand-700 z-50">
          <div className="flex justify-around p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === 'overview' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-xs mt-1">Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === 'orders' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs mt-1">Orders</span>
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === 'invoices' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs mt-1">Invoices</span>
            </button>
            <Link
              to="/products"
              className="flex flex-col items-center p-2 rounded-lg text-gray-400"
            >
              <Package className="w-5 h-5" />
              <span className="text-xs mt-1">Products</span>
            </Link>
            <button
              onClick={() => setActiveTab('agreements')}
              className={`flex flex-col items-center p-2 rounded-lg relative ${
                activeTab === 'agreements' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <FileSignature className="w-5 h-5" />
              <span className="text-xs mt-1">Agreements</span>
              {pendingAgreements > 0 && (
                <span className="absolute -top-1 -right-1 bg-psy-neonPurple text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {pendingAgreements}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('store-locations')}
              className={`flex flex-col items-center p-2 rounded-lg relative ${
                activeTab === 'store-locations' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <Store className="w-5 h-5" />
              <span className="text-xs mt-1">Stores</span>
              {stores.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-700 text-gray-300 text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {stores.length}
                </span>
              )}
            </button>
          </div>
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
                {activeTab === 'store-locations' && 'Store Locations'}
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
            {activeTab === 'store-locations' && renderStoreLocations()}
          </div>
        </div>
      </div>

      {/* Store Location Dialog */}
      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto !z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingStore ? 'Edit Store Location' : 'Add Store Location'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingStore ? 'Update your store details below.' : 'Enter your store location details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="store-name" className="text-gray-300">Store Name</Label>
              <Input
                id="store-name"
                value={storeForm.name}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Main Street Wellness"
                className="bg-[#0a0514] border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-address" className="text-gray-300">Street Address</Label>
              <Input
                id="store-address"
                value={storeForm.address}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St"
                className="bg-[#0a0514] border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-city" className="text-gray-300">City</Label>
                <Input
                  id="store-city"
                  value={storeForm.city}
                  onChange={(e) => setStoreForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-state" className="text-gray-300">State</Label>
                <Input
                  id="store-state"
                  value={storeForm.state}
                  onChange={(e) => setStoreForm((prev) => ({ ...prev, state: e.target.value }))}
                  placeholder="CA"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-zip" className="text-gray-300">ZIP Code</Label>
              <Input
                id="store-zip"
                value={storeForm.zip}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, zip: e.target.value }))}
                placeholder="12345"
                className="bg-[#0a0514] border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-license" className="text-gray-300">Business License # <span className="text-red-400">*</span></Label>
              <Input
                id="store-license"
                value={storeForm.license_number}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, license_number: e.target.value }))}
                placeholder="License Number"
                className="bg-[#0a0514] border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-phone" className="text-gray-300">Phone</Label>
                <Input
                  id="store-phone"
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-email" className="text-gray-300">Email</Label>
                <Input
                  id="store-email"
                  value={storeForm.email}
                  onChange={(e) => setStoreForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="store@example.com"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                id="store-primary"
                checked={storeForm.is_primary}
                onCheckedChange={(checked) => setStoreForm((prev) => ({ ...prev, is_primary: checked === true }))}
                className="border-white/20 data-[state=checked]:bg-[#9a02d0]"
              />
              <Label htmlFor="store-primary" className="text-gray-300 text-sm cursor-pointer">
                Mark as primary location
              </Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStoreDialogOpen(false)}
                className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={saveStore}
                disabled={!storeForm.name || !storeForm.address || !storeForm.city || !storeForm.state || !storeForm.zip || !storeForm.license_number}
                className="flex-1 bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
              >
                {editingStore ? 'Save Changes' : 'Add Store'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
