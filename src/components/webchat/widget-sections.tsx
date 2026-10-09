"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Check, Copy, Eye, EyeSlash, Key, Trash, Warning } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { ConnectNotice } from "@/components/channels/connect-layout";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AllowedOriginsEditor } from "@/components/webchat/allowed-origins-editor";
import { WebchatPreview } from "@/components/webchat/webchat-preview";
import {
  SectionSave,
  WidgetSection,
  useSectionDraft,
  type SaveWidget,
} from "@/components/webchat/widget-section";
import { revealWebchatIdentitySecretAction, rotateWebchatIdentitySecretAction } from "@/app/actions/webchat";
import { toast } from "sonner";
import {
  ATTACHMENT_MAX_MB,
  ATTACHMENT_TYPES,
  IDENTITY_MODES,
  INTAKE_RULES,
  MAX_SHORT_TEXT_LENGTH,
  MAX_WELCOME_MESSAGE_LENGTH,
  WIDGET_POSITIONS,
  checkOrigins,
  isAccentColor,
  isCountryCode,
  isPrivacyPolicyUrl,
  type IdentityMode,
  type IntakeRule,
  type WebchatWidget,
  type WidgetPosition,
} from "@/lib/webchat/types";

interface SectionProps {
  widget: WebchatWidget;
  canUpdate: boolean;
  onSave: SaveWidget;
}

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check weight="bold" className="size-3.5 text-healthy-ink" /> : <Copy className="size-3.5 text-muted-foreground" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export function CodeBlock({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  return (
    <div className="relative rounded-lg border border-border bg-muted">
      <div className="absolute right-2 top-2">
        <CopyButton value={code} label={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <pre className="overflow-x-auto p-4 pr-28 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function InstallSection({ widget }: { widget: WebchatWidget }) {
  const t = useTranslations("webchat.install");
  return (
    <WidgetSection title={t("title")} description={t("description")}>
      {widget.snippet ? (
        <CodeBlock code={widget.snippet} copyLabel={t("copy")} copiedLabel={t("copied")} />
      ) : (
        <ConnectNotice tone="warn">{t("missing")}</ConnectNotice>
      )}
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>{t("steps.copy")}</li>
        <li>{t("steps.paste", { tag: "</body>" })}</li>
        <li>{t("steps.sites")}</li>
        <li>{t("steps.test")}</li>
      </ol>
      {widget.status === "paused" && <ConnectNotice tone="info">{t("pausedNote")}</ConnectNotice>}
    </WidgetSection>
  );
}

export function OriginsSection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.origins");
  const source = widget.allowedOrigins.length > 0 ? widget.allowedOrigins : [""];
  const [rows, setRows, dirty] = useSectionDraft(source);
  const check = checkOrigins(rows);
  return (
    <WidgetSection
      title={t("title")}
      description={t("help")}
      footer={
        <SectionSave
          dirty={dirty}
          valid={check.valid}
          canUpdate={canUpdate}
          onSave={() => onSave({ allowedOrigins: check.origins })}
        />
      }
    >
      <AllowedOriginsEditor rows={rows} onChange={setRows} disabled={!canUpdate} showListIssue={dirty} />
    </WidgetSection>
  );
}

interface AppearanceDraft {
  accentColor: string;
  position: WidgetPosition;
  launcherLabel: string;
  welcomeTitle: string;
  welcomeMessage: string;
  teamName: string;
  assistantName: string;
}

export function AppearanceSection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.appearance");
  const [draft, setDraft, dirty] = useSectionDraft<AppearanceDraft>({
    accentColor: widget.accentColor,
    position: widget.position,
    launcherLabel: widget.launcherLabel ?? "",
    welcomeTitle: widget.welcomeTitle ?? "",
    welcomeMessage: widget.welcomeMessage ?? "",
    teamName: widget.teamName ?? "",
    assistantName: widget.assistantName ?? "",
  });
  const set = <K extends keyof AppearanceDraft>(key: K, value: AppearanceDraft[K]) => setDraft({ ...draft, [key]: value });
  const colorValid = isAccentColor(draft.accentColor);

  const shortField = (key: "launcherLabel" | "welcomeTitle" | "teamName" | "assistantName") => (
    <div className="space-y-1">
      <ElevatedInput
        type="text"
        label={t(`${key}.label`)}
        value={draft[key]}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        disabled={!canUpdate}
        onChange={(e) => set(key, e.target.value)}
        className="w-full"
      />
      <p className="text-2xs leading-relaxed text-muted-foreground">{t(`${key}.hint`)}</p>
    </div>
  );

  return (
    <WidgetSection
      title={t("title")}
      description={t("description")}
      footer={
        <SectionSave
          dirty={dirty}
          valid={colorValid}
          canUpdate={canUpdate}
          onSave={() => onSave({ ...draft, accentColor: draft.accentColor.toUpperCase() })}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-medium text-foreground">{t("accentColor")}</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={t("accentColor")}
                value={colorValid ? draft.accentColor : "#000000"}
                disabled={!canUpdate}
                onChange={(e) => set("accentColor", e.target.value.toUpperCase())}
                className="h-10 w-14 cursor-pointer rounded-[--radius] border border-border bg-background p-1 disabled:cursor-not-allowed"
              />
              <ElevatedInput
                type="text"
                label={t("accentColorHex")}
                value={draft.accentColor}
                maxLength={7}
                disabled={!canUpdate}
                onChange={(e) => set("accentColor", e.target.value)}
                error={colorValid ? undefined : t("accentColorInvalid")}
                controlSize="sm"
                className="w-36"
                inputClassName="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-foreground">{t("position")}</span>
            <ElevatedSegmentedControl
              options={WIDGET_POSITIONS.map((value) => ({ value, label: t(`positions.${value}`) }))}
              value={draft.position}
              onChange={(value) => set("position", value as WidgetPosition)}
              disabled={!canUpdate}
              size="sm"
              className="max-w-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {shortField("launcherLabel")}
            {shortField("teamName")}
            {shortField("assistantName")}
            {shortField("welcomeTitle")}
          </div>

          <div className="space-y-1">
            <ElevatedTextarea
              label={t("welcomeMessage.label")}
              value={draft.welcomeMessage}
              maxLength={MAX_WELCOME_MESSAGE_LENGTH}
              disabled={!canUpdate}
              onChange={(e) => set("welcomeMessage", e.target.value)}
              autoResize
              className="w-full"
            />
            <p className="text-2xs leading-relaxed text-muted-foreground">{t("welcomeMessage.hint")}</p>
          </div>
        </div>

        <WebchatPreview
          name={widget.name}
          accentColor={colorValid ? draft.accentColor : widget.accentColor}
          position={draft.position}
          launcherLabel={draft.launcherLabel}
          welcomeTitle={draft.welcomeTitle}
          welcomeMessage={draft.welcomeMessage}
          teamName={draft.teamName}
          assistantName={draft.assistantName}
        />
      </div>
    </WidgetSection>
  );
}

interface IntakeDraft {
  intakeName: IntakeRule;
  intakeEmail: IntakeRule;
  intakePhone: IntakeRule;
  privacyPolicyUrl: string;
  defaultCountryCode: string;
}

const INTAKE_FIELDS = ["intakeName", "intakeEmail", "intakePhone"] as const;

export function IntakeSection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.intake");
  const [draft, setDraft, dirty] = useSectionDraft<IntakeDraft>({
    intakeName: widget.intakeName,
    intakeEmail: widget.intakeEmail,
    intakePhone: widget.intakePhone,
    privacyPolicyUrl: widget.privacyPolicyUrl ?? "",
    defaultCountryCode: widget.defaultCountryCode,
  });
  const policyValid = isPrivacyPolicyUrl(draft.privacyPolicyUrl);
  const countryValid = isCountryCode(draft.defaultCountryCode);
  const ruleOptions = INTAKE_RULES.map((value) => ({ value, label: t(`rules.${value}`) }));

  return (
    <WidgetSection
      title={t("title")}
      description={t("description")}
      footer={
        <SectionSave
          dirty={dirty}
          valid={policyValid && countryValid}
          canUpdate={canUpdate}
          onSave={() => onSave({ ...draft, privacyPolicyUrl: draft.privacyPolicyUrl.trim() })}
        />
      }
    >
      <div className="space-y-4">
        {INTAKE_FIELDS.map((field) => (
          <div key={field} className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
            <span className="text-sm font-medium text-foreground">{t(`fields.${field}`)}</span>
            <ElevatedSegmentedControl
              options={ruleOptions}
              value={draft[field]}
              onChange={(value) => setDraft({ ...draft, [field]: value as IntakeRule })}
              disabled={!canUpdate}
              size="sm"
            />
          </div>
        ))}
      </div>

      <ConnectNotice tone="info">{t("phoneNote")}</ConnectNotice>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-1">
          <ElevatedInput
            type="url"
            label={t("privacyPolicy.label")}
            value={draft.privacyPolicyUrl}
            disabled={!canUpdate}
            onChange={(e) => setDraft({ ...draft, privacyPolicyUrl: e.target.value })}
            error={policyValid ? undefined : t("privacyPolicy.invalid")}
            className="w-full"
          />
          <p className="text-2xs leading-relaxed text-muted-foreground">{t("privacyPolicy.hint")}</p>
        </div>
        <div className="space-y-1">
          <ElevatedInput
            type="text"
            inputMode="numeric"
            label={t("countryCode.label")}
            value={draft.defaultCountryCode}
            maxLength={3}
            disabled={!canUpdate}
            onChange={(e) => setDraft({ ...draft, defaultCountryCode: e.target.value.replace(/\D/g, "") })}
            error={countryValid ? undefined : t("countryCode.invalid")}
            className="w-full"
          />
          <p className="text-2xs leading-relaxed text-muted-foreground">{t("countryCode.hint")}</p>
        </div>
      </div>
    </WidgetSection>
  );
}

export function ConversationOptionsSection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.conversation");
  const [draft, setDraft, dirty] = useSectionDraft({
    allowHumanRequest: widget.allowHumanRequest,
    allowAttachments: widget.allowAttachments,
  });
  return (
    <WidgetSection
      title={t("title")}
      description={t("description")}
      footer={<SectionSave dirty={dirty} canUpdate={canUpdate} onSave={() => onSave(draft)} />}
    >
      <div className="space-y-4">
        <Switch
          id="webchat-human-request"
          checked={draft.allowHumanRequest}
          disabled={!canUpdate}
          onCheckedChange={(checked) => setDraft({ ...draft, allowHumanRequest: checked })}
          label={t("humanRequest.label")}
          description={t("humanRequest.hint")}
        />
        <Switch
          id="webchat-attachments"
          checked={draft.allowAttachments}
          disabled={!canUpdate}
          onCheckedChange={(checked) => setDraft({ ...draft, allowAttachments: checked })}
          label={t("attachments.label")}
          description={t("attachments.hint", { types: ATTACHMENT_TYPES.join(", "), size: ATTACHMENT_MAX_MB })}
        />
      </div>
    </WidgetSection>
  );
}

