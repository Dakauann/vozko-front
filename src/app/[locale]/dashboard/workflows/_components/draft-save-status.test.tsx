import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { DraftConflictDialog } from "./draft-conflict-dialog";
import { DraftSaveStatusLine } from "./draft-save-status";

const t = ptMessages.workflowsPage.draftSave;
const NOW = new Date("2026-10-20T12:00:00Z");

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC" now={NOW}>
      {children}
    </NextIntlClientProvider>,
  );
}

describe("DraftSaveStatusLine", () => {
  it("says how long ago the draft was saved", () => {
    wrap(<DraftSaveStatusLine status={{ kind: "saved", at: NOW.getTime() - 12_000 }} onRetry={vi.fn()} onResolve={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo há 12 segundos");
  });

  it("says saving while a change waits or is being sent", () => {
    wrap(<DraftSaveStatusLine status={{ kind: "pending" }} onRetry={vi.fn()} onResolve={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.saving);
  });

  it("shows the failure reason with Tentar de novo", () => {
    const onRetry = vi.fn();
    wrap(<DraftSaveStatusLine status={{ kind: "failed", message: "sem conexão", retryable: true }} onRetry={onRetry} onResolve={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Não salvo: sem conexão");
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry for a draft that cannot be saved as it is", () => {
    wrap(<DraftSaveStatusLine status={{ kind: "failed", message: "Adicione um gatilho", retryable: false }} onRetry={vi.fn()} onResolve={vi.fn()} />);
    expect(screen.queryByRole("button", { name: t.retry })).toBeNull();
  });

  it("says plainly that a blocked draft is not saved and why, in full and not as muted text", () => {
    const reason = "O gatilho \"Mensagem recebida\" não é compatível com automações do tipo Voz.";
    wrap(<DraftSaveStatusLine status={{ kind: "failed", message: reason, retryable: false }} onRetry={vi.fn()} onResolve={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(`Não salvo: ${reason}`);
    expect(status).toHaveAttribute("title", `Não salvo: ${reason}`);
    const label = screen.getByText(`Não salvo: ${reason}`);
    expect(label).not.toHaveClass("truncate");
    expect(label.closest(".text-muted-foreground")).toBeNull();
  });

  it("reopens the conflict from the status", () => {
    const onResolve = vi.fn();
    wrap(<DraftSaveStatusLine status={{ kind: "conflict" }} onRetry={vi.fn()} onResolve={onResolve} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.conflict);
    fireEvent.click(screen.getByRole("button", { name: t.resolve }));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it("shows nothing for a new workflow nobody touched", () => {
    wrap(<DraftSaveStatusLine status={{ kind: "idle" }} onRetry={vi.fn()} onResolve={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("DraftConflictDialog", () => {
  it("asks before anything is overwritten and offers reload or overwrite", () => {
    const onReload = vi.fn();
    const onOverwrite = vi.fn();
    wrap(<DraftConflictDialog open canOverwrite onReload={onReload} onOverwrite={onOverwrite} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent(t.conflictTitle);
    fireEvent.click(screen.getByRole("button", { name: t.reload }));
    fireEvent.click(screen.getByRole("button", { name: t.overwrite }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });

  it("does not offer overwrite when the stored revision is unknown", () => {
    wrap(<DraftConflictDialog open canOverwrite={false} onReload={vi.fn()} onOverwrite={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: t.overwrite })).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(t.overwriteUnavailable);
  });

  it("is not shown while closed", () => {
    wrap(<DraftConflictDialog open={false} canOverwrite onReload={vi.fn()} onOverwrite={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
