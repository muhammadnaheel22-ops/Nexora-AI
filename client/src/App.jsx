import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext.jsx";
import Protected from "./components/Protected.jsx";
import AdminProtected from "./components/AdminProtected.jsx";
import Loading from "./components/Loading.jsx";

const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const AgentsPage = lazy(() => import("./pages/AgentsPage.jsx"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const secure = (page) => <Protected>{page}</Protected>;

export default function App() {
  return <AuthProvider><BrowserRouter><Suspense fallback={<Loading />}><Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route path="/" element={secure(<ChatPage />)} />
    <Route path="/dashboard" element={secure(<DashboardPage />)} />
    <Route path="/agents" element={secure(<AgentsPage />)} />
    <Route path="/documents" element={secure(<DocumentsPage />)} />
    <Route path="/settings" element={secure(<SettingsPage />)} />
    <Route path="/admin" element={<AdminProtected><AdminPage /></AdminProtected>} />
  </Routes></Suspense></BrowserRouter></AuthProvider>;
}
