"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowSquareOut,
  ChatCircleDots,
  CurrencyDollar,
  Headset,
  LinkSimpleBreak,
  Phone,
  Trash,
  TrendUp,
  WhatsappLogo,
} from "@/components/icons";

import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
  ElevatedSheetDescription,
} from "@/components/elevated-design/elevated-sheet";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";

import {
  createOpportunityAction,
  updateOpportunityAction,
  deleteOpportunityAction,
  listOpportunityConversationsAction,
  unlinkOpportunityConversationAction,
} from "@/app/actions/opportunities";
import type { OpportunityConversationLink } from "@/lib/crm/opportunities";
import { listAssignableMembersAction, type AssignableMember } from "@/app/actions/workspace";
import {
  formatValueCents,
  parseBRLToCents,
  type Opportunity,
  type OpportunityColumn,
  type OpportunityStatus,
} from "@/lib/crm/opportunities";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

interface OpportunityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null => create mode; an Opportunity => edit mode.
  opportunity: Opportunity | null;
  pipelineId: string;
  columns: OpportunityColumn[];
  customFields: CustomFieldDefinition[];
  workspaceId?: string;
  // Default stage for a new deal (the initial column). Falls back to columns[0].
  defaultStageId?: string;
  // Create-from-chat: pre-fill the title + link this conversation on create so the
  // deal timeline carries the chat history.
  defaultTitle?: string;
  linkEntryId?: string;
  linkEntryType?: string;
  onSaved: () => void;
}

// ISO (yyyy-mm-dd) <-> the drawer's date input value. The API takes an RFC3339
// timestamp; we send midnight UTC for the chosen day.
function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
function fromDateInput(value: string): string | null {
  if (!value) return null;
  return `${value}T00:00:00Z`;
}

