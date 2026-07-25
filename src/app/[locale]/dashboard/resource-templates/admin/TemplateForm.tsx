"use client";

import { FloppyDisk, Sparkle } from "@phosphor-icons/react";
import {
  CATEGORY_LABELS,
  RESOURCE_TYPE_LABELS,
  SUBCATEGORY_LABELS,
} from "@/lib/resource-templates/types";
import type {
  CreateTemplatePayload,
  ResourceTemplate,
  ResourceType,
  TemplateCategory,
  TemplateSubcategory,
} from "@/lib/resource-templates/types";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  adminCreateTemplateAction,
  adminGetTemplateAction,
  adminUpdateTemplateAction,
} from "@/app/actions/resource-templates";
import { useEffect, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

interface TemplateFormProps {
  templateId?: string;
}

export default function TemplateForm({ templateId }: TemplateFormProps) {
  const t = useTranslations("resourceTemplates");
  const router = useRouter();
  const isEdit = !!templateId;

  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("agent");
  const [category, setCategory] = useState<TemplateCategory>("retail");
  const [subcategory, setSubcategory] = useState<TemplateSubcategory | "">("");
  const [snapshotId, setSnapshotId] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;

    async function load() {
      setLoadingTemplate(true);
      const result = await adminGetTemplateAction(templateId!);
      if (cancelled) return;
      if (result.error || !result.template) {
        setError(result.error ?? "Template not found");
        setLoadingTemplate(false);
        return;
      }
      const tpl = result.template;
      setName(tpl.name);
      setDescription(tpl.description);
      setResourceType(tpl.resourceType);
      setCategory(tpl.category);
      setSubcategory(tpl.subcategory ?? "");
      setSnapshotId(
        typeof tpl.snapshot === "string"
          ? tpl.snapshot
          : JSON.stringify(tpl.snapshot ?? ""),
      );
      setIconUrl(tpl.icon ?? "");
      setFeatured(tpl.isFeatured);
      setPosition(tpl.position ?? 0);
      setLoadingTemplate(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreateTemplatePayload = {
      name,
      description,
      resourceType,
      category,
      subcategory: subcategory || undefined,
      snapshot: snapshotId || undefined,
      icon: iconUrl || undefined,
      isFeatured: featured,
      position,
    };

    try {
      if (isEdit) {
        const result = await adminUpdateTemplateAction(templateId!, payload);
        if (result.error) {
          setError(result.error);
        } else {
          router.push("/dashboard/resource-templates/admin");
        }
      } else {
        const result = await adminCreateTemplateAction(payload);
        if (result.error) {
          setError(result.error);
        } else {
          router.push("/dashboard/resource-templates/admin");
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/resource-templates/admin"),
            label: t("admin.backButton"),
          }}
          icon={<Sparkle className="h-5 w-5" weight="fill" />}
          badge={isEdit ? t("admin.edit") : t("admin.create")}
          title={isEdit ? t("admin.edit") : t("admin.create")}
          description=""
        />
      </motion.div>

      <motion.form
        variants={itemVariants}
        onSubmit={handleSubmit}
        className="space-y-6 max-w-2xl"
      >
        {error && (
          <div className="rounded-xl border border-red-600 bg-red-500 px-4 py-3 text-sm text-white">
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ElevatedInput
            type="text"
            label={t("form.name")}
            placeholder={t("form.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <ElevatedTextarea
            label={t("form.description")}
            placeholder={t("form.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            autoResize
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ElevatedSelect
              label={t("form.resourceType")}
              value={resourceType}
              onValueChange={(v) => setResourceType(v as ResourceType)}
            >
              {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                <ElevatedSelectItem key={value} value={value}>
                  {label}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>

            <ElevatedSelect
              label={t("form.category")}
              value={category}
              onValueChange={(v) => setCategory(v as TemplateCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <ElevatedSelectItem key={value} value={value}>
                  {label}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>

          <ElevatedSelect
            label={t("form.subcategory")}
            value={subcategory || "__none__"}
            onValueChange={(v) =>
              setSubcategory(
                v === "__none__"
                  ? ("" as TemplateSubcategory)
                  : (v as TemplateSubcategory),
              )
            }
          >
            <ElevatedSelectItem value="__none__">,</ElevatedSelectItem>
            {Object.entries(SUBCATEGORY_LABELS).map(([value, label]) => (
              <ElevatedSelectItem key={value} value={value}>
                {label}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ElevatedInput
            type="text"
            label={t("form.snapshotId")}
            placeholder={t("form.snapshotIdPlaceholder")}
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
          />

          <ElevatedInput
            type="text"
            label={t("form.iconUrl")}
            placeholder={t("form.iconUrlPlaceholder")}
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ElevatedInput
              type="number"
              label={t("form.position")}
              value={String(position)}
              onChange={(e) => setPosition(Number(e.target.value) || 0)}
            />

            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="featured-toggle"
                checked={featured}
                onCheckedChange={setFeatured}
              />
              <label
                htmlFor="featured-toggle"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                {t("form.featured")}
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            title={saving ? t("form.saving") : t("form.save")}
            icon={<FloppyDisk className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          />
        </div>
      </motion.form>
    </motion.main>
  );
}
