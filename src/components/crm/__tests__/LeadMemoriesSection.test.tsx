import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { LeadMemory } from "@/lib/lead-memories/types";
import LeadMemoriesSection from "../LeadMemoriesSection";
import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";

const listAction = vi.fn();
const createAction = vi.fn();
const updateAction = vi.fn();
const deleteAction = vi.fn();

vi.mock("@/app/actions/lead-memories", () => ({
    listLeadMemoriesAction: (...args: unknown[]) => listAction(...args),
    createLeadMemoryAction: (...args: unknown[]) => createAction(...args),
    updateLeadMemoryAction: (...args: unknown[]) => updateAction(...args),
    deleteLeadMemoryAction: (...args: unknown[]) => deleteAction(...args),
}));

function memory(overrides: Partial<LeadMemory> = {}): LeadMemory {
    return {
        id: "11111111-2222-4333-8444-555555555555",
        leadId: "lead-1",
        category: "preference",
        content: "Prefere boleto a PIX.",
        actorKind: "ai",
        actorId: "ai:agent-1",
        actorLabel: "Agente Vendas",
        createdAt: "2026-08-10T12:00:00.000Z",
        updatedAt: "2026-08-10T12:00:00.000Z",
        ...overrides,
    };
}

function renderSection(
    props: Partial<React.ComponentProps<typeof LeadMemoriesSection>> = {},
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <LeadMemoriesSection leadId="lead-1" canManage {...props} />
        </NextIntlClientProvider>,
    );
}

const t = ptMessages.leadMemories;

describe("LeadMemoriesSection", () => {
    beforeEach(() => {
        listAction.mockReset().mockResolvedValue({ memories: [memory()], total: 1 });
        createAction.mockReset().mockResolvedValue({ memory: memory() });
        updateAction.mockReset().mockResolvedValue({ memory: memory() });
        deleteAction.mockReset().mockResolvedValue({});
    });

    // An Instagram/Telegram conversation not yet bridged to a lead: the section
    // must explain itself rather than fetch with an empty id.
    it("explains itself when the conversation has no lead", () => {
        renderSection({ leadId: null });
        expect(screen.getByText(t.noLead)).toBeInTheDocument();
        expect(listAction).not.toHaveBeenCalled();
    });

    it("lists memories with content and attribution", async () => {
        renderSection();
        expect(await screen.findByText("Prefere boleto a PIX.")).toBeInTheDocument();
        // The AI's writes are visible and attributed: that visibility is the
        // feature's safety tripwire.
        expect(screen.getByText(/Agente Vendas/)).toBeInTheDocument();
        expect(listAction).toHaveBeenCalledWith("lead-1", undefined);
    });

    it("falls back to the actor kind when no label resolved", async () => {
        listAction.mockResolvedValue({
            memories: [memory({ actorLabel: undefined })],
            total: 1,
        });
        renderSection();
        expect(await screen.findByText(new RegExp(t.byAi))).toBeInTheDocument();
    });

    it("shows the empty state", async () => {
        listAction.mockResolvedValue({ memories: [], total: 0 });
        renderSection();
        expect(await screen.findByText(t.empty)).toBeInTheDocument();
    });

    it("creates a memory and refetches", async () => {
        listAction.mockResolvedValue({ memories: [], total: 0 });
        renderSection();

        fireEvent.click(await screen.findByText(t.addButton));
        fireEvent.change(screen.getByPlaceholderText(t.addPlaceholder), {
            target: { value: "Esposa se chama Ana." },
        });
        fireEvent.click(screen.getByText(t.saveButton));

        await waitFor(() =>
            expect(createAction).toHaveBeenCalledWith("lead-1", {
                content: "Esposa se chama Ana.",
                category: "other",
            }),
        );
        // Refetch rather than optimistic append: the backend may have
        // deduplicated into an existing memory.
        await waitFor(() => expect(listAction).toHaveBeenCalledTimes(2));
    });

    it("deletes only after the two-step confirm and then refetches", async () => {
        renderSection();
        await screen.findByText("Prefere boleto a PIX.");

        fireEvent.click(screen.getByLabelText(t.deleteButton));
        expect(deleteAction).not.toHaveBeenCalled();

        fireEvent.click(screen.getByLabelText(t.confirmDelete));
        await waitFor(() =>
            expect(deleteAction).toHaveBeenCalledWith("11111111-2222-4333-8444-555555555555"),
        );
        await waitFor(() => expect(listAction).toHaveBeenCalledTimes(2));
    });

    it("hides every mutation affordance without leads:update", async () => {
        renderSection({ canManage: false });
        await screen.findByText("Prefere boleto a PIX.");

        expect(screen.queryByText(t.addButton)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(t.deleteButton)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(t.editButton)).not.toBeInTheDocument();
    });

    it("filters by category and forwards the filter to the API", async () => {
        renderSection();
        await screen.findByText("Prefere boleto a PIX.");

        fireEvent.click(screen.getByText(t.categories.deal));
        await waitFor(() => expect(listAction).toHaveBeenCalledWith("lead-1", "deal"));
    });
});
