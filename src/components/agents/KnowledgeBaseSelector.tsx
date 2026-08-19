"use client";

import { CircleNotch, Files, Plus, Trash } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { KnowledgeBase } from "@/lib/knowledge-base/types";
import Link from "next/link";
import { apiClient } from "@/lib/api/browser-client";
import { useTranslations } from "next-intl";

interface KnowledgeBaseSelectorProps {
  agentId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function KnowledgeBaseSelector({
  selectedIds,
  onChange,
}: KnowledgeBaseSelectorProps) {
  const t = useTranslations("agents.form");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKnowledgeBases = useCallback(async () => {
    const { data, error } = await apiClient<
      KnowledgeBase[] | { data?: KnowledgeBase[] }
    >("/knowledge-bases");
    if (error) {
      console.error("Failed to fetch knowledge bases:", error.message);
    } else if (data) {
      const items = Array.isArray(data) ? data : data.data || [];
      setKnowledgeBases(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const addKnowledgeBase = (id: string) => {
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
  };

  const removeKnowledgeBase = (id: string) => {
    onChange(selectedIds.filter((kbId) => kbId !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <CircleNotch className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("knowledgeBases.loading")}</span>
      </div>
    );
  }

  if (knowledgeBases.length === 0) {
    return (
      <ElevatedContainer className="p-4">
        <div className="text-center space-y-3">
          <Files
            className="h-8 w-8 text-muted-foreground mx-auto"
            weight="fill"
          />
          <p className="text-sm text-muted-foreground">
            {t("knowledgeBases.noKnowledgeBases")}
          </p>
          <Link
            href="/dashboard/knowledge-bases/new"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink hover:underline"
          >
            <Plus className="h-4 w-4" weight="bold" />
            {t("knowledgeBases.createNew")}
          </Link>
        </div>
      </ElevatedContainer>
    );
  }

  const selectedKBs = knowledgeBases.filter((kb) =>
    selectedIds.includes(kb.id),
  );
  const availableKBs = knowledgeBases.filter(
    (kb) => !selectedIds.includes(kb.id),
  );

  return (
    <div className="space-y-4">
      {/* Selected knowledge bases - shown like media items with trash button */}
      {selectedKBs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("knowledgeBases.selected", { count: selectedKBs.length })}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {selectedKBs.map((kb) => (
              <div
                key={kb.id}
                className="group relative flex items-center gap-3 rounded-[--radius] border border-border bg-muted p-3 transition-all hover:border-primary/70 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Files className="h-6 w-6 text-primary-ink" weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {kb.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {kb.description || t("knowledgeBases.selectPlaceholder")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {kb.documentCount || 0} documents
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeKnowledgeBase(kb.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground opacity-0 transition-all hover:bg-destructive group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available knowledge bases to add */}
      {availableKBs.length > 0 && (
        <div className="space-y-2">
          {selectedKBs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("knowledgeBases.available")}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {availableKBs.map((kb) => (
              <button
                key={kb.id}
                type="button"
                onClick={() => addKnowledgeBase(kb.id)}
                className="flex items-start gap-3 rounded-[--radius] border border-border bg-card p-4 text-left transition-all hover:border-border hover:bg-muted"
              >
                <div className="shrink-0 rounded-lg p-2 bg-muted">
                  <Files
                    className="h-5 w-5 text-muted-foreground"
                    weight="fill"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">
                    {kb.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {kb.description || t("knowledgeBases.selectPlaceholder")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kb.documentCount || 0} documents
                  </p>
                </div>
                <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" weight="bold" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/dashboard/knowledge-bases/new"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink hover:underline"
      >
        <Plus className="h-4 w-4" weight="bold" />
        {t("knowledgeBases.createNew")}
      </Link>
    </div>
  );
}
