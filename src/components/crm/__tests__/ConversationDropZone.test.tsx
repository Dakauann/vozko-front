import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { ConversationDropZone } from "../ConversationDropZone";

function dataTransfer(files: File[]) {
  return {
    files,
    items: files.map((file) => ({ kind: "file", type: file.type, getAsFile: () => file })),
    types: ["Files"],
  };
}

function renderZone(enabled: boolean, onFiles = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ConversationDropZone enabled={enabled} onFiles={onFiles}>
        <p>thread</p>
      </ConversationDropZone>
    </NextIntlClientProvider>,
  );
  return { zone: screen.getByText("thread").parentElement as HTMLElement, onFiles };
}

describe("ConversationDropZone", () => {
  it("hands every dropped file to the composer", async () => {
    const { zone, onFiles } = renderZone(true);
    const files = [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.pdf", { type: "application/pdf" })];

    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: dataTransfer(files) });
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0][0].map((file: File) => file.name)).toEqual(["a.png", "b.pdf"]);
  });

  it("shows where to drop while files are dragged over the thread", async () => {
    const { zone } = renderZone(true);
    await act(async () => {
      fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([new File(["a"], "a.png", { type: "image/png" })]) });
    });
    expect(await screen.findByText(ptMessages.crmComposer.attachments.dropHere)).toBeInTheDocument();
  });

  it("ignores drops when the composer cannot send", async () => {
    const { zone, onFiles } = renderZone(false);
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: dataTransfer([new File(["a"], "a.png", { type: "image/png" })]) });
    });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
