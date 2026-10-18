"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { MemberCommandSelect } from "@/components/members/MemberCommandSelect";
import { customerLines, type PortfolioRow } from "@/lib/customer-portfolio/portfolio";

import { usePortfolioCommands } from "./use-portfolio-commands";

export function MovePortfolioDialog({ row, onClose }: { row: PortfolioRow; onClose: () => void }) {
  const t = useTranslations("customerPortfolio");
  const { busy, move } = usePortfolioCommands();
  const [holderId, setHolderId] = useState("");
  const excluded = useMemo(() => [row.holderId], [row.holderId]);

  const confirm = async () => {
    if (await move(row.id, holderId)) onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("move.title", { name: customerLines(row).primary })}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("move.description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <MemberCommandSelect
            value={holderId}
            onChange={setHolderId}
            text={{ label: t("member.label"), search: t("member.search"), empty: t("member.empty"), failed: t("member.failed") }}
            excluded={excluded}
            disabled={busy}
          />
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("move.cancel")} onClick={onClose} disabled={busy} />
          <Button variant="primary" title={t("move.confirm")} onClick={() => void confirm()} disabled={busy || holderId === ""} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
