import { useState, useEffect, createContext, useContext, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

export const AuthContext = createContext(null);

const formatApiErrorDetail = (detail) => {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`);
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401) {
        setUser(false);
      } else {
        console.error('Auth check error:', e);
        setUser(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      setUser(data);
      toast.success("Login realizado com sucesso!");
      return true;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/register`, { name, email, password });
      setUser(data);
      toast.success("Conta criada com sucesso!");
      return true;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(false);
      toast.success("Logout realizado com sucesso!");
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
