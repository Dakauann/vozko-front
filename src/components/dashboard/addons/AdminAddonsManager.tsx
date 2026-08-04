"use client";

import * as React from "react";

import {
  Archive,
  CircleNotch,
  FloppyDisk,
  Phone,
  PlusCircle,
  PuzzlePiece,
  WhatsappLogo,
} from "@/components/icons";
import {
  adminArchiveAddonAction,
  adminCreateAddonAction,
  adminListAddonsAction,
  adminUpdateAddonAction,
} from "@/app/actions/addons";
import type {
  AddonDefinition,
  AddonDefinitionInput,
  AddonEntitlementKind,
} from "@/lib/workspace-addon/types";
import { dollarsToMicros, microsToDollars } from "@/app/[locale]/dashboard/plans/pricing-helpers";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";

type AddonDraft = {
  key: string;
  name: string;
  description: string;
  entitlementKind: AddonEntitlementKind;
  unitsPerQuantity: string;
  monthlyPrice: string;
  annualPrice: string;
  monthlyCost: string;
  annualCost: string;
  isActive: boolean;
};

const KIND_LABELS: Record<AddonEntitlementKind, string> = {
  call_channels: "Canais de chamada",
  whatsapp_business_phones: "Números WhatsApp Business",
};

/**
 * VoIP is no longer part of the product, so a call-channel addon cannot be
 * created, listed or sold. The kind stays in the type because the API still
 * returns it for rows created before the feature was withdrawn — those are
 * filtered out here rather than rendered as a purchasable capability.
 */
const RETIRED_KINDS = new Set<AddonEntitlementKind>(["call_channels"]);

function KindGlyph({ kind }: { kind: AddonEntitlementKind }) {
  return kind === "whatsapp_business_phones" ? (
    <WhatsappLogo className="h-5 w-5" weight="fill" />
  ) : (
    <Phone className="h-5 w-5" weight="fill" />
  );
}

function emptyDraft(): AddonDraft {
  return {
    key: "",
    name: "",
    description: "",
    entitlementKind: "whatsapp_business_phones",
    unitsPerQuantity: "1",
    monthlyPrice: "0",
    annualPrice: "0",
    monthlyCost: "0",
    annualCost: "0",
    isActive: true,
  };
}

function draftFromAddon(addon: AddonDefinition): AddonDraft {
  return {
    key: addon.key,
    name: addon.name,
    description: addon.description,
    entitlementKind: addon.entitlementKind,
    unitsPerQuantity: String(addon.unitsPerQuantity),
    monthlyPrice: String(microsToDollars(addon.monthlyPriceMicros)),
    annualPrice: String(microsToDollars(addon.annualPriceMicros)),
    monthlyCost: String(microsToDollars(addon.monthlyCostMicros ?? 0)),
    annualCost: String(microsToDollars(addon.annualCostMicros ?? 0)),
    isActive: addon.isActive,
  };
}

function toInput(draft: AddonDraft): AddonDefinitionInput {
  return {
    key: draft.key.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    entitlementKind: draft.entitlementKind,
    unitsPerQuantity: Number.parseInt(draft.unitsPerQuantity, 10) || 1,
    monthlyPriceMicros: dollarsToMicros(draft.monthlyPrice),
    annualPriceMicros: dollarsToMicros(draft.annualPrice),
    monthlyCostMicros: dollarsToMicros(draft.monthlyCost),
    annualCostMicros: dollarsToMicros(draft.annualCost),
    isActive: draft.isActive,
  };
}

function usd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function statusChip(addon: AddonDefinition) {
  if (addon.archivedAt) return { label: "arquivado", cls: "bg-muted text-muted-foreground" };
  if (!addon.isActive) return { label: "inativo", cls: "bg-warning text-warning-foreground" };
  return { label: "ativo", cls: "bg-healthy text-healthy-foreground" };
}

const PANEL = "rounded-[--radius] border border-border bg-card";

