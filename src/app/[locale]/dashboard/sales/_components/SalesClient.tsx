"use client";

import OpportunityBoard from "@/components/crm/OpportunityBoard";
import { useWorkspace } from "@/contexts/workspace-context";

// Thin client wrapper: resolves the workspace + permission from context and hands
// them to the reusable OpportunityBoard. The board owns its own data + drawer.
export default function SalesClient() {
  const { can, currentWorkspace } = useWorkspace();

  return (
    <div className="-m-3 h-[calc(100vh-3rem)] w-[calc(100%+1.5rem)] overflow-hidden sm:-m-6 sm:w-[calc(100%+3rem)]">
      <OpportunityBoard
        workspaceId={currentWorkspace?.id}
        canEdit={can("conversations", "update")}
      />
    </div>
  );
}
