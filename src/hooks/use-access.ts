"use client";

import { useMemo } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import { type AccessState, decideCapabilities, decidePath, decideScreen, screenCapability } from "@/lib/access/decide";
import { describePermission } from "@/lib/access/describe";
import type { ScreenKey } from "@/lib/navigation/routes";
import type { PermissionEntry } from "@/lib/workspace/types";

export function useAccess() {
  const { featureCatalog, permissionCatalog, permissionsLoading, permissionsMap, privileged, systemAdmin } = useWorkspace();

  const state = useMemo<AccessState>(
    () => ({
      catalog: featureCatalog,
      permissionsLoading,
      privileged,
      systemAdmin,
      has: (permission) => permissionsMap[permission.resource]?.has(permission.action) ?? false,
    }),
    [featureCatalog, permissionsLoading, privileged, systemAdmin, permissionsMap],
  );

  return useMemo(
    () => ({
      decidePath: (pathname: string) => decidePath(pathname, state),
      canOpenPath: (pathname: string) => decidePath(pathname, state).status === "allowed",
      decideScreen: (screen: ScreenKey) => decideScreen(screen, state),
      decideCapabilities: (keys: readonly string[]) => decideCapabilities(keys, state),
      screenFeature: (screen: ScreenKey) =>
        featureCatalog.status === "ready" ? screenCapability(featureCatalog.features, screen) : null,
      describePermission: (permission: PermissionEntry) => describePermission(permissionCatalog, permission),
    }),
    [state, featureCatalog, permissionCatalog],
  );
}
