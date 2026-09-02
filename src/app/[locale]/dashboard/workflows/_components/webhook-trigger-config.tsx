"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Warning,
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
import { cn } from "@/lib/utils";
import {
  getWorkflowWebhookAction,
  createWorkflowWebhookAction,
  updateWorkflowWebhookAction,
  rotateWorkflowWebhookAction,
  deleteWorkflowWebhookAction,
  type WorkflowWebhookConfig,
} from "@/app/actions/workflows";

type AuthMode = "none" | "header_token" | "hmac";
type CopyTarget = "url" | "secret" | "curl" | "body";
/** Which of the two mutually exclusive ways of naming the conversation the examples show. */
type EntryMode = "entry" | "phone";

interface Draft {
  auth_mode: AuthMode;
  header_name: string;
  method: string;
  active: boolean;
}

const DEFAULT_TOKEN_HEADER = "X-Webhook-Token";
const DEFAULT_SIGNATURE_HEADER = "X-Signature-256";

/**
 * The only HTTP method the public receiver is registered for
 * (`delivery/http/workflowwebhook/routes.go`). The method select still offers
 * PUT and PATCH because saved webhooks may carry them, but a call with either
 * is refused by the router with a 405 before the workflow is ever reached — so
 * the panel says so rather than printing a snippet that cannot work.
 */
const RECEIVER_METHOD = "POST";

/** Bodies for the examples: compact for the shell command, indented for the field reference. */
const COMPACT_BODY: Record<EntryMode, string> = {
  entry:
    '{"entry_id":"c7f1e2a0-9b3d-4a1e-8f2c-1d2e3f4a5b6c","entry_type":"whatsapp"}',
  phone: '{"phone":"+5511998887777"}',
};

const PRETTY_BODY: Record<EntryMode, string> = {
  entry: `{
  "entry_id": "c7f1e2a0-9b3d-4a1e-8f2c-1d2e3f4a5b6c",
  "entry_type": "whatsapp"
}`,
  phone: `{
  "phone": "+5511998887777"
}`,
};

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

/** Mirrors the server's `resolveHeaderName`: an empty field means the per-mode default. */
function resolveHeaderName(mode: AuthMode, provided: string): string {
  if (provided.trim()) return provided.trim();
  if (mode === "hmac") return DEFAULT_SIGNATURE_HEADER;
  if (mode === "header_token") return DEFAULT_TOKEN_HEADER;
  return "";
}

