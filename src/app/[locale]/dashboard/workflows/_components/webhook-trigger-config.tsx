"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  WebhooksLogo,
  Copy,
  Check,
  Eye,
  EyeSlash,
  ArrowsClockwise,
  Trash,
  LinkSimple,
  CircleNotch,
  Code,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage, type CodedFailure } from "@/lib/api/coded-error";
import { cn } from "@/lib/utils";
import {
  webhookExamples,
  type WebhookExampleKey,
  type WebhookStartOn,
} from "@/lib/workflows/webhook-trigger";
import {
  getWorkflowWebhookAction,
  createWorkflowWebhookAction,
  updateWorkflowWebhookAction,
  rotateWorkflowWebhookAction,
  deleteWorkflowWebhookAction,
  type WorkflowWebhookConfig,
} from "@/app/actions/workflows";
import { WebhookDeliveries } from "./webhook-deliveries";

type AuthMode = "none" | "header_token" | "hmac";
type CopyTarget = "url" | "secret" | "curl" | "body";
type Translate = ReturnType<typeof useTranslations>;

interface Draft {
  auth_mode: AuthMode;
  header_name: string;
  method: string;
  active: boolean;
}

const DEFAULT_TOKEN_HEADER = "X-Webhook-Token";
const DEFAULT_SIGNATURE_HEADER = "X-Signature-256";

const RECEIVER_METHOD = "POST";

const ENTRY_TYPES = ["whatsapp", "unofficial_whatsapp", "instagram", "facebook", "telegram", "webchat", "email"];

const richCode = { code: (chunks: ReactNode) => <Mono>{chunks}</Mono>, strong: (chunks: ReactNode) => <span className="font-medium text-foreground">{chunks}</span> };

function toDraft(w: WorkflowWebhookConfig): Draft {
  return {
    auth_mode: w.auth_mode,
    header_name: w.header_name ?? "",
    method: w.method || "POST",
    active: w.active,
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.auth_mode === b.auth_mode &&
    a.header_name === b.header_name &&
    a.method === b.method &&
    a.active === b.active
  );
}

function resolveHeaderName(mode: AuthMode, provided: string): string {
  if (provided.trim()) return provided.trim();
  if (mode === "hmac") return DEFAULT_SIGNATURE_HEADER;
  if (mode === "header_token") return DEFAULT_TOKEN_HEADER;
  return "";
}

function buildCurl(opts: {
  url: string;
  method: string;
  authMode: AuthMode;
  headerName: string;
  secret: string;
  body: string;
}): string {
  const { url, method, authMode, headerName, secret, body } = opts;
  const header = resolveHeaderName(authMode, headerName);

  if (authMode === "hmac") {
    return [
      `BODY='${body}'`,
      `SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac '${secret}' -r | cut -d' ' -f1)`,
      "",
      `curl -X ${method} '${url}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H '${header}: sha256='"$SIG" \\`,
      `  --data-raw "$BODY"`,
    ].join("\n");
  }

  const lines = [
    `curl -X ${method} '${url}' \\`,
    `  -H 'Content-Type: application/json' \\`,
  ];
  if (authMode === "header_token") {
    lines.push(`  -H '${header}: ${secret}' \\`);
  }
  lines.push(`  -d '${body}'`);
  return lines.join("\n");
}

