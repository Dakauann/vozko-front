"use client";

import { useTranslations } from "next-intl";

import { ChoiceRow } from "@/components/elevated-design/choice-row";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { RadioGroup } from "@/components/ui/radio-group";
import { BUTTON_TEXT_LIMIT, FOOTER_TEXT_LIMIT } from "@/lib/whatsapp-templates/builder";
import { EXIT_KINDS, exitWordLabel, offeredKinds } from "@/lib/whatsapp-templates/exit";
import { footerShowsCommand, withExitWord, type LeadExitDraft, type LeadExitMode } from "@/lib/whatsapp-templates/exit-draft";

import { ButtonActionFields } from "./ButtonActionFields";
import { ExitConfirmationField } from "./ExitConfirmationField";
import { ExitWordInput } from "./ExitWordInput";
import { OptOutNotice } from "./OptOutNotice";

type DraftChange = (draft: LeadExitDraft) => void;

function ButtonPlanFields({ draft, onChange, allowedKinds }: { draft: LeadExitDraft; onChange: DraftChange; allowedKinds: readonly string[] }) {
  const t = useTranslations("templateExit.choice");
  return (
    <div className="space-y-3 pl-7">
      <ElevatedInput label={t("buttonText")} value={draft.text} maxLength={BUTTON_TEXT_LIMIT} onChange={(event) => onChange({ ...draft, text: event.target.value })} />
      <ButtonActionFields value={draft.action} kinds={offeredKinds(EXIT_KINDS, allowedKinds)} allowNone={false} onChange={(action) => onChange({ ...draft, action })} />
    </div>
  );
}

function WordPlanFields({ draft, onChange }: { draft: LeadExitDraft; onChange: DraftChange }) {
  const t = useTranslations("templateExit.choice");
  const sentence = (command: string) => t("footerSentence", { command });
  const word = draft.word.trim();
  const missingCommand = word !== "" && draft.footerText.trim() !== "" && !footerShowsCommand(draft.footerText, word);
  return (
    <div className="space-y-3 pl-7">
      <ExitWordInput label={t("wordLabel")} value={draft.word} onChange={(event) => onChange(withExitWord(draft, event.target.value, sentence))} />
      <ElevatedInput
        label={t("footerText")}
        value={draft.footerText}
        maxLength={FOOTER_TEXT_LIMIT}
        onChange={(event) => onChange({ ...draft, footerText: event.target.value })}
      />
      {missingCommand ? <p className="text-xs text-warning-ink">{t("footerNeedsCommand", { command: exitWordLabel(word) })}</p> : null}
      <ExitConfirmationField value={draft.confirmation} onChange={(confirmation) => onChange({ ...draft, confirmation })} />
      <OptOutNotice />
    </div>
  );
}

export function LeadExitChoice({
  draft,
  onChange,
  room,
  allowedKinds,
}: {
  draft: LeadExitDraft;
  onChange: DraftChange;
  room: { button: boolean };
  allowedKinds: readonly string[];
}) {
  const t = useTranslations("templateExit.choice");
  return (
    <RadioGroup value={draft.mode ?? ""} onValueChange={(mode) => onChange({ ...draft, mode: mode as LeadExitMode })} className="grid gap-2">
      <ChoiceRow value="button" title={t("button")} hint={room.button ? t("buttonHint") : t("buttonFull")} disabled={!room.button} />
      {draft.mode === "button" ? <ButtonPlanFields draft={draft} onChange={onChange} allowedKinds={allowedKinds} /> : null}
      <ChoiceRow value="word" title={t("word")} hint={t("wordHint")} />
      {draft.mode === "word" ? <WordPlanFields draft={draft} onChange={onChange} /> : null}
    </RadioGroup>
  );
}
