"use client";

import { Warning } from "@/components/icons";
import { useState } from "react";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import type {
  CommentRuleAction,
  CommentRuleMatch,
  InstagramCommentRule,
} from "@/lib/instagram/types";
import { createCommentRuleAction, updateCommentRuleAction } from "@/app/actions/instagram";

import { CommentRuleFields, commentRuleFieldsErrors } from "./comment-rule-fields";
import { useTranslations } from "next-intl";

/**
 * Create or edit one comment rule.
 *
 * The form is ordered as the sentence a marketer would say out loud:
 * "when a comment CONTAINS these words, DO these things." Actions reveal their
 * own message field only when selected, so the form shows exactly what the rule
 * needs and nothing else.
 */
export function InstagramCommentRuleDialog({
  accountId,
  mediaId,
  rule,
  onClose,
  onSaved,
}: {
  accountId: string;
  mediaId?: string;
  rule: InstagramCommentRule | null;
  onClose: () => void;
  onSaved: (rule: InstagramCommentRule) => void;
}) {
  const t = useTranslations("instagram.commentRules");

  const [name, setName] = useState(rule?.name ?? "");
  const [match, setMatch] = useState<CommentRuleMatch>(rule?.match ?? "contains");
  const [keywords, setKeywords] = useState((rule?.keywords ?? []).join(", "));
  const [actions, setActions] = useState<CommentRuleAction[]>(rule?.actions ?? ["private_reply"]);
  const [publicText, setPublicText] = useState(rule?.publicReplyText ?? "");
  const [privateText, setPrivateText] = useState(rule?.privateReplyText ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  // A new rule inherits the post it was opened from; an existing rule keeps its
  // own scope so editing never silently moves it.
  const [scopeToPost, setScopeToPost] = useState(
    rule ? !!rule.igMediaId : !!mediaId,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation comes from the shared helper, so the composer and this dialog
  // accept exactly the same rules.
  const fieldErrors = commentRuleFieldsErrors({
    match,
    keywords,
    actions,
    publicText,
    privateText,
  });
  const invalid = !name.trim() || !fieldErrors.valid;

  const handleSave = async () => {
    if (invalid) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      enabled,
      igMediaId: scopeToPost ? (rule?.igMediaId ?? mediaId ?? "") : "",
      match,
      keywords: fieldErrors.keywordList,
      actions,
      publicReplyText: publicText.trim(),
      privateReplyText: privateText.trim(),
      priority: rule?.priority ?? 0,
    };

    const result = rule
      ? await updateCommentRuleAction(accountId, rule.id, payload)
      : await createCommentRuleAction(accountId, payload);

    setSaving(false);
    if (result.error || !result.rule) {
      setError(result.error ?? t("saveFailed"));
      return;
    }
    onSaved(result.rule);
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{rule ? t("editTitle") : t("createTitle")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-sleek">
          <Field label={t("fieldName")}>
            <ElevatedInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fieldNamePlaceholder")}
            />
          </Field>

          <CommentRuleFields
            value={{ match, keywords, actions, publicText, privateText }}
            onChange={(next) => {
              setMatch(next.match);
              setKeywords(next.keywords);
              setActions(next.actions);
              setPublicText(next.publicText);
              setPrivateText(next.privateText);
            }}
            disabled={saving}
          />

          {(mediaId || rule?.igMediaId) && (
            <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
              <div className="min-w-0 space-y-0.5">
                <span className="text-sm font-medium text-foreground">{t("fieldScope")}</span>
                <p className="text-xs text-muted-foreground">
                  {scopeToPost ? t("fieldScopePost") : t("fieldScopeAccount")}
                </p>
              </div>
              <ElevatedSwitch
                checked={scopeToPost}
                onCheckedChange={setScopeToPost}
                aria-label={t("fieldScope")}
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
            <div className="min-w-0 space-y-0.5">
              <span className="text-sm font-medium text-foreground">{t("fieldEnabled")}</span>
              <p className="text-xs text-muted-foreground">{t("fieldEnabledHint")}</p>
            </div>
            <ElevatedSwitch checked={enabled} onCheckedChange={setEnabled} aria-label={t("fieldEnabled")} />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
              <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button
            title={saving ? t("saving") : t("save")}
            variant="primary"
            disabled={invalid || saving}
            onClick={() => void handleSave()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
