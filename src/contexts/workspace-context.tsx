"use client";

import type {
  MemberPermission,
  ResourceAction,
  ResourceType,
  Workspace,
} from "@/lib/workspace/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchMemberPermissions,
  fetchWorkspace,
  fetchWorkspaces,
} from "@/lib/workspace/client";

import { useAuth } from "@/contexts/auth-context";

export type PermissionsMap = Record<string, Set<string>>;

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  permissions: MemberPermission[];
  permissionsMap: PermissionsMap;
  permissionsLoading: boolean;
  can: (resource: ResourceType, action: ResourceAction) => boolean;
  canAny: (resource: ResourceType) => boolean;
  refreshPermissions: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

const WORKSPACE_COOKIE_NAME = "workspaceId";
const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getWorkspaceIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${WORKSPACE_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setWorkspaceCookieClient(workspaceId: string) {
  if (typeof document === "undefined" || !workspaceId) return;

  const encoded = encodeURIComponent(workspaceId);
  const baseCookie = `workspaceId=${encoded}; path=/; max-age=${WORKSPACE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
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

function clearWorkspaceCookieClient() {
  if (typeof document === "undefined") return;

  const clearBase = "workspaceId=; path=/; max-age=0; samesite=lax";
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

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedWorkspacesRef = useRef(false);
  const lastWorkspaceFetchRef = useRef(0);
  const userRef = useRef(user);
  const authLoadingRef = useRef(authLoading);
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);
  const workspacesRequestRef = useRef<Promise<void> | null>(null);
  const permissionsRequestRef = useRef<Promise<void> | null>(null);
  const lastPermissionsTargetRef = useRef<string | null>(null);
  userRef.current = user;
  authLoadingRef.current = authLoading;

  const [permissions, setPermissions] = useState<MemberPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = user?.id ?? null;

    if (previousUserId === currentUserId) return;

    previousUserIdRef.current = currentUserId;

    if (previousUserId !== null) {
      clearWorkspaceCookieClient();
      setCurrentWorkspace(null);
      setWorkspaces([]);
      setPermissions([]);
      setPermissionsLoading(false);
      hasLoadedWorkspacesRef.current = false;
      lastWorkspaceFetchRef.current = 0;
      lastPermissionsTargetRef.current = null;
    }
  }, [user?.id]);

  const isPrivileged =
    user?.role === "admin" ||
    (!!user?.id &&
      !!currentWorkspace?.ownerId &&
      user.id === currentWorkspace.ownerId) ||
    currentWorkspace?.currentUserRole === "owner" ||
    currentWorkspace?.currentUserRole === "admin";

  const permissionsMap = useMemo<PermissionsMap>(() => {
    const map: PermissionsMap = {};
    for (const p of permissions) {
      if (!map[p.resource]) map[p.resource] = new Set();
      map[p.resource].add(p.action);
    }
    return map;
  }, [permissions]);

  const can = useCallback(
    (resource: ResourceType, action: ResourceAction): boolean => {
      if (isPrivileged) return true;
      if (permissionsLoading) return true;
      return permissionsMap[resource]?.has(action) ?? false;
    },
    [isPrivileged, permissionsLoading, permissionsMap],
  );

  const canAny = useCallback(
    (resource: ResourceType): boolean => {
      if (isPrivileged) return true;
      if (permissionsLoading) return true;
      const actions = permissionsMap[resource];
      return !!actions && actions.size > 0;
    },
    [isPrivileged, permissionsLoading, permissionsMap],
  );

  const refreshPermissions = useCallback(async () => {
    if (permissionsRequestRef.current) {
      return permissionsRequestRef.current;
    }

    if (!currentWorkspace || !user?.id) {
      setPermissions([]);
      setPermissionsLoading(false);
      lastPermissionsTargetRef.current = null;
      return;
    }

    if (isPrivileged) {
      setPermissions([]);
      setPermissionsLoading(false);
      lastPermissionsTargetRef.current = null;
      return;
    }

    const target = `${currentWorkspace.id}:${user.id}`;
    lastPermissionsTargetRef.current = target;

    const request = (async () => {
      setPermissionsLoading(true);
      try {
        const result = await fetchMemberPermissions(
          currentWorkspace.id,
          user.id,
        );
        if (!result.error) {
          setPermissions(result.permissions);
        }
      } catch {
        // Silently fail, permissions will be empty (restrictive)
      } finally {
        setPermissionsLoading(false);
        permissionsRequestRef.current = null;
      }
    })();

    permissionsRequestRef.current = request;
    return request;
  }, [currentWorkspace, user?.id, isPrivileged]);

  const lastEnrichedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const wsId = currentWorkspace?.id;
    if (!wsId || !user?.id || lastEnrichedIdRef.current === wsId) return;
    lastEnrichedIdRef.current = wsId;

    void (async () => {
      const result = await fetchWorkspace(wsId);
      if (!result.workspace) return;
      const full = result.workspace;
      setCurrentWorkspace((prev) => {
        if (!prev || prev.id !== full.id) return prev;
        if (
          prev.planName === full.planName &&
          prev.subscriptionStatus === full.subscriptionStatus &&
          prev.ownerName === full.ownerName &&
          prev.ownerEmail === full.ownerEmail
        ) {
          return prev;
        }
        return { ...prev, ...full };
      });
    })();
  }, [currentWorkspace?.id, user?.id]);

  useEffect(() => {
    const target =
      currentWorkspace?.id && user?.id
        ? `${currentWorkspace.id}:${user.id}`
        : null;

    if (!currentWorkspace?.id || !user?.id || isPrivileged) {
      refreshPermissions();
      return;
    }

    if (lastPermissionsTargetRef.current === target) {
      return;
    }

    refreshPermissions();
  }, [currentWorkspace?.id, user?.id, isPrivileged, refreshPermissions]);

  const refreshWorkspaces = useCallback(async (force = false) => {
    if (authLoadingRef.current) {
      return;
    }

    if (!userRef.current?.id) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setPermissions([]);
      setPermissionsLoading(false);
      setIsLoading(false);
      hasLoadedWorkspacesRef.current = false;
      lastWorkspaceFetchRef.current = 0;
      workspacesRequestRef.current = null;
      return;
    }

    if (
      !force &&
      hasLoadedWorkspacesRef.current &&
      Date.now() - lastWorkspaceFetchRef.current < 10_000
    ) {
      return;
    }

    if (workspacesRequestRef.current) {
      return workspacesRequestRef.current;
    }

    const request = (async () => {
      if (!hasLoadedWorkspacesRef.current) {
        setIsLoading(true);
      }
      try {
        const result = await fetchWorkspaces();
        if (result.error) {
          return;
        }

        const all = result.workspaces;
        const effective = [...all];

        let targetId: string | null = null;
        setCurrentWorkspace((prev) => {
          targetId = prev?.id ?? null;
          return prev; 
        });
        if (!targetId) {
          targetId = getWorkspaceIdFromCookie();
        }

        const isPaginated =
          result.totalPages !== undefined && result.totalPages > 1;
        if (
          targetId &&
          !effective.find((w) => w.id === targetId) &&
          isPaginated
        ) {
          const single = await fetchWorkspace(targetId);
          if (single.workspace) {
            effective.unshift(single.workspace);
          }
        }

        setWorkspaces((prev) => {
          if (
            prev.length === effective.length &&
            prev.every((ws, index) => ws.id === effective[index]?.id)
          ) {
            return prev;
          }
          return effective;
        });

        if (effective.length > 0) {
          const savedId = getWorkspaceIdFromCookie();

          const saved = savedId
            ? effective.find((w) => w.id === savedId)
            : null;
          const defaultWs = effective.find((w) => w.isDefault);

          const selection: { workspace: Workspace | null } = {
            workspace: null,
          };

          setCurrentWorkspace((prev) => {
            if (prev) {
              const updated = effective.find((w) => w.id === prev.id);
              if (updated) {
                selection.workspace = updated;
                if (updated.id === prev.id && updated.name === prev.name) {
                  return prev;
                }
                return updated;
              }
              selection.workspace = prev;
              return prev;
            }
            selection.workspace = saved ?? defaultWs ?? effective[0];
            return selection.workspace;
          });

          if (selection.workspace) {
            setWorkspaceCookieClient(selection.workspace.id);
          }
        } else {
          setCurrentWorkspace(null);
          setPermissions([]);
          setPermissionsLoading(false);
          lastPermissionsTargetRef.current = null;
        }
      } finally {
        setIsLoading(false);
        hasLoadedWorkspacesRef.current = true;
        lastWorkspaceFetchRef.current = Date.now();
        workspacesRequestRef.current = null;
      }
    })();

    workspacesRequestRef.current = request;
    return request;
  }, []);

  const switchWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setPermissionsLoading(true);
    setWorkspaceCookieClient(workspace.id);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    refreshWorkspaces();
  }, [authLoading, user?.id, user?.role, refreshWorkspaces]);

  const contextValue = useMemo<WorkspaceContextType>(
    () => ({
      workspaces,
      currentWorkspace,
      isLoading,
      switchWorkspace,
      refreshWorkspaces,
      permissions,
      permissionsMap,
      permissionsLoading,
      can,
      canAny,
      refreshPermissions,
    }),
    [
      workspaces,
      currentWorkspace,
      isLoading,
      switchWorkspace,
      refreshWorkspaces,
      permissions,
      permissionsMap,
      permissionsLoading,
      can,
      canAny,
      refreshPermissions,
    ],
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    return {
      workspaces: [],
      currentWorkspace: null,
      isLoading: false,
      switchWorkspace: () => {},
      refreshWorkspaces: async () => {},
      permissions: [],
      permissionsMap: {} as PermissionsMap,
      permissionsLoading: false,
      can: () => true,
      canAny: () => true,
      refreshPermissions: async () => {},
    } as WorkspaceContextType;
  }
  return context;
}
