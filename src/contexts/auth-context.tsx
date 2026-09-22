"use client";

import {
  clearClientAuthCookies,
  getUserDataFromCookie,
  hasUserDataCookie,
} from "@/lib/auth/client-cookies";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { User, UserPlan } from "@/lib/auth/types";
import { logout as logoutRequest } from "@/lib/auth/auth-api";
import {
  apiClient,
  notifySessionExpired,
  onSessionExpired,
} from "@/lib/api/browser-client";

const IDENTITY_RECHECK_MIN_MS = 60 * 1000;

interface UserMeResponse {
  id: string;
  username: string;
  email: string;
  picture?: string;
  role: string;
  customerType: "company" | "individual";
  emailVerified?: boolean;
  plan?: UserPlan;
}

function mapUserMe(payload: UserMeResponse): User {
  return {
    id: payload.id,
    email: payload.email,
    name: payload.username,
    picture: payload.picture,
    role: payload.role,
    customerType: payload.customerType,
    emailVerified: payload.emailVerified,
    plan: payload.plan,
  };
}

function usersAreEqual(previous: User | null, next: User | null): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return JSON.stringify(previous) === JSON.stringify(next);
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  serverError: boolean;
  refreshUser: (forceRefresh?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const userId = user?.id ?? null;
  const initialCheckDoneRef = useRef(false);
  const userRef = useRef<User | null>(null);
  const isLoggingOutRef = useRef(false);
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const applyUser = useCallback((nextUser: User | null) => {
    setUser((previousUser) =>
      usersAreEqual(previousUser, nextUser) ? previousUser : nextUser,
    );
  }, []);

  const refreshUser = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        if (!initialCheckDoneRef.current) {
          setIsLoading(true);
        }

        if (!forceRefresh && initialCheckDoneRef.current) {
          const cachedUser = getUserDataFromCookie();
          if (cachedUser && hasUserDataCookie()) {
            applyUser(cachedUser);
            return;
          }
        }

        if (!hasUserDataCookie()) {
          setServerError(false);
          applyUser(null);
          return;
        }

        const { data, error } = await apiClient<UserMeResponse>("/user/me");
        if (data) {
          setServerError(false);
          applyUser(mapUserMe(data));
        } else if (error?.status === 401) {
          setServerError(false);
          try {
            await logoutRequest();
          } catch {
          }
          clearClientAuthCookies();
          applyUser(null);
        } else {
          const cachedUser = getUserDataFromCookie();
          applyUser(cachedUser);
          setServerError(!cachedUser);
        }
      } catch (error) {
        console.error("[AuthContext] Error resolving user:", error);
        const cachedUser = getUserDataFromCookie();
        applyUser(cachedUser);
        setServerError(!cachedUser);
      } finally {
        setIsLoading(false);
        initialCheckDoneRef.current = true;
      }
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    notifySessionExpired();

    try {
      setUser(null);
      setIsLoading(true);
      clearClientAuthCookies();

      await logoutRequest();
    } catch (error) {
      console.error("[AuthContext] Error logging out:", error);
      clearClientAuthCookies();
    } finally {
      if (typeof window !== "undefined") {
        const host = window.location.host;
        const isShopSubdomain = host.startsWith("shop.");

        if (isShopSubdomain) {
          const protocol = window.location.protocol;
          const shopUrl = `${protocol}//${host}`;
          window.location.href = `/login?redirect=${encodeURIComponent(shopUrl)}`;
        } else {
          window.location.href = "/login";
        }
      }
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    return onSessionExpired(() => {
      if (userRef.current) {
        void logout();
      }
    });
  }, [logout]);

  useEffect(() => {
    if (!userId) return;

    const maybeRecheck = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      if (now - lastCheckRef.current < IDENTITY_RECHECK_MIN_MS) return;
      lastCheckRef.current = now;
      void refreshUser(true);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") maybeRecheck();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", maybeRecheck);
    window.addEventListener("online", maybeRecheck);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", maybeRecheck);
      window.removeEventListener("online", maybeRecheck);
    };
  }, [userId, refreshUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    serverError,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
