"use client";

import { useTranslations } from "next-intl";

import { listRcsSendersAction } from "@/app/actions/rcs";
import { listSmsRoutesAction } from "@/app/actions/sms";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { RcsComposer } from "@/components/rcs/composer/RcsComposer";
import type { RcsPreviewAgent } from "@/components/rcs/preview/palette";
import { SmsComposer } from "@/components/sms/SmsComposer";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { useLoaded } from "@/lib/carrier-messaging/use-loaded";
import type { VariableBinding } from "@/lib/leads/sends";
import type { RcsSender } from "@/lib/rcs/types";
import type { SmsRoute } from "@/lib/sms/types";
import { CARRIER_CHANNELS, readCarrierConfig, type CarrierChannel } from "@/lib/workflows/carrier-node";

import { Notice } from "@/components/ui/notice";
import type { ConfigFieldOption } from "@/lib/workflows/types";

import { IllegibleOptions } from "./illegible-options";

const NO_BINDINGS: VariableBinding[] = [];

function keepNoBindings() {}

function loadSenders(signal: AbortSignal): Promise<ParsedAnswer<RcsSender[]>> {
  return listRcsSendersAction(signal).then((answer) => (answer.error ? answer : { data: answer.data.senders, error: null }));
}

function loadNoSenders(): Promise<ParsedAnswer<RcsSender[]>> {
  return Promise.resolve({ data: [], error: null });
}

function loadNoRoutes(): Promise<ParsedAnswer<SmsRoute[]>> {
  return Promise.resolve({ data: [], error: null });
}

function loadRoutes(signal: AbortSignal): Promise<ParsedAnswer<SmsRoute[]>> {
  return listSmsRoutesAction(signal).then((answer) => (answer.error ? answer : { data: answer.data.routes, error: null }));
}

function previewAgentOf(sender: RcsSender | undefined): RcsPreviewAgent {
  return {
    name: sender?.brand_name ?? "",
    logoUrl: sender?.logo_url || undefined,
    bannerUrl: sender?.banner_url || undefined,
    color: sender?.color || undefined,
    description: sender?.description || undefined,
    verified: sender?.status === "launched",
  };
}

function routeLabel(route: SmsRoute): string {
  return route.kind === "dedicated" ? `${route.brand_prefix} (${route.number})` : route.brand_prefix;
}

function withSaved(options: { value: string; label: string }[], saved: string, savedLabel: string) {
  return saved && !options.some((option) => option.value === saved) ? [{ value: saved, label: savedLabel || saved }, ...options] : options;
}

export function SendCarrierConfigSection({
  config,
  defaults,
  channelOptions,
  onChange,
}: {
  config: Record<string, unknown>;
  defaults: Record<string, unknown>;
  channelOptions: readonly ConfigFieldOption[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const t = useTranslations("workflowsPage.carrierNode");
  const tSoon = useTranslations("carrierMessaging.comingSoon");
  const offered = channelOptions.map((option) => option.value).filter((value): value is CarrierChannel => (CARRIER_CHANNELS as readonly string[]).includes(value));
  const rcsOffered = offered.includes("rcs");
  const senders = useLoaded(rcsOffered ? loadSenders : loadNoSenders, String(rcsOffered));
  const smsOffered = offered.includes("sms");
  const routes = useLoaded(smsOffered ? loadRoutes : loadNoRoutes, String(smsOffered));
  const read = readCarrierConfig({ ...defaults, ...config });
  if (!read.readable) {
    return <IllegibleOptions onReset={() => onChange(defaults)} />;
  }
  const node = read.config;
  const senderList = senders.status === "ready" ? senders.data : [];
  const routeList = routes.status === "ready" ? routes.data : [];
  const sender = senderList.find((candidate) => candidate.id === node.senderId);
  const route = routeList.find((candidate) => candidate.id === node.routeId);
  const savedLabel = (key: string) => (typeof config[`_display_${key}`] === "string" ? (config[`_display_${key}`] as string) : "");

  return (
    <div className="space-y-4 rounded-[--radius] border border-border bg-mist p-3" data-testid="send-carrier-config">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">{t("channel")}</p>
        <ElevatedPillToggle<CarrierChannel>
          aria-label={t("channel")}
          value={node.channel}
          onChange={(channel) => onChange({ channel })}
          options={offered.map((channel) => ({ value: channel, label: t(`channels.${channel}`) }))}
        />
      </div>

      {!offered.includes(node.channel) ? (
        <Notice tone="warning" title={tSoon("nodeTitle", { channel: t(`channels.${node.channel}`) })}>
          <p>{tSoon("nodeBody")}</p>
        </Notice>
      ) : node.channel === "rcs" ? (
        <>
          <div className="space-y-1">
            <ElevatedCommandSelect
              label={t("sender")}
              value={node.senderId}
              options={withSaved(
                senderList.map((item) => ({ value: item.id, label: item.brand_name })),
                node.senderId,
                savedLabel("sender_id"),
              )}
              onValueChange={(senderId) => onChange({ sender_id: senderId, _display_sender_id: senderList.find((item) => item.id === senderId)?.brand_name ?? "" })}
              searchPlaceholder={t("search")}
              emptyMessage={senders.status === "failed" ? t("loadFailed") : t("noSenders")}
              isLoading={senders.status === "loading"}
            />
            {!node.senderId ? <p className="text-2xs text-destructive-ink">{t("senderRequired")}</p> : null}
            {sender && !sender.can_send ? <p className="text-2xs text-muted-foreground">{t("senderNotLaunched")}</p> : null}
          </div>
          <RcsComposer
            value={node.content}
            onChange={(content) => onChange({ content })}
            bindings={NO_BINDINGS}
            onBindingsChange={keepNoBindings}
            agent={previewAgentOf(sender)}
            className="lg:grid-cols-1"
          />
        </>
      ) : (
        <>
          <div className="space-y-1">
            <ElevatedCommandSelect
              label={t("route")}
              value={node.routeId}
              options={withSaved(
                routeList.map((item) => ({ value: item.id, label: routeLabel(item) })),
                node.routeId,
                savedLabel("route_id"),
              )}
              onValueChange={(routeId) => {
                const picked = routeList.find((item) => item.id === routeId);
                onChange({ route_id: routeId, _display_route_id: picked ? routeLabel(picked) : "" });
              }}
              searchPlaceholder={t("search")}
              emptyMessage={routes.status === "failed" ? t("loadFailed") : t("noRoutes")}
              isLoading={routes.status === "loading"}
            />
            {!node.routeId ? <p className="text-2xs text-destructive-ink">{t("routeRequired")}</p> : null}
          </div>
          <SmsComposer
            compact
            value={node.text}
            onChange={(text) => onChange({ text })}
            bindings={NO_BINDINGS}
            onBindingsChange={keepNoBindings}
            brandPrefix={route?.brand_prefix}
            routeId={route?.id}
            sender={route?.kind === "dedicated" ? route.number : undefined}
          />
        </>
      )}

      <p className="text-2xs text-muted-foreground">{t("variablesHint")}</p>

      <ElevatedSwitch
        checked={node.marketing}
        onCheckedChange={(marketing) => onChange({ marketing })}
        label={t("marketing")}
        description={t("marketingDescription")}
        explainer={<ExplainerHint id="workflows.carrierMarketing" />}
      />
    </div>
  );
}
