/** Contexte d'authentification (stub de dev — voir POST /api/dev/login). */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { devLogin } from "../api/client";

interface AuthState {
  userId: string;
  username: string;
  token: string;
  balance: number;
}

interface AuthContextValue {
  auth: AuthState | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  setBalance: (balance: number) => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "split.auth";

function loadStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadStoredAuth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await devLogin(username);
      const next: AuthState = {
        userId: response.userId,
        username: response.username,
        token: response.token,
        balance: response.balance,
      };
      setAuth(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setBalance = useCallback((balance: number) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, balance };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout, setBalance, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  return ctx;
}