export function WebhookTriggerConfig({
  workflowId,
  focusDeliveries = false,
  startOn = "conversation",
  events = [],
}: {
  workflowId?: string | null;
  focusDeliveries?: boolean;
  startOn?: WebhookStartOn;
  events?: readonly string[];
}) {
  const tPage = useTranslations("workflowsPage");
  const t = useTranslations("workflowsPage.webhookTrigger");
  const [webhook, setWebhook] = useState<WorkflowWebhookConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState(false);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const apply = useCallback((w: WorkflowWebhookConfig | null) => {
    setWebhook(w);
    setDraft(w ? toDraft(w) : null);
  }, []);

  useEffect(() => {
    if (!workflowId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await getWorkflowWebhookAction(workflowId);
      if (cancelled) return;
      if (res.error) setError(codedErrorMessage(tPage, res, res.error));
      apply(res.webhook ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workflowId, apply, tPage]);

  const copy = useCallback((value: string, which: CopyTarget) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const runAction = useCallback(
    async (
      fn: () => Promise<{ webhook?: WorkflowWebhookConfig | null } & Partial<CodedFailure>>,
    ) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      if (res.error) setError(codedErrorMessage(tPage, res, res.error));
      else apply(res.webhook ?? null);
      setBusy(false);
    },
    [apply, tPage],
  );

  if (!workflowId) {
    return (
      <ConfigShell startOn={startOn}>
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t("saveFirst")}
        </p>
      </ConfigShell>
    );
  }

  if (loading) {
    return (
      <ConfigShell startOn={startOn}>
        <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      </ConfigShell>
    );
  }

  if (!webhook || !draft) {
    return (
      <ConfigShell startOn={startOn}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("createHint")}
        </p>
        <ElevatedButton
          title={t("create")}
          variant="primary"
          size="sm"
          iconVisible
          icon={<WebhooksLogo className="h-4 w-4" weight="bold" />}
          disabled={busy}
          onClick={() => void runAction(() => createWorkflowWebhookAction(workflowId))}
        />
        {error && <ErrorLine message={error} />}
      </ConfigShell>
    );
  }

  const dirty = !draftsEqual(draft, toDraft(webhook));
  const showSecret = draft.auth_mode !== "none";
  const secretLabel =
    draft.auth_mode === "header_token" ? t("secretToken") : t("secretSignature");

  return (
    <ConfigShell startOn={startOn} active={webhook.active}>
      <Field label={t("url")}>
        <div className="flex items-center gap-2">
          <ElevatedInput
            readOnly
            value={webhook.url}
            icon={<LinkSimple className="h-4 w-4" />}
            inputClassName="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <ElevatedButton
            variant="outline-subtle"
            size="icon"
            title=""
            iconVisible
            aria-label={t("copyUrl")}
            icon={
              copied === "url" ? (
                <Check className="h-4 w-4 text-healthy-ink" weight="bold" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
            onClick={() => copy(webhook.url, "url")}
          />
        </div>
      </Field>

      <ElevatedSelect
        label={t("auth")}
        value={draft.auth_mode}
        onValueChange={(v) =>
          setDraft((d) => (d ? { ...d, auth_mode: v as AuthMode } : d))
        }
      >
        <ElevatedSelectItem value="none">{t("authModes.none")}</ElevatedSelectItem>
        <ElevatedSelectItem value="header_token">{t("authModes.header_token")}</ElevatedSelectItem>
        <ElevatedSelectItem value="hmac">{t("authModes.hmac")}</ElevatedSelectItem>
      </ElevatedSelect>

      {showSecret && (
        <ElevatedInput
          label={t("headerName")}
          value={draft.header_name}
          placeholder={
            draft.auth_mode === "hmac"
              ? DEFAULT_SIGNATURE_HEADER
              : DEFAULT_TOKEN_HEADER
          }
          onChange={(e) =>
            setDraft((d) => (d ? { ...d, header_name: e.target.value } : d))
          }
        />
      )}

      {showSecret && webhook.secret && (
        <Field label={secretLabel}>
          <div className="flex items-center gap-2">
            <ElevatedInput
              readOnly
              type={revealSecret ? "text" : "password"}
              value={webhook.secret}
              inputClassName="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <ElevatedButton
              variant="outline-subtle"
              size="icon"
              title=""
              iconVisible
              aria-label={revealSecret ? t("hideSecret") : t("revealSecret")}
              icon={
                revealSecret ? (
                  <EyeSlash className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )
              }
              onClick={() => setRevealSecret((v) => !v)}
            />
            <ElevatedButton
              variant="outline-subtle"
              size="icon"
              title=""
              iconVisible
              aria-label={t("copySecret")}
              icon={
                copied === "secret" ? (
                  <Check className="h-4 w-4 text-healthy-ink" weight="bold" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
              onClick={() => webhook.secret && copy(webhook.secret, "secret")}
            />
          </div>
        </Field>
      )}

      <ElevatedSelect
        label={t("method")}
        value={draft.method}
        onValueChange={(v) => setDraft((d) => (d ? { ...d, method: v } : d))}
      >
        <ElevatedSelectItem value="POST">POST</ElevatedSelectItem>
        <ElevatedSelectItem value="PUT">PUT</ElevatedSelectItem>
        <ElevatedSelectItem value="PATCH">PATCH</ElevatedSelectItem>
      </ElevatedSelect>

      {draft.method !== RECEIVER_METHOD && (
        <NoticeLine>{t.rich("methodWarning", { ...richCode, method: draft.method })}</NoticeLine>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">{t("active")}</p>
          <p className="text-2xs text-muted-foreground">{t("activeHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.active}
          aria-label={t("toggleActive")}
          onClick={() => setDraft((d) => (d ? { ...d, active: !d.active } : d))}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            draft.active ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform",
              draft.active ? "bg-primary-foreground" : "bg-foreground",
              draft.active && "translate-x-5",
            )}
          />
        </button>
      </div>

      <WebhookReference
        key={startOn}
        webhook={webhook}
        startOn={startOn}
        events={events}
        dirty={dirty}
        revealSecret={revealSecret}
        onToggleSecret={() => setRevealSecret((v) => !v)}
        copied={copied}
        onCopy={copy}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <ElevatedButton
          title={t("save")}
          variant="primary"
          size="sm"
          disabled={!dirty || busy}
          onClick={() =>
            void runAction(() => updateWorkflowWebhookAction(workflowId, draft))
          }
        />
        <ElevatedButton
          title={t("rotate")}
          variant="outline-subtle"
          size="sm"
          iconVisible
          icon={<ArrowsClockwise className="h-4 w-4" />}
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("rotateConfirm"))) {
              void runAction(() => rotateWorkflowWebhookAction(workflowId));
            }
          }}
        />
        <ElevatedButton
          title={t("remove")}
          variant="ghost"
          size="sm"
          iconVisible
          icon={<Trash className="h-4 w-4" />}
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("removeConfirm"))) {
              void runAction(async () => {
                const res = await deleteWorkflowWebhookAction(workflowId);
                return { webhook: null, error: res.error };
              });
            }
          }}
        />
      </div>

      {error && <ErrorLine message={error} />}

      <WebhookDeliveries workflowId={workflowId} focused={focusDeliveries} />
    </ConfigShell>
  );
}

