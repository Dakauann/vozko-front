"use client";

import type { ReactNode } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

const LAYOUT_STORAGE_ID = "crm.classicPanels";

interface CrmClassicPanelsProps {
  desktop: boolean;
  showConversation: boolean;
  inbox: ReactNode;
  conversation: ReactNode;
  info: ReactNode | null;
}

export function CrmClassicPanels({ desktop, showConversation, inbox, conversation, info }: CrmClassicPanelsProps) {
  if (!desktop) {
    return (
      <>
        <div data-tour="live-chat-inbox" className={cn("w-full flex-col border-r border-border", showConversation ? "hidden" : "flex")}>
          {inbox}
        </div>
        <div data-tour="live-chat-conversation" className={cn("relative isolate min-w-0 flex-1 flex-col", showConversation ? "flex" : "hidden")}>
          {conversation}
        </div>
      </>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" autoSaveId={LAYOUT_STORAGE_ID} className="min-h-0 flex-1">
      <ResizablePanel id="inbox" order={1} defaultSize={28} minSize={20} maxSize={42} data-tour="live-chat-inbox" className="flex min-w-0 flex-col">
        {inbox}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="conversation" order={2} minSize={30} data-tour="live-chat-conversation" className="relative isolate flex min-w-0 flex-col">
        {conversation}
      </ResizablePanel>
      {info ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel id="info" order={3} defaultSize={26} minSize={20} maxSize={45} className="flex min-w-0 flex-col">
            {info}
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
