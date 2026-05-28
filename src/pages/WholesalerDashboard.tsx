import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  LogOut,
  ChevronRight,
  Search,
  Filter,
  Eye,

  Clock,
  Truck,
  AlertCircle,
  Send,
  Store,
  Plus,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Settings as SettingsIcon,
  Lock,
  Building2,
  Save,
  CreditCard,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CheckoutModal } from '@/components/payment/CheckoutModal';
import { ExportDropdown } from '@/components/ExportDropdown';
import { EmptyState } from '@/components/EmptyState';
import { AccountRepCard } from '@/components/AccountRepCard';
import { exportData, storeColumns } from '@/lib/exportUtils';
import { StoreUploadModal } from '@/components/StoreUploadModal';
import { Pagination } from '@/components/Pagination';
import { orderColumns, invoiceColumns } from '@/lib/exportUtils';
import { ProductAccordion } from '@/components/products/ProductAccordion';
import { ProductTable } from '@/components/products/ProductTable';
import { StarterKitCard } from '@/components/products/StarterKitCard';
import { ViewToggle } from '@/components/products/ViewToggle';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartButton } from '@/components/cart/CartButton';
import type { UserRole, Product, WholesalerStarterKit } from '@/types/products';


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

// Types matching Supabase schema
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';
type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export function WholesalerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  // Auth guard: redirect to portal if not authenticated (with 3s grace period)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const timer = setTimeout(() => {
        // Double-check after 3s — only redirect if still no user
        navigate('/wholesaler-portal');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user, navigate]);

  // Fetch real orders and invoices from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setDataLoading(true);

      const [{ data: o, error: oErr }, { data: i, error: iErr }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, po_number, items, total, status, notes, created_at, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, order_id, amount, status, date, due_date, orders:order_id(po_number, notes, order_items(id, product_name, variant_name, sku, quantity, unit_price, line_total))')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
      ]);

      if (oErr) console.error('[WholesalerDashboard] orders error:', oErr);
      if (iErr) console.error('[WholesalerDashboard] invoices error:', iErr);

      setOrders((o as any[]) || []);
      setInvoices((i as any[]) || []);
      setDataLoading(false);
    };

    fetchData();
  }, [user]);

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'products' | 'agreements' | 'store-locations' | 'settings'>('overview');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');

  // Real data from Supabase
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [kit, setKit] = useState<WholesalerStarterKit | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productView, setProductView] = useState<'grid' | 'table'>('grid');
  const [productSearch, setProductSearch] = useState('');

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    business_name: '', phone: '', address: '',
    city: '', state: '', zip: '', website: '', license_number: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
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

  // Re-fetch fresh profile data from Supabase whenever Settings tab opens
  useEffect(() => {
    if (activeTab !== 'settings' || !user?.id) return;
    async function refreshProfile() {
      const { data, error } = await supabase
        .from('users')
        .select('business_name, phone, address, city, state, zip, website, license_number')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) {
        console.error('[Settings] refreshProfile error:', error);
        return;
      }
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

  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [showStoreUploadModal, setShowStoreUploadModal] = useState(false);
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

  const getStatusBadge = (status: OrderStatus) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
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
    const icons = {
      pending: Clock,
      processing: Package,
      shipped: Truck,
      cancelled: AlertCircle,
    };
    return icons[status];
  };

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

  const filteredInvoices = invoices.filter((invoice) => {
    const invDate = invoice.date ? invoice.date.slice(0, 10) : '';
    const matchesDateFrom = !invoiceDateFrom || invDate >= invoiceDateFrom;
    const matchesDateTo = !invoiceDateTo || invDate <= invoiceDateTo;
    return matchesDateFrom && matchesDateTo;
  });
  const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize);
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / invoicePageSize));

  // Fetch products for the catalog tab
  const fetchProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_products_with_variants');
      if (rpcError) throw rpcError;

      const dbProducts = rpcData?.products || [];
      const dbVariants = rpcData?.variants || [];

      // Build enriched variants (same logic as Products.tsx)
      const variantMap = new Map<string, any[]>();
      for (const v of dbVariants) {
        const list = variantMap.get(v.product_id) || [];
        list.push(v);
        variantMap.set(v.product_id, list);
      }

      const enrichedVariants = [...dbVariants];
      for (const p of dbProducts) {
        const pv = variantMap.get(p.id);
        if (!pv || pv.length === 0) {
          enrichedVariants.push({
            id: `default-${p.id}`, product_id: p.id, tier: 'individual',
            name: 'Individual', quantity: 1, total_pills: p.stock || 1,
            sku: p.sku || `${p.id.slice(0, 8)}-001`,
            msrp_price: p.retail_price || p.price * 2,
            wholesaler_price: p.price * 1.5,
            distributor_price: p.price,
            in_stock: p.stock > 0,
          });
        }
      }

      // Transform to frontend format
      const kitProduct = dbProducts.find((p: any) => p.sku === 'MD2-KIT');
      const regularProducts = dbProducts.filter((p: any) => p.sku !== 'MD2-KIT');

      const transformedProducts: Product[] = regularProducts.map((dbp: any) => {
        const productVariants = enrichedVariants.filter((v: any) => v.product_id === dbp.id);
        const firstVariant = productVariants[0];
        const basePillCount = firstVariant ? Math.round(firstVariant.total_pills / firstVariant.quantity) : 10;
        return {
          id: dbp.id, name: dbp.name, description: dbp.description || '',
          basePillCount, image: dbp.image_url || '/placeholder-box.png',
          packagingOptions: productVariants.map((v: any) => ({
            id: v.sku, tier: v.tier as 'individual' | 'case' | 'master_case' | 'special',
            name: v.name, quantity: v.quantity, totalPills: v.total_pills,
            pricing: { msrp: v.msrp_price, wholesalerPrice: v.wholesaler_price, distributorPrice: v.distributor_price },
            sku: v.sku, inStock: v.in_stock,
          })),
        };
      });

      let transformedKit: WholesalerStarterKit | null = null;
      if (kitProduct) {
        const kitVariants = enrichedVariants.filter((v: any) => v.product_id === kitProduct.id);
        const kitVariant = kitVariants[0];
        transformedKit = {
          id: kitProduct.id, name: kitProduct.name,
          description: kitProduct.description || 'Everything to get started selling microDOS(2)',
          contents: { boxes: 9, starterCards: 7, display: true, placard: true },
          totalPills: kitVariant?.total_pills || 104,
          pricing: {
            msrp: kitVariant?.msrp_price || kitProduct.retail_price || 474.65,
            wholesalerPrice: kitVariant?.wholesaler_price || 155.76,
            distributorPrice: kitVariant?.distributor_price || kitProduct.price || 116.82,
          },
          sku: kitProduct.sku,
          inStock: kitVariant?.in_stock ?? true,
        };
      }

      setProducts(transformedProducts);
      setKit(transformedKit);
    } catch (err: any) {
      setProductsError(err.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  // Load products when products tab is active
  useEffect(() => {
    if (activeTab === 'products' && products.length === 0) {
      fetchProducts();
    }
  }, [activeTab]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.packagingOptions.some(
          (po) => po.name.toLowerCase().includes(q) || po.sku.toLowerCase().includes(q)
        )
    );
  }, [products, productSearch]);

  const currentUserRole: UserRole = (user?.role as UserRole) || 'wholesaler';

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

  const handleImportStores = async (parsedStores: any[]) => {
    if (!user) return;
    try {
      let inserted = 0;
      let failed = 0;
      for (const s of parsedStores) {
        const { error } = await supabase.from('wholesaler_store_locations').insert({
          name: s.name, address: s.address, city: s.city, state: s.state,
          zip: s.zip || null, phone: s.phone || null, email: s.email || null,
          website: s.website || null, stock: s.stock || 'In Stock',
          is_primary: s.is_primary || false, is_active: true,
          lat: s.lat, lng: s.lng, user_id: user.id, source: 'admin',
        });
        if (error) { failed++; } else { inserted++; }
      }
      toast.success(`Imported ${inserted} stores${failed > 0 ? `, ${failed} failed` : ''}`);
      setShowStoreUploadModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    }
  };

  const stats = {
    totalOrders: orders.length,
    totalSpent: orders.reduce((acc, order) => acc + order.total, 0),
    pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
    overdueAmount: invoices.filter((inv) => inv.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0),
  };

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
      </div>

      {/* Your Sales Rep & Manager */}
      {user && <AccountRepCard accountId={user.id} />}

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
              {orders.length === 0 ? (
                <tr><td colSpan={5}><EmptyState type="orders" /></td></tr>
              ) : (
                orders.slice(0, 3).map((order) => (
                  <TableRow key={order.id} className="border-brand-700">
                    <TableCell className="font-medium text-white">{order.po_number}</TableCell>
                    <TableCell className="text-gray-300">{order.created_at?.slice(0, 10) || '—'}</TableCell>
                    <TableCell className="text-gray-300">{order.items}</TableCell>
                    <TableCell className="text-gray-300">${order.total.toLocaleString()}</TableCell>
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
          <Pagination
            currentPage={orderPage}
            totalPages={orderTotalPages}
            pageSize={orderPageSize}
            onPageChange={setOrderPage}
            onPageSizeChange={(size) => { setOrderPageSize(size); setOrderPage(1); }}
            totalItems={filteredOrders.length}
          />
        </CardContent>
      </Card>

      {/* Pending Agreements Alert — hidden */}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer" onClick={() => setActiveTab('products')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-psy-neonPurple/20 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-psy-neonPurple" />
              </div>
              <div>
                <h3 className="font-bold text-white">Place New Order</h3>
                <p className="text-sm text-gray-400">Browse products and order</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer" onClick={() => setActiveTab('invoices')}>
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
        <Card className="bg-brand-800 border-brand-700 hover:bg-brand-700/50 transition-colors cursor-pointer" onClick={() => setActiveTab('products')}>
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
              {dataLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">Loading orders...</TableCell></TableRow>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={6}><EmptyState type="orders" /></td></tr>
              ) : (
                paginatedOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  const isExpanded = expandedOrders.has(order.id);
                  return (
                    <>
                      <TableRow key={order.id} className="border-brand-700">
                        <TableCell className="font-medium text-white">{order.po_number}</TableCell>
                        <TableCell className="text-gray-300">{order.created_at?.slice(0, 10) || '—'}</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
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
                })
              )}
            </TableBody>
          </Table>
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
              {dataLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">Loading invoices...</TableCell></TableRow>
              ) : paginatedInvoices.length === 0 ? (
                <tr><td colSpan={7}><EmptyState type="invoices" /></td></tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const isInvExpanded = expandedInvoices.has(invoice.id);
                  return (
                    <>
                      <TableRow key={invoice.id} className="border-brand-700">
                        <TableCell className="font-medium text-white">{invoice.invoice_number}</TableCell>
                        <TableCell className="text-gray-300">{invoice.orders?.po_number || (invoice.order_id ? invoice.order_id.slice(0, 8) : '—')}</TableCell>
                        <TableCell className="text-gray-300">{invoice.date?.slice(0, 10) || '—'}</TableCell>
                        <TableCell className="text-gray-300">{invoice.due_date?.slice(0, 10) || '—'}</TableCell>
                        <TableCell className="text-gray-300">${invoice.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getInvoiceStatusBadge(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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
                            <ExportDropdown
                              data={[invoice]}
                              columns={invoiceColumns}
                              filename={`invoice-${invoice.invoice_number}`}
                              title={`Invoice ${invoice.invoice_number}`}
                              label=""
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-white"
                            />
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
                                <pre className="text-sm text-white whitespace-pre-wrap font-sans">{invoice.orders!.notes.replace(/;\s*/g, "\n")}</pre>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No detailed invoice items available.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
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
        </CardContent>
      </Card>
    </div>
  );

  const renderStoreLocations = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm">
            Manage your retail store locations
          </p>
        </div>
        <div className="flex gap-2">
          {stores.length > 0 && (
            <Button variant="outline" onClick={() => exportData('csv', stores, storeColumns, 'my-stores')} className="border-[#44f80c]/30 text-[#44f80c] hover:bg-[#44f80c]/10 hover:text-[#44f80c]">
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowStoreUploadModal(true)} className="border-[#9a02d0]/30 text-[#9a02d0] hover:bg-[#9a02d0]/10 hover:text-[#9a02d0]">
            <Upload className="w-4 h-4 mr-2" /> Upload
          </Button>
          <Button onClick={() => openStoreDialog()} className="btn-primary-gradient">
            <Plus className="w-4 h-4 mr-2" />
            Add Store
          </Button>
        </div>
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
                <PasswordInput value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                  className="bg-brand-900 border-brand-700 mt-1" placeholder="••••••••" />
              </div>
              <div>
                <Label className="text-gray-400">New Password</Label>
                <PasswordInput value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                  className="bg-brand-900 border-brand-700 mt-1" placeholder="••••••••" />
              </div>
              <div>
                <Label className="text-gray-400">Confirm</Label>
                <PasswordInput value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className="bg-brand-900 border-brand-700 mt-1" placeholder="••••••••" />
              </div>
            </div>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.startsWith('Error') || passwordMessage.includes('not match') || passwordMessage.includes('incorrect') || passwordMessage.includes('6') ? 'text-red-400' : 'text-green-400'}`}>{passwordMessage}</p>
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

  return (
    <main className="min-h-screen bg-brand-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-brand-800 border-r border-brand-700 min-h-screen fixed left-0 top-0 hidden lg:block">
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
              <button
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'products'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <Package className="w-5 h-5" />
                Products
              </button>
              {/* <button
                onClick={() => setActiveTab('agreements')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'agreements'
                    ? 'bg-psy-neonPurple/20 text-psy-neonPurple'
                    : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <FileSignature className="w-5 h-5" />
                Agreements
                {pendingAgreementsCount > 0 && (
                  <span className="ml-auto bg-psy-neonPurple text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingAgreementsCount}
                  </span>
                )}
              </button> */}
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
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'settings' ? 'bg-psy-neonPurple/20 text-psy-neonPurple' : 'text-gray-400 hover:text-white hover:bg-brand-700'
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
                Settings
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
            <button
              onClick={() => setActiveTab('products')}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === 'products' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="text-xs mt-1">Products</span>
            </button>
            {/* <button
              onClick={() => setActiveTab('agreements')}
              className={`flex flex-col items-center p-2 rounded-lg relative ${
                activeTab === 'agreements' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <FileSignature className="w-5 h-5" />
              <span className="text-xs mt-1">Agreements</span>
              {pendingAgreementsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-psy-neonPurple text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {pendingAgreementsCount}
                </span>
              )}
            </button> */}
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
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center p-2 rounded-lg ${
                activeTab === 'settings' ? 'text-psy-neonPurple' : 'text-gray-400'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-xs mt-1">Settings</span>
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
                {activeTab === 'products' && 'Product Catalog'}
                {activeTab === 'store-locations' && 'Store Locations'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab === 'products' && (
                <div className="sticky top-4 z-40">
                  <CartButton />
                </div>
              )}
            </div>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'invoices' && renderInvoices()}
            {activeTab === 'products' && (
              <>
                <CartDrawer />
                {productsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
                  </div>
                ) : productsError ? (
                  <div className="text-center py-8 text-red-400">
                    <p>Failed to load products</p>
                    <button onClick={fetchProducts} className="text-sm text-[#9a02d0] hover:text-[#ff66c4] mt-2">Retry</button>
                  </div>
                ) : (
                  <>
                    {/* View Toggle & Search */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <ViewToggle view={productView} onViewChange={setProductView} />
                        <span className="text-gray-400 text-sm">
                          {filteredProducts.reduce((acc, p) => acc + p.packagingOptions.length, 0)} options
                        </span>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full bg-[#150f24] border border-white/10 text-white rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#9a02d0]"
                        />
                      </div>
                    </div>

                    {/* Starter Kit */}
                    {kit && (
                      <div className="mb-8">
                        <StarterKitCard kit={kit} role={currentUserRole} />
                      </div>
                    )}

                    {/* Products */}
                    {productView === 'grid' ? (
                      <div className="space-y-6">
                        {filteredProducts.map((product) => (
                          <ProductAccordion key={product.id} product={product} role={currentUserRole} />
                        ))}
                      </div>
                    ) : (
                      <ProductTable products={filteredProducts} role={currentUserRole} />
                    )}

                    {/* Empty State */}
                    {filteredProducts.length === 0 && (
                      <div className="text-center py-16">
                        <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {productSearch ? 'No products found' : 'No products available'}
                        </h3>
                        <p className="text-gray-400">
                          {productSearch ? 'Try adjusting your search query' : 'Products will appear once the catalog is configured'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {activeTab === 'store-locations' && renderStoreLocations()}
            {activeTab === 'settings' && renderSettings()}
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
      {showStoreUploadModal && (
        <StoreUploadModal onClose={() => setShowStoreUploadModal(false)} onImport={handleImportStores} />
      )}
    </main>
  );
}
