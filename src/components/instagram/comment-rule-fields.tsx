"use client";

import { ChatCircleDots, EyeSlash, PaperPlaneTilt } from "@phosphor-icons/react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { CommentRuleAction, CommentRuleMatch } from "@/lib/instagram/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * The comment-rule form, shared by the rule dialog and the post composer.
 *
 * Both surfaces configure the same object, so they must ask the same questions
 * in the same order — a rule created while publishing and one created later are
 * the same thing, and two different-looking forms would suggest otherwise.
 *
 * The order is the sentence a marketer says out loud: "when a comment CONTAINS
 * these words, DO these things." Each action reveals its own message field only
 * when selected, so the form never asks for text that goes unused.
 */

export interface CommentRuleFieldsValue {
  match: CommentRuleMatch;
  keywords: string;
  actions: CommentRuleAction[];
  publicText: string;
  privateText: string;
}

/** Validation shared by both surfaces, so they accept exactly the same rules. */
export function commentRuleFieldsErrors(value: CommentRuleFieldsValue) {
  const keywordList = value.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    keywordList,
    needsKeywords: value.match !== "any" && keywordList.length === 0,
    needsPublicText: value.actions.includes("public_reply") && !value.publicText.trim(),
    needsPrivateText: value.actions.includes("private_reply") && !value.privateText.trim(),
    get valid() {
      return (
        value.actions.length > 0 &&
        !this.needsKeywords &&
        !this.needsPublicText &&
        !this.needsPrivateText
      );
    },
  };
}

export function CommentRuleFields({
  value,
  onChange,
  disabled,
  className,
}: {
  value: CommentRuleFieldsValue;
  onChange: (next: CommentRuleFieldsValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("instagram.commentRules");

  const set = <K extends keyof CommentRuleFieldsValue>(
    key: K,
    next: CommentRuleFieldsValue[K],
  ) => onChange({ ...value, [key]: next });

  const toggleAction = (action: CommentRuleAction) =>
    set(
      "actions",
      value.actions.includes(action)
        ? value.actions.filter((a) => a !== action)
        : [...value.actions, action],
    );

  const actionOptions: {
    id: CommentRuleAction;
    label: string;
    hint: string;
    icon: typeof ChatCircleDots;
  }[] = [
    {
      id: "public_reply",
      label: t("action.public_reply"),
      hint: t("hint.public_reply"),
      icon: ChatCircleDots,
    },
    {
      id: "private_reply",
      label: t("action.private_reply"),
      hint: t("hint.private_reply"),
      icon: PaperPlaneTilt,
    },
    { id: "hide", label: t("action.hide"), hint: t("hint.hide"), icon: EyeSlash },
  ];

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">{t("fieldWhen")}</label>
        <ElevatedSegmentedControl
          value={value.match}
          onChange={(v) => set("match", v as CommentRuleMatch)}
          disabled={disabled}
          options={(["contains", "exact", "any"] as CommentRuleMatch[]).map((m) => ({
            value: m,
            label: t(`match.${m}`),
          }))}
        />

        {value.match !== "any" && (
          <div className="pt-2">
            <ElevatedInput
              value={value.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              disabled={disabled}
              placeholder={t("fieldKeywordsPlaceholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("fieldKeywordsHint")}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">{t("fieldActions")}</label>
        <div className="space-y-2">
          {actionOptions.map(({ id, label, hint, icon: Icon }) => {
            const selected = value.actions.includes(id);
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => toggleAction(id)}
                  aria-pressed={selected}
                  disabled={disabled}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                    weight={selected ? "fill" : "regular"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>

                {selected && id === "public_reply" && (
                  <Textarea
                    value={value.publicText}
                    onChange={(e) => set("publicText", e.target.value)}
                    disabled={disabled}
                    rows={2}
                    placeholder={t("fieldPublicTextPlaceholder")}
                    className="mt-2 resize-y"
                  />
                )}
                {selected && id === "private_reply" && (
                  <Textarea
                    value={value.privateText}
                    onChange={(e) => set("privateText", e.target.value)}
                    disabled={disabled}
                    rows={2}
                    placeholder={t("fieldPrivateTextPlaceholder")}
                    className="mt-2 resize-y"
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">{t("variablesHint")}</p>
      </div>
    </div>
  );
}
