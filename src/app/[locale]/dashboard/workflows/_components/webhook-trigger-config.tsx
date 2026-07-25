"use client";

import { useCallback, useEffect, useState } from "react";
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
  Info,
} from "@phosphor-icons/react";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
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

interface Draft {
  auth_mode: AuthMode;
  header_name: string;
  method: string;
  active: boolean;
}

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
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

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

  const copy = useCallback((value: string, which: "url" | "secret") => {
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
        <p className="rounded-lg border border-border/70 bg-mist px-3 py-2 text-xs text-muted-foreground">
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
                <Check className="h-4 w-4 text-emerald-600" weight="bold" />
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
          placeholder={draft.auth_mode === "hmac" ? "X-Signature-256" : "X-Webhook-Token"}
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
                  <Check className="h-4 w-4 text-emerald-600" weight="bold" />
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

      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-mist px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">Webhook ativo</p>
          <p className="text-[11px] text-muted-foreground">
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
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              draft.active && "translate-x-5",
            )}
          />
        </button>
      </div>

      <PayloadReference />

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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <WebhooksLogo className="h-5 w-5 text-white" weight="bold" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Gatilho de Webhook</p>
            {active === false && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                inativo
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Um sistema externo inicia este fluxo com um POST. O payload precisa conter
            entry_id e entry_type.
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

function PayloadReference() {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-mist p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Info className="h-3.5 w-3.5 text-primary" weight="bold" />
        Variáveis disponíveis no fluxo
      </div>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        <li>
          <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">
            {"{{var.webhook.body.<campo>}}"}
          </code>{" "}
          corpo recebido (JSON)
        </li>
        <li>
          <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">
            {"{{var.webhook.method}}"}
          </code>{" "}
          método da requisição
        </li>
      </ul>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
