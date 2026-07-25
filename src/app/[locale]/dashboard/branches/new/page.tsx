"use client";

import BranchForm from "../_components/BranchForm";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Prohibit } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function NewBranchPage() {
  const t = useTranslations("branchesPage");
  const { can } = useWorkspace();

  if (!can("branches", "create")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Prohibit weight="fill" className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground">{t("restrictedTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("restrictedBody")}</p>
        </ElevatedContainer>
      </div>
    );
  }

  return <BranchForm mode="create" />;
}
