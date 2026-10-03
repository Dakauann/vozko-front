"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

import { listAdPagesAction } from "@/app/actions/advertising";
import { civilToday } from "@/lib/advertising/date-range";
import type { WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import type { AdAccount, AdPage } from "@/lib/advertising/types";
import type { DraftIssue } from "@/lib/advertising/wizard-issues";

import { useAdsResource, type Resource } from "./use-ads-resource";

export interface WizardContextValue {
  form: WizardForm;
  patch: (changes: Partial<WizardForm>) => void;
  update: (change: (form: WizardForm) => WizardForm) => void;
  account: AdAccount | undefined;
  accounts: AdAccount[];
  options: AdsOptions;
  pages: Resource<AdPage[]> & { reload: () => void };
  page: AdPage | undefined;
  issues: DraftIssue[];
  today: string | null;
  canGenerate: boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export const WizardProvider = WizardContext.Provider;

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) throw new Error("useWizard must be used inside WizardProvider");
  return value;
}

export function useAdPages(accountId: string) {
  return useAdsResource(accountId ? `pages:${accountId}` : null, () => listAdPagesAction(accountId));
}

export function useWizardValue({
  form,
  setForm,
  account,
  accounts,
  options,
  issues,
  canGenerate,
}: {
  form: WizardForm;
  setForm: Dispatch<SetStateAction<WizardForm>>;
  account: AdAccount | undefined;
  accounts: AdAccount[];
  options: AdsOptions;
  issues: DraftIssue[];
  canGenerate: boolean;
}): WizardContextValue {
  const [now] = useState(() => new Date());
  const pages = useAdPages(form.accountId);
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === form.pageId) : undefined;
  return {
    form,
    patch: (changes) => setForm((current) => ({ ...current, ...changes })),
    update: (change) => setForm(change),
    account,
    accounts,
    options,
    pages,
    page,
    issues,
    today: account ? civilToday(account.timezone, now) : null,
    canGenerate,
  };
}
