"use client";

import * as React from "react";

import {
  ArrowLeft,
  Buildings,
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  Clock,
  Crown,
  EnvelopeSimple,
  IdentificationBadge,
  IdentificationCard,
  User,
  UserCircle,
  Wallet,
  XCircle,
} from "@/components/icons";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Image from "next/image";
import Link from "next/link";
import type { User as UserType } from "@/lib/users/types";
import { cn } from "@/lib/utils";
import { getUserByIdAction } from "@/app/actions/users";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";


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

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJ(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}


function InfoCard({
  icon,
  iconBg,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-[--radius] border border-border bg-card p-4 transition-colors hover:border-border"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius]",
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-sm font-medium text-foreground break-all",
            mono && "font-mono tracking-wide",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}


export default function AdminUserDetailPage() {
  const t = useTranslations("userDetail");
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = React.useState<UserType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUserByIdAction(userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUser(result.user);
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  if (error || !user) {
    return (
      <motion.main
        className="w-full space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard/users">
            <Button
              variant="outline"
              icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
              iconVisible
              title={t("actions.back")}
            />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <XCircle className="h-12 w-12 text-destructive-ink" weight="fill" />
          <p className="text-sm text-muted-foreground">
            {error ?? t("error.notFound")}
          </p>
          <Button
            variant="secondary"
            title={t("actions.retry")}
            onClick={loadData}
          />
        </div>
      </motion.main>
    );
  }

  const roleConfig = {
    admin: {
      icon: Crown,
      label: t("role.admin"),
      bg: "tile-3",
      text: "",
    },
    user: {
      icon: User,
      label: t("role.user"),
      bg: "tile-2",
      text: "",
    },
  };
  const role = roleConfig[user.role] ?? roleConfig.user;
  const RoleIcon = role.icon;

  const document = user.customerType === "company" ? user.cnpj : user.cpf;
  const documentLabel = user.customerType === "company" ? "CNPJ" : "CPF";
  const formattedDocument = document
    ? user.customerType === "company"
      ? formatCNPJ(document)
      : formatCPF(document)
    : null;

  return (
    <motion.main
      className="w-full space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/users">
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
            iconVisible
            title={t("actions.back")}
          />
        </Link>
      </div>

      <DashboardPageHeader
        icon={<UserCircle className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          <Link href={`/dashboard/users/${userId}/balance`}>
            <Button
              variant="secondary"
              icon={<Wallet className="h-4 w-4" weight="bold" />}
              iconVisible
              title={t("actions.manageBalance")}
            />
          </Link>
        }
      />

      {/* Profile Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div
          className="rounded-[--radius] border border-border bg-card p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative">
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.username}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-[--radius] object-cover ring-2 ring-border/50"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[--radius] bg-muted">
                  <UserCircle
                    className="h-12 w-12 text-primary-ink"
                    weight="fill"
                  />
                </div>
              )}
              {/* Verified indicator */}
              <div
                className={cn(
                  "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-card",
                  user.emailVerified
                    ? "bg-healthy"
                    : "bg-muted-foreground",
                )}
              >
                {user.emailVerified ? (
                  <CheckCircle className="h-4 w-4 text-white" weight="fill" />
                ) : (
                  <XCircle className="h-4 w-4 text-white" weight="fill" />
                )}
              </div>
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-semibold text-foreground">
                {user.username}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {/* Role badge */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-2xs font-semibold",
                    role.bg,
                    role.text,
                  )}
                >
                  <RoleIcon className="h-3.5 w-3.5" weight="fill" />
                  {role.label}
                </span>

                {/* Customer type badge */}
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground">
                  <Buildings className="h-3.5 w-3.5" weight="fill" />
                  {user.customerType === "company"
                    ? t("customerType.company")
                    : t("customerType.individual")}
                </span>

                {/* Email verified badge */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-2xs font-semibold",
                    user.emailVerified
                      ? "bg-healthy text-healthy-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {user.emailVerified ? (
                    <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" weight="fill" />
                  )}
                  {user.emailVerified
                    ? t("status.verified")
                    : t("status.unverified")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detail Cards Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Email */}
          <InfoCard
            icon={<EnvelopeSimple className="h-5 w-5" weight="bold" />}
            iconBg="tile-neutral"
            label={t("fields.email")}
            value={user.email}
          />

          {/* Username */}
          <InfoCard
            icon={<User className="h-5 w-5" weight="bold" />}
            iconBg="tile-neutral"
            label={t("fields.username")}
            value={user.username}
          />

          {/* Customer Type */}
          <InfoCard
            icon={<Buildings className="h-5 w-5" weight="bold" />}
            iconBg="tile-neutral"
            label={t("fields.customerType")}
            value={
              user.customerType === "company"
                ? t("customerType.company")
                : t("customerType.individual")
            }
          />

          {/* Document (CPF/CNPJ) */}
          {formattedDocument ? (
            <InfoCard
              icon={<IdentificationCard className="h-5 w-5" weight="bold" />}
              iconBg="tile-healthy"
              label={documentLabel}
              value={formattedDocument}
              mono
            />
          ) : (
            <InfoCard
              icon={<IdentificationCard className="h-5 w-5" weight="bold" />}
              iconBg="tile-neutral"
              label={documentLabel}
              value={
                <span className="text-muted-foreground italic">
                  {t("fields.notProvided")}
                </span>
              }
            />
          )}

          {/* User ID */}
          <InfoCard
            icon={<IdentificationBadge className="h-5 w-5" weight="bold" />}
            iconBg="tile-neutral"
            label={t("fields.userId")}
            value={user.id}
            mono
          />

          {/* Role */}
          <InfoCard
            icon={<Crown className="h-5 w-5" weight="bold" />}
            iconBg="tile-warning"
            label={t("fields.role")}
            value={
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                  role.bg,
                  role.text,
                )}
              >
                <RoleIcon className="h-3.5 w-3.5" weight="fill" />
                {role.label}
              </span>
            }
          />

          {/* Email Verified */}
          <InfoCard
            icon={
              user.emailVerified ? (
                <CheckCircle className="h-5 w-5" weight="bold" />
              ) : (
                <XCircle className="h-5 w-5" weight="bold" />
              )
            }
            iconBg={user.emailVerified ? "bg-healthy" : "bg-muted"}
            label={t("fields.emailVerified")}
            value={
              user.emailVerified ? t("status.verified") : t("status.unverified")
            }
          />

          {/* Created At */}
          <InfoCard
            icon={<CalendarCheck className="h-5 w-5" weight="bold" />}
            iconBg="tile-brand"
            label={t("fields.createdAt")}
            value={formatDateTime(user.createdAt)}
          />

          {/* Updated At */}
          <InfoCard
            icon={<Clock className="h-5 w-5" weight="bold" />}
            iconBg="tile-warning"
            label={t("fields.updatedAt")}
            value={formatDateTime(user.updatedAt)}
          />
        </div>
      </motion.div>
    </motion.main>
  );
}
