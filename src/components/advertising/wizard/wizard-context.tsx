"use client";

import { createContext, useContext } from "react";

import type { WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import type { AdAccount, AdPage } from "@/lib/advertising/types";
import type { DraftIssue } from "@/lib/advertising/wizard-issues";

import type { Resource } from "./use-ads-resource";

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
  blockedAccounts: AdAccount[];
  onAccountUpdated: (account: AdAccount) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export const WizardProvider = WizardContext.Provider;

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) throw new Error("useWizard must be used inside WizardProvider");
  return value;
}
