"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, PencilSimple, Sliders, Trash, X } from "@/components/icons";

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

import {
  listCustomFieldsAction,
  createCustomFieldAction,
  updateCustomFieldAction,
  deleteCustomFieldAction,
} from "@/app/actions/custom-fields";
import {
  customFieldTypeHasOptions,
  type CustomFieldDefinition,
  type CustomFieldType,
} from "@/lib/crm/custom-fields";
import { cn } from "@/lib/utils";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Sim/Não" },
  { value: "select", label: "Seleção" },
  { value: "multiselect", label: "Seleção múltipla" },
];

// machine key from a label: lowercase, ascii-ish, underscores.
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface CustomFieldManagerProps {
  objectType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

interface DraftField {
  id?: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
}

const emptyDraft: DraftField = {
  key: "",
  label: "",
  type: "text",
  options: [],
  required: false,
};

export default function CustomFieldManager({
  objectType = "opportunity",
  open,
  onOpenChange,
  onChanged,
}: CustomFieldManagerProps) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftField | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { fields: f } = await listCustomFieldsAction(objectType);
    setFields([...f].sort((a, b) => a.position - b.position));
    setLoading(false);
  }, [objectType]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const startCreate = () => setDraft({ ...emptyDraft });
  const startEdit = (f: CustomFieldDefinition) =>
    setDraft({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      options: f.options ?? [],
      required: f.required,
    });

  const handleSave = async () => {
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      toast.error("Informe um rótulo para o campo.");
      return;
    }
    const key = (draft.key || slugify(label)).trim();
    if (!key) {
      toast.error("Não foi possível gerar a chave do campo.");
      return;
    }
    if (customFieldTypeHasOptions(draft.type) && draft.options.filter(Boolean).length === 0) {
      toast.error("Campos de seleção precisam de ao menos uma opção.");
      return;
    }
    setSaving(true);
    const payload = {
      objectType,
      key,
      label,
      type: draft.type,
      options: customFieldTypeHasOptions(draft.type) ? draft.options.filter(Boolean) : undefined,
      required: draft.required,
    };
    const res = draft.id
      ? await updateCustomFieldAction(draft.id, payload)
      : await createCustomFieldAction(payload);
    setSaving(false);
    if (res.error || !res.field) {
      toast.error(res.error ?? "Não foi possível salvar o campo.");
      return;
    }
    toast.success(draft.id ? "Campo atualizado." : "Campo criado.");
    setDraft(null);
    await reload();
    onChanged?.();
  };

  const handleDelete = async (id: string) => {
    const { success, error } = await deleteCustomFieldAction(id);
    if (!success) {
      toast.error(error ?? "Não foi possível excluir o campo.");
      return;
    }
    toast.success("Campo excluído.");
    await reload();
    onChanged?.();
  };

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <ElevatedSheetHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sliders weight="bold" className="h-4 w-4" />
            </span>
            <div>
              <ElevatedSheetTitle className="text-lg">Campos personalizados</ElevatedSheetTitle>
              <ElevatedSheetDescription className="text-xs">
                Defina os atributos que suas oportunidades precisam rastrear.
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {draft ? (
            <DraftForm
              draft={draft}
              setDraft={setDraft}
              onSave={handleSave}
              onCancel={() => setDraft(null)}
              saving={saving}
            />
          ) : (
            <>
              {loading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Carregando...</p>
              ) : fields.length === 0 ? (
                <div className="rounded-[--radius] border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum campo personalizado ainda.</p>
                </div>
              ) : (
                fields.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {f.label}
                        {f.required ? <span className="ml-1 text-destructive-ink">*</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                        <span className="ml-1 font-mono opacity-70">· {f.key}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Editar campo"
                    >
                      <PencilSimple weight="bold" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Excluir campo"
                    >
                      <Trash weight="bold" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {!draft ? (
          <div className="border-t border-border px-6 py-4">
            <ElevatedButton
              variant="primary"
              size="sm"
              title="Novo campo"
              icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
              iconVisible
              onClick={startCreate}
            />
          </div>
        ) : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function DraftForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: DraftField;
  setDraft: (d: DraftField) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const optionsText = useMemo(() => draft.options.join("\n"), [draft.options]);
  const hasOptions = customFieldTypeHasOptions(draft.type);

  return (
    <div className="space-y-4 rounded-[--radius] border border-border bg-card p-4">
      <p className="text-2xs font-semibold text-muted-foreground">
        {draft.id ? "Editar campo" : "Novo campo"}
      </p>
      <ElevatedInput
        id="cf-label"
        label="Rótulo"
        variant="outline"
        controlSize="sm"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        placeholder="Ex.: Segmento, Score, Origem..."
      />
      <div className="space-y-1.5">
        <label className="pl-1 text-sm font-medium text-foreground">Tipo</label>
        <ElevatedSelect
          value={draft.type}
          onValueChange={(v) => setDraft({ ...draft, type: v as CustomFieldType })}
          className="w-full"
          // A field's type is fixed after creation to avoid orphaning stored values.
          disabled={!!draft.id}
        >
          {FIELD_TYPES.map((t) => (
            <ElevatedSelectItem key={t.value} value={t.value}>
              {t.label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>

      {hasOptions ? (
        <div className="space-y-1.5">
          <label className="pl-1 text-sm font-medium text-foreground">
            Opções (uma por linha)
          </label>
          <textarea
            value={optionsText}
            onChange={(e) => setDraft({ ...draft, options: e.target.value.split("\n") })}
            rows={4}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-ring"
            placeholder={"enterprise\nsmb\nstartup"}
          />
        </div>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2.5 pl-1">
        <button
          type="button"
          role="switch"
          aria-checked={draft.required}
          onClick={() => setDraft({ ...draft, required: !draft.required })}
          className={cn(
            "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors",
            draft.required ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              draft.required ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
        <span className="text-sm font-medium text-foreground">Obrigatório</span>
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X weight="bold" className="h-3.5 w-3.5" />
          Cancelar
        </button>
        <ElevatedButton
          variant="primary"
          size="sm"
          title={saving ? "Salvando..." : "Salvar"}
          onClick={onSave}
          disabled={saving || !draft.label.trim()}
        />
      </div>
    </div>
  );
}
