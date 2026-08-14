import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ProtectedRoute from "./components/UI/ProtectedRoute.jsx";
import Spinner from "./components/UI/Spinner.jsx";

const AgentsPage = lazy(() => import("./pages/AgentsPage.jsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));

function ProtectedPage({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/" element={<ProtectedPage><ChatPage /></ProtectedPage>} />
              <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
              <Route path="/agents" element={<ProtectedPage><AgentsPage /></ProtectedPage>} />
              <Route path="/documents" element={<ProtectedPage><DocumentsPage /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
