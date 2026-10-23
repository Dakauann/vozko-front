"use client";

import { useEffect, useState } from "react";

import { getSmartDefaultsAction } from "@/app/actions/whatsapp-campaign-smart";
import { canSaveSmartPolicy, type SmartDefaults, type SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

import { SmartPolicyEditor } from "./SmartPolicyEditor";

type SmartPolicyDraft = {
  policy: SmartPolicy | null;
  setPolicy: (next: SmartPolicy | null) => void;
  defaults: SmartDefaults | null;
  error: string | null;
  blocks: boolean;
  fields: { smartPolicy?: SmartPolicy };
};

export function useSmartPolicyDraft(mode: "create" | "edit", initial: SmartPolicy | null = null): SmartPolicyDraft {
  const [policy, setPolicy] = useState<SmartPolicy | null>(initial);
  const [defaults, setDefaults] = useState<SmartDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "create") return;
    let active = true;
    getSmartDefaultsAction().then((result) => {
      if (!active) return;
      setDefaults(result.defaults);
      setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const enabled = mode === "create" && policy !== null;
  return {
    policy,
    setPolicy,
    defaults,
    error,
    blocks: enabled && !canSaveSmartPolicy(policy),
    fields: enabled ? { smartPolicy: policy } : {},
  };
}

export function SmartCampaignSection({ draft, contacts, startAt }: { draft: SmartPolicyDraft; contacts: number; startAt?: string | null }) {
  return (
    <div className="space-y-2" data-tour="wc-smart">
      {draft.error ? <p role="alert" className="text-sm text-destructive-ink">{draft.error}</p> : null}
      <SmartPolicyEditor value={draft.policy} defaults={draft.defaults} onChange={draft.setPolicy} contacts={contacts} startAt={startAt} />
    </div>
  );
}