/**
 * Builds the call the operator hands their integrator, filled in from the
 * webhook as it is SAVED — not from the unsaved draft, which the server would
 * not honour yet.
 *
 * The HMAC form is a three-liner because the signature covers the exact bytes
 * sent and has to be computed before the request. That is the detail
 * integrations most often get wrong: a bare hex digest with no `sha256=`
 * prefix fails `VerifyPrefixedHMAC` and comes back as a bare 401, with nothing
 * on the wire saying why.
 */
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
}: {
  workflowId?: string | null;
}) {
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
      if (res.error) setError(res.error);
      apply(res.webhook ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workflowId, apply]);

  const copy = useCallback((value: string, which: CopyTarget) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const runAction = useCallback(
    async (
      fn: () => Promise<{ webhook?: WorkflowWebhookConfig | null; error?: string }>,
    ) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else apply(res.webhook ?? null);
      setBusy(false);
    },
    [apply],
  );

  if (!workflowId) {
    return (
      <ConfigShell>
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Salve o fluxo para gerar a URL do webhook.
        </p>
      </ConfigShell>
    );
  }

  if (loading) {
    return (
      <ConfigShell>
        <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Carregando configuração do webhook...
        </div>
      </ConfigShell>
    );
  }

  if (!webhook || !draft) {
    return (
      <ConfigShell>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Gere uma URL exclusiva para que sistemas externos iniciem este fluxo.
        </p>
        <ElevatedButton
          title="Gerar URL do webhook"
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
    draft.auth_mode === "header_token" ? "Token do cabeçalho" : "Segredo de assinatura";

  return (
    <ConfigShell active={webhook.active}>
      <Field label="URL de produção">
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
            aria-label="Copiar URL"
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
        label="Autenticação"
        value={draft.auth_mode}
        onValueChange={(v) =>
          setDraft((d) => (d ? { ...d, auth_mode: v as AuthMode } : d))
        }
      >
        <ElevatedSelectItem value="none">Somente URL secreta</ElevatedSelectItem>
        <ElevatedSelectItem value="header_token">Token no cabeçalho</ElevatedSelectItem>
        <ElevatedSelectItem value="hmac">Assinatura HMAC SHA256</ElevatedSelectItem>
      </ElevatedSelect>

      {showSecret && (
        <ElevatedInput
          label="Nome do cabeçalho"
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
              aria-label={revealSecret ? "Ocultar segredo" : "Revelar segredo"}
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
              aria-label="Copiar segredo"
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
        label="Método HTTP"
        value={draft.method}
        onValueChange={(v) => setDraft((d) => (d ? { ...d, method: v } : d))}
      >
        <ElevatedSelectItem value="POST">POST</ElevatedSelectItem>
        <ElevatedSelectItem value="PUT">PUT</ElevatedSelectItem>
        <ElevatedSelectItem value="PATCH">PATCH</ElevatedSelectItem>
      </ElevatedSelect>

      {draft.method !== RECEIVER_METHOD && (
        <NoticeLine>
          O receptor público aceita somente <Mono>POST</Mono>. Com{" "}
          <Mono>{draft.method}</Mono> as chamadas retornam <Mono>405</Mono> antes
          de alcançar o fluxo.
        </NoticeLine>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">Webhook ativo</p>
          <p className="text-2xs text-muted-foreground">
            Quando inativo, as chamadas recebidas retornam 404.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.active}
          aria-label="Ativar webhook"
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
        webhook={webhook}
        dirty={dirty}
        revealSecret={revealSecret}
        onToggleSecret={() => setRevealSecret((v) => !v)}
        copied={copied}
        onCopy={copy}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <ElevatedButton
          title="Salvar"
          variant="primary"
          size="sm"
          disabled={!dirty || busy}
          onClick={() =>
            void runAction(() => updateWorkflowWebhookAction(workflowId, draft))
          }
        />
        <ElevatedButton
          title="Regerar URL e segredo"
          variant="outline-subtle"
          size="sm"
          iconVisible
          icon={<ArrowsClockwise className="h-4 w-4" />}
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Isso invalida a URL e o segredo atuais. Integrações existentes vão parar de funcionar ate serem atualizadas. Continuar?",
              )
            ) {
              void runAction(() => rotateWorkflowWebhookAction(workflowId));
            }
          }}
        />
        <ElevatedButton
          title="Remover"
          variant="ghost"
          size="sm"
          iconVisible
          icon={<Trash className="h-4 w-4" />}
          disabled={busy}
          onClick={() => {
            if (window.confirm("Remover o webhook deste fluxo?")) {
              void runAction(async () => {
                const res = await deleteWorkflowWebhookAction(workflowId);
                return { webhook: null, error: res.error };
              });
            }
          }}
        />
      </div>

      {error && <ErrorLine message={error} />}
    </ConfigShell>
  );
}

function ConfigShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <WebhooksLogo className="h-5 w-5" weight="bold" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Gatilho de Webhook</p>
            {active === false && (
              <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                inativo
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Um sistema externo inicia este fluxo com uma requisição HTTP. O corpo
            precisa dizer sobre qual conversa o fluxo vai rodar — por{" "}
            <Mono>entry_id</Mono> + <Mono>entry_type</Mono>, ou por{" "}
            <Mono>phone</Mono>. A referência abaixo monta a chamada pronta.
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

/**
 * The call reference.
 *
 * The panel used to hand the operator a URL, a secret and a method and stop
 * there: everything needed to CONFIGURE the webhook and nothing needed to CALL
 * it. What was missing is what an integrator actually asks for — the exact
 * request, the two ways of naming the conversation, and what comes back — so
 * that is what the four panes carry, in that order.
 *
 * Tabs rather than stacked sections because this sits inside an already long
 * config column: four panes keep the block a fixed, scannable height, and only
 * one of them is ever the question being asked.
 *
 * Every value is filled in from the saved webhook rather than described in
 * prose, because a snippet the operator can paste into a ticket is the point.
 */
function WebhookReference({
  webhook,
  dirty,
  revealSecret,
  onToggleSecret,
  copied,
  onCopy,
}: {
  webhook: WorkflowWebhookConfig;
  dirty: boolean;
  revealSecret: boolean;
  onToggleSecret: () => void;
  copied: CopyTarget | null;
  onCopy: (value: string, which: CopyTarget) => void;
}) {
  const [entryMode, setEntryMode] = useState<EntryMode>("entry");

  const authMode = webhook.auth_mode;
  const hasSecret = authMode !== "none" && Boolean(webhook.secret);
  const secretPlaceholder = authMode === "hmac" ? "SEU_SEGREDO" : "SEU_TOKEN";
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
        body: COMPACT_BODY[entryMode],
      }),
    [
      webhook.url,
      webhook.method,
      webhook.header_name,
      authMode,
      secretForSnippet,
      entryMode,
    ],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Code className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
        <span className="text-xs font-medium text-foreground">
          Como chamar este webhook
        </span>
      </div>

      <Tabs defaultValue="request" className="px-3 pb-3">
        <TabsList>
          <TabsTrigger value="request" className="text-xs">
            Requisição
          </TabsTrigger>
          <TabsTrigger value="body" className="text-xs">
            Corpo
          </TabsTrigger>
          <TabsTrigger value="responses" className="text-xs">
            Respostas
          </TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">
            No fluxo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-3 space-y-2.5">
          <AuthNote authMode={authMode} headerName={webhook.header_name ?? ""} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ElevatedPillToggle<EntryMode>
              aria-label="Forma de identificar a conversa no exemplo"
              value={entryMode}
              onChange={setEntryMode}
              options={[
                { value: "entry", label: "entry_id" },
                { value: "phone", label: "phone" },
              ]}
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
                {revealSecret ? "Ocultar segredo" : "Incluir segredo"}
              </button>
            )}
          </div>

          <CodeBlock
            code={curl}
            copied={copied === "curl"}
            onCopy={() => onCopy(curl, "curl")}
            copyLabel="Copiar comando"
          />

          {dirty && (
            <NoticeLine>
              O exemplo usa a configuração já salva. Salve as alterações para
              refleti-las aqui.
            </NoticeLine>
          )}
          {hasSecret && !revealSecret && (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              <Mono>{secretPlaceholder}</Mono> é um marcador — use “Incluir
              segredo” para copiar o comando já preenchido.
            </p>
          )}
        </TabsContent>

        <TabsContent value="body" className="mt-3 space-y-3">
          <p className="text-2xs leading-relaxed text-muted-foreground">
            O corpo é JSON e identifica a conversa de{" "}
            <span className="font-medium text-foreground">uma</span> destas duas
            formas.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <BodyOption
              title="entry_id + entry_type"
              hint="Quando o sistema externo já conhece o id interno da conversa."
              code={PRETTY_BODY.entry}
              copied={copied === "body" && entryMode === "entry"}
              onCopy={() => {
                setEntryMode("entry");
                onCopy(PRETTY_BODY.entry, "body");
              }}
            />
            <BodyOption
              title="phone"
              hint="Resolve para a conversa de WhatsApp mais recente com esse número."
              code={PRETTY_BODY.phone}
              copied={copied === "body" && entryMode === "phone"}
              onCopy={() => {
                setEntryMode("phone");
                onCopy(PRETTY_BODY.phone, "body");
              }}
            />
          </div>

          <dl className="space-y-1.5 border-t border-border pt-2.5">
            <FieldRow name="entry_id" type="string">
              Id interno da conversa. Só vale acompanhado de{" "}
              <Mono>entry_type</Mono>.
            </FieldRow>
            <FieldRow name="entry_type" type="string">
              Um de <Mono>whatsapp</Mono>, <Mono>unofficial_whatsapp</Mono>,{" "}
              <Mono>instagram</Mono>, <Mono>telegram</Mono> ou{" "}
              <Mono>support</Mono>.
            </FieldRow>
            <FieldRow name="phone" type="string">
              Número em E.164 (<Mono>+5511998887777</Mono>). Alternativa ao par
              acima; o formato brasileiro com e sem o nono dígito é aceito.
            </FieldRow>
          </dl>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            Qualquer outro campo enviado é preservado e fica disponível no fluxo
            em <Mono>{"{{var.webhook.body.<campo>}}"}</Mono>.
          </p>
        </TabsContent>

        <TabsContent value="responses" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            {SUCCESS_RESPONSES.map((r) => (
              <StatusRow key={r.code + r.status} {...r} />
            ))}
          </div>

          <div className="space-y-1.5 border-t border-border pt-2.5">
            {ERROR_RESPONSES.map((r) => (
              <StatusRow key={r.code + r.status} {...r} />
            ))}
          </div>

          <div className="rounded-[--radius] border border-border bg-muted px-2.5 py-2">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Reenvios.</span> Uma
              chamada repetida é ignorada por 6 h. A chave vem de{" "}
              <Mono>X-Idempotency-Key</Mono> (ou <Mono>X-Webhook-Id</Mono> /{" "}
              <Mono>X-Event-Id</Mono>); sem esses cabeçalhos ela é o hash do
              corpo — então dois disparos legítimos de corpo idêntico contam como
              um só. Envie um deles para controlar isso.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="flow" className="mt-3 space-y-2.5">
          <p className="text-2xs leading-relaxed text-muted-foreground">
            O que a requisição deixa disponível para os nós seguintes:
          </p>
          <dl className="space-y-1.5">
            <FieldRow name="{{var.webhook.body.<campo>}}">
              Qualquer campo do corpo recebido, inclusive os do provedor.
            </FieldRow>
            <FieldRow name="{{var.webhook.method}}">
              Método da requisição.
            </FieldRow>
          </dl>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            A conversa identificada no corpo vira a entrada da execução: os nós
            de mensagem, etapa e finalização já agem sobre ela, sem precisar
            referenciá-la.
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
  const header = resolveHeaderName(authMode, headerName);

  if (authMode === "none") {
    return (
      <NoticeLine>
        Sem autenticação: qualquer chamada com a URL correta inicia o fluxo.
        Trate a URL como um segredo.
      </NoticeLine>
    );
  }

  if (authMode === "hmac") {
    return (
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Assine os bytes exatos do corpo com HMAC-SHA256 e envie o digest em{" "}
        <Mono>{header}</Mono> no formato <Mono>{"sha256=<hex>"}</Mono>. Sem o
        prefixo <Mono>sha256=</Mono> a verificação falha com <Mono>401</Mono>.
      </p>
    );
  }

  return (
    <p className="text-2xs leading-relaxed text-muted-foreground">
      Envie o token, sem prefixo, no cabeçalho <Mono>{header}</Mono>.
    </p>
  );
}

