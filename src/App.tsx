import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { StoreLocator } from './pages/StoreLocator';
import { WholesaleApplication } from './pages/WholesaleApplication';
import { WholesalerPortal } from './pages/WholesalerPortal';
import { ContactPage } from './pages/ContactPage';
import { WholesalerDashboard } from './pages/WholesalerDashboard';
import { DistributorPortal } from './pages/DistributorPortal';
import { DistributorDashboard } from './pages/DistributorDashboard';
import { DistributorOrders } from './pages/DistributorOrders';
import { DistributorInvoices } from './pages/DistributorInvoices';
import { DistributorAgreements } from './pages/DistributorAgreements';
import { DistributorSettings } from './pages/DistributorSettings';
import { SalesManagerPortal } from './pages/SalesManagerPortal';
import { SalesManagerDashboard } from './pages/SalesManagerDashboard';
import { SalesManagerTeam } from './pages/SalesManagerTeam';
import { SalesManagerAccounts } from './pages/SalesManagerAccounts';
import { SalesManagerPerformance } from './pages/SalesManagerPerformance';
import { SalesManagerSettings } from './pages/SalesManagerSettings';
import { SalesManagerStores } from './pages/SalesManagerStores';
import { SalesRepPortal } from './pages/SalesRepPortal';
import { SalesRepDashboard } from './pages/SalesRepDashboard';
import { AdminPortal } from './pages/AdminPortal';
import { Products } from './pages/Products';
import { InfluencerPortal } from './pages/InfluencerPortal';
import { InfluencerDashboard } from './pages/InfluencerDashboard';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { CartProvider } from './context/CartContext';
import { Toaster } from 'sonner';

// Admin Command Center (sidebar-based, /admin/*)
import { AdminLayout } from './admin/AdminLayout';
import { DashboardPage } from './admin/pages/DashboardPage';
import { UsersPage } from './admin/pages/UsersPage';
import { ApplicationsPage } from './admin/pages/ApplicationsPage';
import { AccountsPage } from './admin/pages/AssignmentsPage';
import { InfluencersPage } from './admin/pages/InfluencersPage';
import { ProductsPage } from './admin/pages/ProductsPage';
import { OrdersPage } from './admin/pages/OrdersPage';
import { InvoicesPage } from './admin/pages/InvoicesPage';
import { AgreementsPage } from './admin/pages/AgreementsPage';
import { StoresPage } from './admin/pages/StoresPage';
import { ApprovalsPage } from './admin/pages/ApprovalsPage';
import { ConfigPage } from './admin/pages/ConfigPage';
import { AuditLogPage } from './admin/pages/AuditLogPage';
import { TransferHistoryPage } from './admin/pages/TransferHistoryPage';
import { TerritoryTransferPage } from './admin/pages/TerritoryTransferPage';

function AppContent() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  // Check if current route is a portal/dashboard route (no Navigation/Footer needed)
  const isPortalRoute = [
    '/wholesaler-portal',
    '/wholesaler-dashboard',
    '/distributor-portal',
    '/distributor-dashboard',
    '/distributor-orders',
    '/distributor-invoices',
    '/distributor-agreements',
    '/distributor-settings',
    '/sales-manager-portal',
    '/sales-manager-dashboard',
    '/sales-manager-team',
    '/sales-manager-accounts',
    '/sales-manager-performance',
    '/sales-manager-stores',
    '/sales-manager-settings',
    '/sales-rep-portal',
    '/sales-rep-dashboard',
    '/admin-portal',
    '/products',
    '/influencer-portal',
    '/influencer-dashboard',
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
          <Route path="/wholesaler-portal" element={<WholesalerPortal />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/wholesaler-dashboard" element={<WholesalerDashboard />} />
          <Route path="/distributor-portal" element={<DistributorPortal />} />
          <Route path="/distributor-dashboard" element={<DistributorDashboard />} />
          <Route path="/distributor-orders" element={<DistributorOrders />} />
          <Route path="/distributor-invoices" element={<DistributorInvoices />} />
          <Route path="/distributor-agreements" element={<DistributorAgreements />} />
          <Route path="/distributor-settings" element={<DistributorSettings />} />
          <Route path="/sales-manager-portal" element={<SalesManagerPortal />} />
          <Route path="/sales-manager-dashboard" element={<SalesManagerDashboard />} />
          <Route path="/sales-manager-team" element={<SalesManagerTeam />} />
          <Route path="/sales-manager-accounts" element={<SalesManagerAccounts />} />
          <Route path="/sales-manager-performance" element={<SalesManagerPerformance />} />
          <Route path="/sales-manager-stores" element={<SalesManagerStores />} />
          <Route path="/sales-manager-settings" element={<SalesManagerSettings />} />
          <Route path="/sales-rep-portal" element={<SalesRepPortal />} />
          <Route path="/sales-rep-dashboard" element={<SalesRepDashboard />} />
          <Route path="/admin-portal" element={<AdminPortal />} />
          <Route path="/products" element={<Products />} />
          <Route path="/influencer-portal" element={<InfluencerPortal />} />
          <Route path="/influencer-dashboard" element={<InfluencerDashboard />} />

          {/* Admin Command Center — /admin/* */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          <Route path="assignments" element={<Navigate to="/admin/accounts" replace />} />
            <Route path="influencers" element={<InfluencersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="agreements" element={<AgreementsPage />} />
            <Route path="stores" element={<StoresPage />} />
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