const IDENTITY_SERVER_EXAMPLE = `import jwt from "jsonwebtoken";

export function vozkoChatIdentity(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, phone: user.phone },
    process.env.VOZKO_CHAT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" },
  );
}`;

function identityPageExample(snippet: string | undefined, tokenPlaceholder: string): string {
  return `<script>
  window.VozkoChat = { identity: "${tokenPlaceholder}" };
</script>
${snippet ?? '<script async src="..."></script>'}`;
}

export function IdentitySection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.identity");
  const tRoot = useTranslations("webchat");
  const [draft, setDraft, dirty] = useSectionDraft<{ identityMode: IdentityMode }>({ identityMode: widget.identityMode });
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const reveal = async () => {
    setBusy(true);
    const result = await revealWebchatIdentitySecretAction(widget.id);
    setBusy(false);
    if ("error" in result) {
      toast.error(t("revealFailed"), { description: result.error });
      return;
    }
    setSecret(result.identitySecret);
  };

  const rotate = async () => {
    const result = await rotateWebchatIdentitySecretAction(widget.id);
    if ("error" in result) {
      toast.error(t("rotateFailed"), { description: result.error });
      return;
    }
    setSecret(result.identitySecret);
    toast(t("rotated"));
  };

  return (
    <WidgetSection
      title={t("title")}
      description={t("description")}
      footer={<SectionSave dirty={dirty} canUpdate={canUpdate} onSave={() => onSave(draft)} />}
    >
      <ElevatedSegmentedControl
        options={IDENTITY_MODES.map((value) => ({
          value,
          label: t(`modes.${value}.label`),
          description: t(`modes.${value}.hint`),
        }))}
        value={draft.identityMode}
        onChange={(value) => setDraft({ identityMode: value as IdentityMode })}
        disabled={!canUpdate}
        size="sm"
        columns={3}
      />

      {canUpdate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t("secretTitle")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                title={secret ? t("hide") : t("reveal")}
                icon={secret ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                iconVisible
                iconSide="left"
                onClick={() => (secret ? setSecret(null) : void reveal())}
                disabled={busy}
              />
              <Button
                variant="ghost"
                size="sm"
                title={t("rotate")}
                onClick={() => setConfirmRotate(true)}
                disabled={busy}
              />
            </div>
          </div>
          {secret ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-[--radius] bg-muted px-3 py-2 font-mono text-xs text-foreground">
                {secret}
              </code>
              <CopyButton value={secret} label={t("copy")} copiedLabel={t("copied")} />
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">{t("secretHidden")}</p>
          )}
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
            <Warning weight="fill" className="mt-px size-3.5 shrink-0 text-warning-ink" />
            {t("secretWarning")}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("howTitle")}</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("how.sign")}</li>
          <li>{t("how.claims")}</li>
          <li>{t("how.page")}</li>
        </ol>
        <CodeBlock code={IDENTITY_SERVER_EXAMPLE} copyLabel={t("copy")} copiedLabel={t("copied")} />
        <CodeBlock code={identityPageExample(widget.snippet, t("tokenPlaceholder"))} copyLabel={t("copy")} copiedLabel={t("copied")} />
      </div>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={t("rotateConfirmTitle")}
        description={t("rotateConfirmDescription")}
        confirmLabel={t("rotate")}
        cancelLabel={tRoot("common.cancel")}
        tone="default"
        onConfirm={rotate}
      />
    </WidgetSection>
  );
}

