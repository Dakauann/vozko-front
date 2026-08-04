"use client";

import * as React from "react";

import type {
  AvailablePermission,
  PermissionEntry,
  ResourceAction,
} from "@/lib/workspace/types";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { cn } from "@/lib/utils";

interface PermissionsEditorProps {
  availablePermissions: AvailablePermission[];
  permMap: Record<string, Set<string>>;
  onToggle: (resource: string, action: string) => void;
  onToggleAll: (resource: string, actions: string[]) => void;
  disabled?: boolean;
  t: (key: string) => string;
  compact?: boolean;
}

export default function PermissionsEditor({
  availablePermissions,
  permMap,
  onToggle,
  onToggleAll,
  disabled = false,
  t,
  compact = false,
}: PermissionsEditorProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        compact
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {availablePermissions.map((perm) => {
        const actions = perm.actions ?? [];
        const resourcePerms = permMap[perm.resource] ?? new Set<string>();
        const allEnabled =
          actions.length > 0 && actions.every((a) => resourcePerms.has(a));
        const someEnabled = actions.some((a) => resourcePerms.has(a));

        return (
          <ElevatedContainer
            key={perm.resource}
            className={cn(
              "!p-3 space-y-2 transition-colors",
              someEnabled && "!border-primary/20 !bg-primary/[0.02]",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-semibold",
                  someEnabled ? "text-lamp-ink" : "text-foreground",
                )}
              >
                {t(`resources.${perm.resource}`)}
              </span>
              {!disabled && actions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleAll(perm.resource, actions)}
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    allEnabled
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-border",
                  )}
                >
                  {allEnabled ? t("deselectAll") : t("selectAll")}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t(`resourceDescriptions.${perm.resource}`)}
            </p>
            <div className="space-y-1">
              {actions.map((action: ResourceAction) => (
                <ElevatedSwitch
                  key={action}
                  checked={resourcePerms.has(action)}
                  onCheckedChange={() =>
                    !disabled && onToggle(perm.resource, action)
                  }
                  disabled={disabled}
                  label={
                    perm.actionDescriptions?.[action] || t(`actions.${action}`)
                  }
                />
              ))}
            </div>
          </ElevatedContainer>
        );
      })}
    </div>
  );
}

export function usePermissionMap(
  initialPermissions?: Array<{ resource: string; action: string }>,
  availablePermissions?: AvailablePermission[],
) {
  const [permMap, setPermMap] = React.useState<Record<string, Set<string>>>(
    () => {
      if (!initialPermissions) return {};
      const map: Record<string, Set<string>> = {};
      for (const p of initialPermissions) {
        if (!map[p.resource]) map[p.resource] = new Set();
        map[p.resource].add(p.action);
      }
      return map;
    },
  );

  const dependencyOf = React.useMemo(() => {
    const depOf: Record<string, Record<string, PermissionEntry[]>> = {};
    if (availablePermissions) {
      for (const perm of availablePermissions) {
        if (!perm.dependencies) continue;
        for (const [action, reqs] of Object.entries(perm.dependencies)) {
          if (!depOf[perm.resource]) depOf[perm.resource] = {};
          depOf[perm.resource][action] = reqs;
        }
      }
    }
    return depOf;
  }, [availablePermissions]);

  const applyDependencies = React.useCallback(
    (next: Record<string, Set<string>>) => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const [resource, actionMap] of Object.entries(dependencyOf)) {
          for (const [action, reqs] of Object.entries(actionMap)) {
            if (!next[resource]?.has(action)) continue;
            const allMet = reqs.every((r) => next[r.resource]?.has(r.action));
            if (!allMet) {
              next[resource] = new Set(next[resource]);
              next[resource].delete(action);
              if (next[resource].size === 0) delete next[resource];
              changed = true;
            }
          }
        }
      }
      return next;
    },
    [dependencyOf],
  );

  const togglePermission = React.useCallback(
    (resource: string, action: string) => {
      setPermMap((prev) => {
        const next = { ...prev };
        if (!next[resource]) next[resource] = new Set();
        else next[resource] = new Set(next[resource]);

        if (next[resource].has(action)) {
          next[resource].delete(action);
          if (next[resource].size === 0) delete next[resource];
          return applyDependencies(next);
        }
        next[resource].add(action);
        const reqs = dependencyOf[resource]?.[action];
        if (reqs) {
          for (const req of reqs) {
            if (!next[req.resource]) next[req.resource] = new Set();
            else next[req.resource] = new Set(next[req.resource]);
            next[req.resource].add(req.action);
          }
        }
        return next;
      });
    },
    [applyDependencies, dependencyOf],
  );

  const toggleAllForResource = React.useCallback(
    (resource: string, actions: string[]) => {
      setPermMap((prev) => {
        const next = { ...prev };
        const current = next[resource] ?? new Set<string>();
        const allEnabled = actions.every((a) => current.has(a));
        if (allEnabled) {
          delete next[resource];
        } else {
          next[resource] = new Set(actions);
          for (const action of actions) {
            const reqs = dependencyOf[resource]?.[action];
            if (reqs) {
              for (const req of reqs) {
                if (!next[req.resource]) next[req.resource] = new Set();
                else next[req.resource] = new Set(next[req.resource]);
                next[req.resource].add(req.action);
              }
            }
          }
        }
        return applyDependencies(next);
      });
    },
    [applyDependencies, dependencyOf],
  );

  const resetPermMap = React.useCallback(
    (permissions?: Array<{ resource: string; action: string }>) => {
      if (!permissions) {
        setPermMap({});
        return;
      }
      const map: Record<string, Set<string>> = {};
      for (const p of permissions) {
        if (!map[p.resource]) map[p.resource] = new Set();
        map[p.resource].add(p.action);
      }
      setPermMap(map);
    },
    [],
  );

  const getPermissionEntries = React.useCallback(() => {
    const entries: Array<{ resource: string; action: string }> = [];
    for (const [resource, actions] of Object.entries(permMap)) {
      for (const action of actions) {
        entries.push({ resource, action });
      }
    }
    return entries;
  }, [permMap]);

  const hasAnyPermissions = Object.keys(permMap).length > 0;

  return {
    permMap,
    setPermMap,
    togglePermission,
    toggleAllForResource,
    resetPermMap,
    getPermissionEntries,
    hasAnyPermissions,
  };
}
