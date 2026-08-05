"use client";

import type {
  AgentMCPAuthMode,
  AgentMCPBindingStatus,
  AgentMCPRemoteServer,
} from "@/lib/agent-mcp/types";
import {
  ArrowsClockwise,
  CheckCircle,
  Globe,
  Key,
  LinkSimple,
  Plug,
  Plus,
  PuzzlePiece,
  Stack,
  Trash,
  Warning,
  WarningCircle,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  deleteMCPRemoteAction,
  listMCPRemotesAction,
  registerMCPRemoteAction,
  startMCPRemoteOAuthAction,
} from "@/app/actions/agent-mcp";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import CollectionsTab from "@/components/agent-mcp/CollectionsTab";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type TranslateText = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function statusLabel(t: TranslateText, status: AgentMCPBindingStatus): string {
  switch (status) {
    case "connected":
      return t("status.connected");
    case "pending":
      return t("status.pending");
    case "disconnected":
      return t("status.disconnected");
    case "revoked":
      return t("status.revoked");
    case "error":
      return t("status.error");
    default:
      return status;
  }
}

function statusChipClasses(status: AgentMCPBindingStatus): string {
  switch (status) {
    case "connected":
      return "bg-muted border-healthy/30 text-healthy-ink";
    case "pending":
      return "bg-muted border-warning/30 text-warning-ink";
    case "disconnected":
      return "bg-muted border-warning/30 text-warning-ink";
    case "revoked":
      return "bg-muted border-border text-muted-foreground";
    case "error":
      return "bg-muted border-destructive/30 text-destructive-ink";
    default:
      return "bg-muted border-border text-muted-foreground";
  }
}

function StatusChip({ status }: { status: AgentMCPBindingStatus }) {
  const t = useTranslations("mcpPage");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius] border px-2.5 py-0.5 text-xs font-medium",
        statusChipClasses(status),
      )}
    >
      {status === "connected" ? (
        <CheckCircle weight="fill" className="h-3.5 w-3.5" />
      ) : status === "disconnected" ? (
        <WarningCircle weight="fill" className="h-3.5 w-3.5" />
      ) : status === "error" ? (
        <WarningCircle weight="fill" className="h-3.5 w-3.5" />
      ) : null}
      {statusLabel(t, status)}
    </span>
  );
}

function authBadgeLabel(mode: AgentMCPAuthMode, t: TranslateText): string {
  switch (mode) {
    case "none":
      return t("auth.none");
    case "api_key":
      return t("auth.api_key");
    case "oauth2":
      return t("auth.oauth2");
    default:
      return mode;
  }
}

type TabKey = "servers" | "collections";