export function AvailabilitySection({ widget, canUpdate, onSave }: SectionProps) {
  const t = useTranslations("webchat.availability");
  const [saving, setSaving] = useState(false);
  const active = widget.status === "active";

  const toggle = async (checked: boolean) => {
    setSaving(true);
    await onSave({ status: checked ? "active" : "paused" });
    setSaving(false);
  };

  return (
    <WidgetSection title={t("title")} description={active ? t("activeHint") : t("pausedHint")}>
      <Switch
        id="webchat-status"
        checked={active}
        disabled={!canUpdate || saving}
        onCheckedChange={(checked) => void toggle(checked)}
        label={t("label")}
      />
    </WidgetSection>
  );
}

export function DangerSection({ widget, onDelete }: { widget: WebchatWidget; onDelete: () => Promise<void> }) {
  const t = useTranslations("webchat");
  const [open, setOpen] = useState(false);
  return (
    <WidgetSection title={t("danger.title")} description={t("danger.description")}>
      <div className="flex justify-start">
        <Button
          variant="destructive"
          title={t("danger.delete")}
          icon={<Trash className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => setOpen(true)}
        />
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("danger.confirmTitle")}
        description={t("danger.confirmDescription", { name: widget.name })}
        confirmLabel={t("danger.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={onDelete}
      />
    </WidgetSection>
  );
}
