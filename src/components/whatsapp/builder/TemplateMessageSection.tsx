"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { Notice } from "@/components/ui/notice";
import ComponentEditor, { type FormButtonSource } from "@/components/whatsapp/ComponentEditor";
import DragDropBuilder, { paletteForCategory } from "@/components/whatsapp/DragDropBuilder";
import { DraftExitStrip } from "@/components/whatsapp/exit/DraftExitStrip";
import { LeadExitDialog } from "@/components/whatsapp/exit/LeadExitDialog";
import { computeParameterFormat, type ParameterFormatState } from "@/lib/whatsapp-templates/draft";
import { leadExitPieceUsed, leadExitRoom } from "@/lib/whatsapp-templates/exit-draft";
import { variableFormatOf } from "@/lib/whatsapp-templates/suggestions";

import type { TemplateDraft } from "./use-template-draft";

export const BUILDER_PROBLEMS_ANCHOR = "template-error-anchor-builder";

export function TemplateMessageSection({ draft, forms }: { draft: TemplateDraft; forms?: FormButtonSource }) {
  const t = useTranslations("whatsappTemplates");
  const tExit = useTranslations("templateExit");
  const { components, category, purpose } = draft;
  const exitPieceUsed = leadExitPieceUsed(components);
  const footerText = components.find((c) => c.type === "FOOTER")?.data.text ?? "";
  const formatChip = (
    {
      named: { label: t("new.guidelines.formatNamed"), tone: "outline" },
      positional: { label: t("new.guidelines.formatPositional"), tone: "outline" },
      none: { label: t("new.guidelines.formatNone"), tone: "muted" },
      mixed: { label: t("new.guidelines.formatMixed"), tone: "warning" },
    } satisfies Record<ParameterFormatState, { label: string; tone: StatusChipTone }>
  )[computeParameterFormat(components)];
  const builderErrors = Object.values(draft.problems).filter((message): message is string => Boolean(message));

  return (
    <>
      <PanelSection
        title={t("new.messageTitle")}
        description={t("new.messageHint")}
        legend={t("new.guidelines.formatLabel")}
        actions={<StatusChip tone={formatChip.tone} label={formatChip.label} className="px-2 text-2xs" />}
      >
        <DragDropBuilder
          components={components}
          onChange={draft.setComponents}
          onComponentSelect={draft.setSelected}
          selectedComponentId={draft.selected?.id}
          palette={paletteForCategory(category)}
          pickers={{
            LEAD_EXIT: {
              onPick: () => draft.setChoosingExit(true),
              used: exitPieceUsed,
              hint: exitPieceUsed ? tExit("piece.used") : undefined,
            },
          }}
          renderEditor={(component) => (
            <ComponentEditor
              component={component}
              variableFormat={variableFormatOf(components)}
              onChange={draft.updateComponent}
              category={category}
              allowedKinds={draft.exitVerdict.allowedKinds}
              forms={forms}
              refusedButton={draft.refusedButton}
            />
          )}
        />

        <DraftExitStrip components={components} category={category} purpose={purpose} />
        <span id={BUILDER_PROBLEMS_ANCHOR} aria-hidden />
        {builderErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {builderErrors.map((error) => (
              <Notice key={error} tone="fault">
                {error}
              </Notice>
            ))}
          </div>
        )}
      </PanelSection>
      <LeadExitDialog
        open={draft.choosingExit}
        onOpenChange={draft.setChoosingExit}
        room={leadExitRoom(components)}
        allowedKinds={draft.exitVerdict.allowedKinds}
        footerText={footerText}
        onApply={draft.applyExitPlan}
      />
    </>
  );
}
