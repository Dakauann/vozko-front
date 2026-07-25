"use client";

import {
  CheckCircle,
  Confetti,
  IdentificationBadge,
  Info,
  Storefront,
  Tag,
  Wallet,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState, useTransition } from "react";

import { registerAffiliateAction } from "@/app/actions/affiliate";
import {
  ElevatedStepper,
  ElevatedStepperFooter,
  type ElevatedStepperStep,
} from "@/components/elevated-design/elevated-stepper";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";


const CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/;
const URL_REGEX = /^https?:\/\/.+\..+/i;

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveCodeFromBrand(brand: string): string {
  return normalizeCode(brand).slice(0, 20);
}

const DOMAIN_ERROR_KEYS: Array<{
  pattern: RegExp;
  key: string;
  field?: string;
}> = [
  { pattern: /already registered as an affiliate/i, key: "alreadyAffiliate" },
  { pattern: /code already in use/i, key: "codeTaken", field: "code" },
  { pattern: /invalid affiliate code/i, key: "invalidCode", field: "code" },
  {
    pattern: /invalid brand name/i,
    key: "invalidBrandName",
    field: "brandName",
  },
  {
    pattern: /invalid brand logo url/i,
    key: "invalidBrandLogoUrl",
    field: "brandLogoUrl",
  },
  {
    pattern: /invalid asaas wallet id/i,
    key: "invalidWallet",
    field: "asaasWalletId",
  },
  {
    pattern: /could not validate asaas wallet id/i,
    key: "walletValidationFailed",
    field: "asaasWalletId",
  },
  { pattern: /invalid commission percentage/i, key: "invalidCommission" },
  { pattern: /not authorized/i, key: "unauthorized" },
];

function mapDomainError(raw: string): { key: string; field?: string } | null {
  for (const entry of DOMAIN_ERROR_KEYS) {
    if (entry.pattern.test(raw)) return { key: entry.key, field: entry.field };
  }
  return null;
}


