import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { StoreLocator } from './pages/StoreLocator';
import { WholesaleApplication } from './pages/WholesaleApplication';
import { WholesalerPortal } from './pages/WholesalerPortal';
import { ContactPage } from './pages/ContactPage';
import { WholesalerDashboard } from './pages/WholesalerDashboard';
import { DistributorPortal } from './pages/DistributorPortal';
import { DistributorDashboard } from './pages/DistributorDashboard';
import { SalesManagerPortal } from './pages/SalesManagerPortal';
import { SalesManagerDashboard } from './pages/SalesManagerDashboard';
import { SalesManagerTeam } from './pages/SalesManagerTeam';
import { SalesManagerAccounts } from './pages/SalesManagerAccounts';
import { SalesManagerPerformance } from './pages/SalesManagerPerformance';
import { SalesManagerSettings } from './pages/SalesManagerSettings';
import { SalesManagerCommissions } from './pages/SalesManagerCommissions';
import { SalesManagerStores } from './pages/SalesManagerStores';
import { SalesManagerRepDashboard } from './pages/SalesManagerRepDashboard';
import { SalesRepPortal } from './pages/SalesRepPortal';
import { SalesRepDashboard } from './pages/SalesRepDashboard';
import { SalesRepAccounts } from './pages/SalesRepAccounts';
import { SalesRepStores } from './pages/SalesRepStores';
import { SalesRepOrders } from './pages/SalesRepOrders';
import { SalesRepNotifications } from './pages/SalesRepNotifications';
import { SalesRepSettings } from './pages/SalesRepSettings';
import { SalesRepCommissions } from './pages/SalesRepCommissions';
import SalesRepVisits from './pages/SalesRepVisits';
import { AdminPortal } from './pages/AdminPortal';
import { Products } from './pages/Products';
import { ShippingPortal } from './pages/ShippingPortal';
import { ShippingDashboard } from './pages/ShippingDashboard';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { CartProvider } from './context/CartContext';
import { RequireAuth } from './components/RequireAuth';
import { Toaster } from 'sonner';

// Admin Command Center (sidebar-based, /admin/*)
import { AdminLayout } from './admin/AdminLayout';
import { DashboardPage } from './admin/pages/DashboardPage';
import { UsersPage } from './admin/pages/UsersPage';
import { ApplicationsPage } from './admin/pages/ApplicationsPage';
import { AccountsPage } from './admin/pages/AssignmentsPage';
import { ProductsPage } from './admin/pages/ProductsPage';
import { VideosPage } from './admin/pages/VideosPage';
import { AgreementsPage } from './admin/pages/AgreementsPage';
import { StoresPage } from './admin/pages/StoresPage';
import { CommissionsPage } from './admin/pages/CommissionsPage';
import { ApprovalsPage } from './admin/pages/ApprovalsPage';
import { ConfigPage } from './admin/pages/ConfigPage';
import { AuditLogPage } from './admin/pages/AuditLogPage';
import { TransferHistoryPage } from './admin/pages/TransferHistoryPage';
import { TerritoryTransferPage } from './admin/pages/TerritoryTransferPage';
import { OrdersInvoicesPage } from './admin/pages/OrdersInvoicesPage';