export default function MCPClient() {
  const t = useTranslations("mcpPage");
  const [remotes, setRemotes] = useState<AgentMCPRemoteServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("servers");
  const [registerOpen, setRegisterOpen] = useState(false);

  const [pollingRemoteFor, setPollingRemoteFor] = useState<string | null>(null);
  const pollRemoteTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshRemotes = useCallback(
    async (preferredId?: string) => {
      const result = await listMCPRemotesAction();
      if (result.error) {
        toast.error(result.error);
        return [] as AgentMCPRemoteServer[];
      }
      setRemotes(result.items);
      setSelectedId((current) => {
        if (preferredId && result.items.some((r) => r.id === preferredId)) {
          return preferredId;
        }
        if (current && result.items.some((r) => r.id === current)) {
          return current;
        }
        return result.items[0]?.id ?? null;
      });
      return result.items;
    },
    [],
  );

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      await refreshRemotes();
    } finally {
      setLoading(false);
    }
  }, [refreshRemotes]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    if (!pollingRemoteFor) return;
    let elapsed = 0;
    pollRemoteTimer.current = setInterval(async () => {
      elapsed += 2;
      const items = await refreshRemotes(pollingRemoteFor);
      const target = items.find((r) => r.id === pollingRemoteFor);
      if (target?.status === "connected") {
        toast.success(t("toasts.oauthConnected", { name: target.name }));
        setPollingRemoteFor(null);
      } else if (target?.status === "error" || target?.status === "disconnected") {
        toast.error(t("toasts.oauthStartFailed"));
        setPollingRemoteFor(null);
      } else if (elapsed >= 180) {
        toast.error(t("toasts.oauthTimeout"));
        setPollingRemoteFor(null);
      }
    }, 2000);
    return () => {
      if (pollRemoteTimer.current) {
        clearInterval(pollRemoteTimer.current);
        pollRemoteTimer.current = null;
      }
    };
  }, [pollingRemoteFor, refreshRemotes, t]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== "mcp-oauth") return;
      if (data.ok) {
        void refreshRemotes();
      } else if (data.error) {
        toast.error(String(data.error));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshRemotes]);

  const launchRemoteOAuth = useCallback(
    (serverId: string, authorizeUrl: string) => {
      const popup = window.open(
        authorizeUrl,
        "mcp-oauth",
        "width=600,height=720",
      );
      if (!popup) {
        toast.error(t("toasts.popupBlocked"));
        return;
      }
      setPollingRemoteFor(serverId);
    },
    [t],
  );

  const handleReconnectRemote = useCallback(
    async (server: AgentMCPRemoteServer) => {
      const result = await startMCPRemoteOAuthAction(server.id);
      if (result.error || !result.authorizeUrl) {
        toast.error(result.error || t("toasts.oauthStartFailed"));
        return;
      }
      launchRemoteOAuth(server.id, result.authorizeUrl);
    },
    [launchRemoteOAuth, t],
  );

  const handleDeleteRemote = useCallback(
    async (server: AgentMCPRemoteServer) => {
      if (!confirm(t("confirm.deleteRemote", { name: server.name }))) {
        return;
      }
      const result = await deleteMCPRemoteAction(server.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toasts.remoteDeleted"));
      await refreshRemotes();
    },
    [refreshRemotes, t],
  );

  const filteredRemotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return remotes;
    return remotes.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.url.toLowerCase().includes(query),
    );
  }, [remotes, search]);

  const selectedRemote = useMemo(
    () =>
      filteredRemotes.find((r) => r.id === selectedId) ||
      remotes.find((r) => r.id === selectedId) ||
      null,
    [filteredRemotes, remotes, selectedId],
  );

  const connectedRemoteCount = useMemo(
    () => remotes.filter((r) => r.status === "connected").length,
    [remotes],
  );

  const oauth2RemoteCount = useMemo(
    () => remotes.filter((r) => r.authMode === "oauth2").length,
    [remotes],
  );

  const stats = useMemo(
    () => [
      {
        label: t("summary.total.label"),
        value: String(remotes.length),
        helper: t("summary.total.description"),
        color: "violet" as const,
        icon: <Globe weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("summary.connected.label"),
        value: String(connectedRemoteCount),
        helper: t("summary.connected.description"),
        color: "emerald" as const,
        icon: <Plug weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("summary.oauth.label"),
        value: String(oauth2RemoteCount),
        helper: t("summary.oauth.description"),
        color: "blue" as const,
        icon: <Key weight="fill" className="h-5 w-5" />,
      },
    ],
    [connectedRemoteCount, oauth2RemoteCount, remotes.length, t],
  );

  const openRegister = () => setRegisterOpen(true);

  return (
    <>
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full space-y-4"
      >
        <DashboardPageHeader
          icon={<PuzzlePiece weight="fill" className="h-6 w-6" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline-subtle"
                onClick={() => void reloadAll()}
                title={t("header.refresh")}
                icon={<ArrowsClockwise weight="bold" className="h-4 w-4" />}
                iconVisible
              />
              <Button
                onClick={openRegister}
                title={t("remote.add")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
              />
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[--radius] border border-border bg-card p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.helper}
                  </p>
                </div>
                <IconBox color={stat.color} size="md" animated={false}>
                  {stat.icon}
                </IconBox>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TabButton
            active={activeTab === "servers"}
            onClick={() => setActiveTab("servers")}
            icon={<Globe weight="fill" className="h-4 w-4" />}
            label={t("tabs.servers")}
          />
          <TabButton
            active={activeTab === "collections"}
            onClick={() => setActiveTab("collections")}
            icon={<Stack weight="fill" className="h-4 w-4" />}
            label={t("tabs.collections")}
          />
        </div>

        {activeTab === "servers" ? (
          loading ? (
            <div
              className="rounded-[--radius] border border-border bg-card px-6 py-16"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border border-border-strong border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  {t("remote.loading")}
                </span>
              </div>
            </div>
          ) : remotes.length === 0 ? (
            <div
              className="rounded-[--radius] border border-border bg-card px-6 py-16 text-center"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <IconBox
                color="violet"
                size="lg"
                className="mx-auto"
                animated={false}
              >
                <Globe weight="fill" />
              </IconBox>
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                {t("remote.emptyTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("remote.emptyDescription")}
              </p>
              <Button
                className="mt-5"
                onClick={openRegister}
                title={t("remote.add")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
              />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section
                className="space-y-4 rounded-[--radius] border border-border bg-card p-5"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <ElevatedInput
                  label={t("filters.search")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("filters.searchPlaceholder")}
                />

                <div className="space-y-3">
                  {filteredRemotes.length === 0 ? (
                    <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
                      <Globe
                        className="mx-auto h-8 w-8 text-muted-foreground"
                        weight="fill"
                      />
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {t("filters.noResultsTitle")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("filters.noResultsDescription")}
                      </p>
                    </div>
                  ) : (
                    filteredRemotes.map((server) => {
                      const isSelected = server.id === selectedRemote?.id;
                      return (
                        <button
                          key={server.id}
                          type="button"
                          onClick={() => setSelectedId(server.id)}
                          className={cn(
                            "w-full rounded-[--radius] border px-4 py-4 text-left transition-all",
                            isSelected
                              ? "border-primary bg-muted"
                              : "border-border bg-background hover:border-primary/30 hover:bg-background",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <IconBox color="violet" size="sm" animated={false}>
                              <Globe weight="fill" />
                            </IconBox>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                                  {server.name}
                                </p>
                                <StatusChip status={server.status} />
                              </div>
                              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                                {server.url}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-[--radius] border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                  {server.transport}
                                </span>
                                {server.authMode ? (
                                  <span className="rounded-[--radius] border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                    {authBadgeLabel(server.authMode, t)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section
                className="space-y-4 rounded-[--radius] border border-border bg-card p-5"
                style={{ boxShadow: softSurfaceShadow }}
              >
                {selectedRemote ? (
                  <RemoteDetail
                    server={selectedRemote}
                    pollingFor={pollingRemoteFor}
                    onReconnect={handleReconnectRemote}
                    onDelete={handleDeleteRemote}
                  />
                ) : (
                  <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[--radius] border border-dashed border-border bg-background px-6 py-12 text-center">
                    <IconBox color="slate" size="lg" animated={false}>
                      <Globe weight="fill" />
                    </IconBox>
                    <h2 className="mt-4 text-lg font-semibold text-foreground">
                      {t("detail.noSelectionTitle")}
                    </h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {t("detail.noSelectionDescription")}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )
        ) : (
          <div
            className="rounded-[--radius] border border-border bg-card p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <CollectionsTab bindings={[]} remotes={remotes} />
          </div>
        )}
      </motion.main>

      <RegisterRemoteDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSaved={async (serverId) => {
          setRegisterOpen(false);
          await refreshRemotes(serverId);
        }}
        onOAuth={launchRemoteOAuth}
      />
    </>
  );
}


function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[--radius] border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RemoteDetail({
  server,
  pollingFor,
  onReconnect,
  onDelete,
}: {
  server: AgentMCPRemoteServer;
  pollingFor: string | null;
  onReconnect: (s: AgentMCPRemoteServer) => void | Promise<void>;
  onDelete: (s: AgentMCPRemoteServer) => void | Promise<void>;
}) {
  const t = useTranslations("mcpPage");
  const isPolling = pollingFor === server.id;
  const canReconnect =
    server.authMode === "oauth2" && server.status !== "connected";

  return (
    <>
      <div className="rounded-[--radius] border border-border bg-background p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <IconBox color="violet" size="lg" animated={false}>
              <Globe weight="fill" />
            </IconBox>
            <div>
              <p className="text-xs font-semibold text-primary-ink">
                {t("detail.badge")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {server.name}
              </h2>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {server.url}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canReconnect ? (
              <Button
                variant="outline"
                onClick={() => void onReconnect(server)}
                disabled={isPolling}
                title={
                  isPolling ? t("remote.connecting") : t("remote.reconnect")
                }
                icon={<ArrowsClockwise weight="bold" className="h-4 w-4" />}
                iconVisible
              />
            ) : null}
            <Button
              variant="outline"
              onClick={() => void onDelete(server)}
              title={t("remote.delete")}
              icon={<Trash weight="bold" className="h-4 w-4" />}
              iconVisible
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[--radius] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("detail.statusLabel")}
          </p>
          <div className="mt-2">
            <StatusChip status={server.status} />
          </div>
        </div>
        <div className="rounded-[--radius] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("detail.transportLabel")}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {server.transport}
          </p>
        </div>
        <div className="rounded-[--radius] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("detail.authLabel")}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {server.authMode
              ? authBadgeLabel(server.authMode, t)
              : t("auth.none")}
          </p>
        </div>
      </div>

      <div className="rounded-[--radius] border border-border bg-background p-4">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("detail.endpointLabel")}
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-[--radius] border border-border bg-card px-4 py-3 font-mono text-xs text-foreground">
          <LinkSimple
            weight="bold"
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          />
          <span className="break-all">{server.url}</span>
        </div>
      </div>

      {server.status === "disconnected" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[--radius] border border-warning/30 bg-muted p-4 text-sm text-warning-ink"
        >
          <Warning
            weight="fill"
            className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink"
          />
          <div>
            <p className="font-semibold">{t("detail.disconnectedTitle")}</p>
            <p className="mt-1 text-warning/80">
              {t("detail.disconnectedDescription")}
            </p>
          </div>
        </div>
      ) : server.status === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[--radius] border border-destructive/30 bg-muted p-4 text-sm text-destructive-ink"
        >
          <Warning
            weight="fill"
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          />
          <div>
            <p className="font-semibold">{t("detail.errorTitle")}</p>
            <p className="mt-1 text-destructive/80">
              {t("detail.errorDescription")}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RegisterRemoteDialog({
  open,
  onClose,
  onSaved,
  onOAuth,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (serverId?: string) => void | Promise<void>;
  onOAuth: (serverId: string, authorizeUrl: string) => void;
}) {
  const t = useTranslations("mcpPage");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authMode, setAuthMode] = useState<AgentMCPAuthMode>("none");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setUrl("");
    setAuthMode("none");
    setApiKey("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("toasts.nameRequired"));
      return;
    }
    if (!url.trim()) {
      toast.error(t("toasts.urlRequired"));
      return;
    }
    if (!/^https:\/\//i.test(url.trim())) {
      toast.error(t("toasts.urlHttps"));
      return;
    }
    if (authMode === "api_key" && !apiKey.trim()) {
      toast.error(t("toasts.remoteApiKeyRequired"));
      return;
    }

    setSubmitting(true);
    const result = await registerMCPRemoteAction({
      name: name.trim(),
      url: url.trim(),
      authMode,
      apiKey: authMode === "api_key" ? apiKey.trim() : undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (authMode === "oauth2") {
      if (result.authorizeUrl && result.server) {
        onOAuth(result.server.id, result.authorizeUrl);
      } else {
        toast.error(t("toasts.oauthStartFailed"));
      }
    } else {
      toast.success(t("toasts.remoteRegistered", { name: name.trim() }));
    }

    resetForm();
    await onSaved(result.server?.id);
  };

  return (
    <ElevatedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <ElevatedDialogContent>
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("dialogs.remote.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("dialogs.remote.description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex flex-col gap-4">
          <ElevatedInput
            label={t("dialogs.remote.name")}
            placeholder={t("dialogs.remote.namePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <ElevatedInput
            label={t("dialogs.remote.url")}
            placeholder={t("dialogs.remote.urlPlaceholder")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            icon={<LinkSimple weight="bold" className="h-4 w-4" />}
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("dialogs.remote.authentication")}
            </label>
            <ElevatedSelect
              value={authMode}
              onValueChange={(value) =>
                setAuthMode(value as AgentMCPAuthMode)
              }
            >
              <ElevatedSelectItem value="none">
                {t("auth.none")}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="api_key">
                {t("auth.api_key")}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="oauth2">
                {t("auth.oauth2")}
              </ElevatedSelectItem>
            </ElevatedSelect>
          </div>

          {authMode === "api_key" ? (
            <ElevatedInput
              label={t("dialogs.apiKey.label")}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              icon={<Key weight="bold" className="h-4 w-4" />}
            />
          ) : null}

          {authMode === "oauth2" ? (
            <p className="rounded-[--radius] border border-info/30 bg-muted px-4 py-3 text-xs text-muted-foreground">
              {t("dialogs.remote.oauth2Hint")}
            </p>
          ) : null}
        </div>

        <ElevatedDialogFooter>
          <Button
            title={t("dialogs.remote.cancel")}
            variant="outline-subtle"
            onClick={handleClose}
            disabled={submitting}
          />
          <Button
            title={
              submitting
                ? t("dialogs.remote.connecting")
                : t("dialogs.remote.register")
            }
            variant="primary"
            disabled={submitting}
            onClick={() => void handleSave()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
