"use client";

import { CircleNotch, Prohibit, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { SipTrunk } from "@/lib/sip-trunks/types";
import SipTrunkForm from "../../_components/SipTrunkForm";
import { getSipTrunkAction } from "@/app/actions/sip-trunks";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function EditSipTrunkPage() {
  const params = useParams();
  const t = useTranslations("sipTrunksPage");
  const trunkId = params.trunkId as string;

  const [trunk, setTrunk] = useState<SipTrunk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { can } = useWorkspace();
  const hasAccess = can("sip_trunks", "update");

  useEffect(() => {
    async function fetchTrunk() {
      setLoading(true);
      try {
        const { trunk: data, error: err } = await getSipTrunkAction(trunkId);
        if (err) {
          setError(err);
        } else {
          setTrunk(data);
        }
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    }

    fetchTrunk();
  }, [trunkId, t]);

  if (!hasAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Prohibit
            weight="fill"
            className="mx-auto mb-4 h-12 w-12 text-red-500"
          />
          <h2 className="text-xl font-semibold text-foreground">
            Acesso Restrito
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("adminOnlyEdit")}
          </p>
        </ElevatedContainer>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <CircleNotch
          weight="bold"
          className="h-8 w-8 animate-spin text-primary"
        />
      </div>
    );
  }

  if (error || !trunk) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Warning
            weight="fill"
            className="mx-auto mb-4 h-12 w-12 text-amber-500"
          />
          <h2 className="text-xl font-semibold text-foreground">
            {t("notFound")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "O trunk solicitado não existe."}
          </p>
          <Button
            variant="outline"
            title={t("actions.back")}
            link="/dashboard/sip-trunks"
            newTab={false}
            className="mt-4 text-[11px] font-semibold uppercase"
          />
        </ElevatedContainer>
      </div>
    );
  }

  return <SipTrunkForm trunk={trunk} mode="edit" />;
}
