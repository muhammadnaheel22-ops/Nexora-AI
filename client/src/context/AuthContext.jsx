import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);
const AUTH_CHECK_TIMEOUT_MS = 5000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me", { timeout: AUTH_CHECK_TIMEOUT_MS })
      .then((response) => setUser(response.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(data) {
      const response = await api.post("/auth/login", data);
      setUser(response.data.user);
      return response.data.user;
    },
    async register(data) {
      const response = await api.post("/auth/register", data);
      setUser(response.data.user);
      return response.data.user;
    },
    async logout() {
      await api.post("/auth/logout");
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
