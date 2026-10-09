import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { Approval, PendingAction } from "@/lib/aichat/types";
import type { ModelKind } from "@/lib/media-generation/types";

const listMediaModels = vi.fn();
vi.mock("@/app/actions/media-generation", () => ({
  listMediaModelsAction: (kind: ModelKind) => listMediaModels(kind),
}));

import type { UIMessage } from "@/lib/aichat/ui-message";

import { MessageBubble, useBubbleLabels } from "./message-list";

const imageProposal: PendingAction = {
  id: "act-1",
  toolName: "generate_image",
  fields: [{ key: "image", value: "pizza artesanal" }],
  choices: [{ key: "image_model", kind: "image_model" }],
  status: "pending",
};

const musicProposal: PendingAction = {
  id: "act-2",
  toolName: "generate_music",
  fields: [{ key: "music", value: "samba leve e acústico" }],
  choices: [{ key: "music_model", kind: "music_model", default: "google/lyria-3-clip-preview" }],
  status: "pending",
};

function message(pending: PendingAction): UIMessage {
  return { id: "m1", role: "assistant", content: "", createdAt: "", pending };
}

function Bubble({ pending, onApprove }: { pending: PendingAction; onApprove: (id: string, approval?: Approval) => void }) {
  const labels = useBubbleLabels();
  return <MessageBubble elo message={message(pending)} live={false} onApprove={onApprove} onReject={vi.fn()} labels={labels} />;
}

function renderBubble(pending: PendingAction, onApprove = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <Bubble pending={pending} onApprove={onApprove} />
    </NextIntlClientProvider>,
  );
  return onApprove;
}

function approveButton() {
  return screen.getByRole("button", { name: "Aprovar" });
}

describe("approval card with a model choice", () => {
  beforeEach(() => {
    listMediaModels.mockReset();
  });

  it("approves with the recommended image model already picked", async () => {
    listMediaModels.mockResolvedValue({
      data: [
        { id: "openai/gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst", default: true },
        { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image", default: false },
      ],
    });
    const onApprove = renderBubble(imageProposal);
    expect(screen.getByText(pt.mediaGeneration.modelsLoading.image)).toBeTruthy();
    expect(approveButton()).toBeDisabled();
    await waitFor(() => expect(approveButton()).not.toBeDisabled());
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith("act-1", { choices: { image_model: "openai/gpt-image-2.5-sunburst" } });
  });

  it("cannot be approved while the image models are unavailable", async () => {
    listMediaModels.mockResolvedValue({ error: "down", code: "models_unavailable", status: 503 });
    const onApprove = renderBubble(imageProposal);
    expect(await screen.findByRole("alert")).toHaveTextContent(pt.mediaGeneration.modelsUnavailable.image);
    expect(approveButton()).toBeDisabled();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("offers the music catalog with the model the card recommends", async () => {
    listMediaModels.mockResolvedValue({
      data: [
        { id: "acme/tune-1", name: "Tune 1", default: false },
        { id: "google/lyria-3-clip-preview", name: "Lyria 3 Clip", default: true },
      ],
    });
    const onApprove = renderBubble(musicProposal);
    expect(screen.getByText(pt.mediaGeneration.modelsLoading.music)).toBeTruthy();
    await waitFor(() => expect(approveButton()).not.toBeDisabled());
    expect(listMediaModels).toHaveBeenCalledWith("music");
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith("act-2", { choices: { music_model: "google/lyria-3-clip-preview" } });
  });
});
