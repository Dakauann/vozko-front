"use client";

import { useState } from "react";

import { isActionError } from "@/app/actions/action-result";
import { provisionEmailAction } from "@/app/actions/email-marketing";
import { EmailOnboarding } from "@/components/email-marketing/email-onboarding";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import { useApplyEmailSetup, useEmailPricing } from "@/hooks/use-email-marketing";
import { usePermissionVerdict } from "@/hooks/use-settled-permission";
import type { EmailActivationRefusal, EmailActivationVerdict, EmailSubdomain } from "@/lib/email-marketing/types";

const PLAN_REFUSALS: readonly string[] = ["email_plan_required", "email_plan_unavailable"] satisfies EmailActivationRefusal[];

function planRefusalOf(code: string | undefined): EmailActivationRefusal | null {
  return code && PLAN_REFUSALS.includes(code) ? (code as EmailActivationRefusal) : null;
}

export function EmailActivation({ subdomain, activation }: { subdomain: EmailSubdomain; activation: EmailActivationVerdict }) {
  const describe = useEmailError();
  const pricing = useEmailPricing();
  const canConfigure = usePermissionVerdict("email_marketing", "configure");
  const applySetup = useApplyEmailSetup();
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [refusedByPlan, setRefusedByPlan] = useState<EmailActivationRefusal | null>(null);

  const activate = async (slug: string) => {
    setActivating(true);
    setActivationError(null);
    setRefusedByPlan(null);
    const result = await provisionEmailAction(slug);
    setActivating(false);
    if (isActionError(result)) {
      const planRefusal = planRefusalOf(result.code);
      if (planRefusal) {
        setRefusedByPlan(planRefusal);
        return;
      }
      setActivationError(describe(result));
      return;
    }
    applySetup(result.data);
  };

  return (
    <EmailOnboarding
      pricing={pricing.data}
      pricingError={pricing.isError ? describe(pricing.error) : null}
      subdomain={subdomain}
      canConfigure={canConfigure}
      activating={activating}
      activationError={activationError}
      planRefusal={activation.allowed ? refusedByPlan : (activation.error_code ?? "email_plan_unavailable")}
      onActivate={(slug) => void activate(slug)}
    />
  );
}
