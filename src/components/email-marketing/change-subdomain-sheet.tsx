"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { changeEmailSubdomainAction } from "@/app/actions/email-marketing";
import { SubdomainField, subdomainReady } from "@/components/email-marketing/subdomain-field";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetFooter, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { Notice } from "@/components/ui/notice";
import { useSubdomainCheck } from "@/hooks/use-email-marketing";
import type { EmailSubdomain } from "@/lib/email-marketing/types";

export function ChangeSubdomainSheet({ subdomain, onClose, onChanged }: { subdomain: EmailSubdomain; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("emailMarketing.subdomain");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const [slug, setSlug] = useState(subdomain.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useSubdomainCheck(slug);
  const unchanged = slug === subdomain.slug;

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await changeEmailSubdomainAction(slug);
    setSaving(false);
    if (isActionError(result)) {
      setError(describe(result));
      return;
    }
    toast.success(t("changed", { address: result.data.subdomain.address }));
    onChanged();
    onClose();
  };

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("changeTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("changeDescription")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <form
          id="email-change-subdomain"
          className="space-y-4 px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <SubdomainField value={slug} onChange={setSlug} state={check} />
          {error ? (
            <Notice tone="fault">
              <p>{error}</p>
            </Notice>
          ) : null}
        </form>
        <ElevatedSheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border">
          <Button variant="outline" title={tm("common.cancel")} onClick={onClose} />
          <Button type="submit" form="email-change-subdomain" title={saving ? t("saving") : t("save")} disabled={saving || unchanged || !subdomainReady(check)} />
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
