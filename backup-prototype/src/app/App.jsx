import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./providers/AuthProvider";
import { AppLayout } from "../layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { MaterialsPage } from "../pages/MaterialsPage";
import { PurchasingPage } from "../pages/PurchasingPage";
import { QualityPage } from "../pages/QualityPage";
import { WarehousePage } from "../pages/WarehousePage";
import { SalesPage } from "../pages/SalesPage";
import { ProductionPage } from "../pages/ProductionPage";

function ProtectedRoute() {
  const { user, loading, isDemoMode } = useAuth();

  if (loading) {
    return <div className="loading-screen">Yukleniyor...</div>;
  }

  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/purchasing" element={<PurchasingPage />} />
          <Route path="/quality" element={<QualityPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/production" element={<ProductionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
