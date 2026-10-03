"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ADVERTISING_PATH } from "@/lib/advertising/connect";
import { parseMultiTarget } from "@/lib/advertising/editor-multi";

import { DraftEditor } from "./draft-editor";
import { MultiObjectEditor } from "./multi-object-editor";
import { PublishedEditor } from "./published-editor";

export function AdsEditorPage() {
  const t = useTranslations("adsEditor");
  const params = useSearchParams();
  const draftId = params.get("draft");
  const objectId = params.get("object");
  const accountId = params.get("account");
  const objects = params.get("objects");
  const multi = parseMultiTarget(objects, accountId);
  if (draftId) return <DraftEditor key={draftId} draftId={draftId} />;
  if (multi) return <MultiObjectEditor key={`${multi.accountId}:${multi.metaIds.join(",")}`} metaIds={multi.metaIds} accountId={multi.accountId} />;
  if (objectId && accountId && objects === null) return <PublishedEditor key={`${accountId}:${objectId}`} metaId={objectId} accountId={accountId} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t(objects === null ? "nothingToEdit" : "multi.invalidSelection")}</p>
      <Button variant="secondary" title={t("toManager")} link={ADVERTISING_PATH} />
    </div>
  );
}