export function AdminAddonsManager() {
  const { toast } = useToast();
  const [addons, setAddons] = React.useState<AddonDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AddonDraft>(emptyDraft());
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { addons: list, error } = await adminListAddonsAction(true);
    const visible = list.filter((a) => !RETIRED_KINDS.has(a.entitlementKind));
    if (error) {
      toast({ title: "Erro ao carregar addons", description: error, variant: "destructive" });
    } else {
      setAddons(visible);
    }
    setLoading(false);
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function startEdit(addon: AddonDefinition) {
    setEditingId(addon.id);
    setDraft(draftFromAddon(addon));
  }

  function set<K extends keyof AddonDraft>(field: K, value: AddonDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (!draft.key.trim() || !draft.name.trim()) {
      toast({ title: "Preencha a chave e o nome", variant: "destructive" });
      return;
    }
    setSaving(true);
    const input = toInput(draft);
    const result = editingId
      ? await adminUpdateAddonAction(editingId, input)
      : await adminCreateAddonAction(input);
    setSaving(false);
    if (result.error || !result.addon) {
      toast({
        title: "Não foi possível salvar",
        description: result.error ?? "",
        variant: "destructive",
      });
      return;
    }
    toast({ title: editingId ? "Addon atualizado" : "Addon criado" });
    startCreate();
    void load();
  }

  async function archive() {
    if (!editingId) return;
    const { success, error } = await adminArchiveAddonAction(editingId);
    if (!success) {
      toast({ title: "Falha ao arquivar", description: error ?? "", variant: "destructive" });
      return;
    }
    toast({ title: "Addon arquivado" });
    startCreate();
    void load();
  }

  const margin = (addon: AddonDefinition) => addon.monthlyPriceMicros - (addon.monthlyCostMicros ?? 0);

  return (
    <motion.main
      animate={{ opacity: 1 }}
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <DashboardPageHeader
        icon={<PuzzlePiece className="h-6 w-6" weight="fill" />}
        badge="Gerenciar Addons"
        description="Produtos adicionais que o cliente compra e paga pela carteira. Defina preço e custo para acompanhar a margem."
        actions={
          <Button
            icon={<PlusCircle className="h-4 w-4" weight="bold" />}
            iconVisible
            onClick={startCreate}
            title="Novo addon"
            variant="outline"
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <CircleNotch className="h-7 w-7 animate-spin text-lamp-ink" weight="bold" />
            </div>
          ) : addons.length === 0 ? (
            <div
              className={cn(PANEL, "px-4 py-16 text-center")}
              style={{ boxShadow: softSurfaceShadow }}
            >
              <PuzzlePiece className="mx-auto h-9 w-9 text-muted-foreground" weight="fill" />
              <p className="mt-3 text-sm font-medium text-foreground">Nenhum addon cadastrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie o primeiro addon no painel ao lado.
              </p>
            </div>
          ) : (
            addons.map((addon) => {
              const chip = statusChip(addon);
              const isSelected = editingId === addon.id;
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => startEdit(addon)}
                  className={cn(
                    "w-full rounded-[--radius] border p-4 text-left transition-all",
                    isSelected
                      ? "border-primary bg-muted"
                      : "border-border bg-card hover:border-primary/30",
                  )}
                  style={isSelected ? undefined : { boxShadow: softSurfaceShadow }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                        <KindGlyph kind={addon.entitlementKind} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {addon.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {KIND_LABELS[addon.entitlementKind]} · +{addon.unitsPerQuantity}/qtd ·{" "}
                          <span className="font-mono">{addon.key}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-[--radius] px-2.5 py-1 text-[10px] font-semibold uppercase",
                        chip.cls,
                      )}
                    >
                      {chip.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Preço/mês</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {usd(addon.monthlyPriceMicros)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Custo/mês</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {usd(addon.monthlyCostMicros ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Margem/mês</p>
                      <p className="mt-1 font-semibold text-healthy">{usd(margin(addon))}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>

        <section
          className={cn(PANEL, "h-fit space-y-3 rounded-[--radius] p-5")}
          style={{ boxShadow: softSurfaceShadow }}
        >
          <p className="text-xs font-semibold uppercase text-lamp-ink">
            {editingId ? "Editar addon" : "Novo addon"}
          </p>

          <ElevatedInput
            label="Chave (slug única)"
            value={draft.key}
            disabled={editingId != null}
            onChange={(e) => set("key", e.target.value)}
          />
          <ElevatedInput
            label="Nome"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <ElevatedInput
            label="Descrição"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <ElevatedSelect
            label="Tipo de capacidade"
            value={draft.entitlementKind}
            onValueChange={(v) => set("entitlementKind", v as AddonEntitlementKind)}
          >
            <ElevatedSelectItem value="whatsapp_business_phones">
              {KIND_LABELS.whatsapp_business_phones}
            </ElevatedSelectItem>
          </ElevatedSelect>

          <ElevatedInput
            label="Unidades por quantidade"
            type="number"
            min="1"
            value={draft.unitsPerQuantity}
            onChange={(e) => set("unitsPerQuantity", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <ElevatedInput
              label="Preço/mês (USD)"
              type="number"
              min="0"
              value={draft.monthlyPrice}
              onChange={(e) => set("monthlyPrice", e.target.value)}
            />
            <ElevatedInput
              label="Preço/ano (USD)"
              type="number"
              min="0"
              value={draft.annualPrice}
              onChange={(e) => set("annualPrice", e.target.value)}
            />
            <ElevatedInput
              label="Custo/mês (USD)"
              type="number"
              min="0"
              value={draft.monthlyCost}
              onChange={(e) => set("monthlyCost", e.target.value)}
            />
            <ElevatedInput
              label="Custo/ano (USD)"
              type="number"
              min="0"
              value={draft.annualCost}
              onChange={(e) => set("annualCost", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-primary"
              checked={draft.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Ativo (disponível para compra)
          </label>

          <div className="flex gap-2 pt-1">
            {editingId && (
              <Button
                icon={<Archive className="h-4 w-4" weight="bold" />}
                iconVisible
                onClick={archive}
                title="Arquivar"
                variant="outline-subtle"
              />
            )}
            <Button
              className="flex-1"
              disabled={saving}
              icon={
                saving ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : (
                  <FloppyDisk className="h-4 w-4" weight="bold" />
                )
              }
              iconVisible
              onClick={save}
              title={editingId ? "Salvar alterações" : "Criar addon"}
              variant="primary"
            />
          </div>
        </section>
      </div>
    </motion.main>
  );
}

export default AdminAddonsManager;
