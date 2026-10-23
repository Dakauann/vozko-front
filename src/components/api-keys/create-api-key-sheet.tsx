"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import { createApiKeyAction } from "@/app/actions/api-keys";
import { useApiKeyError } from "@/components/api-keys/use-api-key-error";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetFooter, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { Notice } from "@/components/ui/notice";
import type { ApiKeyProduct, CreatedApiKey } from "@/lib/api-keys/types";

export function CreateApiKeySheet({
  products,
  onClose,
  onCreated,
}: {
  products: ApiKeyProduct[];
  onClose: () => void;
  onCreated: (key: CreatedApiKey) => void;
}) {
  const t = useTranslations("apiKeys");
  const describe = useApiKeyError();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (scope: string, checked: boolean) => setScopes((current) => (checked ? [...current, scope] : current.filter((s) => s !== scope)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await createApiKeyAction({ name: name.trim(), scopes });
    setSaving(false);
    if (isActionError(result)) {
      setError(describe(result));
      return;
    }
    onCreated(result.data);
  };

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("form.title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("form.description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <form
          id="api-key-form"
          className="space-y-5 px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <ElevatedInput label={t("form.name")} placeholder=" " value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" required />
          <p className="-mt-3 text-xs text-muted-foreground">{t("form.nameHelp")}</p>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">{t("form.scopes")}</legend>
            {products.map((product) => (
              <div key={product.key} className="space-y-2 rounded-[--radius] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.has(`products.${product.key}`) ? t(`products.${product.key}`) : product.key}</p>
                {product.scopes.map((scope) => (
                  <label key={scope.scope} className="flex cursor-pointer items-start gap-3">
                    <Checkbox checked={scopes.includes(scope.scope)} onCheckedChange={(checked) => toggle(scope.scope, checked === true)} aria-label={scope.scope} className="mt-0.5" />
                    <span>
                      <span className="block font-mono text-xs text-foreground">{scope.scope}</span>
                      <span className="block text-xs text-muted-foreground">{t.has(`scopes.${scope.scope}`) ? t(`scopes.${scope.scope}`) : scope.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>

          <Notice tone="info" title={t("form.workspaceTitle")}>
            <p>{t("form.workspaceText")}</p>
          </Notice>

          {error ? (
            <Notice tone="fault" title={t("form.failed")}>
              <p>{error}</p>
            </Notice>
          ) : null}
        </form>
        <ElevatedSheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border">
          <Button variant="outline" title={t("common.cancel")} onClick={onClose} />
          <Button type="submit" form="api-key-form" title={saving ? t("form.creating") : t("form.create")} disabled={saving || name.trim() === "" || scopes.length === 0} />
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
