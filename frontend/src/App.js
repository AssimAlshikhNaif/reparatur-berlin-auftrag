import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import OrderCreate from "@/pages/OrderCreate";
import OrderDetail from "@/pages/OrderDetail";
import Inventory from "@/pages/Inventory";
import Users from "@/pages/Users";
import Scan from "@/pages/Scan";
import Analytics from "@/pages/Analytics";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-muted-foreground">Lade…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/auftraege" element={<Protected><Orders /></Protected>} />
      <Route path="/auftrag/neu" element={<Protected roles={["admin", "mitarbeiter"]}><OrderCreate /></Protected>} />
      <Route path="/auftrag/:id" element={<Protected><OrderDetail /></Protected>} />
      <Route path="/scannen" element={<Protected><Scan /></Protected>} />
      
      {/* تم السماح للجميع (أدمن، تقني، موظف) بالدخول لصفحة قطع الغيار والصلاحيات تُدار داخل الصفحة نفسها */}
      <Route path="/ersatzteile" element={<Protected><Inventory /></Protected>} />
      
      <Route path="/benutzer" element={<Protected roles={["admin"]}><Users /></Protected>} />
      <Route path="/analyse" element={<Protected roles={["admin"]}><Analytics /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
          <Toaster position="top-right" theme="dark" richColors />
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;