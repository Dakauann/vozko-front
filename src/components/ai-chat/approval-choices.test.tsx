import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { Approval } from "@/lib/aichat/types";

const listImageModels = vi.fn();
vi.mock("@/app/actions/image-generation", () => ({
  listImageModelsAction: () => listImageModels(),
}));

import { MessageBubble, useBubbleLabels, type UIMessage } from "./message-list";

const message: UIMessage = {
  id: "m1",
  role: "assistant",
  content: "",
  createdAt: "",
  pending: {
    id: "act-1",
    toolName: "generate_image",
    fields: [{ key: "image", value: "pizza artesanal" }],
    choices: [{ key: "image_model", kind: "image_model" }],
    status: "pending",
  },
};

function Bubble({ onApprove }: { onApprove: (id: string, approval?: Approval) => void }) {
  const labels = useBubbleLabels();
  return <MessageBubble elo message={message} live={false} onApprove={onApprove} onReject={vi.fn()} labels={labels} />;
}

function renderBubble(onApprove = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <Bubble onApprove={onApprove} />
    </NextIntlClientProvider>,
  );
  return onApprove;
}

function approveButton() {
  return screen.getByRole("button", { name: "Aprovar" });
}

describe("approval card with an image model choice", () => {
  beforeEach(() => {
    listImageModels.mockReset();
  });

  it("approves with the most popular image model already picked", async () => {
    listImageModels.mockResolvedValue({
      data: [
        { id: "openai/gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst" },
        { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image" },
      ],
    });
    const onApprove = renderBubble();
    expect(screen.getByText(pt.imageGeneration.modelsLoading)).toBeTruthy();
    expect(approveButton()).toBeDisabled();
    await waitFor(() => expect(approveButton()).not.toBeDisabled());
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith("act-1", { choices: { image_model: "openai/gpt-image-2.5-sunburst" } });
  });

  it("cannot be approved while the image models are unavailable", async () => {
    listImageModels.mockResolvedValue({ error: "down", code: "models_unavailable", status: 503 });
    const onApprove = renderBubble();
    expect(await screen.findByRole("alert")).toHaveTextContent(pt.imageGeneration.modelsUnavailable);
    expect(approveButton()).toBeDisabled();
    expect(onApprove).not.toHaveBeenCalled();
  });
});