export function BecomeAffiliateForm() {
  const t = useTranslations("affiliatePage.register");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [asaasWalletId, setAsaasWalletId] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);


  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const bn = brandName.trim();
    if (!bn) e.brandName = t("errors.brandName.required");
    else if (bn.length < 3) e.brandName = t("errors.brandName.tooShort");
    else if (bn.length > 128) e.brandName = t("errors.brandName.tooLong");

    const bl = brandLogoUrl.trim();
    if (!bl) e.brandLogoUrl = t("errors.brandLogoUrl.required");
    else if (!URL_REGEX.test(bl))
      e.brandLogoUrl = t("errors.brandLogoUrl.invalid");

    if (!asaasWalletId.trim()) {
      e.asaasWalletId = t("errors.asaasWalletId.required");
    }

    const c = code.trim();
    if (c && !CODE_REGEX.test(c)) {
      e.code = t("errors.code.invalid");
    }
    return e;
  }, [brandName, brandLogoUrl, asaasWalletId, code, t]);

  const isStepValid = useCallback(
    (idx: number): boolean => {
      switch (idx) {
        case 0: // Welcome, always valid
          return true;
        case 1: // Brand
          return !errors.brandName && !errors.brandLogoUrl;
        case 2: // Wallet
          return !errors.asaasWalletId;
        case 3: // Code (optional)
          return !errors.code;
        case 4: // Review, needs all valid
          return Object.keys(errors).length === 0;
        default:
          return true;
      }
    },
    [errors],
  );


  const steps: ElevatedStepperStep[] = useMemo(
    () => [
      {
        id: "welcome",
        title: t("steps.welcome.title"),
        description: t("steps.welcome.description"),
        icon: Info,
      },
      {
        id: "brand",
        title: t("steps.brand.title"),
        description: t("steps.brand.description"),
        icon: Storefront,
      },
      {
        id: "wallet",
        title: t("steps.wallet.title"),
        description: t("steps.wallet.description"),
        icon: Wallet,
      },
      {
        id: "code",
        title: t("steps.code.title"),
        description: t("steps.code.description"),
        icon: Tag,
        optional: true,
      },
      {
        id: "review",
        title: t("steps.review.title"),
        description: t("steps.review.description"),
        icon: CheckCircle,
      },
    ],
    [t],
  );


  const handleNext = useCallback(() => {
    if (step === 1)
      setTouched((p) => ({ ...p, brandName: true, brandLogoUrl: true }));
    if (step === 2) setTouched((p) => ({ ...p, asaasWalletId: true }));
    if (step === 3) setTouched((p) => ({ ...p, code: true }));

    if (!isStepValid(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }, [step, isStepValid, steps.length]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleSubmit = useCallback(() => {
    setTouched({
      brandName: true,
      brandLogoUrl: true,
      asaasWalletId: true,
      code: true,
    });
    setSubmitError(null);
    if (Object.keys(errors).length > 0) {
      setSubmitError(t("toast.validationFailed"));
      toast({
        title: t("toast.validationFailed"),
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await registerAffiliateAction({
        brandName: brandName.trim(),
        brandLogoUrl: brandLogoUrl.trim(),
        asaasWalletId: asaasWalletId.trim(),
        code: code.trim() || undefined,
      });

      if (result.error || !result.affiliate) {
        const raw = result.error ?? "";
        const mapped = raw ? mapDomainError(raw) : null;
        const msg = mapped
          ? t(`domainErrors.${mapped.key}`)
          : raw || t("toast.genericError");
        setSubmitError(msg);
        if (mapped?.field) {
          const fieldToStep: Record<string, number> = {
            brandName: 1,
            brandLogoUrl: 1,
            asaasWalletId: 2,
            code: 3,
          };
          const target = fieldToStep[mapped.field];
          if (target !== undefined) setStep(target);
        }
        toast({
          title: t("toast.errorTitle"),
          description: msg,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("toast.successTitle"),
        description: t("toast.successDescription"),
      });
      router.push("/dashboard/affiliate");
      router.refresh();
    });
  }, [
    brandName,
    brandLogoUrl,
    asaasWalletId,
    code,
    errors,
    toast,
    t,
    router,
    startTransition,
  ]);


  const suggestedCode = useMemo(
    () => deriveCodeFromBrand(brandName),
    [brandName],
  );
  const finalCode = code.trim() ? normalizeCode(code.trim()) : suggestedCode;


  return (
    <div className="space-y-4">
      {submitError ? (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" weight="bold" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("toast.errorTitle")}</p>
            <p className="mt-0.5 text-xs opacity-90">{submitError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            {t("buttons.dismiss")}
          </button>
        </motion.div>
      ) : null}

      <ElevatedStepper
        steps={steps}
        currentStep={step}
        onStepClick={(i) => i < step && setStep(i)}
        footer={
          <ElevatedStepperFooter
            canGoBack={step > 0 && !isPending}
            canGoNext={isStepValid(step)}
            isLast={step === steps.length - 1}
            loading={isPending}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            labels={{
              back: t("buttons.back"),
              next: t("buttons.next"),
              submit: t("buttons.submit"),
            }}
          />
        }
      >
        {step === 0 && <WelcomeStep t={t} />}

        {step === 1 && (
          <div className="space-y-4">
            <FieldWithError
              error={touched.brandName ? errors.brandName : undefined}
            >
              <ElevatedInput
                label={t("fields.brandName.label")}
                placeholder={t("fields.brandName.placeholder")}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, brandName: true }))}
                icon={<Storefront className="h-5 w-5" weight="fill" />}
                autoFocus
              />
            </FieldWithError>
            <FieldWithError
              error={touched.brandLogoUrl ? errors.brandLogoUrl : undefined}
            >
              <ElevatedInput
                label={t("fields.brandLogoUrl.label")}
                placeholder={t("fields.brandLogoUrl.placeholder")}
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, brandLogoUrl: true }))}
                icon={<Tag className="h-5 w-5" weight="fill" />}
                type="url"
                inputMode="url"
              />
            </FieldWithError>
            {brandLogoUrl && !errors.brandLogoUrl ? (
              <LogoPreview url={brandLogoUrl} />
            ) : null}
            <Hint>{t("steps.brand.hint")}</Hint>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <FieldWithError
              error={touched.asaasWalletId ? errors.asaasWalletId : undefined}
            >
              <ElevatedInput
                label={t("fields.asaasWalletId.label")}
                placeholder={t("fields.asaasWalletId.placeholder")}
                value={asaasWalletId}
                onChange={(e) => setAsaasWalletId(e.target.value)}
                onBlur={() =>
                  setTouched((p) => ({ ...p, asaasWalletId: true }))
                }
                icon={<Wallet className="h-5 w-5" weight="fill" />}
                autoFocus
              />
            </FieldWithError>
            <Hint>{t("steps.wallet.hint")}</Hint>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <FieldWithError error={touched.code ? errors.code : undefined}>
              <ElevatedInput
                label={t("fields.code.label")}
                placeholder={suggestedCode || t("fields.code.placeholder")}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onBlur={() => setTouched((p) => ({ ...p, code: true }))}
                icon={<IdentificationBadge className="h-5 w-5" weight="fill" />}
                autoFocus
                maxLength={32}
              />
            </FieldWithError>
            <Hint>{t("steps.code.hint")}</Hint>
            {finalCode ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("steps.code.previewLabel")}
                </p>
                <p className="mt-1 font-mono text-base font-semibold text-foreground">
                  {finalCode}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {step === 4 && (
          <ReviewStep
            t={t}
            brandName={brandName.trim()}
            brandLogoUrl={brandLogoUrl.trim()}
            asaasWalletId={asaasWalletId.trim()}
            code={finalCode}
          />
        )}
      </ElevatedStepper>
    </div>
  );
}