export default function OpportunityDrawer({
  open,
  onOpenChange,
  opportunity,
  pipelineId,
  columns,
  customFields,
  workspaceId,
  defaultStageId,
  defaultTitle,
  linkEntryId,
  linkEntryType,
  onSaved,
}: OpportunityDrawerProps) {
  const isEdit = !!opportunity;
  const { user } = useAuth();
  const { can } = useWorkspace();
  const currentUserId = user?.id ?? "";
  // RBAC: only members with the assign permission can hand a deal to someone else;
  // everyone else is locked to themselves as the responsável.
  const canAssignOthers = can("conversations", "assign");

  const [title, setTitle] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [source, setSource] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [links, setLinks] = useState<OpportunityConversationLink[]>([]);

  // Reset the form each time the drawer opens (or the target deal changes).
  useEffect(() => {
    if (!open) return;
    setTitle(opportunity?.title ?? defaultTitle ?? "");
    setValueInput(opportunity ? String((opportunity.valueCents ?? 0) / 100).replace(".", ",") : "");
    setStageId(opportunity?.stageId ?? defaultStageId ?? columns[0]?.id ?? "");
    // New deals default to the creator as responsável; edits keep their owner.
    setOwnerId(opportunity?.ownerId ?? currentUserId);
    setCloseDate(toDateInput(opportunity?.closeDate));
    setSource(opportunity?.source ?? "");
    setLostReason(opportunity?.lostReasonId ?? "");
    setCustom({ ...(opportunity?.customFields ?? {}) });
  }, [open, opportunity, defaultStageId, defaultTitle, columns, currentUserId]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    let cancelled = false;
    void listAssignableMembersAction(workspaceId, { pageSize: 200 }).then((res) => {
      if (!cancelled) setMembers(res.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  // Deal timeline: the WhatsApp/voice conversations linked to this deal (the Vozko
  // moat, the chat history lives on the deal card). Only in edit mode.
  const reloadLinks = useCallback(async () => {
    if (!opportunity) {
      setLinks([]);
      return;
    }
    const { links: l } = await listOpportunityConversationsAction(opportunity.id);
    setLinks(l);
  }, [opportunity]);

  useEffect(() => {
    if (open && opportunity) void reloadLinks();
    else setLinks([]);
  }, [open, opportunity, reloadLinks]);

  const handleUnlink = useCallback(
    async (entryId: string, entryType: string) => {
      if (!opportunity) return;
      const { success, error } = await unlinkOpportunityConversationAction(
        opportunity.id,
        entryId,
        entryType,
      );
      if (!success) {
        toast.error(error ?? "Não foi possível desvincular a conversa.");
        return;
      }
      await reloadLinks();
    },
    [opportunity, reloadLinks],
  );

  const selectedColumn = useMemo(
    () => columns.find((c) => c.id === stageId),
    [columns, stageId],
  );
  const derivedStatus: OpportunityStatus = selectedColumn?.isWon
    ? "won"
    : selectedColumn?.isLost
      ? "lost"
      : "open";
  const needsLostReason = derivedStatus === "lost";

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.userId,
        label: m.username?.trim() || m.email?.trim() || m.userId,
      })),
    [members],
  );

  const setCustomValue = useCallback((key: string, value: unknown) => {
    setCustom((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined || value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const canSave =
    !!stageId && (title.trim().length > 0 || !!opportunity?.leadId) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    if (needsLostReason && !lostReason.trim()) {
      toast.error("Informe o motivo da perda para mover para uma etapa de perdido.");
      return;
    }
    setSaving(true);
    const valueCents = parseBRLToCents(valueInput);
    const closeIso = fromDateInput(closeDate);

    if (isEdit && opportunity) {
      const { opportunity: updated, error } = await updateOpportunityAction(opportunity.id, {
        title: title.trim(),
        valueCents,
        ownerId,
        source: source.trim(),
        closeDate: closeIso,
        customFields: custom,
        stageId,
        status: derivedStatus,
        lostReasonId: needsLostReason ? lostReason.trim() : "",
      });
      setSaving(false);
      if (error || !updated) {
        toast.error(error ?? "Não foi possível salvar a oportunidade.");
        return;
      }
      toast.success("Oportunidade atualizada.");
    } else {
      const { opportunity: created, error } = await createOpportunityAction({
        pipelineId,
        stageId,
        title: title.trim(),
        valueCents,
        ownerId: ownerId || undefined,
        source: source.trim() || undefined,
        closeDate: closeIso,
        customFields: Object.keys(custom).length ? custom : undefined,
        // create-from-chat: carry the linked conversation onto the new deal.
        linkEntryId: linkEntryId || undefined,
        linkEntryType: linkEntryType || undefined,
      });
      setSaving(false);
      if (error || !created) {
        toast.error(error ?? "Não foi possível criar a oportunidade.");
        return;
      }
      toast.success("Oportunidade criada.");
    }
    onOpenChange(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!opportunity) return;
    setDeleting(true);
    const { success, error } = await deleteOpportunityAction(opportunity.id);
    setDeleting(false);
    if (!success) {
      toast.error(error ?? "Não foi possível excluir a oportunidade.");
      return;
    }
    toast.success("Oportunidade excluída.");
    onOpenChange(false);
    onSaved();
  };

  const previewValue = formatValueCents(parseBRLToCents(valueInput));

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <ElevatedSheetHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendUp weight="bold" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="text-lg">
                {isEdit ? "Editar oportunidade" : "Nova oportunidade"}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription className="text-xs">
                {isEdit
                  ? "Atualize os dados, mova de etapa ou registre ganho/perda."
                  : "Registre um novo negócio no funil de vendas."}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <ElevatedInput
            id="opp-title"
            label="Título"
            variant="outline"
            controlSize="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Contrato Acme, 10 licenças"
          />

          <div>
            <ElevatedInput
              id="opp-value"
              label="Valor (R$)"
              variant="outline"
              controlSize="sm"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {valueInput ? (
              <p className="mt-1 flex items-center gap-1 pl-1 text-xs text-muted-foreground">
                <CurrencyDollar weight="bold" className="h-3 w-3" />
                {previewValue}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="pl-1 text-sm font-medium text-foreground">Etapa</label>
            <ElevatedSelect value={stageId} onValueChange={setStageId} className="w-full">
              {columns.map((c) => (
                <ElevatedSelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: c.color || "#94a3b8" }}
                    />
                    {c.name}
                    {c.isWon ? " • ganho" : c.isLost ? " • perdido" : ""}
                  </span>
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>

          {needsLostReason ? (
            <ElevatedInput
              id="opp-lost-reason"
              label="Motivo da perda"
              variant="outline"
              controlSize="sm"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Ex.: preço, concorrente, sem orçamento..."
              error={needsLostReason && !lostReason.trim() ? "Obrigatório" : undefined}
            />
          ) : null}

          <div className="space-y-1.5">
            {canAssignOthers ? (
              <ElevatedCommandSelect
                label="Responsável"
                options={memberOptions}
                value={ownerId || null}
                onValueChange={(v) => setOwnerId(v)}
                searchPlaceholder="Buscar responsável..."
                emptyMessage="Nenhum membro"
                fullWidth
              />
            ) : (
              // No permission to assign others: locked to the current user.
              <div>
                <label className="pl-1 text-sm font-medium text-foreground">Responsável</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase text-foreground">
                    {(memberOptions.find((m) => m.value === ownerId)?.label ?? "?").charAt(0)}
                  </span>
                  <span className="truncate">
                    {memberOptions.find((m) => m.value === ownerId)?.label ?? "Você"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <ElevatedDatePicker
            id="opp-close-date"
            label="Previsão de fechamento"
            value={closeDate}
            onChange={(v) => setCloseDate(v)}
          />

          <ElevatedInput
            id="opp-source"
            label="Origem"
            variant="outline"
            controlSize="sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Ex.: WhatsApp, indicação, anúncio..."
          />

          {customFields.length > 0 ? (
            <div className="space-y-4 border-t border-border pt-4">
              <p className="text-2xs font-semibold text-muted-foreground">
                Campos personalizados
              </p>
              {customFields.map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={custom[f.key]}
                  onChange={(v) => setCustomValue(f.key, v)}
                />
              ))}
            </div>
          ) : null}

          {isEdit ? <LinkedConversations links={links} onUnlink={handleUnlink} /> : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
              <Trash weight="bold" className="h-3.5 w-3.5" />
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              title="Cancelar"
              onClick={() => onOpenChange(false)}
            />
            <ElevatedButton
              variant="primary"
              size="sm"
              title={saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
              onClick={handleSave}
              disabled={!canSave}
            />
          </div>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

// The deal timeline: the WhatsApp/voice conversations attached to this deal. Each
// row links out to the conversation and can be unlinked. (A richer inline message
// history can be layered on later; the linkage + jump-off is the moat.)
function LinkedConversations({
  links,
  onUnlink,
}: {
  links: OpportunityConversationLink[];
  onUnlink: (entryId: string, entryType: string) => void;
}) {
  function meta(entryType: string) {
    switch (entryType) {
      case "whatsapp":
        return { label: "WhatsApp", icon: <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-white" />, tile: "bg-[#25d366] text-white" };
      case "voice":
        return { label: "Voz", icon: <Phone weight="fill" className="h-3.5 w-3.5 text-white" />, tile: "bg-foreground/80 text-background" };
      case "support":
        return { label: "Suporte", icon: <Headset weight="fill" className="h-3.5 w-3.5 text-white" />, tile: "bg-foreground/80 text-background" };
      default:
        return { label: entryType, icon: <ChatCircleDots weight="fill" className="h-3.5 w-3.5 text-white" />, tile: "bg-foreground/80 text-background" };
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-2xs font-semibold text-muted-foreground">
        Conversas vinculadas
      </p>
      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          Nenhuma conversa vinculada a este negócio.
        </p>
      ) : (
        links.map((l) => {
          const m = meta(l.entryType);
          return (
            <div
              key={`${l.entryType}:${l.entryId}`}
              className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md", m.tile)}>
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{m.label}</p>
                <p className="truncate font-mono text-2xs text-muted-foreground">{l.entryId}</p>
              </div>
              <a
                href={`/dashboard/live-chat?entry=${encodeURIComponent(l.entryId)}`}
                title="Abrir conversa"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onUnlink(l.entryId, l.entryType)}
                title="Desvincular"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <LinkSimpleBreak weight="bold" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <label className="pl-1 text-sm font-medium text-foreground">{label}</label>
        <ElevatedSelect
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          className="w-full"
        >
          {(field.options ?? []).map((opt) => (
            <ElevatedSelectItem key={opt} value={opt}>
              {opt}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
    );
  }

  if (field.type === "boolean") {
    const checked = value === true;
    return (
      <label className="flex cursor-pointer items-center gap-2.5 pl-1">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              checked ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <ElevatedDatePicker
        id={`cf-${field.key}`}
        label={label}
        value={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(v: string) => onChange(v || undefined)}
      />
    );
  }

  return (
    <ElevatedInput
      id={`cf-${field.key}`}
      label={label}
      variant="outline"
      controlSize="sm"
      type={field.type === "number" ? "number" : "text"}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) =>
        onChange(
          field.type === "number"
            ? e.target.value === ""
              ? undefined
              : Number(e.target.value)
            : e.target.value,
        )
      }
    />
  );
}
