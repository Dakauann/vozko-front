"use client";

import {
  CheckCircle,
  CircleNotch,
  GoogleLogo,
  Plugs,
  XCircle,
} from "@/components/icons";
import {
  disconnectGoogleCalendar,
  fetchGoogleAuthURL,
  fetchGoogleConnection,
} from "@/lib/calendar/client";
import { useCallback, useEffect, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { GoogleCalendarConnection } from "@/lib/calendar/types";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function IntegrationsPage() {
  const t = useTranslations("integrationsPage");
  const { currentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();

  const [connection, setConnection] = useState<GoogleCalendarConnection | null>(
    null,
  );
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadConnection = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const res = await fetchGoogleConnection();
    setConnected(res.connected);
    setConnection(res.connection);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    void loadConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  useEffect(() => {
    const connectedParam = searchParams.get("connected");
    const errorParam = searchParams.get("error");

    if (connectedParam === "true") {
      toast.success(t("google.connectionSuccess"));
      void loadConnection();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (errorParam) {
      toast.error(t("google.connectionError"));
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = async () => {
    setConnecting(true);
    const res = await fetchGoogleAuthURL();
    if (res.authUrl) {
      window.location.href = res.authUrl;
    } else {
      toast.error(t("google.connectionError"));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t("google.disconnectConfirm"))) return;
    setDisconnecting(true);
    const res = await disconnectGoogleCalendar();
    if (res.error) {
      toast.error(t("google.disconnectionError"));
    } else {
      toast.success(t("google.disconnectionSuccess"));
      setConnected(false);
      setConnection(null);
    }
    setDisconnecting(false);
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<Plugs size={20} weight="duotone" />}
        badge={t("badge")}
        description={t("description")}
      />

      {/* Google Calendar Integration */}
      <ElevatedContainer>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-[--radius] bg-muted">
              <GoogleLogo size={24} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t("google.title")}</h3>
                {!loading && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-2xs font-medium ${
                      connected
                        ? "bg-healthy text-healthy-foreground"
                        : "bg-[hsl(var(--plate-neutral))] text-white"
                    }`}
                  >
                    {connected ? (
                      <>
                        <CheckCircle size={10} weight="fill" />
                        {t("google.connected")}
                      </>
                    ) : (
                      <>
                        <XCircle size={10} weight="fill" />
                        {t("google.notConnected")}
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {connected && connection?.email ? (
                  <>
                    {t("google.connectedAs")}{" "}
                    <span className="font-medium">{connection.email}</span>
                  </>
                ) : (
                  t("google.subtitle")
                )}
              </p>
            </div>
            <div>
              {loading ? (
                <CircleNotch
                  size={20}
                  className="animate-spin text-muted-foreground"
                />
              ) : connected ? (
                <ElevatedButton
                  variant="secondary"
                  size="sm"
                  title={
                    disconnecting
                      ? t("google.disconnecting")
                      : t("google.disconnect")
                  }
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive-ink hover:text-destructive-ink"
                />
              ) : (
                <ElevatedButton
                  title={
                    connecting ? t("google.connecting") : t("google.connect")
                  }
                  icon={<GoogleLogo size={16} weight="bold" />}
                  iconVisible
                  onClick={handleConnect}
                  disabled={connecting || loading}
                />
              )}
            </div>
          </div>
        </div>
      </ElevatedContainer>
    </div>
  );
}
