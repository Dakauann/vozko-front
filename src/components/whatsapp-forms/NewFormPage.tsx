"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createFormAction } from "@/app/actions/whatsapp-forms";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Files, Plus } from "@/components/icons";
import { AccessDenied } from "@/components/ui/access-denied";
import { Notice } from "@/components/ui/notice";
import { useFormAccess, useFormOptions, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { useRouter } from "@/i18n/routing";
import { formBuilderHref, formsListHref } from "@/lib/whatsapp-forms/links";
import type { Starter } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { PhonePreview } from "./builder/PhonePreview";
import { useFormError } from "./use-form-text";

const BLANK = "";

function StarterCard({ starter, picked, onPick }: { starter: Starter; picked: boolean; onPick: () => void }) {
  const t = useTranslations("whatsappForms.new");
  const first = starter.document.screens[0];
  const questions = starter.document.screens.reduce((sum, screen) => sum + screen.blocks.filter((block) => block.field).length, 0);
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        "flex flex-col overflow-hidden rounded-[--radius] border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        picked ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
      )}
    >
      <div aria-hidden className="pointer-events-none h-56 overflow-hidden bg-muted/50 pt-3">
        {first ? (
          <div className="origin-top scale-[0.55]">
            <PhonePreview document={starter.document} screen={first} />
          </div>
        ) : null}
      </div>
      <div className="space-y-1 border-t border-border p-3">
        <p className="text-sm font-semibold text-foreground">{starter.name}</p>
        {starter.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{starter.description}</p> : null}
        <p className="text-2xs text-muted-foreground">{t("shape", { screens: starter.document.screens.length, questions })}</p>
      </div>
    </button>
  );
}

export function NewFormPage() {
  const t = useTranslations("whatsappForms");
  const router = useRouter();
  const access = useFormAccess();
  const options = useFormOptions();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const [picked, setPicked] = useState<string>(BLANK);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!access.create) return <AccessDenied backHref={formsListHref()} />;
  if (options.isPending) return <ScreenLoader fit="fill" />;

  const starters = options.data?.starters ?? [];
  const pickedStarter = starters.find((starter) => starter.key === picked);

  const create = async () => {
    const chosen = name.trim() || pickedStarter?.name || "";
    if (!chosen) {
      toast.error(t("new.nameRequired"));
      return;
    }
    setBusy(true);
    const answer = await createFormAction({ name: chosen, ...(picked ? { starter: picked } : {}) });
    setBusy(false);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    void refresh();
    router.push(formBuilderHref(answer.data.form.id));
  };

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        icon={<Files className="h-6 w-6" />}
        badge={t("new.title")}
        description={t("new.description")}
        back={{ label: t("new.back"), onClick: () => router.push(formsListHref()) }}
      />

      {options.isError ? <Notice tone="fault">{t("common.errorTitle")}</Notice> : null}

      <section aria-label={t("new.gallery")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          aria-pressed={picked === BLANK}
          onClick={() => setPicked(BLANK)}
          className={cn(
            "flex flex-col overflow-hidden rounded-[--radius] border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            picked === BLANK ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
          )}
        >
          <div aria-hidden className="flex h-56 items-center justify-center bg-muted/50 text-muted-foreground">
            <Plus className="h-8 w-8" />
          </div>
          <div className="space-y-1 border-t border-border p-3">
            <p className="text-sm font-semibold text-foreground">{t("new.blank")}</p>
            <p className="text-xs text-muted-foreground">{t("new.blankDescription")}</p>
          </div>
        </button>
        {starters.map((starter) => (
          <StarterCard key={starter.key} starter={starter} picked={picked === starter.key} onPick={() => setPicked(starter.key)} />
        ))}
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-sm">
          <ElevatedInput
            label={t("new.name")}
            placeholder={pickedStarter?.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
          />
        </div>
        <Button variant="primary" title={busy ? t("new.creating") : t("new.create")} disabled={busy} onClick={() => void create()} />
      </div>
    </div>
  );
}