function AppContent() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  // Check if current route is a portal/dashboard route (no Navigation/Footer needed)
  const isPortalRoute = [
    '/wholesaler-portal',
    '/wholesaler-dashboard',
    '/distributor-portal',
    '/distributor-dashboard',
    '/sales-manager-portal',
    '/sales-manager-dashboard',
    '/sales-manager-team',
    '/sales-manager-accounts',
    '/sales-manager-performance',
    '/sales-manager-commissions',
    '/sales-manager-stores',
    '/sales-manager-settings',
    '/sales-manager-rep-dashboard',
    '/sales-rep-portal',
    '/sales-rep-dashboard',
    '/sales-rep-accounts',
    '/sales-rep-stores',
    '/sales-rep-orders',
    '/sales-rep-commissions',
    '/sales-rep-notifications',
    '/sales-rep-settings',
    '/admin-portal',
    '/products',
    '/shipping-portal',
    '/shipping-dashboard',
  ].includes(location.pathname) || location.pathname.startsWith('/admin');

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0a0514]">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#150f24',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
            },
          }}
        />
        {!isPortalRoute && <Navigation />}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/store-locator" element={<StoreLocator />} />
          <Route path="/wholesale-application" element={<WholesaleApplication />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Auth-protected portal routes */}
          <Route path="/wholesaler-portal" element={<RequireAuth allowedRoles={['wholesaler', 'admin']}><WholesalerPortal /></RequireAuth>} />
          <Route path="/wholesaler-dashboard" element={<RequireAuth allowedRoles={['wholesaler', 'admin']}><WholesalerDashboard /></RequireAuth>} />
          <Route path="/distributor-portal" element={<RequireAuth allowedRoles={['distributor', 'admin']}><DistributorPortal /></RequireAuth>} />
          <Route path="/distributor-dashboard" element={<RequireAuth allowedRoles={['distributor', 'admin']}><DistributorDashboard /></RequireAuth>} />
          <Route path="/distributor-orders" element={<RequireAuth allowedRoles={['distributor', 'admin']}><Navigate to="/distributor-dashboard" replace /></RequireAuth>} />
          <Route path="/distributor-invoices" element={<RequireAuth allowedRoles={['distributor', 'admin']}><Navigate to="/distributor-dashboard" replace /></RequireAuth>} />
          <Route path="/distributor-agreements" element={<RequireAuth allowedRoles={['distributor', 'admin']}><Navigate to="/distributor-dashboard" replace /></RequireAuth>} />
          <Route path="/distributor-settings" element={<RequireAuth allowedRoles={['distributor', 'admin']}><Navigate to="/distributor-dashboard" replace /></RequireAuth>} />
          <Route path="/sales-manager-portal" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerPortal /></RequireAuth>} />
          <Route path="/sales-manager-dashboard" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerDashboard /></RequireAuth>} />
          <Route path="/sales-manager-team" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerTeam /></RequireAuth>} />
          <Route path="/sales-manager-accounts" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerAccounts /></RequireAuth>} />
          <Route path="/sales-manager-performance" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerPerformance /></RequireAuth>} />
          <Route path="/sales-manager-commissions" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerCommissions /></RequireAuth>} />
          <Route path="/sales-manager-stores" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerStores /></RequireAuth>} />
          <Route path="/sales-manager-settings" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerSettings /></RequireAuth>} />
          <Route path="/sales-manager-rep-dashboard" element={<RequireAuth allowedRoles={['sales_manager', 'admin']}><SalesManagerRepDashboard /></RequireAuth>} />
          <Route path="/sales-rep-portal" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepPortal /></RequireAuth>} />
          <Route path="/sales-rep-dashboard" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepDashboard /></RequireAuth>} />
          <Route path="/sales-rep-accounts" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepAccounts /></RequireAuth>} />
          <Route path="/sales-rep-stores" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepStores /></RequireAuth>} />
          <Route path="/sales-rep-orders" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepOrders /></RequireAuth>} />
          <Route path="/sales-rep-commissions" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepCommissions /></RequireAuth>} />
          <Route path="/sales-rep-notifications" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepNotifications /></RequireAuth>} />
          <Route path="/sales-rep-settings" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepSettings /></RequireAuth>} />
          <Route path="/sales-rep-visits" element={<RequireAuth allowedRoles={['sales_rep', 'admin']}><SalesRepVisits /></RequireAuth>} />
          <Route path="/admin-portal" element={<AdminPortal />} />
          <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
          <Route path="/shipping-portal" element={<RequireAuth allowedRoles={['shipping_fulfillment', 'admin']}><ShippingPortal /></RequireAuth>} />
          <Route path="/shipping-dashboard" element={<RequireAuth allowedRoles={['shipping_fulfillment', 'admin']}><ShippingDashboard /></RequireAuth>} />

          {/* Admin Command Center — /admin/* */}
          <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="assignments" element={<Navigate to="/admin/accounts" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="agreements" element={<AgreementsPage />} />
            <Route path="orders-invoices" element={<OrdersInvoicesPage />} />
            <Route path="fulfillment" element={<Navigate to="/admin/orders-invoices" replace />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="transfers" element={<TransferHistoryPage />} />
            <Route path="territory-transfer" element={<TerritoryTransferPage />} />
          </Route>

          {/* Redirect old /command-center URLs to /admin */}
          <Route path="/command-center" element={<Navigate to="/admin" replace />} />
          <Route path="/command-center/*" element={<Navigate to="/admin" replace />} />
        </Routes>
        {isLandingPage && <Footer />}
      </div>
    </CartProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

