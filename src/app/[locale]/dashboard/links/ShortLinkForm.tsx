"use client";

import { useMemo, useState } from "react";

import {
  CaretDown,
  CaretRight,
  CircleNotch,
  FloppyDisk,
  X,
} from "@/components/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { createLink, updateLink } from "@/app/actions/links";
import type {
  LinkStatus,
  RedirectType,
  ShortLink,
  UpdateShortLinkPayload,
} from "@/lib/links/types";
import { appendUtm } from "@/lib/links/utm";
import { cn } from "@/lib/utils";

interface ShortLinkFormProps {
  mode: "create" | "edit";
  initialData?: ShortLink;
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(local: string): string | undefined {
  const trimmed = local.trim();
  if (trimmed === "") return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function RedirectOption({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-[--radius] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-slate-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-primary" : "border-slate-300",
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}

export default function ShortLinkForm({ mode, initialData }: ShortLinkFormProps) {
  const t = useTranslations("links");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [redirectType, setRedirectType] = useState<RedirectType>(
    initialData?.redirectType ?? "302",
  );
  const [status, setStatus] = useState<LinkStatus>(
    initialData?.status ?? "active",
  );
  const [clearPassword, setClearPassword] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        targetUrl: z
          .string()
          .min(1, t("form.errors.targetRequired"))
          .refine((v) => /^https?:\/\//i.test(v.trim()), {
            message: t("form.errors.targetScheme"),
          }),
        customAlias: z.string().optional(),
        title: z.string().optional(),
        password: z.string().optional(),
        expiresAt: z.string().optional(),
        maxClicks: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        utmTerm: z.string().optional(),
        utmContent: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetUrl: initialData?.targetUrl ?? "",
      customAlias: "",
      title: initialData?.title ?? "",
      password: "",
      expiresAt: isoToLocalInput(initialData?.expiresAt),
      maxClicks: initialData?.maxClicks ? String(initialData.maxClicks) : "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmTerm: "",
      utmContent: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const targetUrl = appendUtm(values.targetUrl, {
        source: values.utmSource,
        medium: values.utmMedium,
        campaign: values.utmCampaign,
        term: values.utmTerm,
        content: values.utmContent,
      });
      const maxClicks = values.maxClicks?.trim()
        ? Number(values.maxClicks)
        : undefined;
      const expiresAt = localInputToIso(values.expiresAt ?? "");

      if (mode === "create") {
        const { error } = await createLink({
          targetUrl,
          customAlias: values.customAlias?.trim() || undefined,
          title: values.title?.trim() || undefined,
          redirectType,
          password: values.password?.trim() || undefined,
          expiresAt,
          maxClicks,
        });
        if (error) throw new Error(error);
        toast.success(t("form.toast.created"));
      } else if (initialData) {
        const payload: UpdateShortLinkPayload = {
          targetUrl,
          title: values.title?.trim() ?? "",
          redirectType,
          status,
        };
        if (values.password?.trim()) {
          payload.password = values.password.trim();
        } else if (clearPassword) {
          payload.clearPassword = true;
        }
        if (expiresAt) {
          payload.expiresAt = expiresAt;
        } else if (initialData.expiresAt) {
          payload.clearExpiry = true;
        }
        if (maxClicks) {
          payload.maxClicks = maxClicks;
        } else if (initialData.maxClicks) {
          payload.clearMaxClicks = true;
        }
        const { error } = await updateLink(initialData.id, payload);
        if (error) throw new Error(error);
        toast.success(t("form.toast.updated"));
      }

      router.push("/dashboard/links");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("form.toast.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <ElevatedContainer className="border border-border" contentClassName="space-y-7">
        <SectionHeader
          title={t("form.sections.destination")}
          hint={t("form.sections.destinationHint")}
        />

        <ElevatedInput
          type="url"
          label={t("form.labels.targetUrl")}
          placeholder="https://exemplo.com/pagina"
          {...register("targetUrl")}
          error={errors.targetUrl?.message}
        />

        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
          <ElevatedInput
            type="text"
            label={t("form.labels.title")}
            placeholder={t("form.placeholders.title")}
            {...register("title")}
            error={errors.title?.message}
          />
          {mode === "create" ? (
            <ElevatedInput
              type="text"
              label={t("form.labels.customAlias")}
              placeholder={t("form.placeholders.customAlias")}
              {...register("customAlias")}
              error={errors.customAlias?.message}
            />
          ) : (
            <ElevatedSelect
              value={status}
              onValueChange={(v) => setStatus(v as LinkStatus)}
              label={t("form.labels.status")}
            >
              <ElevatedSelectItem value="active">
                {t("status.active")}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="inactive">
                {t("status.inactive")}
              </ElevatedSelectItem>
            </ElevatedSelect>
          )}
        </div>

        <div className="space-y-2.5">
          <span className="block text-sm font-medium text-foreground">
            {t("form.labels.redirectType")}
          </span>
          <div className="grid gap-4 sm:grid-cols-2">
            <RedirectOption
              selected={redirectType === "302"}
              title={t("form.redirect.temporary")}
              hint={t("form.redirect.temporaryHint")}
              onSelect={() => setRedirectType("302")}
            />
            <RedirectOption
              selected={redirectType === "301"}
              title={t("form.redirect.permanent")}
              hint={t("form.redirect.permanentHint")}
              onSelect={() => setRedirectType("301")}
            />
          </div>
        </div>
      </ElevatedContainer>

      <ElevatedContainer className="border border-border" contentClassName="space-y-7">
        <SectionHeader
          title={t("form.sections.rules")}
          hint={t("form.sections.rulesHint")}
        />

        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
          <ElevatedInput
            type="datetime-local"
            label={t("form.labels.expiresAt")}
            {...register("expiresAt")}
            error={errors.expiresAt?.message}
          />
          <ElevatedInput
            type="number"
            min={1}
            label={t("form.labels.maxClicks")}
            placeholder={t("form.placeholders.maxClicks")}
            {...register("maxClicks")}
            error={errors.maxClicks?.message}
          />
        </div>

        <div className="space-y-3">
          <ElevatedInput
            type="password"
            autoComplete="new-password"
            label={
              mode === "edit" && initialData?.hasPassword
                ? t("form.labels.passwordChange")
                : t("form.labels.password")
            }
            placeholder={t("form.placeholders.password")}
            {...register("password")}
            error={errors.password?.message}
          />
          {mode === "edit" && initialData?.hasPassword && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={clearPassword}
                onChange={(e) => setClearPassword(e.target.checked)}
                className="h-4 w-4 rounded border-border text-lamp-ink focus-visible:ring-2 focus-visible:ring-ring"
              />
              {t("form.labels.removePassword")}
            </label>
          )}
        </div>
      </ElevatedContainer>

      <ElevatedContainer className="border border-border p-6">
        <button
          type="button"
          onClick={() => setUtmOpen((v) => !v)}
          aria-expanded={utmOpen}
          className="flex w-full items-center justify-between gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {t("form.sections.utm")}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {t("form.sections.utmHint")}
            </span>
          </span>
          {utmOpen ? (
            <CaretDown
              className="h-4 w-4 shrink-0 text-muted-foreground"
              weight="bold"
            />
          ) : (
            <CaretRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              weight="bold"
            />
          )}
        </button>

        {utmOpen && (
          <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2">
            <ElevatedInput type="text" label="utm_source" placeholder="newsletter" {...register("utmSource")} />
            <ElevatedInput type="text" label="utm_medium" placeholder="email" {...register("utmMedium")} />
            <ElevatedInput type="text" label="utm_campaign" placeholder="julho" {...register("utmCampaign")} />
            <ElevatedInput type="text" label="utm_term" placeholder="whatsapp" {...register("utmTerm")} />
            <div className="sm:col-span-2">
              <ElevatedInput type="text" label="utm_content" placeholder="cta_topo" {...register("utmContent")} />
            </div>
          </div>
        )}
      </ElevatedContainer>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          type="button"
          variant="secondary"
          title={t("form.buttons.cancel")}
          icon={<X className="h-4 w-4" weight="bold" />}
          iconVisible
          onClick={() => router.push("/dashboard/links")}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          title={
            mode === "create" ? t("form.buttons.create") : t("form.buttons.save")
          }
          icon={
            isSubmitting ? (
              <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
            ) : (
              <FloppyDisk className="h-4 w-4" weight="bold" />
            )
          }
          iconVisible
        />
      </div>
    </form>
  );
}
