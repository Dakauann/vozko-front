"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Crown,
  EnvelopeSimple,
  Eye,
  FunnelSimple,
  MagnifyingGlass,
  ShieldCheck,
  User,
  UserCircle,
  UsersFour,
  XCircle,
} from "@/components/icons";
import type { UserRole, User as UserType } from "@/lib/users/types";
import { listUsersAction, updateUserRoleAction } from "@/app/actions/users";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const roleConfig: Record<
  UserRole,
  { icon: typeof ShieldCheck; color: string; bgColor: string }
> = {
  admin: {
    icon: Crown,
    color: "text-warning-ink",
    bgColor: "bg-muted",
  },
  user: {
    icon: User,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function UsersPage() {
  const t = useTranslations("users");
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsersAction({
        page: currentPage,
        pageSize,
        search: searchQuery || undefined,
        role: roleFilter || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.users);
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);
      }
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, roleFilter, t]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    setShowRoleDropdown(null);
    try {
      const result = await updateUserRoleAction(userId, { role: newRole });
      if (result.error) {
        toast({
          title: t("toast.updateRoleError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.updateRoleSuccess"),
          description: t("toast.updateRoleSuccessDescription"),
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        );
      }
    } catch {
      toast({
        title: t("toast.updateRoleError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (role: UserRole | "") => {
    setRoleFilter(role);
    setCurrentPage(1);
  };

  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = users.filter((u) => u.role === "user").length;
  const verifiedCount = users.filter((u) => u.emailVerified).length;

  const tableColumns = useMemo<DashboardTableColumn<UserType>[]>(
    () => [
      {
        header: t("table.user"),
        key: "user",
        render: (user) => (
          <div className="flex items-center gap-3">
            {user.picture ? (
              <Image
                src={user.picture}
                alt={user.username}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full tile-brand">
                <UserCircle className="h-6 w-6 text-primary-ink" weight="fill" />
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {user.customerType === "company"
                  ? t("customerType.company")
                  : t("customerType.individual")}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: t("table.email"),
        key: "email",
        render: (user) => (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <EnvelopeSimple className="h-4 w-4" weight="bold" />
            {user.email}
          </div>
        ),
      },
      {
        header: t("table.role"),
        key: "role",
        render: (user) => {
          const RoleIcon = roleConfig[user.role]?.icon ?? User;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                roleConfig[user.role]?.bgColor ?? "bg-muted",
                roleConfig[user.role]?.color ?? "text-muted-foreground",
              )}
            >
              <RoleIcon className="h-3.5 w-3.5" weight="fill" />
              {t(`role.${user.role}`)}
            </span>
          );
        },
      },
      {
        header: t("table.status"),
        key: "status",
        render: (user) =>
          user.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-healthy px-3 py-1.5 text-[11px] font-semibold text-healthy-foreground">
              <CheckCircle className="h-3.5 w-3.5" weight="fill" />
              {t("status.verified")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" weight="fill" />
              {t("status.unverified")}
            </span>
          ),
      },
      {
        header: t("table.createdAt"),
        key: "createdAt",
        render: (user) => (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" weight="fill" />
            {formatDate(user.createdAt)}
          </div>
        ),
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (user) => (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/users/${user.id}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-foreground/20"
            >
              <Eye className="h-4 w-4" weight="bold" />
              {t("button.details")}
            </button>
            <div className="relative inline-block">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRoleDropdown(
                    showRoleDropdown === user.id ? null : user.id,
                  );
                }}
                disabled={updatingUserId === user.id}
                className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-foreground/20 disabled:opacity-50"
              >
                {updatingUserId === user.id ? (
                  <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                ) : (
                  <ShieldCheck className="h-4 w-4" weight="bold" />
                )}
                {t("button.changeRole")}
                <CaretDown
                  className="h-3 w-3 text-muted-foreground"
                  weight="bold"
                />
              </button>
              <AnimatePresence>
                {showRoleDropdown === user.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-2 w-44 rounded-[--radius] border border-border bg-card py-2 shadow-xl"
                  >
                    <button
                      onClick={() => handleRoleChange(user.id, "admin")}
                      disabled={user.role === "admin"}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50",
                        user.role === "admin" && "bg-muted font-medium",
                      )}
                    >
                      <Crown className="h-4 w-4 text-warning-ink" weight="fill" />
                      {t("role.admin")}
                    </button>
                    <button
                      onClick={() => handleRoleChange(user.id, "user")}
                      disabled={user.role === "user"}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50",
                        user.role === "user" && "bg-muted font-medium",
                      )}
                    >
                      <User
                        className="h-4 w-4 text-muted-foreground"
                        weight="fill"
                      />
                      {t("role.user")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ),
      },
    ],
    [t, showRoleDropdown, updatingUserId],
  );

  return (
    <motion.main
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<UsersFour className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.title")}
        />
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DashboardTable<UserType>
          onRowClick={(row) => router.push(`/dashboard/users/${row.id}`)}
          stats={[
            {
              label: t("stats.total"),
              value: loading ? "..." : totalItems.toLocaleString(),
              icon: (
                <UsersFour className="h-4 w-4 text-info-ink" weight="fill" />
              ),
            },
            {
              label: t("stats.admins"),
              value: loading ? "..." : adminCount.toLocaleString(),
              icon: <Crown className="h-4 w-4 text-warning-ink" weight="fill" />,
            },
            {
              label: t("stats.users"),
              value: loading ? "..." : userCount.toLocaleString(),
              icon: (
                <User className="h-4 w-4 text-muted-foreground" weight="fill" />
              ),
            },
            {
              label: t("stats.verified"),
              value: loading ? "..." : verifiedCount.toLocaleString(),
              icon: (
                <CheckCircle
                  className="h-4 w-4 text-healthy-ink"
                  weight="fill"
                />
              ),
            },
          ]}
          headerLeft={
            <ElevatedInput
              type="text"
              label={t("search.placeholder")}
              value={searchQuery}
              onChange={handleSearchChange}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full max-w-xs"
            />
          }
          toolbar={
            <div className="flex items-center gap-3">
              <FunnelSimple
                className="h-5 w-5 text-muted-foreground"
                weight="bold"
              />
              <span className="text-sm font-medium text-foreground">
                {t("search.filterByRole")}
              </span>
              <div className="flex items-center gap-1.5">
                {(["", "admin", "user"] as const).map((role) => (
                  <button
                    key={role || "all"}
                    onClick={() => handleRoleFilterChange(role)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      roleFilter === role
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {role ? t(`role.${role}`) : t("search.allRoles")}
                  </button>
                ))}
              </div>
            </div>
          }
          data={users}
          columns={tableColumns}
          rowKey={(row) => row.id}
          loading={loading}
          pagination={
            totalPages > 1
              ? {
                  currentPage,
                  totalPages,
                  pageSize,
                  totalItems,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          paginationText={{
            showing: t("pagination.showing"),
            of: t("pagination.of"),
            items: t("stats.total").toLowerCase(),
          }}
          emptyState={
            error
              ? {
                  icon: (
                    <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                  action: (
                    <Button
                      variant="secondary"
                      title={t("button.retry")}
                      onClick={fetchUsers}
                    />
                  ),
                }
              : {
                  icon: (
                    <UsersFour
                      className="h-7 w-7 text-muted-foreground"
                      weight="fill"
                    />
                  ),
                  title: t("empty.title"),
                  description: t("empty.description"),
                }
          }
        />
      </motion.div>

      {/* Click outside to close dropdowns */}
      {showRoleDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowRoleDropdown(null);
          }}
        />
      )}
    </motion.main>
  );
}
