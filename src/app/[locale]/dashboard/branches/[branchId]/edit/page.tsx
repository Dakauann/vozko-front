"use client";

import { ArrowLeft, CircleNotch } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import type { Branch } from "@/lib/branches/types";
import BranchForm from "../../_components/BranchForm";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Prohibit } from "@phosphor-icons/react";
import { getBranchAction } from "@/app/actions/branches";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function EditBranchPage() {
  const t = useTranslations("branchesPage");
  const params = useParams();
  const branchId = String(params.branchId);
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { branch: b, error } = await getBranchAction(branchId);
      if (!active) return;
      if (error || !b) {
        toast({ title: t("toast.genericError"), description: error ?? "", variant: "destructive" });
      } else {
        setBranch(b);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [branchId, toast, t]);

  if (!can("branches", "update")) {
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

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="bold" />
      </div>
    );
  }

  if (!branch) {
    return <Button variant="outline" title={t("detail.back")} icon={<ArrowLeft weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" link="/dashboard/branches" newTab={false} />;
  }

  return <BranchForm mode="edit" branch={branch} />;
}
