import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { AssistantContext } from "@/lib/aichat/assistant-context";
import type { ChatAttachment } from "@/lib/aichat/types";

let context: AssistantContext | null = null;
let pathname: string | null = "/en/dashboard/leads";

vi.mock("./assistant-context", () => ({ useAssistantContext: () => context }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { ChatVisionNotice } from "./vision-notice";

const pricing: ModelPricingInfo[] = [
  { id: "lab/blind", name: "Blind", promptPrice: 1, completionPrice: 2, capabilities: ["tools"] },
  { id: "lab/seer-no-tools", name: "Seer without tools", promptPrice: 1, completionPrice: 2, capabilities: ["vision"] },
  { id: "lab/seer", name: "Seer", promptPrice: 1, completionPrice: 2, capabilities: ["vision", "tools"] },
];
const models = pricing.map((p) => p.id);
const image: ChatAttachment = { mediaId: "m1", name: "logo.png", kind: "image", url: "https://cdn/logo.png" };
const studio: AssistantContext = { kind: "studio", view: { surface: "studio", projectId: "p1", projectKind: "image" }, projectName: "Post" };

function Notice({ model = "lab/blind", attachments = [], onModelChange = vi.fn() }: { model?: string; attachments?: ChatAttachment[]; onModelChange?: (id: string) => void }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <ChatVisionNotice model={model} models={models} pricing={pricing} onModelChange={onModelChange} attachments={attachments} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  context = null;
  pathname = "/en/dashboard/leads";
});
afterEach(cleanup);

describe("ChatVisionNotice", () => {
  it("warns before sending an image to a model that cannot see it", () => {
    render(<Notice attachments={[image]} />);
    expect(screen.getByText("This model cannot see images")).toBeTruthy();
    expect(screen.getByText(/The attached image does not reach Elo with this model/)).toBeTruthy();
  });

  it("warns in the Studio, where Elo looks at the canvas", () => {
    context = studio;
    render(<Notice />);
    expect(screen.getByText(/In the Studio, Elo looks at the canvas/)).toBeTruthy();
  });

  it("warns on the advertising screens", () => {
    pathname = "/en/dashboard/advertising/new";
    render(<Notice />);
    expect(screen.getByText(/To review ad creatives/)).toBeTruthy();
  });

  it("switches in one click to the most popular model that sees and uses tools", () => {
    const onModelChange = vi.fn();
    context = studio;
    render(<Notice onModelChange={onModelChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Seer" }));
    expect(onModelChange).toHaveBeenCalledWith("lab/seer");
  });

  it("lets the person continue knowingly", () => {
    render(<Notice attachments={[image]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue anyway" }));
    expect(screen.queryByText("This model cannot see images")).toBeNull();
  });

  it("stays quiet when the model sees or nothing needs vision", () => {
    render(<Notice model="lab/seer" attachments={[image]} />);
    expect(screen.queryByText("This model cannot see images")).toBeNull();
    cleanup();
    render(<Notice />);
    expect(screen.queryByText("This model cannot see images")).toBeNull();
  });
});
