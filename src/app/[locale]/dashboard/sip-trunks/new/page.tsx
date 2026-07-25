"use client";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Prohibit } from "@phosphor-icons/react";
import SipTrunkForm from "../_components/SipTrunkForm";
import { useWorkspace } from "@/contexts/workspace-context";

export default function NewSipTrunkPage() {
  const { can } = useWorkspace();

  if (!can("sip_trunks", "create")) {
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
            Você não tem permissão para criar canais de telefonia nesta área de
            trabalho. Solicite a permissão a um administrador do workspace.
          </p>
        </ElevatedContainer>
      </div>
    );
  }

  return <SipTrunkForm mode="create" />;
}
