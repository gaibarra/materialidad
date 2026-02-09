"use client";

import Cookies from "js-cookie";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { loadSession, persistSession, removeSession } from "../lib/token-storage";

const isTokenExpired = (token: string | null | undefined): boolean => {
  if (!token) {
    return true;
  }
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return true;
    }
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (!decoded.exp) {
      return false;
    }
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export type UserProfile = {
  id: number;
  email: string;
  full_name: string | null;
  tenant_slug: string | null;
  despacho_slug: string | null;
  is_staff: boolean;
  is_superuser: boolean;
};

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  tenant: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  /** true once the initial profile fetch has completed (or was skipped) */
  isProfileLoaded: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL debe estar definido");
}

type AuthProviderProps = {
  children: React.ReactNode;
};

type LoginPayload = {
  email: string;
  password: string;
  tenant?: string; // Opcional - se auto-determina del usuario
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setTenant(null);
    setUser(null);
    setIsProfileLoaded(false);
    removeSession();
    Cookies.remove("tenant");
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (isTokenExpired(session.accessToken)) {
        removeSession();
        Cookies.remove("tenant");
        setIsProfileLoaded(true);
        return;
      }
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setTenant(session.tenant);
      // fetchProfile will set isProfileLoaded = true when done
    } else {
      // No session at all — mark as loaded so consumers don't wait forever
      setIsProfileLoaded(true);
    }
  }, []);

  const fetchProfile = useCallback(
    async (token: string, tenantSlug: string | null) => {
      if (isTokenExpired(token)) {
        logout();
        setIsProfileLoaded(true);
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      // Solo agregar X-Tenant header si hay tenant
      if (tenantSlug) {
        headers["X-Tenant"] = tenantSlug;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/accounts/me/`, {
          headers,
          cache: "no-store",
        });
        if (response.ok) {
          const payload = (await response.json()) as UserProfile;
          setUser(payload);
        } else if (response.status === 401) {
          logout();
          return;
        }
      } finally {
        setIsProfileLoaded(true);
      }
    },
    [logout]
  );

  useEffect(() => {
    // Cargar perfil si hay token Y (hay tenant O el usuario aún no está cargado)
    // Esto permite que superusuarios sin tenant también carguen su perfil
    if (accessToken && !user && !isTokenExpired(accessToken)) {
      void fetchProfile(accessToken, tenant);
    }
  }, [accessToken, tenant, user, fetchProfile]);

  const login = useCallback(
    async ({ email, password, tenant: tenantSlug }: LoginPayload) => {
      const body: { email: string; password: string; tenant?: string } = {
        email,
        password,
      };

      // Solo enviar tenant si se especificó
      if (tenantSlug) {
        body.tenant = tenantSlug;
      }

      const response = await fetch(`${apiBaseUrl}/api/accounts/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Credenciales inválidas o empresa incorrecta");
      }

      const data = (await response.json()) as {
        access: string;
        refresh: string;
        tenant: string | null;
      };

      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setTenant(data.tenant);
      persistSession({
        accessToken: data.access,
        refreshToken: data.refresh,
        tenant: data.tenant,
      });

      // Solo setear cookie si hay tenant
      if (data.tenant) {
        Cookies.set("tenant", data.tenant);
      }

      await fetchProfile(data.access, data.tenant);
    },
    [fetchProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (accessToken && !isTokenExpired(accessToken)) {
      await fetchProfile(accessToken, tenant);
    } else if (accessToken && isTokenExpired(accessToken)) {
      logout();
    }
  }, [accessToken, tenant, fetchProfile, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      refreshToken,
      tenant,
      user,
      // Autenticado si hay token (tenant puede ser null para superusuarios)
      isAuthenticated: Boolean(accessToken),
      isProfileLoaded,
      login,
      logout,
      refreshProfile,
    }),
    [accessToken, tenant, user, isProfileLoaded, login, logout, refreshProfile, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext debe usarse dentro de AuthProvider");
  }
  return context;
}
