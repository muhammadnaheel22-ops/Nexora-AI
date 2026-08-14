import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import Loading from "./Loading.jsx";

export default function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace />;
}
