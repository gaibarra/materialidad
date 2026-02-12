"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { refreshAccessToken } from "../lib/api";
import { loadSession, persistSession, removeSession } from "../lib/token-storage";

/* ── helpers ── */

const getTokenExp = (token: string | null | undefined): number | null => {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string | null | undefined): boolean => {
  const exp = getTokenExp(token);
  return exp === null || exp <= Date.now();
};

export type UserProfile = {
  id: number;
  email: string;
  full_name: string | null;
  tenant_slug: string | null;
  despacho_slug: string | null;
  despacho_tipo: "despacho" | "corporativo" | null;
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
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setTenant(null);
    setUser(null);
    setIsProfileLoaded(false);
    removeSession();
    Cookies.remove("tenant");
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    router.push("/login");
  }, [router]);

  /* ── Schedule proactive token refresh 2 min before expiry ── */
  const scheduleRefresh = useCallback(
    (token: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const exp = getTokenExp(token);
      if (!exp) return;
      // Refresh 2 minutes before expiry, minimum 10 seconds from now
      const delay = Math.max(exp - Date.now() - 2 * 60 * 1000, 10_000);
      refreshTimerRef.current = setTimeout(async () => {
        const newToken = await refreshAccessToken();
        if (newToken) {
          setAccessToken(newToken);
          const session = loadSession();
          if (session?.refreshToken) setRefreshToken(session.refreshToken);
          scheduleRefresh(newToken);
        } else {
          logout();
        }
      }, delay);
    },
    [logout]
  );

  /* ── Listen for token refreshes triggered by api.ts interceptor ── */
  useEffect(() => {
    const handler = () => {
      const session = loadSession();
      if (session) {
        setAccessToken(session.accessToken);
        setRefreshToken(session.refreshToken);
        scheduleRefresh(session.accessToken);
      }
    };
    window.addEventListener("session-refreshed", handler);
    return () => window.removeEventListener("session-refreshed", handler);
  }, [scheduleRefresh]);

  /* ── Initial session load ── */
  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (isTokenExpired(session.accessToken)) {
        // Try to refresh instead of immediately removing session
        void (async () => {
          const newToken = await refreshAccessToken();
          if (newToken) {
            const updated = loadSession();
            setAccessToken(newToken);
            setRefreshToken(updated?.refreshToken ?? null);
            setTenant(updated?.tenant ?? session.tenant);
            scheduleRefresh(newToken);
          } else {
            removeSession();
            Cookies.remove("tenant");
            setIsProfileLoaded(true);
          }
        })();
        return;
      }
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setTenant(session.tenant);
      scheduleRefresh(session.accessToken);
    } else {
      setIsProfileLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Cleanup timer on unmount ── */
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
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
          if (!tenantSlug && payload.tenant_slug) {
            setTenant(payload.tenant_slug);
            const current = loadSession();
            if (current) {
              persistSession({
                accessToken: current.accessToken,
                refreshToken: current.refreshToken,
                tenant: payload.tenant_slug,
              });
            }
          }
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

      scheduleRefresh(data.access);
      await fetchProfile(data.access, data.tenant);
    },
    [fetchProfile, scheduleRefresh]
  );

  const refreshProfile = useCallback(async () => {
    if (accessToken && !isTokenExpired(accessToken)) {
      await fetchProfile(accessToken, tenant);
    } else {
      // Token expired — try to refresh it
      const newToken = await refreshAccessToken();
      if (newToken) {
        setAccessToken(newToken);
        const session = loadSession();
        if (session?.refreshToken) setRefreshToken(session.refreshToken);
        scheduleRefresh(newToken);
        await fetchProfile(newToken, tenant);
      } else {
        logout();
      }
    }
  }, [accessToken, tenant, fetchProfile, logout, scheduleRefresh]);

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
