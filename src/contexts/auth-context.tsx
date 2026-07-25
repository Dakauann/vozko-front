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

/** Throttle for identity re-checks on focus/visibility/online. */
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
  /**
   * True when identity could not be resolved due to a transient backend/network
   * error (not an expired session). The dashboard gate uses this to show a retry
   * screen instead of bouncing to /login, avoiding the historical redirect loop.
   */
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

  /**
   * Resolve identity from the API. Auth rides the httpOnly cookie, so this is a
   * plain `GET /user/me` through `apiClient` (which transparently refreshes on a
   * 401). No timers, no proactive token rotation.
   */
  const refreshUser = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        if (!initialCheckDoneRef.current) {
          setIsLoading(true);
        }

        // Instant paint from the soft identity hint on repeat, non-forced checks.
        if (!forceRefresh && initialCheckDoneRef.current) {
          const cachedUser = getUserDataFromCookie();
          if (cachedUser && hasUserDataCookie()) {
            applyUser(cachedUser);
            return;
          }
        }

        // No session hint at all -> guest; skip the network round-trip (and avoid
        // a pointless refresh attempt on public pages like /login).
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
          // Session is gone; apiClient already attempted a refresh and failed.
          // Ask Go to clear httpOnly cookies (JS cannot). Client-readable
          // cookies are wiped locally so the UI stays guest without relying
          // on an edge bounce that used to loop login ↔ dashboard.
          setServerError(false);
          try {
            await logoutRequest();
          } catch {
            /* best-effort cookie revoke */
          }
          clearClientAuthCookies();
          applyUser(null);
        } else {
          // Transient (5xx/network): keep the cached identity, never force logout.
          const cachedUser = getUserDataFromCookie();
          applyUser(cachedUser);
          // Only a transient error with no cached identity is unrecoverable here;
          // surface it as a retry screen rather than a login bounce.
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

    // Tell every other tab to tear down its session too.
    notifySessionExpired();

    try {
      setUser(null);
      setIsLoading(true);
      clearClientAuthCookies();

      // API revokes the session + clears httpOnly cookies; client-readable
      // cookies were already cleared above.
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
      // Intentionally do NOT reset isLoggingOutRef: the page is navigating away,
      // and keeping it true suppresses any last-moment callbacks.
    }
  }, []);

  // Initial hydration.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Cross-tab + in-tab session expiry: when the client can no longer authenticate,
  // log out here too, but only if we currently believe we are signed in (avoids a
  // redirect loop on public pages).
  useEffect(() => {
    return onSessionExpired(() => {
      if (userRef.current) {
        void logout();
      }
    });
  }, [logout]);

  // Re-validate identity when the user returns to the tab or reconnects. This is
  // reactive (not a timer); a near-expired access cookie is refreshed by apiClient
  // on the /user/me call.
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
