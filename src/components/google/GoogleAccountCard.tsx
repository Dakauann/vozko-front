"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CircleNotch, GoogleLogo } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useGoogleConnect } from "@/hooks/use-google-connect";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { disconnectGoogle, fetchGoogleStatus } from "@/lib/google/client";
import { googleResultFromQuery } from "@/lib/google/connect";
import type { GoogleAccountStatus, GoogleConnectResult, GoogleProduct, GoogleProductStatus } from "@/lib/google/types";

const STATUS_TONE: Record<GoogleAccountStatus, StatusChipTone> = {
  connected: "healthy",
  needs_reconnect: "warning",
  disconnected: "muted",
};

const PRODUCT_LOGO: Record<GoogleProduct, string> = {
  calendar: "/images/brands/google/calendar.png",
  sheets: "/images/brands/google/sheets.png",
};

interface GoogleAccountCardProps {
  product: GoogleProduct;
  canConnect: boolean;
  canDisconnect: boolean;
  returnPath?: string;
  onChange?: (status: GoogleProductStatus | null) => void;
}

export function GoogleAccountCard({ product, canConnect, canDisconnect, returnPath, onChange }: GoogleAccountCardProps) {
  const t = useTranslations("googleAccount");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GoogleProductStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(() => {
    void fetchGoogleStatus(product).then((res) => {
      setStatus(res.status);
      setLoading(false);
      onChange?.(res.status);
    });
  }, [product, onChange]);

  useEffect(() => {
    load();
  }, [load]);

  const announce = useCallback(
    (result: GoogleConnectResult) => {
      if (result.status === "cancelled") return;
      if (result.status === "connected") {
        toast.success(t(`products.${product}.connected`), { description: result.email });
        load();
        return;
      }
      toast.error(t(`products.${product}.connectFailed`), { description: codedErrorMessage(t, { code: result.reason }, t("errors.google_account_connect_failed")) });
    },
    [load, product, t],
  );

  useEffect(() => {
    const result = googleResultFromQuery(searchParams);
    if (!result || result.status === "cancelled" || result.product !== product) return;
    announce(result);
    window.history.replaceState({}, "", window.location.pathname);
  }, [announce, product, searchParams]);

  const { connect, isConnecting } = useGoogleConnect(product, announce);

  const disconnect = async () => {
    setDisconnecting(true);
    const res = await disconnectGoogle(product);
    setDisconnecting(false);
    setConfirming(false);
    if (res.error) {
      toast.error(t(`products.${product}.disconnectFailed`), { description: codedErrorMessage(t, res.error, res.error.message ?? "") });
      return;
    }
    toast(t(`products.${product}.disconnected`));
    load();
  };

  const state: GoogleAccountStatus = status?.status ?? "disconnected";
  const connected = status?.connected ?? false;

  return (
    <ElevatedContainer>
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card shadow-quiet">
          <Image src={PRODUCT_LOGO[product]} width={24} height={24} alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t(`products.${product}.title`)}</h3>
            {loading ? null : <StatusChip tone={STATUS_TONE[state]} label={t(`status.${state}`)} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status?.email ? t("connectedAs", { email: status.email }) : t(`products.${product}.subtitle`)}
          </p>
          {state === "needs_reconnect" ? <p className="mt-1 text-xs text-warning-ink">{t("needsReconnect")}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <CircleNotch size={20} className="animate-spin text-muted-foreground" />
          ) : (
            <>
              {canConnect && !connected ? (
                <ElevatedButton
                  title={isConnecting ? t("connecting") : state === "needs_reconnect" ? t("reconnect") : t("connect")}
                  icon={<GoogleLogo size={16} />}
                  iconVisible
                  onClick={() => connect(returnPath)}
                  disabled={isConnecting}
                />
              ) : null}
              {canDisconnect && status?.email ? (
                <ElevatedButton variant="secondary" size="sm" title={t("disconnect")} onClick={() => setConfirming(true)} disabled={disconnecting} />
              ) : null}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`products.${product}.disconnectTitle`)}
        description={t(`products.${product}.disconnectBody`)}
        confirmLabel={t("disconnect")}
        cancelLabel={t("cancel")}
        tone="danger"
        onConfirm={disconnect}
      />
    </ElevatedContainer>
  );
}
