"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getAuth, saveAuth, clearAuth, AuthUser } from "./authStore";
import { SERVER_URL } from "./socket";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getAuth();
    if (!stored) {
      setLoading(false);
      return;
    }

    // Validate token with server
    fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        setToken(stored.token);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    saveAuth({ token: newToken, user: newUser });
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