function ConfigShell({
  children,
  active,
  startOn,
}: {
  children: ReactNode;
  active?: boolean;
  startOn: WebhookStartOn;
}) {
  const t = useTranslations("workflowsPage.webhookTrigger");
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <WebhooksLogo className="h-5 w-5" weight="bold" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            {active === false && (
              <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                {t("inactive")}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.rich(`intro.${startOn}`, richCode)}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function WebhookReference({
  webhook,
  startOn,
  events,
  dirty,
  revealSecret,
  onToggleSecret,
  copied,
  onCopy,
}: {
  webhook: WorkflowWebhookConfig;
  startOn: WebhookStartOn;
  events: readonly string[];
  dirty: boolean;
  revealSecret: boolean;
  onToggleSecret: () => void;
  copied: CopyTarget | null;
  onCopy: (value: string, which: CopyTarget) => void;
}) {
  const t = useTranslations("workflowsPage.webhookTrigger");
  const examples = useMemo(() => webhookExamples(startOn, events), [startOn, events]);
  const [exampleKey, setExampleKey] = useState<WebhookExampleKey>(examples[0].key);
  const chosen = examples.find((candidate) => candidate.key === exampleKey) ?? examples[0];
  const bodyVariable = `{{webhook.body.<${t("reference.fieldPlaceholder")}>}}`;

  const authMode = webhook.auth_mode;
  const hasSecret = authMode !== "none" && Boolean(webhook.secret);
  const secretPlaceholder = authMode === "hmac" ? t("reference.secretPlaceholder.signature") : t("reference.secretPlaceholder.token");
  const secretForSnippet =
    revealSecret && webhook.secret ? webhook.secret : secretPlaceholder;

  const curl = useMemo(
    () =>
      buildCurl({
        url: webhook.url,
        method: webhook.method || RECEIVER_METHOD,
        authMode,
        headerName: webhook.header_name ?? "",
        secret: secretForSnippet,
        body: chosen.compact,
      }),
    [
      webhook.url,
      webhook.method,
      webhook.header_name,
      authMode,
      secretForSnippet,
      chosen.compact,
    ],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Code className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
        <span className="text-xs font-medium text-foreground">
          {t("reference.title")}
        </span>
      </div>

      <Tabs defaultValue="request" className="px-3 pb-3">
        <TabsList>
          <TabsTrigger value="request" className="text-xs">
            {t("reference.tabs.request")}
          </TabsTrigger>
          <TabsTrigger value="body" className="text-xs">
            {t("reference.tabs.body")}
          </TabsTrigger>
          <TabsTrigger value="responses" className="text-xs">
            {t("reference.tabs.responses")}
          </TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">
            {t("reference.tabs.flow")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-3 space-y-2.5">
          <AuthNote authMode={authMode} headerName={webhook.header_name ?? ""} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ElevatedPillToggle<WebhookExampleKey>
              aria-label={t(`reference.exampleLabel.${startOn}`)}
              value={chosen.key}
              onChange={setExampleKey}
              options={examples.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
            />
            {hasSecret && (
              <button
                type="button"
                onClick={onToggleSecret}
                className="inline-flex items-center gap-1.5 rounded-[--radius] text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {revealSecret ? (
                  <EyeSlash className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {revealSecret ? t("reference.hideSecret") : t("reference.includeSecret")}
              </button>
            )}
          </div>

          <CodeBlock
            code={curl}
            copied={copied === "curl"}
            onCopy={() => onCopy(curl, "curl")}
            copyLabel={t("reference.copyCommand")}
          />

          {dirty && <NoticeLine>{t("reference.dirty")}</NoticeLine>}
          {hasSecret && !revealSecret && (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t.rich("reference.placeholderHint", { ...richCode, placeholder: secretPlaceholder })}
            </p>
          )}
        </TabsContent>

        <TabsContent value="body" className="mt-3 space-y-3">
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t.rich(`reference.body.intro.${startOn}`, richCode)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {examples.map((candidate) => (
              <BodyOption
                key={candidate.key}
                title={candidate.key === "entry" ? "entry_id + entry_type" : candidate.label}
                hint={t.rich(`reference.body.options.${candidate.key}`, richCode)}
                code={candidate.pretty}
                copyLabel={t("reference.copyBody", { title: candidate.label })}
                copied={copied === "body" && chosen.key === candidate.key}
                onCopy={() => {
                  setExampleKey(candidate.key);
                  onCopy(candidate.pretty, "body");
                }}
              />
            ))}
          </div>

          <dl className="space-y-1.5 border-t border-border pt-2.5">
            {startOn === "conversation" ? (
              <>
                <FieldRow name="entry_id" type="string">
                  {t.rich("reference.body.fields.entry_id", richCode)}
                </FieldRow>
                <FieldRow name="entry_type" type="string">
                  {t("reference.body.fields.entry_type")}{" "}
                  {ENTRY_TYPES.map((type, index) => (
                    <span key={type}>
                      {index > 0 ? " " : null}
                      <Mono>{type}</Mono>
                    </span>
                  ))}
                </FieldRow>
                <FieldRow name="phone" type="string">
                  {t.rich("reference.body.fields.phone", richCode)}
                </FieldRow>
              </>
            ) : (
              <>
                <FieldRow name="phone" type="string">
                  {t.rich("reference.body.fields.leadPhone", richCode)}
                </FieldRow>
                <FieldRow name="name" type="string">
                  {t.rich("reference.body.fields.name", richCode)}
                </FieldRow>
                <FieldRow name="email" type="string">
                  {t.rich("reference.body.fields.email", richCode)}
                </FieldRow>
                <FieldRow name="event" type="string">
                  {t.rich("reference.body.fields.event", richCode)}
                </FieldRow>
                <FieldRow name="external_id" type="string">
                  {t.rich("reference.body.fields.external_id", richCode)}
                </FieldRow>
              </>
            )}
          </dl>

          {startOn === "lead" && events.length > 0 ? (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t("reference.body.acceptedEvents")}{" "}
              {events.map((event, index) => (
                <span key={event}>
                  {index > 0 ? " " : null}
                  <Mono>{event}</Mono>
                </span>
              ))}
            </p>
          ) : null}

          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t.rich("reference.body.extra", { ...richCode, variable: bodyVariable })}
          </p>
        </TabsContent>

        <TabsContent value="responses" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            {successResponses(t, startOn).map((r) => (
              <StatusRow key={r.code + r.status} {...r} />
            ))}
          </div>

          <div className="space-y-1.5 border-t border-border pt-2.5">
            {errorResponses(t, startOn).map((r) => (
              <StatusRow key={r.code + r.meaning} {...r} />
            ))}
          </div>

          <div className="rounded-[--radius] border border-border bg-muted px-2.5 py-2">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t.rich("reference.responses.retries", richCode)}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="flow" className="mt-3 space-y-2.5">
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t("reference.flow.intro")}
          </p>
          <dl className="space-y-1.5">
            <FieldRow name={bodyVariable}>{t("reference.flow.body")}</FieldRow>
            <FieldRow name="{{webhook.method}}">{t("reference.flow.method")}</FieldRow>
            {startOn === "lead" ? (
              <>
                <FieldRow name="{{lead_id}}">{t("reference.flow.leadId")}</FieldRow>
                <FieldRow name="{{lead_name}}">{t("reference.flow.leadName")}</FieldRow>
              </>
            ) : null}
          </dl>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t(`reference.flow.outro.${startOn}`)}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuthNote({
  authMode,
  headerName,
}: {
  authMode: AuthMode;
  headerName: string;
}) {
  const t = useTranslations("workflowsPage.webhookTrigger.reference");
  const header = resolveHeaderName(authMode, headerName);

  if (authMode === "none") {
    return <NoticeLine>{t("authNone")}</NoticeLine>;
  }

  if (authMode === "hmac") {
    return (
      <p className="text-2xs leading-relaxed text-muted-foreground">
        {t.rich("authHmac", { ...richCode, header, digest: "sha256=<hex>", prefix: "sha256=" })}
      </p>
    );
  }

  return (
    <p className="text-2xs leading-relaxed text-muted-foreground">
      {t.rich("authToken", { ...richCode, header })}
    </p>
  );
}