function BodyOption({
  title,
  hint,
  code,
  copied,
  onCopy,
}: {
  title: string;
  hint: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-2xs font-medium text-foreground">{title}</p>
      <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p>
      <CodeBlock
        code={code}
        copied={copied}
        onCopy={onCopy}
        copyLabel={`Copiar corpo com ${title}`}
      />
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

const SUCCESS_RESPONSES: StatusResponse[] = [
  {
    code: "202",
    status: "accepted",
    tone: "ok",
    meaning: "Execução criada; o run_id vem na resposta.",
  },
  {
    code: "200",
    status: "already_running",
    tone: "ok",
    meaning: "Já existe execução ativa para esta conversa neste gatilho.",
  },
  {
    code: "200",
    status: "duplicate",
    tone: "ok",
    meaning: "Reenvio detectado na janela de 6 h; nada foi iniciado.",
  },
];

const ERROR_RESPONSES: StatusResponse[] = [
  {
    code: "400",
    status: "",
    tone: "client",
    meaning: "Corpo sem entry_id + entry_type e sem phone.",
  },
  {
    code: "401",
    status: "",
    tone: "fault",
    meaning: "Token ausente ou incorreto, ou assinatura inválida.",
  },
  {
    code: "403",
    status: "",
    tone: "fault",
    meaning: "A conversa não pertence a esta área de trabalho.",
  },
  {
    code: "404",
    status: "",
    tone: "client",
    meaning:
      "Webhook inexistente ou desativado, ou nenhuma conversa para o telefone.",
  },
  {
    code: "405",
    status: "",
    tone: "client",
    meaning: "Método diferente do configurado.",
  },
  {
    code: "409",
    status: "",
    tone: "client",
    // "Ativar" is the word on the editor's own button; "publicado" would send
    // the operator looking for a control that does not exist.
    meaning: "O fluxo não está ativo — use Ativar no editor.",
  },
  {
    code: "422",
    status: "",
    tone: "client",
    meaning: "O fluxo não tem um nó de gatilho de webhook.",
  },
  {
    code: "429",
    status: "",
    tone: "client",
    meaning: "Limite de execuções simultâneas da área de trabalho atingido.",
  },
];

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
            {" — "}
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
  children: React.ReactNode;
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

/**
 * An inline literal in running prose.
 *
 * The ground is `--background`, not `--muted`: these chips appear both on the
 * card and inside the muted wells of `NoticeLine`, and a muted chip on a muted
 * well is no chip at all. `--background` differs from BOTH `--card` and
 * `--muted` in either theme, so the same chip reads on every ground it lands on.
 */
function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.95em] text-foreground">
      {children}
    </code>
  );
}

/**
 * A caution the operator has to read before the thing next to it will work.
 * Neutral ground with the warning ink in the glyph and text — the product's
 * rule against washing a hue behind its own ink.
 */
function NoticeLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 rounded-[--radius] border border-border bg-muted px-2.5 py-2 text-warning-ink">
      <Warning className="mt-px h-3.5 w-3.5 shrink-0" weight="bold" />
      <p className="text-2xs leading-relaxed">{children}</p>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-destructive-ink dark:border-border dark:text-destructive-ink">
      {message}
    </p>
  );
}
