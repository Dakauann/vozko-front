"use client";

import { useTranslations } from "next-intl";

import { UserCheck } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { LeadOwnerPicker } from "@/components/leads/LeadOwnerPicker";

import { SheetHint, SheetSection } from "./SheetSection";

export function OwnerSection({
  ownerId,
  canAssign,
  ownerName,
  onChange,
}: {
  ownerId: string;
  canAssign: boolean;
  ownerName: (ownerId: string | undefined) => string | null;
  onChange: (ownerId: string) => void;
}) {
  const t = useTranslations("leadSheet.owner");
  const currentName = ownerName(ownerId);

  return (
    <SheetSection icon={<UserCheck />} title={t("title")}>
      {canAssign ? (
        <LeadOwnerPicker ownerId={ownerId} onChange={onChange} />
      ) : (
        <>
          <p className="pl-1 text-sm text-foreground">{currentName ?? (ownerId ? <EmptyValue /> : t("none"))}</p>
          <SheetHint>{t("readOnly")}</SheetHint>
        </>
      )}
    </SheetSection>
  );
}
