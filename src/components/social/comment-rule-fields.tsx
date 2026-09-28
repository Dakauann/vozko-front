"use client";

import { ChatCircleDots, EyeSlash, Heart, PaperPlaneTilt, Trash } from "@/components/icons";
import type { Icon } from "@/components/icons";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import Textarea from "@/components/elevated-design/elevated-textarea";
import type { CommentRuleAction, CommentRuleFieldsValue, CommentRuleMatch } from "@/lib/social/comment-rules";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export const RULE_ACTION_ICONS: Record<CommentRuleAction, Icon> = {
  public_reply: ChatCircleDots,
  private_reply: PaperPlaneTilt,
  hide: EyeSlash,
  delete: Trash,
  like: Heart,
};

export function CommentRuleFields({
  value,
  onChange,
  allowedActions,
  translationNamespace,
  disabled,
  className,
}: {
  value: CommentRuleFieldsValue;
  onChange: (next: CommentRuleFieldsValue) => void;
  allowedActions: readonly CommentRuleAction[];
  translationNamespace: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations(translationNamespace);

  const set = <K extends keyof CommentRuleFieldsValue>(key: K, next: CommentRuleFieldsValue[K]) =>
    onChange({ ...value, [key]: next });

  const toggleAction = (action: CommentRuleAction) =>
    set(
      "actions",
      value.actions.includes(action) ? value.actions.filter((a) => a !== action) : [...value.actions, action],
    );

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
          {allowedActions.map((id) => {
            const selected = value.actions.includes(id);
            const Icon = RULE_ACTION_ICONS[id];
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => toggleAction(id)}
                  aria-pressed={selected}
                  disabled={disabled}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-primary-edge bg-muted text-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-primary-ink" : "text-muted-foreground")}
                    weight={selected ? "fill" : "regular"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{t(`action.${id}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`hint.${id}`)}</span>
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
