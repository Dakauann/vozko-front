"use client";

import type {
  AgentMCPBuiltinBinding,
  AgentMCPCollection,
  AgentMCPCollectionMember,
  AgentMCPRemoteServer,
} from "@/lib/agent-mcp/types";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Pencil, Plus, Trash } from "@/components/icons";
import {
  createMCPCollectionAction,
  deleteMCPCollectionAction,
  listMCPCollectionsAction,
  updateMCPCollectionAction,
} from "@/app/actions/agent-mcp";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface CollectionsTabProps {
  bindings: AgentMCPBuiltinBinding[];
  remotes: AgentMCPRemoteServer[];
}

function memberKey(m: AgentMCPCollectionMember): string {
  return `${m.kind}:${m.refId}`;
}

export default function CollectionsTab({
  bindings,
  remotes,
}: CollectionsTabProps) {
  const t = useTranslations("mcpPage");
  const [items, setItems] = useState<AgentMCPCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentMCPCollection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMCPCollectionsAction();
      if (res.error) toast.error(res.error);
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (c: AgentMCPCollection) => {
      if (!confirm(t("collections.confirmDelete", { name: c.name }))) return;
      const res = await deleteMCPCollectionAction(c.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("collections.deleted"));
      void refresh();
    },
    [refresh, t],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (c: AgentMCPCollection) => {
    setEditing(c);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">
            {t("collections.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("collections.description")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus weight="bold" className="h-4 w-4" />
          {t("collections.createButton")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          {t("collections.loading")}
        </p>
      ) : items.length === 0 ? (
        <ElevatedContainer className="p-6 text-center text-sm text-muted-foreground">
          {t("collections.empty")}
        </ElevatedContainer>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((c) => (
            <ElevatedContainer key={c.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {c.name}
                  </p>
                  {c.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(c)}
                    title={t("collections.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void handleDelete(c)}
                    title={t("collections.delete")}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("collections.memberCount", { count: c.members.length })}
              </p>
            </ElevatedContainer>
          ))}
        </div>
      )}

      <CollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        bindings={bindings}
        remotes={remotes}
        onSaved={() => {
          setDialogOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AgentMCPCollection | null;
  bindings: AgentMCPBuiltinBinding[];
  remotes: AgentMCPRemoteServer[];
  onSaved: () => void;
}

function CollectionDialog({
  open,
  onOpenChange,
  editing,
  bindings,
  remotes,
  onSaved,
}: CollectionDialogProps) {
  const t = useTranslations("mcpPage");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setSelected(new Set((editing?.members ?? []).map(memberKey)));
  }, [open, editing]);

  const connectedBindings = useMemo(
    () => bindings.filter((b) => b.status === "connected"),
    [bindings],
  );
  const connectedRemotes = useMemo(
    () => remotes.filter((r) => r.status === "connected"),
    [remotes],
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    const members: AgentMCPCollectionMember[] = Array.from(selected).map(
      (k) => {
        const [kind, ...rest] = k.split(":");
        return {
          kind: kind as AgentMCPCollectionMember["kind"],
          refId: rest.join(":"),
        };
      },
    );
    if (!name.trim()) {
      toast.error(t("collections.errors.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        members,
      };
      const res = editing
        ? await updateMCPCollectionAction(editing.id, payload)
        : await createMCPCollectionAction(payload);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        editing ? t("collections.updated") : t("collections.created"),
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent>
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>
            {editing
              ? t("collections.editTitle")
              : t("collections.createTitle")}
          </ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("collections.dialogDescription")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("collections.fields.name")}
            </label>
            <ElevatedInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("collections.fields.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("collections.fields.description")}
            </label>
            <ElevatedInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("collections.fields.descriptionPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t("collections.fields.members")}
            </p>
            {connectedBindings.length === 0 && connectedRemotes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("collections.fields.noMembers")}
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {connectedBindings.map((b) => {
                  const key = `builtin:${b.id}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                      />
                      <span className="truncate">
                        {b.label || b.displayName}
                      </span>
                      <span className="ml-auto text-2xs text-muted-foreground">
                        {t("collections.kind.builtin")}
                      </span>
                    </label>
                  );
                })}
                {connectedRemotes.map((r) => {
                  const key = `remote:${r.id}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                      />
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto text-2xs text-muted-foreground">
                        {t("collections.kind.remote")}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ElevatedDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("collections.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("collections.saving") : t("collections.save")}
          </Button>
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
