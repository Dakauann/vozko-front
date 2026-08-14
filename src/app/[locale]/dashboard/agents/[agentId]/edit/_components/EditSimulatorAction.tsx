"use client";

import { TestTube, X } from "@/components/icons";

import type { Agent } from "@/lib/agents/types";
import AgentSimulatorPanel from "@/components/agents/AgentSimulatorPanel";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The tune-test loop without leaving the edit flow: a header-rack action that
 * opens the compact simulator in a slide-over. Shared by every /edit page so
 * the affordance and the drawer cannot drift between them. It tests the last
 * SAVED version of the agent (the panel says so): edit → save → simulate.
 */
export default function EditSimulatorAction({ agent }: { agent: Agent }) {
    const t = useTranslations("agentSimulator");
    const [open, setOpen] = useState(false);

    return (
        <>
            <ElevatedButton
                variant="outline-subtle"
                title={t("panel.open")}
                icon={<TestTube className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() => setOpen(true)}
            />

            <div
                aria-hidden={!open}
                inert={!open}
                className={cn(
                    "fixed inset-0 z-50",
                    open ? "pointer-events-auto" : "pointer-events-none",
                )}
            >
                <div
                    onClick={() => setOpen(false)}
                    className={cn(
                        "absolute inset-0 bg-foreground/20 transition-opacity duration-200 motion-reduce:transition-none",
                        open ? "opacity-100" : "opacity-0",
                    )}
                />
                <aside
                    aria-label={t("panel.title", { agent: agent.name })}
                    className={cn(
                        "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-200 ease-panel motion-reduce:transition-none",
                        open ? "translate-x-0" : "translate-x-full",
                    )}
                >
                    <div className="flex shrink-0 justify-end border-b border-border px-2 py-1.5">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label={t("rail.close")}
                            className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X className="h-4 w-4" weight="bold" />
                        </button>
                    </div>
                    {/* Mount on open so the panel's session fetches happen lazily. */}
                    {open && <AgentSimulatorPanel agentId={agent.id} agentName={agent.name} />}
                </aside>
            </div>
        </>
    );
}
