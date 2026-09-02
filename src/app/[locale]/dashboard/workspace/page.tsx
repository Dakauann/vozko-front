"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Buildings,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Crown,
  Envelope,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Shield,
  ShieldCheck,
  ShieldPlus,
  SlidersHorizontal,
  Trash,
  TreeStructure,
  UserCirclePlus,
  UserGear,
  UserMinus,
  Users,
  Warning,
  X,
} from "@/components/icons";
import type {
  AvailablePermission,
  CustomRole,
  MemberPermission,
  PermissionEntry,
  ResourceAssignment,
  ResourceType,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "@/lib/workspace/types";
import type { Department, DepartmentMember } from "@/lib/department/types";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import PermissionsEditor, {
  usePermissionMap,
} from "@/components/elevated-design/permissions-editor";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  addDepartmentMember,
  createDepartment,
  deleteDepartment,
  fetchDepartmentMembers,
  fetchDepartments,
  removeDepartmentMember,
  updateDepartment,
} from "@/lib/department/client";
import {
  assignCustomRole,
  assignResource,
  cancelInvite,
  createCustomRole,
  deleteCustomRole,
  fetchAvailablePermissions,
  fetchCustomRoles,
  fetchMemberPermissions,
  fetchMembers,
  fetchResourceAssignments,
  fetchWorkspaceInvites,
  inviteMember,
  removeMember,
  setMemberPermissions,
  unassignResource,
  updateCustomRole,
  updateMemberRole,
  updateWorkspace,
} from "@/lib/workspace/client";
import { getWorkspaceConfigAction } from "@/app/actions/workspace-config";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { WorkspaceConfigTab } from "@/components/dashboard/workspace/WorkspaceConfigTab";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import {
  validateWorkingHours,
  type WorkingHoursSpec,
} from "@/lib/working-hours/types";
import { useAuth } from "@/contexts/auth-context";
import { useDepartment } from "@/contexts/department-context";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function WorkspaceSettingsPage() {
  const t = useTranslations("workspaceSettings");
  const { user } = useAuth();
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = React.useState<WorkspaceInvite[]>([]);
  const [customRoles, setCustomRoles] = React.useState<CustomRole[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingName, setEditingName] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [nameError, setNameError] = React.useState("");
  const [wsConfig, setWsConfig] = React.useState<WorkspaceConfig | null>(null);

  const wsId = currentWorkspace?.id;
  const currentMember = members.find((m) => m.userId === user?.id);
  const isSystemAdmin = user?.role === "admin";
  const isOwner =
    isSystemAdmin ||
    currentMember?.role === "owner" ||
    currentWorkspace?.ownerId === user?.id;
  const isOwnerOrAdmin =
    isSystemAdmin ||
    currentMember?.role === "owner" ||
    currentMember?.role === "admin";

  const didInitialLoad = React.useRef(false);

  const loadData = React.useCallback(async () => {
    if (!wsId) return;
    if (!didInitialLoad.current) setIsLoading(true);
    try {
      const [membersRes, invitesRes, configRes, rolesRes] = await Promise.all([
        fetchMembers(wsId),
        fetchWorkspaceInvites(wsId),
        getWorkspaceConfigAction(wsId),
        fetchCustomRoles(wsId),
      ]);
      if (!membersRes.error) setMembers(membersRes.members);
      if (!invitesRes.error) setInvites(invitesRes.invites);
      if (!configRes.error) setWsConfig(configRes.config);
      if (!rolesRes.error) setCustomRoles(rolesRes.roles);
    } finally {
      setIsLoading(false);
      didInitialLoad.current = true;
    }
  }, [wsId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name);
    }
  }, [currentWorkspace]);

  const handleUpdateName = async () => {
    if (!wsId || !workspaceName.trim()) return;
    setNameError("");
    const result = await updateWorkspace(wsId, { name: workspaceName.trim() });
    if (result.error) {
      setNameError(result.error);
      return;
    }
    setEditingName(false);
    await refreshWorkspaces();
  };

  const pendingInvitesCount = invites.filter(
    (inv) => inv.status === "pending",
  ).length;

  if (!currentWorkspace) {
    return (
      <div className="flex h-64 items-center justify-center">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  return (
    <main className="w-full space-y-4">
      {/* ─── HEADER ─── */}
      <div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Buildings className="h-5 w-5 text-primary-ink" weight="fill" />
              <span className="text-xs font-semibold text-primary-ink">
                {t("header.badge", { fallback: "Workspace" })}
              </span>
            </div>

            {editingName ? (
              <div className="flex items-center gap-2">
                <ElevatedInput
                  value={workspaceName}
                  onChange={(e) => {
                    setWorkspaceName(e.target.value);
                    setNameError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateName();
                    if (e.key === "Escape") {
                      setEditingName(false);
                      setWorkspaceName(currentWorkspace.name);
                    }
                  }}
                  variant="outline"
                  controlSize="sm"
                  className="max-w-xs"
                  autoFocus
                />
                <ElevatedButton
                  onClick={handleUpdateName}
                  variant="primary"
                  size="icon"
                  icon={<Check weight="bold" />}
                  iconVisible
                />
                <ElevatedButton
                  onClick={() => {
                    setEditingName(false);
                    setWorkspaceName(currentWorkspace.name);
                  }}
                  variant="ghost"
                  size="icon"
                  icon={<X weight="bold" />}
                  iconVisible
                />
                {nameError && (
                  <span className="text-sm text-destructive-ink">{nameError}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground md:text-3xl">
                  {currentWorkspace.name}
                </h1>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <PencilSimple className="h-4 w-4" weight="bold" />
                  </button>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground max-w-2xl">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ─── TABS (config first for owners; people/org after) ─── */}
      <div>
        <Tabs defaultValue={isOwner ? "config" : "members"}>
          <TabsList>
            {isOwner && (
              <TabsTrigger value="config" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" weight="fill" />
                <span className="hidden sm:inline">{t("tabs.config")}</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.members")}</span>
              <span className="ml-1 rounded-[--radius] bg-primary px-1.5 py-0.5 text-2xs font-semibold text-primary-foreground">
                {members.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Envelope className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.invites")}</span>
              {pendingInvitesCount > 0 && (
                <span className="ml-1 rounded-full bg-warning px-1.5 py-0.5 text-2xs font-semibold text-warning-foreground">
                  {pendingInvitesCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <ShieldCheck className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.permissions")}</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <UserGear className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.roles")}</span>
              {customRoles.length > 0 && (
                <span className="ml-1 rounded-[--radius] bg-healthy px-1.5 py-0.5 text-2xs font-semibold text-healthy-foreground">
                  {customRoles.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <TreeStructure className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.departments")}</span>
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <CircleNotch
                  className="h-8 w-8 animate-spin text-primary-ink"
                  weight="bold"
                />
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              </div>
            </div>
          ) : (
            <>
              {isOwner && wsId && (
                <TabsContent value="config">
                  <WorkspaceConfigTab
                    workspaceId={wsId}
                    config={wsConfig}
                    onConfigChange={(cfg) => setWsConfig(cfg)}
                  />
                </TabsContent>
              )}
              <TabsContent value="members">
                <MembersTab
                  wsId={wsId!}
                  members={members}
                  customRoles={customRoles}
                  currentUserId={user?.id ?? ""}
                  onRefresh={loadData}
                  t={t}
                />
              </TabsContent>
              <TabsContent value="invites">
                <InvitesTab
                  wsId={wsId!}
                  invites={invites}
                  customRoles={customRoles}
                  onRefresh={loadData}
                  t={t}
                />
              </TabsContent>
              <TabsContent value="permissions">
                <PermissionsTab wsId={wsId!} members={members} t={t} />
              </TabsContent>
              <TabsContent value="roles">
                <RolesTab
                  wsId={wsId!}
                  customRoles={customRoles}
                  onRefresh={loadData}
                  t={t}
                />
              </TabsContent>
              <TabsContent value="departments">
                <DepartmentsTab
                  wsId={wsId!}
                  members={members}
                  onRefresh={loadData}
                  t={t}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </main>
  );
}

function RoleBadge({
  role,
  roleName,
  t,
}: {
  role: WorkspaceRole;
  roleName?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const config: Record<string, { bg: string; icon: typeof Crown }> = {
    owner: {
      bg: "bg-warning text-warning-foreground",
      icon: Crown,
    },
    admin: {
      bg: "bg-primary text-primary-foreground",
      icon: Shield,
    },
    member: {
      bg: "bg-healthy text-healthy-foreground",
      icon: Users,
    },
  };
  const { bg, icon: Icon } = config[role] ?? {
    bg: "bg-healthy text-healthy-foreground",
    icon: Users,
  };
  const label = roleName || t(`roles.${role}`);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-xs font-semibold",
        bg,
      )}
    >
      <Icon className="h-3.5 w-3.5" weight="fill" />
      {label}
    </span>
  );
}

function MemberAvatar({
  member,
  size = "md",
}: {
  member: WorkspaceMember;
  size?: "sm" | "md";
}) {
  const name = member.username || member.email;
  const initials = name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const roleColors: Record<string, string> = {
    owner: "bg-warning text-warning-foreground",
    admin: "bg-primary text-primary-foreground",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[--radius] font-semibold select-none",
        roleColors[member.role] ?? "bg-healthy text-healthy-foreground",
        size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
      )}
    >
      {initials}
    </div>
  );
}

function MembersTab({
  wsId,
  members,
  customRoles,
  currentUserId,
  onRefresh,
  t,
}: {
  wsId: string;
  members: WorkspaceMember[];
  customRoles: CustomRole[];
  currentUserId: string;
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const { can } = useWorkspace();
  const [changingRole, setChangingRole] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleRoleChange = async (userId: string, value: string) => {
    setError("");
    setChangingRole(userId);
    if (value === "admin" || value === "member") {
      const result = await updateMemberRole(wsId, userId, value);
      if (result.error) setError(result.error);
      else await onRefresh();
    } else if (value.startsWith("role:")) {
      const roleId = value.replace("role:", "");
      const result = await assignCustomRole(wsId, userId, roleId);
      if (result.error) setError(result.error);
      else await onRefresh();
    }
    setChangingRole(null);
  };

  const handleRemove = async (userId: string) => {
    setError("");
    setRemoving(userId);
    const result = await removeMember(wsId, userId);
    setRemoving(null);
    if (result.error) {
      setError(result.error);
      return; // keep the confirmation open so the member can read the error
    }
    setConfirmRemove(null);
    await onRefresh();
  };

  const closeRemoveDialog = () => {
    if (removing) return; // don't dismiss mid-request
    setConfirmRemove(null);
    setError("");
  };

  const memberToRemove = members.find((m) => m.userId === confirmRemove) ?? null;

  const filteredMembers = members.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.username?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <ElevatedContainer className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <ElevatedInput
              type="text"
              label={t("searchMembers", { fallback: "Search members..." })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredMembers.length} / {members.length}
          </span>
        </div>
      </ElevatedContainer>

      {error && (
        <ElevatedContainer className="!bg-muted !border-border !p-3">
          <p className="text-sm text-destructive-ink">{error}</p>
        </ElevatedContainer>
      )}

      {filteredMembers.length === 0 ? (
        <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
          <Users
            className="mx-auto h-10 w-10 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchQuery
              ? t("noMembersFound", { fallback: "No members found" })
              : t("noMembers", { fallback: "No members yet" })}
          </p>
        </ElevatedContainer>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const currentUserMember = members.find(
              (m) => m.userId === currentUserId,
            );
            const isOwner = currentUserMember?.role === "owner";
            const canChangeRole =
              !isCurrentUser &&
              member.role !== "owner" &&
              can("members", "update") &&
              (isOwner || member.role !== "admin");
            const canRemove =
              !isCurrentUser &&
              member.role !== "owner" &&
              can("members", "delete") &&
              (isOwner || member.role !== "admin");

            return (
              <div key={member.id}>
                <ElevatedContainer className="!p-4 transition-all hover:!border-border">
                  <div className="flex items-center gap-4">
                    <MemberAvatar member={member} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {member.username || member.email}
                        </p>
                        {isCurrentUser && (
                          <span className="rounded-[--radius] bg-primary px-2 py-0.5 text-2xs font-semibold text-primary-foreground">
                            {t("you", { fallback: "You" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    <RoleBadge
                      role={member.role}
                      roleName={member.roleName}
                      t={t}
                    />

                    {(canChangeRole || canRemove) && (
                      <div className="flex items-center gap-2">
                        {canChangeRole && (
                          <ElevatedSelect
                            value={
                              member.roleId
                                ? `role:${member.roleId}`
                                : member.role
                            }
                            onValueChange={(val) =>
                              handleRoleChange(member.userId, val)
                            }
                            disabled={changingRole === member.userId}
                            className="w-auto min-w-[130px]"
                          >
                            <ElevatedSelectItem
                              value="admin"
                              icon={
                                <Shield className="h-4 w-4" weight="fill" />
                              }
                            >
                              {t("roles.admin")}
                            </ElevatedSelectItem>
                            <ElevatedSelectItem
                              value="member"
                              icon={<Users className="h-4 w-4" weight="fill" />}
                            >
                              {t("roles.member")}
                            </ElevatedSelectItem>
                            {customRoles.map((cr) => (
                              <ElevatedSelectItem
                                key={cr.id}
                                value={`role:${cr.id}`}
                                icon={
                                  <UserGear className="h-4 w-4" weight="fill" />
                                }
                              >
                                {cr.name}
                              </ElevatedSelectItem>
                            ))}
                          </ElevatedSelect>
                        )}
                        {canRemove && (
                          <button
                            onClick={() => setConfirmRemove(member.userId)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive-ink dark:hover:text-destructive-ink transition-colors"
                            title={t("removeMember")}
                          >
                            <UserMinus className="h-4 w-4" weight="bold" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </ElevatedContainer>
              </div>
            );
          })}
        </div>
      )}

      <ElevatedDialog
        open={!!confirmRemove}
        onOpenChange={(open) => {
          if (!open) closeRemoveDialog();
        }}
      >
        <ElevatedDialogContent className="max-w-[460px] gap-5">
          <ElevatedDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] bg-destructive text-destructive-foreground">
                <UserMinus className="h-5 w-5" weight="bold" />
              </div>
              <ElevatedDialogTitle>{t("removeMember")}</ElevatedDialogTitle>
            </div>
          </ElevatedDialogHeader>

          {memberToRemove && (
            <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-muted p-3">
              <MemberAvatar member={memberToRemove} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {memberToRemove.username || memberToRemove.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {memberToRemove.email}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 rounded-[--radius] border border-border bg-muted p-3.5">
            <Warning
              className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink"
              weight="fill"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("removeMemberDepartmentsTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("removeMemberDepartmentsBody")}
              </p>
            </div>
          </div>

          <ElevatedDialogDescription>
            {t("removeMemberIrreversible")}
          </ElevatedDialogDescription>

          {error && (
            <p className="text-sm text-destructive-ink">{error}</p>
          )}

          <ElevatedDialogFooter>
            <ElevatedButton
              variant="ghost"
              title={t("cancel")}
              onClick={closeRemoveDialog}
              disabled={!!removing}
            />
            <button
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={!!removing}
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive disabled:opacity-50"
            >
              {removing ? (
                <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
              ) : (
                <UserMinus className="h-4 w-4" weight="bold" />
              )}
              {t("removeMemberConfirmCta")}
            </button>
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>
    </div>
  );
}

function InvitesTab({
  wsId,
  invites,
  customRoles: initialRoles,
  onRefresh,
  t,
}: {
  wsId: string;
  invites: WorkspaceInvite[];
  customRoles: CustomRole[];
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const { can } = useWorkspace();
  const { departments: wsDepartments } = useDepartment();
  const [showForm, setShowForm] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [selectedDeptIds, setSelectedDeptIds] = React.useState<string[]>([]);
  const [selectedValue, setSelectedValue] = React.useState<string>(
    initialRoles[0]?.id ? `role:${initialRoles[0].id}` : "admin",
  );
  const [error, setError] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<string | null>(null);
  const [expandedInvite, setExpandedInvite] = React.useState<string | null>(
    null,
  );

  const [showCreateRole, setShowCreateRole] = React.useState(false);
  const [roleName, setRoleName] = React.useState("");
  const [roleDescription, setRoleDescription] = React.useState("");
  const [savingRole, setSavingRole] = React.useState(false);
  const [roleError, setRoleError] = React.useState("");
  const [localRoles, setLocalRoles] =
    React.useState<CustomRole[]>(initialRoles);

  const [availablePerms, setAvailablePerms] = React.useState<
    AvailablePermission[]
  >([]);
  const [loadingPerms, setLoadingPerms] = React.useState(false);

  const {
    permMap,
    togglePermission,
    toggleAllForResource,
    resetPermMap,
    getPermissionEntries,
    hasAnyPermissions,
  } = usePermissionMap(undefined, availablePerms);

  React.useEffect(() => {
    setLocalRoles(initialRoles);
  }, [initialRoles]);

  const loadAvailablePermissions = React.useCallback(async () => {
    if (availablePerms.length > 0) return;
    setLoadingPerms(true);
    const result = await fetchAvailablePermissions();
    if (!result.error) setAvailablePerms(result.permissions);
    setLoadingPerms(false);
  }, [availablePerms.length]);

  React.useEffect(() => {
    if (showCreateRole) loadAvailablePermissions();
  }, [showCreateRole, loadAvailablePermissions]);

  const handleCreateRole = async () => {
    if (!roleName.trim()) return;
    setSavingRole(true);
    setRoleError("");

    const permissions = getPermissionEntries() as PermissionEntry[];
    const result = await createCustomRole(wsId, {
      name: roleName.trim(),
      description: roleDescription.trim() || undefined,
      permissions,
    });

    if (result.error) {
      setRoleError(result.error);
      setSavingRole(false);
      return;
    }

    if (result.role) {
      setLocalRoles((prev) => [...prev, result.role!]);
      setSelectedValue(`role:${result.role.id}`);
    }

    setRoleName("");
    setRoleDescription("");
    resetPermMap();
    setShowCreateRole(false);
    setSavingRole(false);
    await onRefresh();
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    setError("");
    setSending(true);

    const isAdmin = selectedValue === "admin";
    const roleId = isAdmin ? undefined : selectedValue.replace("role:", "");

    const result = await inviteMember(
      wsId,
      email.trim(),
      isAdmin ? "admin" : undefined,
      roleId,
      selectedDeptIds.length > 0 ? selectedDeptIds : undefined,
    );
    if (result.error) {
      setError(result.error);
      setSending(false);
      return;
    }
    setEmail("");
    setSelectedDeptIds([]);
    setShowForm(false);
    setSending(false);
    await onRefresh();
  };

  const pendingInvites = invites.filter((inv) => inv.status === "pending");

  return (
    <div className="space-y-4">
      {/* Invite Form */}
      {can("members", "create") && (
        <div>
          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ElevatedContainer className="!p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                      <UserCirclePlus className="h-5 w-5" weight="fill" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("inviteMember")}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t("inviteDescription")}
                      </p>
                    </div>
                  </div>

                  {/* Email + Role */}
                  <div className="flex items-start gap-3">
                    <ElevatedInput
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      label={t("inviteEmailPlaceholder")}
                      variant="outline"
                      controlSize="sm"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInvite();
                      }}
                      autoFocus
                    />
                    <ElevatedSelect
                      value={selectedValue}
                      onValueChange={(val) => {
                        if (val === "__create_role__") {
                          setShowCreateRole(true);
                        } else {
                          setSelectedValue(val);
                        }
                      }}
                      className="w-auto min-w-[150px]"
                    >
                      <ElevatedSelectItem
                        value="admin"
                        icon={<Shield className="h-4 w-4" weight="fill" />}
                      >
                        {t("roles.admin")}
                      </ElevatedSelectItem>
                      {localRoles.map((cr) => (
                        <ElevatedSelectItem
                          key={cr.id}
                          value={`role:${cr.id}`}
                          icon={<UserGear className="h-4 w-4" weight="fill" />}
                        >
                          {cr.name}
                        </ElevatedSelectItem>
                      ))}
                      {can("roles", "create") && (
                        <ElevatedSelectItem
                          value="__create_role__"
                          icon={
                            <ShieldPlus className="h-4 w-4" weight="fill" />
                          }
                        >
                          <span className="text-primary-ink font-semibold">
                            {t("customRoles.createRole")}
                          </span>
                        </ElevatedSelectItem>
                      )}
                    </ElevatedSelect>
                  </div>

                  {/* Admin role info */}
                  {selectedValue === "admin" && (
                    <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
                      <Shield
                        className="h-4 w-4 text-primary-ink mt-0.5 flex-shrink-0"
                        weight="fill"
                      />
                      <p className="text-2xs text-primary-ink leading-relaxed">
                        {t("adminRoleHint")}
                      </p>
                    </div>
                  )}

                  {/* Inline Create-Role Dialog */}
                  <AnimatePresence>
                    {showCreateRole && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-[--radius] border border-border bg-muted p-4 space-y-4">
                          <div className="flex items-center gap-3">
                            <IconBox color="emerald" size="sm">
                              <UserGear className="h-4 w-4" weight="fill" />
                            </IconBox>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-foreground">
                                {t("customRoles.createRole")}
                              </h4>
                              <p className="text-2xs text-muted-foreground">
                                {t("customRoles.description")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreateRole(false);
                                setRoleName("");
                                setRoleDescription("");
                                setRoleError("");
                                resetPermMap();
                              }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <X className="h-4 w-4" weight="bold" />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <ElevatedInput
                              type="text"
                              value={roleName}
                              onChange={(e) => setRoleName(e.target.value)}
                              label={t("customRoles.roleName")}
                              variant="outline"
                              controlSize="sm"
                              className="w-full"
                              autoFocus
                            />
                            <ElevatedInput
                              type="text"
                              value={roleDescription}
                              onChange={(e) =>
                                setRoleDescription(e.target.value)
                              }
                              label={t("customRoles.roleDescription")}
                              variant="outline"
                              controlSize="sm"
                              className="w-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-foreground">
                              {t("customRoles.rolePermissions")}
                            </h4>
                            {loadingPerms ? (
                              <div className="flex h-20 items-center justify-center">
                                <CircleNotch
                                  className="h-6 w-6 animate-spin text-primary-ink"
                                  weight="bold"
                                />
                              </div>
                            ) : (
                              <PermissionsEditor
                                availablePermissions={availablePerms}
                                permMap={permMap}
                                onToggle={togglePermission}
                                onToggleAll={toggleAllForResource}
                                t={(key: string) => t(key)}
                                compact
                              />
                            )}
                          </div>

                          {roleError && (
                            <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
                              <X
                                className="h-4 w-4 text-destructive-ink dark:text-destructive-ink mt-0.5 flex-shrink-0"
                                weight="bold"
                              />
                              <p className="text-xs text-destructive-ink">
                                {roleError}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <ElevatedButton
                              onClick={() => {
                                setShowCreateRole(false);
                                setRoleName("");
                                setRoleDescription("");
                                setRoleError("");
                                resetPermMap();
                              }}
                              variant="outline-subtle"
                              title={t("customRoles.cancel")}
                            />
                            <div className="flex items-center gap-2">
                              {hasAnyPermissions && (
                                <span className="text-2xs text-muted-foreground">
                                  {t("customRoles.permissionCount", {
                                    count: getPermissionEntries().length,
                                  })}
                                </span>
                              )}
                              <ElevatedButton
                                onClick={handleCreateRole}
                                disabled={!roleName.trim() || savingRole}
                                variant="primary"
                                title={
                                  savingRole
                                    ? t("customRoles.saving")
                                    : t("customRoles.save")
                                }
                                icon={
                                  <Check className="h-4 w-4" weight="bold" />
                                }
                                iconVisible
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Department assignment */}
                  {wsDepartments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TreeStructure
                          className="h-4 w-4 text-muted-foreground"
                          weight="fill"
                        />
                        <span className="text-xs font-semibold text-foreground">
                          {t("departments.assignLabel")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {wsDepartments.map((dept) => {
                          const selected = selectedDeptIds.includes(dept.id);
                          return (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() =>
                                setSelectedDeptIds((prev) =>
                                  selected
                                    ? prev.filter((id) => id !== dept.id)
                                    : [...prev, dept.id],
                                )
                              }
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground font-medium"
                                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                              )}
                            >
                              {selected && (
                                <Check className="h-3 w-3" weight="bold" />
                              )}
                              {dept.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
                      <X
                        className="h-4 w-4 text-destructive-ink dark:text-destructive-ink mt-0.5 flex-shrink-0"
                        weight="bold"
                      />
                      <p className="text-xs text-destructive-ink">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <ElevatedButton
                      onClick={() => {
                        setShowForm(false);
                        setEmail("");
                        setError("");
                        setSelectedDeptIds([]);
                        setShowCreateRole(false);
                      }}
                      variant="outline-subtle"
                      title={t("cancel")}
                    />
                    <ElevatedButton
                      onClick={handleInvite}
                      disabled={!email.trim() || sending || showCreateRole}
                      variant="primary"
                      title={sending ? t("sending") : t("sendInvite")}
                      icon={<Envelope className="h-4 w-4" weight="bold" />}
                      iconVisible
                    />
                  </div>
                </ElevatedContainer>
              </motion.div>
            ) : (
              <motion.div
                key="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ElevatedButton
                  onClick={() => setShowForm(true)}
                  variant="primary"
                  title={t("inviteMember")}
                  icon={<UserCirclePlus className="h-4 w-4" weight="bold" />}
                  iconVisible
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pending Invites */}
      {pendingInvites.length === 0 ? (
        <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
          <Envelope
            className="mx-auto h-10 w-10 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("noPendingInvites")}
          </p>
        </ElevatedContainer>
      ) : (
        <div className="space-y-3">
          {pendingInvites.map((invite) => {
            const permCount = invite.permissions?.length ?? 0;
            const isExpanded = expandedInvite === invite.id;
            const roleName =
              invite.roleName || (invite.role ? t(`roles.${invite.role}`) : "");

            return (
              <ElevatedContainer
                key={invite.id}
                className="!p-0 overflow-hidden"
              >
                {/* Invite row */}
                <div className="flex items-center gap-4 px-4 py-4">
                  <IconBox color="amber" size="sm">
                    <Envelope className="h-5 w-5" weight="fill" />
                  </IconBox>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {invite.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("invitedAs")} {roleName} &bull; {t("expires")}{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {permCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedInvite(isExpanded ? null : invite.id)
                        }
                        className="inline-flex items-center gap-1 rounded-[--radius] bg-primary px-2 py-0.5 text-2xs font-semibold text-primary-foreground hover:bg-primary/80 transition-colors"
                      >
                        <ShieldCheck className="h-3 w-3" weight="fill" />
                        {permCount} {t("permissionsLabel").toLowerCase()}
                        <CaretDown
                          className={cn(
                            "h-2.5 w-2.5 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                          weight="bold"
                        />
                      </button>
                    )}
                    <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground">
                      {t("pending")}
                    </span>
                    {can("members", "delete") && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCancelling(invite.id);
                          const result = await cancelInvite(wsId, invite.id);
                          if (result.error) {
                            setError(result.error);
                          } else {
                            await onRefresh();
                          }
                          setCancelling(null);
                        }}
                        disabled={cancelling === invite.id}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive-ink hover:bg-muted dark:text-destructive-ink dark:hover:bg-muted disabled:opacity-50 transition-colors"
                        title={t("cancelInvite")}
                      >
                        <X className="h-3.5 w-3.5" weight="bold" />
                        {t("cancelInvite")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded permissions view */}
                <AnimatePresence>
                  {isExpanded &&
                    invite.permissions &&
                    invite.permissions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border bg-muted px-4 py-3">
                          <p className="text-2xs font-semibold text-muted-foreground mb-2">
                            {t("preConfiguredPermissions")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {invite.permissions.map((p, idx) => (
                              <span
                                key={`${p.resource}-${p.action}-${idx}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-card border border-border px-2 py-1 text-2xs font-medium text-muted-foreground"
                              >
                                <span className="text-primary-ink font-semibold">
                                  {t(`resources.${p.resource}`)}
                                </span>
                                <span className="text-muted-foreground">
                                  &middot;
                                </span>
                                <span>{t(`actions.${p.action}`)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </ElevatedContainer>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PermissionsTab({
  wsId,
  members,
  t,
}: {
  wsId: string;
  members: WorkspaceMember[];
  t: ReturnType<typeof useTranslations>;
}) {
  const { can, canAny } = useWorkspace();
  const canViewPermissions = can("members", "read");
  const canEditPermissions = can("members", "update");
  const canManageAssignments = canAny("assignments");
  const [selectedMember, setSelectedMember] =
    React.useState<WorkspaceMember | null>(null);
  const [, setPermissions] = React.useState<MemberPermission[]>([]);
  const [availablePerms, setAvailablePerms] = React.useState<
    AvailablePermission[]
  >([]);
  const [isLoadingPerms, setIsLoadingPerms] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showAssignments, setShowAssignments] = React.useState(
    !canViewPermissions && canManageAssignments,
  );
  const [assignResourceType, setAssignResourceType] =
    React.useState<ResourceType>("agents");
  const [assignResourceId, setAssignResourceId] = React.useState("");
  const [assignments, setAssignments] = React.useState<ResourceAssignment[]>(
    [],
  );
  const [assignError, setAssignError] = React.useState("");
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);
  const [memberSearch, setMemberSearch] = React.useState("");

  const {
    permMap,
    togglePermission,
    toggleAllForResource,
    resetPermMap,
    getPermissionEntries,
  } = usePermissionMap(undefined, availablePerms);

  const employees = members.filter(
    (m) => m.role !== "owner" && m.role !== "admin",
  );
  const privilegedMembers = members.filter(
    (m) => m.role === "owner" || m.role === "admin",
  );

  const filteredEmployees = employees.filter((m) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      m.username?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });
  const filteredPrivileged = privilegedMembers.filter((m) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      m.username?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  const loadPermissions = React.useCallback(
    async (member: WorkspaceMember) => {
      setSelectedMember(member);
      setIsLoadingPerms(true);
      setError("");
      try {
        const [permsRes, availRes] = await Promise.all([
          fetchMemberPermissions(wsId, member.userId),
          fetchAvailablePermissions(),
        ]);
        if (permsRes.error) {
          setError(permsRes.error);
          return;
        }
        if (!availRes.error) setAvailablePerms(availRes.permissions);
        setPermissions(permsRes.permissions);

        resetPermMap(
          permsRes.permissions.map((p) => ({
            resource: p.resource,
            action: p.action,
          })),
        );
      } finally {
        setIsLoadingPerms(false);
      }
    },
    [wsId, resetPermMap],
  );

  const handleSave = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setError("");
    const entries = getPermissionEntries() as PermissionEntry[];
    const result = await setMemberPermissions(
      wsId,
      selectedMember.userId,
      entries,
    );
    if (result.error) setError(result.error);
    setSaving(false);
  };

  const loadAssignments = async () => {
    if (!assignResourceId.trim()) return;
    setLoadingAssignments(true);
    setAssignError("");
    const result = await fetchResourceAssignments(
      wsId,
      assignResourceType,
      assignResourceId.trim(),
    );
    if (result.error) {
      setAssignError(result.error);
    } else {
      setAssignments(result.assignments);
    }
    setLoadingAssignments(false);
  };

  const handleAssign = async (memberUserId: string) => {
    if (!assignResourceId.trim()) return;
    setAssignError("");
    const result = await assignResource(
      wsId,
      assignResourceType,
      assignResourceId.trim(),
      memberUserId,
    );
    if (result.error) {
      setAssignError(result.error);
      return;
    }
    await loadAssignments();
  };

  const handleUnassign = async (userId: string) => {
    if (!assignResourceId.trim()) return;
    setAssignError("");
    const result = await unassignResource(
      wsId,
      assignResourceType,
      assignResourceId.trim(),
      userId,
    );
    if (result.error) {
      setAssignError(result.error);
      return;
    }
    await loadAssignments();
  };

  const resourceTypes: ResourceType[] = [
    "agents",
    "whatsapp_campaigns",
    "whatsapp_templates",
    "business_phones",
    "stages",
    "labels",
    "balance",
    "conversations",
    "media",
    "leads",
    "analysis",
    "sip_trunks",
    "call_recordings",
    "whatsapp_flows",
  ];

  if (!canViewPermissions && !canEditPermissions && !canManageAssignments) {
    return (
      <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
        <Shield
          className="mx-auto h-10 w-10 text-muted-foreground"
          weight="fill"
        />
        <p className="mt-3 text-sm text-muted-foreground">
          {t("noPermissionAccess")}
        </p>
      </ElevatedContainer>
    );
  }

  if (
    employees.length === 0 &&
    privilegedMembers.length === 0 &&
    !selectedMember
  ) {
    return (
      <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
        <Users
          className="mx-auto h-10 w-10 text-muted-foreground"
          weight="fill"
        />
        <p className="mt-3 text-sm text-muted-foreground">{t("noEmployees")}</p>
      </ElevatedContainer>
    );
  }

  if (selectedMember) {
    return (
      <div className="space-y-4">
        <div>
          <ElevatedContainer className="!p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setShowAssignments(false);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" weight="bold" />
              </button>
              <MemberAvatar member={selectedMember} />
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground truncate">
                  {selectedMember.username || selectedMember.email}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedMember.email}
                </p>
              </div>
              <RoleBadge
                role={selectedMember.role}
                roleName={selectedMember.roleName}
                t={t}
              />
            </div>
          </ElevatedContainer>
        </div>

        <div>
          <div className="flex gap-2">
            {(canViewPermissions || canEditPermissions) && (
              <ElevatedButton
                onClick={() => setShowAssignments(false)}
                variant={!showAssignments ? "primary" : "outline-subtle"}
                title={t("permissionsLabel")}
                icon={<ShieldCheck className="h-4 w-4" weight="fill" />}
                iconVisible
              />
            )}
            {canManageAssignments && (
              <ElevatedButton
                onClick={() => setShowAssignments(true)}
                variant={showAssignments ? "primary" : "outline-subtle"}
                title={t("resourceAccess")}
                icon={<Buildings className="h-4 w-4" weight="fill" />}
                iconVisible
              />
            )}
          </div>
        </div>

        {error && (
          <ElevatedContainer className="!bg-muted !border-border !p-3">
            <p className="text-sm text-destructive-ink">{error}</p>
          </ElevatedContainer>
        )}

        {!showAssignments ? (
          <>
            {selectedMember.role === "owner" ||
            selectedMember.role === "admin" ? (
              <div className="space-y-4">
                <ElevatedContainer className="!bg-muted !border-border !p-4">
                  <div className="flex items-start gap-3">
                    <Shield
                      className="h-5 w-5 text-primary-ink mt-0.5 flex-shrink-0"
                      weight="fill"
                    />
                    <div>
                      <p className="text-sm font-semibold text-primary-ink">
                        {t("fullAccessTitle")}
                      </p>
                      <p className="text-xs text-primary-ink/80 mt-1 leading-relaxed">
                        {t("fullAccessDescription", {
                          role: t(`roles.${selectedMember.role}`),
                        })}
                      </p>
                    </div>
                  </div>
                </ElevatedContainer>

                {isLoadingPerms ? (
                  <div className="flex h-32 items-center justify-center">
                    <CircleNotch
                      className="h-8 w-8 animate-spin text-primary-ink"
                      weight="bold"
                    />
                  </div>
                ) : (
                  <PermissionsEditor
                    availablePermissions={availablePerms}
                    permMap={permMap}
                    onToggle={togglePermission}
                    onToggleAll={toggleAllForResource}
                    disabled
                    t={(key: string) => t(key)}
                  />
                )}
              </div>
            ) : isLoadingPerms ? (
              <div className="flex h-32 items-center justify-center">
                <CircleNotch
                  className="h-8 w-8 animate-spin text-primary-ink"
                  weight="bold"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <PermissionsEditor
                  availablePermissions={availablePerms}
                  permMap={permMap}
                  onToggle={togglePermission}
                  onToggleAll={toggleAllForResource}
                  disabled={!canEditPermissions}
                  t={(key: string) => t(key)}
                />

                {canEditPermissions && (
                  <ElevatedButton
                    onClick={handleSave}
                    disabled={saving}
                    variant="primary"
                    title={saving ? t("saving") : t("savePermissions")}
                    icon={
                      saving ? (
                        <CircleNotch
                          className="h-4 w-4 animate-spin"
                          weight="bold"
                        />
                      ) : (
                        <Check className="h-4 w-4" weight="bold" />
                      )
                    }
                    iconVisible
                    className="w-full"
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <ElevatedContainer className="!p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                {t("lookupAssignments")}
              </h4>
              <div className="flex items-center gap-3">
                <ElevatedSelect
                  value={assignResourceType}
                  onValueChange={(val) =>
                    setAssignResourceType(val as ResourceType)
                  }
                  className="w-auto min-w-[180px]"
                >
                  {resourceTypes.map((r) => (
                    <ElevatedSelectItem key={r} value={r}>
                      {t(`resources.${r}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
                <ElevatedInput
                  value={assignResourceId}
                  onChange={(e) => setAssignResourceId(e.target.value)}
                  label={t("resourceIdPlaceholder")}
                  variant="outline"
                  controlSize="sm"
                  className="flex-1"
                />
                <ElevatedButton
                  onClick={loadAssignments}
                  disabled={!assignResourceId.trim() || loadingAssignments}
                  variant="primary"
                  size="icon"
                  icon={
                    loadingAssignments ? (
                      <CircleNotch
                        className="h-4 w-4 animate-spin"
                        weight="bold"
                      />
                    ) : (
                      <MagnifyingGlass className="h-4 w-4" weight="bold" />
                    )
                  }
                  iconVisible
                />
              </div>
              {assignError && (
                <p className="text-xs text-destructive-ink dark:text-destructive-ink">
                  {assignError}
                </p>
              )}
            </ElevatedContainer>

            {assignResourceId.trim() && (
              <ElevatedContainer className="!p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("assignedMembers")}
                </h4>
                {assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("noAssignments")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-[--radius] bg-muted p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {a.memberUsername || a.memberEmail}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.memberEmail}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const member = members.find(
                              (m) => m.id === a.memberId,
                            );
                            if (member) handleUnassign(member.userId);
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive-ink dark:hover:text-destructive-ink transition-colors"
                        >
                          <Trash className="h-4 w-4" weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <h5 className="text-xs font-semibold text-muted-foreground mb-2">
                    {t("assignMember")}
                  </h5>
                  <div className="space-y-1">
                    {employees
                      .filter(
                        (e) =>
                          !assignments.some((a) => {
                            const memberMatch = members.find(
                              (m) => m.id === a.memberId,
                            );
                            return memberMatch?.userId === e.userId;
                          }),
                      )
                      .map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleAssign(emp.userId)}
                          className="flex w-full items-center gap-3 rounded-[--radius] p-2.5 text-left hover:bg-muted transition-colors"
                        >
                          <MemberAvatar member={emp} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {emp.username || emp.email}
                            </p>
                          </div>
                          <span className="text-xs text-primary-ink font-medium">
                            {t("assign")}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </ElevatedContainer>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar for member selection */}
      <ElevatedContainer className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <ElevatedInput
              type="text"
              label={t("searchMembers", {
                fallback: "Search members...",
              })}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("selectMemberToManage")}
          </p>
        </div>
      </ElevatedContainer>

      {filteredPrivileged.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("privilegedMembersLabel")}
          </p>
          <div className="space-y-2">
            {filteredPrivileged.map((member) => (
              <div key={member.id}>
                <ElevatedContainer
                  as="button"
                  onClick={() => loadPermissions(member)}
                  className="!p-4 w-full hover:!border-primary/30 cursor-pointer transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <MemberAvatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {member.username || member.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <RoleBadge
                      role={member.role}
                      roleName={member.roleName}
                      t={t}
                    />
                    <CaretRight
                      className="h-4 w-4 text-muted-foreground"
                      weight="bold"
                    />
                  </div>
                </ElevatedContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEmployees.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("employeeMembersLabel")}
          </p>
          <div className="space-y-2">
            {filteredEmployees.map((member) => (
              <div key={member.id}>
                <ElevatedContainer
                  as="button"
                  onClick={() => loadPermissions(member)}
                  className="!p-4 w-full hover:!border-primary/30 cursor-pointer transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <MemberAvatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {member.username || member.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <RoleBadge
                      role={member.role}
                      roleName={member.roleName}
                      t={t}
                    />
                    <CaretRight
                      className="h-4 w-4 text-muted-foreground"
                      weight="bold"
                    />
                  </div>
                </ElevatedContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEmployees.length === 0 &&
        filteredPrivileged.length === 0 &&
        memberSearch && (
          <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
            <Users
              className="mx-auto h-10 w-10 text-muted-foreground"
              weight="fill"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {t("noMembersFound", { fallback: "No members found" })}
            </p>
          </ElevatedContainer>
        )}

      {employees.length === 0 &&
        privilegedMembers.length > 0 &&
        !memberSearch && (
          <ElevatedContainer className="!border-dashed !bg-muted !p-8 text-center">
            <Users
              className="mx-auto h-8 w-8 text-muted-foreground"
              weight="fill"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("noEmployees")}
            </p>
          </ElevatedContainer>
        )}
    </div>
  );
}

function RolesTab({
  wsId,
  customRoles,
  onRefresh,
  t,
}: {
  wsId: string;
  customRoles: CustomRole[];
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const { can } = useWorkspace();
  const [editingRole, setEditingRole] = React.useState<CustomRole | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  const [availablePerms, setAvailablePerms] = React.useState<
    AvailablePermission[]
  >([]);
  const [loadingPerms, setLoadingPerms] = React.useState(false);

  const {
    permMap,
    togglePermission,
    toggleAllForResource,
    resetPermMap,
    getPermissionEntries,
    hasAnyPermissions,
  } = usePermissionMap(undefined, availablePerms);

  const loadPerms = React.useCallback(async () => {
    if (availablePerms.length > 0) return;
    setLoadingPerms(true);
    const result = await fetchAvailablePermissions();
    if (!result.error) setAvailablePerms(result.permissions);
    setLoadingPerms(false);
  }, [availablePerms.length]);

  const openCreate = () => {
    setEditingRole(null);
    setCreating(true);
    setName("");
    setDescription("");
    setError("");
    resetPermMap();
    loadPerms();
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setCreating(true);
    setName(role.name);
    setDescription(role.description ?? "");
    setError("");
    resetPermMap(
      role.permissions.map((p) => ({
        resource: p.resource,
        action: p.action,
      })),
    );
    loadPerms();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const permissions = getPermissionEntries() as PermissionEntry[];

    if (editingRole) {
      const result = await updateCustomRole(wsId, editingRole.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    } else {
      const result = await createCustomRole(wsId, {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setCreating(false);
    setEditingRole(null);
    await onRefresh();
  };

  const handleDelete = async (roleId: string) => {
    setDeleting(roleId);
    const result = await deleteCustomRole(wsId, roleId);
    if (result.error) {
      setError(result.error);
    } else {
      await onRefresh();
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const canManage = can("roles", "create") || can("roles", "update");
  const canDelete = can("roles", "delete");

  if (creating) {
    return (
      <div className="space-y-4">
        <div>
          <ElevatedContainer className="!p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditingRole(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" weight="bold" />
              </button>
              <IconBox color="emerald" size="sm">
                <UserGear className="h-5 w-5" weight="fill" />
              </IconBox>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                  {editingRole
                    ? t("customRoles.editRole")
                    : t("customRoles.createRole")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("customRoles.description")}
                </p>
              </div>
            </div>
          </ElevatedContainer>
        </div>

        <div>
          <ElevatedContainer className="!p-5 space-y-4">
            <div className="space-y-3">
              <ElevatedInput
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                label={t("customRoles.roleName")}
                variant="outline"
                controlSize="sm"
                className="w-full"
                autoFocus
              />
              <ElevatedInput
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                label={t("customRoles.roleDescription")}
                variant="outline"
                controlSize="sm"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                {t("customRoles.rolePermissions")}
              </h4>
              {loadingPerms ? (
                <div className="flex h-20 items-center justify-center">
                  <CircleNotch
                    className="h-6 w-6 animate-spin text-primary-ink"
                    weight="bold"
                  />
                </div>
              ) : (
                <PermissionsEditor
                  availablePermissions={availablePerms}
                  permMap={permMap}
                  onToggle={togglePermission}
                  onToggleAll={toggleAllForResource}
                  t={(key: string) => t(key)}
                />
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
                <X
                  className="h-4 w-4 text-destructive-ink dark:text-destructive-ink mt-0.5 flex-shrink-0"
                  weight="bold"
                />
                <p className="text-xs text-destructive-ink">
                  {error}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <ElevatedButton
                onClick={() => {
                  setCreating(false);
                  setEditingRole(null);
                }}
                variant="outline-subtle"
                title={t("customRoles.cancel")}
              />
              <div className="flex items-center gap-2">
                {hasAnyPermissions && (
                  <span className="text-2xs text-muted-foreground">
                    {t("customRoles.permissionCount", {
                      count: getPermissionEntries().length,
                    })}
                  </span>
                )}
                <ElevatedButton
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  variant="primary"
                  title={
                    saving ? t("customRoles.saving") : t("customRoles.save")
                  }
                  icon={<Check className="h-4 w-4" weight="bold" />}
                  iconVisible
                />
              </div>
            </div>
          </ElevatedContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <ElevatedButton
          onClick={openCreate}
          variant="primary"
          title={t("customRoles.createRole")}
          icon={<UserGear className="h-4 w-4" weight="bold" />}
          iconVisible
        />
      )}

      {customRoles.length === 0 ? (
        <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
          <UserGear
            className="mx-auto h-10 w-10 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {t("customRoles.noRoles")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("customRoles.noRolesDescription")}
          </p>
        </ElevatedContainer>
      ) : (
        <div className="space-y-2">
          {customRoles.map((role) => (
            <div key={role.id}>
              <ElevatedContainer className="!p-4 transition-all hover:!border-border">
                <div className="flex items-center gap-4">
                  <IconBox color="emerald" size="sm">
                    <UserGear className="h-5 w-5" weight="fill" />
                  </IconBox>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {role.name}
                    </p>
                    {role.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {role.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xs text-muted-foreground">
                        {t("customRoles.permissionCount", {
                          count: role.permissions.length,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        onClick={() => openEdit(role)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <PencilSimple className="h-4 w-4" weight="bold" />
                      </button>
                    )}
                    {canDelete && (
                      <>
                        {confirmDelete === role.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(role.id)}
                              disabled={deleting === role.id}
                              className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive disabled:opacity-50 transition-colors"
                            >
                              {deleting === role.id ? (
                                <CircleNotch
                                  className="h-3.5 w-3.5 animate-spin"
                                  weight="bold"
                                />
                              ) : (
                                <Check className="h-3.5 w-3.5" weight="bold" />
                              )}
                              {t("customRoles.deleteRole")}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                            >
                              <X className="h-3.5 w-3.5" weight="bold" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(role.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <Trash className="h-4 w-4" weight="bold" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </ElevatedContainer>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
          <X
            className="h-4 w-4 text-destructive-ink dark:text-destructive-ink mt-0.5 flex-shrink-0"
            weight="bold"
          />
          <p className="text-xs text-destructive-ink">{error}</p>
        </div>
      )}
    </div>
  );
}


/**
 * Escala própria de um departamento.
 *
 * Sobrescreve a do workspace por inteiro em vez de se somar a ela: o caso que
 * isso existe para resolver é um plantão que trabalha sábado dentro de uma
 * empresa de segunda a sexta, e uma interseção não conseguiria expressá-lo.
 * Desligar aqui devolve o departamento à escala do workspace.
 */
function DepartmentWorkingHours({
  department,
  onSaved,
}: {
  department: Department;
  onSaved: () => Promise<void> | void;
}) {
  const tw = useTranslations("workingHours");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<WorkingHoursSpec | null>(
    department.workingHours ?? null,
  );

  const saved = department.workingHours ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const issues = draft ? validateWorkingHours(draft) : [];

  const handleSave = async () => {
    setSaving(true);
    // `null` viaja de propósito — é o que remove a escala própria. Omitir o
    // campo diria "não mexa", e o botão nunca desligaria nada.
    const result = await updateDepartment(
      department.id,
      department.name,
      department.description || undefined,
      draft,
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(tw("saveSuccess"));
      await onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="rounded-[--radius] border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{tw("title")}</p>
          <p className="text-xs text-muted-foreground">
            {saved ? tw("departmentOwnHours") : tw("departmentInherits")}
          </p>
        </div>
        <CaretDown
          weight="bold"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <WorkingHoursEditor
            value={draft}
            onChange={setDraft}
            disabled={saving}
            offHint={tw("departmentOffHint")}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving || issues.length > 0}
            >
              {saving ? (
                <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check weight="bold" className="mr-1.5 h-4 w-4" />
              )}
              {tw("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentsTab({
  members,
  t,
}: {
  wsId: string;
  members: WorkspaceMember[];
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const { can } = useWorkspace();
  const { refreshDepartments } = useDepartment();

  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [editing, setEditing] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [deptMembers, setDeptMembers] = React.useState<
    Record<string, DepartmentMember[]>
  >({});
  const [loadingMembers, setLoadingMembers] = React.useState<string | null>(
    null,
  );

  const [addingMember, setAddingMember] = React.useState<string | null>(null);
  const [memberSearch, setMemberSearch] = React.useState("");

  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [removingMember, setRemovingMember] = React.useState<string | null>(
    null,
  );

  const canManage =
    can("departments", "update") || can("departments", "create");
  const canDelete = can("departments", "delete");

  const loadDepartments = React.useCallback(async () => {
    setLoading(true);
    const result = await fetchDepartments();
    if (!result.error) {
      setDepartments(result.departments);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const loadMembers = async (deptId: string) => {
    setLoadingMembers(deptId);
    const result = await fetchDepartmentMembers(deptId);
    if (!result.error) {
      setDeptMembers((prev) => ({ ...prev, [deptId]: result.members }));
    }
    setLoadingMembers(null);
  };

  const handleExpand = (deptId: string) => {
    if (expanded === deptId) {
      setExpanded(null);
      setAddingMember(null);
      return;
    }
    setExpanded(deptId);
    setAddingMember(null);
    if (!deptMembers[deptId]) {
      loadMembers(deptId);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    const result = await createDepartment(
      newName.trim(),
      newDesc.trim() || undefined,
    );
    if (result.error) {
      setError(result.error);
      setCreating(false);
      return;
    }
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    setCreating(false);
    await loadDepartments();
    await refreshDepartments();
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    const result = await updateDepartment(
      id,
      editName.trim(),
      editDesc.trim() || undefined,
    );
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setEditing(null);
    setSaving(false);
    await loadDepartments();
    await refreshDepartments();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setError("");
    const result = await deleteDepartment(id);
    if (result.error) {
      setError(result.error);
      setDeleting(null);
      return;
    }
    setConfirmDelete(null);
    setDeleting(null);
    await loadDepartments();
    await refreshDepartments();
  };

  const handleAddMember = async (deptId: string, memberId: string) => {
    setError("");
    const result = await addDepartmentMember(deptId, memberId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAddingMember(null);
    setMemberSearch("");
    await loadMembers(deptId);
    await loadDepartments();
    await refreshDepartments();
  };

  const handleRemoveMember = async (deptId: string, memberId: string) => {
    setRemovingMember(memberId);
    setError("");
    const result = await removeDepartmentMember(deptId, memberId);
    if (result.error) {
      setError(result.error);
      setRemovingMember(null);
      return;
    }
    setRemovingMember(null);
    await loadMembers(deptId);
    await loadDepartments();
    await refreshDepartments();
  };

  const availableMembers = React.useMemo(() => {
    if (!expanded) return members;
    const currentMemberIds = new Set(
      (deptMembers[expanded] ?? []).map((dm) => dm.memberId),
    );
    return members.filter((m) => !currentMemberIds.has(m.id));
  }, [expanded, members, deptMembers]);

  const filteredAvailable = React.useMemo(() => {
    if (!memberSearch.trim()) return availableMembers;
    const q = memberSearch.toLowerCase();
    return availableMembers.filter(
      (m) =>
        m.email.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q),
    );
  }, [availableMembers, memberSearch]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <CircleNotch
          className="h-6 w-6 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create button / form */}
      {canManage && (
        <AnimatePresence mode="wait">
          {showCreate ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ElevatedContainer className="!p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                    <TreeStructure className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("departments.create")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("departments.createDescription")}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <ElevatedInput
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    label={t("departments.name")}
                    variant="outline"
                    controlSize="sm"
                    className="w-full"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                    }}
                    autoFocus
                  />
                  <ElevatedInput
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    label={t("departments.description")}
                    variant="outline"
                    controlSize="sm"
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <ElevatedButton
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setNewDesc("");
                      setError("");
                    }}
                    variant="outline-subtle"
                    title={t("cancel")}
                  />
                  <ElevatedButton
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    variant="primary"
                    title={
                      creating
                        ? t("departments.creating")
                        : t("departments.create")
                    }
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                  />
                </div>
              </ElevatedContainer>
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ElevatedButton
                onClick={() => setShowCreate(true)}
                variant="primary"
                title={t("departments.create")}
                icon={<TreeStructure className="h-4 w-4" weight="bold" />}
                iconVisible
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Department list */}
      {departments.length === 0 ? (
        <ElevatedContainer className="!border-dashed !bg-muted !p-10 text-center">
          <TreeStructure
            className="mx-auto h-10 w-10 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {t("departments.noDepartments")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("departments.noDepartmentsDescription")}
          </p>
        </ElevatedContainer>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => {
            const isExpanded = expanded === dept.id;
            const isEditing = editing === dept.id;
            const membersForDept = deptMembers[dept.id] ?? [];
            const isLoadingMembers = loadingMembers === dept.id;

            return (
              <div key={dept.id}>
                <ElevatedContainer
                  className={cn(
                    "!p-0 transition-all overflow-hidden",
                    isExpanded && "!border-primary/30",
                  )}
                >
                  {/* Department header row */}
                  <div
                    className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleExpand(dept.id)}
                  >
                    <IconBox color="blue" size="sm">
                      <TreeStructure className="h-5 w-5" weight="fill" />
                    </IconBox>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ElevatedInput
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            variant="outline"
                            controlSize="sm"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(dept.id);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            autoFocus
                          />
                          <ElevatedInput
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            variant="outline"
                            controlSize="sm"
                            className="flex-1"
                            label={t("departments.description")}
                          />
                          <button
                            onClick={() => handleUpdate(dept.id)}
                            disabled={saving || !editName.trim()}
                            className="rounded-lg p-1.5 text-primary-ink hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            {saving ? (
                              <CircleNotch
                                className="h-4 w-4 animate-spin"
                                weight="bold"
                              />
                            ) : (
                              <Check className="h-4 w-4" weight="bold" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <X className="h-4 w-4" weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {dept.name}
                          </p>
                          {dept.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {dept.description}
                            </p>
                          )}
                          <span className="text-2xs text-muted-foreground">
                            {t("departments.memberCount", {
                              count: dept.memberCount ?? 0,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canManage && !isEditing && (
                        <button
                          onClick={() => {
                            setEditing(dept.id);
                            setEditName(dept.name);
                            setEditDesc(dept.description ?? "");
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <PencilSimple className="h-4 w-4" weight="bold" />
                        </button>
                      )}
                      {canDelete && (
                        <>
                          {confirmDelete === dept.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(dept.id)}
                                disabled={deleting === dept.id}
                                className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive disabled:opacity-50 transition-colors"
                              >
                                {deleting === dept.id ? (
                                  <CircleNotch
                                    className="h-3.5 w-3.5 animate-spin"
                                    weight="bold"
                                  />
                                ) : (
                                  <Check
                                    className="h-3.5 w-3.5"
                                    weight="bold"
                                  />
                                )}
                                {t("departments.confirmDelete")}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                              >
                                <X className="h-3.5 w-3.5" weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(dept.id)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              <Trash className="h-4 w-4" weight="bold" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <CaretRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-200",
                        isExpanded && "rotate-90",
                      )}
                      weight="bold"
                    />
                  </div>

                  {/* Expanded members section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-4 py-3 space-y-3">
                          {/*
                            A escala do departamento vive no painel expandido, e
                            não na linha de edição inline: uma semana inteira não
                            cabe ao lado do nome, e quem mexe em horário quer ver
                            os sete dias de uma vez.
                          */}
                          {canManage && (
                            <DepartmentWorkingHours
                              department={dept}
                              onSaved={loadDepartments}
                            />
                          )}

                          {/* Add member row */}
                          {canManage && (
                            <>
                              {addingMember === dept.id ? (
                                <div className="space-y-2">
                                  <ElevatedInput
                                    type="text"
                                    value={memberSearch}
                                    onChange={(e) =>
                                      setMemberSearch(e.target.value)
                                    }
                                    label={t("departments.searchMember")}
                                    variant="outline"
                                    controlSize="sm"
                                    className="w-full"
                                    autoFocus
                                  />
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {filteredAvailable.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 text-center">
                                        {t("departments.noAvailableMembers")}
                                      </p>
                                    ) : (
                                      filteredAvailable.map((m) => (
                                        <button
                                          key={m.id}
                                          onClick={() =>
                                            handleAddMember(dept.id, m.id)
                                          }
                                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
                                        >
                                          <Users
                                            className="h-3.5 w-3.5 text-muted-foreground"
                                            weight="fill"
                                          />
                                          <span className="flex-1 truncate">
                                            {m.username || m.email}
                                          </span>
                                          <span className="text-2xs text-muted-foreground">
                                            {m.email}
                                          </span>
                                          <Plus
                                            className="h-3.5 w-3.5 text-primary-ink"
                                            weight="bold"
                                          />
                                        </button>
                                      ))
                                    )}
                                  </div>
                                  <ElevatedButton
                                    onClick={() => {
                                      setAddingMember(null);
                                      setMemberSearch("");
                                    }}
                                    variant="outline-subtle"
                                    title={t("cancel")}
                                  />
                                </div>
                              ) : (
                                <ElevatedButton
                                  onClick={() => setAddingMember(dept.id)}
                                  variant="outline-subtle"
                                  title={t("departments.addMember")}
                                  icon={
                                    <Plus
                                      className="h-3.5 w-3.5"
                                      weight="bold"
                                    />
                                  }
                                  iconVisible
                                />
                              )}
                            </>
                          )}

                          {/* Members list */}
                          {isLoadingMembers ? (
                            <div className="flex h-16 items-center justify-center">
                              <CircleNotch
                                className="h-5 w-5 animate-spin text-primary-ink"
                                weight="bold"
                              />
                            </div>
                          ) : membersForDept.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              {t("departments.noMembers")}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {membersForDept.map((dm) => {
                                const wsMember = members.find(
                                  (m) => m.id === dm.memberId,
                                );
                                return (
                                  <div
                                    key={dm.id}
                                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted transition-colors"
                                  >
                                    <Users
                                      className="h-4 w-4 text-muted-foreground shrink-0"
                                      weight="fill"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {wsMember?.username ||
                                          dm.email ||
                                          dm.memberId}
                                      </p>
                                      {wsMember?.email && (
                                        <p className="text-2xs text-muted-foreground truncate">
                                          {wsMember.email}
                                        </p>
                                      )}
                                    </div>
                                    {canManage && (
                                      <button
                                        onClick={() =>
                                          handleRemoveMember(
                                            dept.id,
                                            dm.memberId,
                                          )
                                        }
                                        disabled={removingMember === dm.id}
                                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                                      >
                                        {removingMember === dm.id ? (
                                          <CircleNotch
                                            className="h-3.5 w-3.5 animate-spin"
                                            weight="bold"
                                          />
                                        ) : (
                                          <UserMinus
                                            className="h-3.5 w-3.5"
                                            weight="bold"
                                          />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </ElevatedContainer>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-[--radius] bg-muted border border-border px-3 py-2.5">
          <X
            className="h-4 w-4 text-destructive-ink dark:text-destructive-ink mt-0.5 flex-shrink-0"
            weight="bold"
          />
          <p className="text-xs text-destructive-ink">{error}</p>
        </div>
      )}
    </div>
  );
}
