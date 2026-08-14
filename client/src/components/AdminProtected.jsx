import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import Loading from "./Loading.jsx";

export default function AdminProtected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? children : <Navigate to="/" replace />;
}