function WelcomeStep({ t }: { t: ReturnType<typeof useTranslations> }) {
  const perks = [
    {
      icon: Confetti,
      title: t("steps.welcome.perks.commission.title"),
      description: t("steps.welcome.perks.commission.description"),
    },
    {
      icon: Wallet,
      title: t("steps.welcome.perks.payout.title"),
      description: t("steps.welcome.perks.payout.description"),
    },
    {
      icon: Tag,
      title: t("steps.welcome.perks.brand.title"),
      description: t("steps.welcome.perks.brand.description"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          {t("steps.welcome.heading")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("steps.welcome.body")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {perks.map((perk) => {
          const Icon = perk.icon;
          return (
            <motion.div
              key={perk.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border bg-background p-4"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-md">
                <Icon className="h-5 w-5" weight="fill" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {perk.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {perk.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({
  t,
  brandName,
  brandLogoUrl,
  asaasWalletId,
  code,
}: {
  t: ReturnType<typeof useTranslations>;
  brandName: string;
  brandLogoUrl: string;
  asaasWalletId: string;
  code: string;
}) {
  const rows = [
    { label: t("fields.brandName.label"), value: brandName },
    {
      label: t("fields.brandLogoUrl.label"),
      value: brandLogoUrl,
      truncate: true,
    },
    {
      label: t("fields.asaasWalletId.label"),
      value: asaasWalletId,
      mono: true,
    },
    {
      label: t("fields.code.label"),
      value: code || t("steps.review.autoCode"),
      mono: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          {t("steps.review.heading")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("steps.review.body")}
        </p>
      </div>

      {brandLogoUrl ? (
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
          <LogoPreview url={brandLogoUrl} compact />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {brandName}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {code}
            </p>
          </div>
        </div>
      ) : null}

      <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:items-center"
          >
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-1">
              {row.label}
            </dt>
            <dd
              className={cn(
                "text-sm text-foreground sm:col-span-2",
                row.truncate && "truncate",
                row.mono && "font-mono",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LogoPreview({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background",
        compact ? "h-14 w-14" : "h-20 w-20",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        weight="bold"
      />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function FieldWithError({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      {children}
      {error ? (
        <p className="pl-4 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

