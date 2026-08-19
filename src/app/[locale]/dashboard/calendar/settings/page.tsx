"use client";

import { CheckCircle, Gear, GoogleLogo, XCircle } from "@/components/icons";
import {
  connectGoogleCalendar,
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

export default function CalendarSettingsPage() {
  const t = useTranslations("calendarSettingsPage");
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
    const code = searchParams.get("code");
    if (!code || !currentWorkspace) return;

    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    void (async () => {
      setConnecting(true);
      const res = await connectGoogleCalendar(code, redirectUri);
      if (res.error) {
        toast.error(t("connectionError"));
      } else {
        toast.success(t("connectionSuccess"));
        setConnected(true);
        setConnection(res.connection);
      }
      setConnecting(false);
      window.history.replaceState({}, "", window.location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentWorkspace]);

  const handleConnect = async () => {
    setConnecting(true);
    const res = await fetchGoogleAuthURL();
    if (res.authUrl) {
      window.location.href = res.authUrl;
    } else {
      toast.error(t("connectionError"));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t("disconnectConfirm"))) return;
    setDisconnecting(true);
    const res = await disconnectGoogleCalendar();
    if (res.error) {
      toast.error(t("disconnectionError"));
    } else {
      toast.success(t("disconnectionSuccess"));
      setConnected(false);
      setConnection(null);
    }
    setDisconnecting(false);
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<Gear size={20} weight="duotone" />}
        badge={t("badge")}
        description={t("description")}
      />

      <ElevatedContainer>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-[--radius] bg-muted">
              <GoogleLogo size={24} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Google Calendar</h3>
                {!loading && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-2xs font-medium ${
                      connected
                        ? "bg-healthy text-healthy-foreground"
                        : "bg-zinc-500 text-white"
                    }`}
                  >
                    {connected ? (
                      <>
                        <CheckCircle size={10} weight="fill" />
                        {t("connected")}
                      </>
                    ) : (
                      <>
                        <XCircle size={10} weight="fill" />
                        {t("notConnected")}
                      </>
                    )}
                  </span>
                )}
              </div>
              {connected && connection?.email && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("connectedAs")}{" "}
                  <span className="font-medium">{connection.email}</span>
                </p>
              )}
            </div>
            <div>
              {connected ? (
                <ElevatedButton
                  variant="secondary"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive-ink hover:text-destructive-ink"
                >
                  {disconnecting ? t("disconnecting") : t("disconnectGoogle")}
                </ElevatedButton>
              ) : (
                <ElevatedButton
                  onClick={handleConnect}
                  disabled={connecting || loading}
                >
                  {connecting ? t("connecting") : t("connectGoogle")}
                </ElevatedButton>
              )}
            </div>
          </div>
        </div>
      </ElevatedContainer>
    </div>
  );
}
