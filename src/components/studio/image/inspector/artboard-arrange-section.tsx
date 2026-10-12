"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ARTBOARD_GAP } from "@/lib/studio/artboards";
import { arrangeTargets, MAX_ARRANGE_GAP, type ArrangeAlign, type ArrangeLayout, type ArrangeOrder } from "@/lib/studio/artboard-arrange";

import { InspectorSection, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SwitchRow } from "../controls";
import { useImageDoc, useImageEditor } from "../editor-state";

const AUTO_COLUMNS = 0;

export function ArtboardArrangeSection() {
  const t = useTranslations("studio.image.artboards.arrange");
  const { commands } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const selection = useImageDoc((s) => s.selection);
  const [layout, setLayout] = useState<ArrangeLayout>("row");
  const [gap, setGap] = useState(ARTBOARD_GAP);
  const [order, setOrder] = useState<ArrangeOrder>("position");
  const [align, setAlign] = useState<ArrangeAlign>("start");
  const [columns, setColumns] = useState(AUTO_COLUMNS);
  const [bySize, setBySize] = useState(false);
  if (document.artboards.length < 2) return null;
  const targets = arrangeTargets(document, selection);
  const picked = targets.length < document.artboards.length;
  const across = layout === "column";
  return (
    <InspectorSection id="artboard-arrange" title={t("title")} defaultOpen={false}>
      <p className="text-2xs text-muted-foreground">{picked ? t("scopeSelected", { count: targets.length }) : t("scopeAll", { count: targets.length })}</p>
      <SelectField
        label={t("layout")}
        value={layout}
        onChange={setLayout}
        options={[
          { value: "row", label: t("row") },
          { value: "column", label: t("column") },
          { value: "grid", label: t("grid") },
        ]}
      />
      <NumberField label={t("gap")} value={gap} min={0} max={MAX_ARRANGE_GAP} suffix="px" onCommit={(value) => setGap(Math.round(value))} />
      {layout === "grid" ? <NumberField label={t("columns")} value={columns} min={AUTO_COLUMNS} max={targets.length} mixed={columns === AUTO_COLUMNS ? t("columnsAuto") : undefined} onCommit={(value) => setColumns(Math.round(value))} /> : null}
      <SelectField
        label={t("order")}
        value={order}
        onChange={setOrder}
        options={[
          { value: "position", label: t("byPosition") },
          { value: "name", label: t("byName") },
          { value: "given", label: t("byList") },
        ]}
      />
      <SelectField
        label={t("align")}
        value={align}
        onChange={setAlign}
        options={[
          { value: "start", label: across ? t("alignLeft") : t("alignTop") },
          { value: "center", label: t("alignCenter") },
          { value: "end", label: across ? t("alignRight") : t("alignBottom") },
        ]}
      />
      <SwitchRow label={t("bySize")} checked={bySize} onChange={setBySize} />
      <button
        type="button"
        className={OUTLINE_BUTTON_CLASS}
        onClick={() => commands.arrangeArtboards({ layout, gap, order, align, bySize, ...(layout === "grid" && columns !== AUTO_COLUMNS ? { columns } : {}) })}
      >
        {t("apply")}
      </button>
    </InspectorSection>
  );
}