function BodyOption({
  title,
  hint,
  code,
  copyLabel,
  copied,
  onCopy,
}: {
  title: string;
  hint: ReactNode;
  code: string;
  copyLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-2xs font-medium text-foreground">{title}</p>
      <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p>
      <CodeBlock code={code} copied={copied} onCopy={onCopy} copyLabel={copyLabel} />
    </div>
  );
}

function CodeBlock({
  code,
  copied,
  onCopy,
  copyLabel,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className="relative rounded-[--radius] border border-border bg-muted">
      <ElevatedButton
        variant="outline-subtle"
        size="icon"
        title=""
        iconVisible
        aria-label={copyLabel}
        className="absolute right-1 top-1 z-10"
        icon={
          copied ? (
            <Check className="h-3.5 w-3.5 text-healthy-ink" weight="bold" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )
        }
        onClick={onCopy}
      />
      <pre className="overflow-x-auto px-2.5 py-2 pr-11 font-mono text-2xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  );
}

type StatusTone = "ok" | "client" | "fault";

interface StatusResponse {
  code: string;
  status: string;
  tone: StatusTone;
  meaning: string;
}

function successResponses(t: Translate, startOn: WebhookStartOn): StatusResponse[] {
  return [
    { code: "202", status: "accepted", tone: "ok", meaning: t("reference.responses.accepted") },
    { code: "202", status: "ignored", tone: "ok", meaning: t("reference.responses.ignored") },
    { code: "200", status: "already_running", tone: "ok", meaning: t(`reference.responses.alreadyRunning.${startOn}`) },
    { code: "200", status: "duplicate", tone: "ok", meaning: t("reference.responses.duplicate") },
  ];
}

function errorResponses(t: Translate, startOn: WebhookStartOn): StatusResponse[] {
  const forbidden: StatusResponse[] =
    startOn === "conversation" ? [{ code: "403", status: "", tone: "fault", meaning: t("reference.responses.forbidden") }] : [];
  const leadPhone: StatusResponse[] =
    startOn === "lead" ? [{ code: "422", status: "", tone: "client", meaning: t("reference.responses.leadPhoneInvalid") }] : [];
  return [
    { code: "400", status: "", tone: "client", meaning: t(`reference.responses.badRequest.${startOn}`) },
    { code: "401", status: "", tone: "fault", meaning: t("reference.responses.unauthorized") },
    ...forbidden,
    { code: "404", status: "", tone: "client", meaning: t(`reference.responses.notFound.${startOn}`) },
    { code: "405", status: "", tone: "client", meaning: t("reference.responses.methodNotAllowed") },
    { code: "409", status: "", tone: "client", meaning: t("reference.responses.notActive") },
    ...leadPhone,
    { code: "422", status: "", tone: "client", meaning: t("reference.responses.triggerInvalid") },
    { code: "422", status: "", tone: "client", meaning: t("reference.responses.noTrigger") },
    { code: "429", status: "", tone: "client", meaning: t("reference.responses.capacity") },
  ];
}

const statusToneClass: Record<StatusTone, string> = {
  ok: "text-healthy-ink",
  client: "text-warning-ink",
  fault: "text-destructive-ink",
};

function StatusRow({ code, status, tone, meaning }: StatusResponse) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          "readout w-7 shrink-0 font-mono text-2xs font-semibold",
          statusToneClass[tone],
        )}
      >
        {code}
      </span>
      <p className="min-w-0 text-2xs leading-relaxed text-muted-foreground">
        {status && (
          <>
            <Mono>{status}</Mono>
            {": "}
          </>
        )}
        {meaning}
      </p>
    </div>
  );
}

function FieldRow({
  name,
  type,
  children,
}: {
  name: string;
  type?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <dt className="shrink-0 font-mono text-2xs font-medium text-foreground">
        {name}
      </dt>
      {type && (
        <span className="text-2xs italic text-muted-foreground">{type}</span>
      )}
      <dd className="min-w-0 flex-1 text-2xs leading-relaxed text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.95em] text-foreground">
      {children}
    </code>
  );
}

function NoticeLine({ children }: { children: ReactNode }) {
  return (
    <Notice tone="warning">{children}</Notice>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <Notice tone="fault">{message}</Notice>
  );
}
