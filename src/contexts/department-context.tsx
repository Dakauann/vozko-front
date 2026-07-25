"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Department } from "@/lib/department/types";
import { fetchDepartments } from "@/lib/department/client";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";

interface DepartmentContextType {
  departments: Department[];
  currentDepartment: Department | null;
  isLoading: boolean;
  switchDepartment: (department: Department | null) => void;
  refreshDepartments: () => Promise<void>;
  isLocked: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(
  undefined,
);

const DEPT_COOKIE_NAME = "departmentId";
const DEPT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getDepartmentIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${DEPT_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setDepartmentCookieClient(departmentId: string) {
  if (typeof document === "undefined") return;

  const encoded = encodeURIComponent(departmentId);
  const baseCookie = `departmentId=${encoded}; path=/; max-age=${DEPT_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  document.cookie = baseCookie;

  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");
  const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (!isLocalhost && !isIPv4) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join(".");
      document.cookie = `${baseCookie}; domain=.${rootDomain}`;
    }
  }
}

function clearDepartmentCookieClient() {
  if (typeof document === "undefined") return;

  const clearBase = "departmentId=; path=/; max-age=0; samesite=lax";
  document.cookie = clearBase;

  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");
  const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (!isLocalhost && !isIPv4) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join(".");
      document.cookie = `${clearBase}; domain=.${rootDomain}`;
    }
  }
}

export function DepartmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { currentWorkspace, isLoading: wsLoading } = useWorkspace();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const isPrivileged =
    user?.role === "admin" ||
    (!!user?.id &&
      !!currentWorkspace?.ownerId &&
      user.id === currentWorkspace.ownerId) ||
    currentWorkspace?.currentUserRole === "owner" ||
    currentWorkspace?.currentUserRole === "admin";

  const refreshDepartments = useCallback(async () => {
    if (!currentWorkspace?.id || !user?.id) {
      setDepartments([]);
      setCurrentDepartment(null);
      clearDepartmentCookieClient();
      lastFetchKeyRef.current = null;
      return;
    }

    const fetchKey = `${currentWorkspace.id}:${user.id}`;
    if (lastFetchKeyRef.current === fetchKey && requestRef.current) {
      return requestRef.current;
    }

    lastFetchKeyRef.current = fetchKey;

    const request = (async () => {
      setIsLoading(true);
      try {
        const result = await fetchDepartments();
        if (result.error) return;

        const all = result.departments;
        setDepartments(all);

        if (all.length === 0) {
          setCurrentDepartment(null);
          clearDepartmentCookieClient();
          return;
        }

        const savedId = getDepartmentIdFromCookie();

        setCurrentDepartment((prev) => {
          if (prev) {
            const stillExists = all.find((d) => d.id === prev.id);
            if (stillExists) return stillExists;
          }
          const saved = savedId ? all.find((d) => d.id === savedId) : null;
          if (saved) return saved;
          return null;
        });
      } finally {
        setIsLoading(false);
        requestRef.current = null;
      }
    })();

    requestRef.current = request;
    return request;
  }, [currentWorkspace?.id, user?.id]);

  useEffect(() => {
    if (wsLoading) return;
    refreshDepartments();
  }, [wsLoading, currentWorkspace?.id, user?.id, refreshDepartments]);

  const prevWsRef = useRef<string | null>(currentWorkspace?.id ?? null);
  useEffect(() => {
    const prev = prevWsRef.current;
    const current = currentWorkspace?.id ?? null;
    prevWsRef.current = current;

    if (prev !== null && prev !== current) {
      setCurrentDepartment(null);
      setDepartments([]);
      clearDepartmentCookieClient();
      lastFetchKeyRef.current = null;
    }
  }, [currentWorkspace?.id]);

  const switchDepartment = useCallback((department: Department | null) => {
    setCurrentDepartment(department);
    if (department) {
      setDepartmentCookieClient(department.id);
    } else {
      clearDepartmentCookieClient();
    }
  }, []);

  const isLocked = !isPrivileged && departments.length > 0;

  useEffect(() => {
    if (isLocked && !currentDepartment && departments.length > 0) {
      const id = getDepartmentIdFromCookie();
      const saved = id ? departments.find((d) => d.id === id) : null;
      switchDepartment(saved ?? departments[0]);
    }
  }, [isLocked, currentDepartment, departments, switchDepartment]);

  const contextValue = useMemo<DepartmentContextType>(
    () => ({
      departments,
      currentDepartment,
      isLoading,
      switchDepartment,
      refreshDepartments,
      isLocked,
    }),
    [
      departments,
      currentDepartment,
      isLoading,
      switchDepartment,
      refreshDepartments,
      isLocked,
    ],
  );

  return (
    <DepartmentContext.Provider value={contextValue}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    return {
      departments: [],
      currentDepartment: null,
      isLoading: false,
      switchDepartment: () => {},
      refreshDepartments: async () => {},
      isLocked: false,
    } as DepartmentContextType;
  }
  return context;
}
