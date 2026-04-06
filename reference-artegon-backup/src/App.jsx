import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Module 1: PLM
import PartsList from './pages/parts/PartsList';
import PartDetail from './pages/parts/PartDetail';
import ModelsList from './pages/parts/ModelsList';
import ModelDetail from './pages/parts/ModelDetail';
import StockMovements from './pages/parts/StockMovements';

// Module 2: MES
import WorkCenters from './pages/workorders/WorkCenters';
import Machines from './pages/workorders/Machines';
import WorkOrderList from './pages/workorders/WorkOrderList';
import WorkOrderDetail from './pages/workorders/WorkOrderDetail';
import GanttPlan from './pages/workorders/GanttPlan';

// Module 3: QMS
import InspectionPlans from './pages/qc/InspectionPlans';
import InspectionsList from './pages/qc/InspectionsList';
import InspectionDetail from './pages/qc/InspectionDetail';
import NcrRecords from './pages/qc/NcrRecords';
import NCRDetail from './pages/qc/NCRDetail';
import MeasuringTools from './pages/qc/MeasuringTools';

// Module 4: PDM (Documents)
import DocumentsList from './pages/documents/DocumentsList';

// Module 5: SCM (Purchasing)
import PurchasingDashboard from './pages/purchasing/PurchasingDashboard';
import MRPDashboard from './pages/purchasing/MRPDashboard';
import RFQModule from './pages/purchasing/RFQModule';
import ASNList from './pages/purchasing/ASNList';
import PurchaseRequests from './pages/purchasing/PurchaseRequests';
import PurchaseOrders from './pages/purchasing/PurchaseOrders';
import InventoryReceipts from './pages/purchasing/InventoryReceipts';
import SuppliersList from './pages/purchasing/SuppliersList';
import Invoices from './pages/purchasing/Invoices';

// Module 6: Inventory
import CycleCounts from './pages/inventory/CycleCounts';
import Traceability from './pages/inventory/Traceability';

// Module 7: Sales & CRM
import CustomersList from './pages/sales/CustomersList';
import SalesOrders from './pages/sales/SalesOrders';
import Shipping from './pages/sales/Shipping';

// Module 8: Financials
import UnitCosting from './pages/sales/UnitCosting';
import SalesInvoices from './pages/sales/Invoices';

// Admin
import UserManagement from './pages/admin/UserManagement';

import { NotificationProvider } from './context/NotificationContext';
import { Spinner } from './components/ui/Shared';
import { Toaster } from 'react-hot-toast';

// Placeholder for missing pages
const ComingSoon = ({ title }) => (
  <div style={{ 
    height: '100%', display: 'flex', flexDirection: 'column', 
    alignItems: 'center', justifyContent: 'center', color: '#475569' 
  }}>
    <h2 style={{ color: '#fff', marginBottom: 8 }}>{title || 'Yapım Aşamasında'}</h2>
    <p>Bu modül şu anda geliştirme aşamasındadır.</p>
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        
        {/* Malzeme Yönetimi */}
        <Route path="parts" element={<PartsList />} />
        <Route path="parts/:id" element={<PartDetail />} />
        <Route path="models" element={<ModelsList />} />
        <Route path="models/:id" element={<ModelDetail />} />
        <Route path="stock-movements" element={<StockMovements />} />
        
        {/* Üretim (MES) */}
        <Route path="work-centers" element={<WorkCenters />} />
        <Route path="machines" element={<Machines />} />
        <Route path="work-orders" element={<WorkOrderList />} />
        <Route path="work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="gantt" element={<GanttPlan />} />

        {/* Kalite (QMS) */}
        <Route path="qc/plans" element={<InspectionPlans />} />
        <Route path="qc/inspections" element={<InspectionsList />} />
        <Route path="qc/inspections/:id" element={<InspectionDetail />} />
        <Route path="qc/ncr" element={<NcrRecords />} />
        <Route path="qc/ncr/:id" element={<NCRDetail />} />
        <Route path="qc/tools" element={<MeasuringTools />} />

        {/* Satınalma (SCM) */}
        <Route path="purchasing" element={<PurchasingDashboard />} />
        <Route path="purchasing/mrp" element={<MRPDashboard />} />
        <Route path="purchasing/rfq" element={<RFQModule />} />
        <Route path="purchasing/requests" element={<PurchaseRequests />} />
        <Route path="purchasing/orders" element={<PurchaseOrders />} />
        <Route path="purchasing/asn" element={<ASNList />} />
        <Route path="purchasing/receipts" element={<InventoryReceipts />} />
        <Route path="purchasing/suppliers" element={<SuppliersList />} />
        <Route path="purchasing/invoices" element={<Invoices />} />

        {/* Depo / Stok (New Section for Storage logic) */}
        <Route path="inventory/cycle-counts" element={<CycleCounts />} />
        <Route path="inventory/traceability" element={<Traceability />} />

        {/* Dokümanlar (PDM) */}
        <Route path="documents" element={<DocumentsList />} />
        <Route path="documents/:id" element={<ComingSoon title="Doküman Detay" />} />

        {/* Admin */}
        <Route path="admin/users" element={<UserManagement />} />

        {/* Satış ve CRM */}
        <Route path="sales/customers" element={<CustomersList />} />
        <Route path="sales/orders" element={<SalesOrders />} />
        <Route path="sales/shipping" element={<Shipping />} />

        {/* Finansal Analiz */}
        <Route path="financials/invoices" element={<SalesInvoices />} />
        <Route path="financials/costing" element={<UnitCosting />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Toaster position="top-right" />
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

