import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { ScreenCommand, ScreenHandler } from "@/lib/aichat/screen";
import type { Block, Document } from "@/lib/email-design/types";

import { EmailEditor } from "../email-editor";
import { blankStarter } from "./fixtures";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const handlers = new Map<string, ScreenHandler>();

vi.mock("@/components/ai-chat/screen-bridge", () => ({
  useScreenHandler: (projectId: string | null, handler: ScreenHandler) => {
    if (projectId) handlers.set(projectId, handler);
  },
  requestScreenStop: () => false,
}));

const designId = "8d6f2b1a-3c4e-4f5a-9b7c-1d2e3f4a5b6c";

function Harness({ initial, seen }: { initial: Document; seen: { current: Document } }) {
  const [document, setDocument] = useState(initial);
  return (
    <NextIntlClientProvider locale="pt" messages={pt}>
      <EmailEditor
        value={document}
        onChange={(next) => {
          seen.current = next;
          setDocument(next);
        }}
        agent={{ surface: "email_design", projectId: designId, name: "Black Friday" }}
      />
    </NextIntlClientProvider>
  );
}

function run(command: Omit<ScreenCommand, "id" | "projectId">) {
  const handler = handlers.get(designId);
  if (!handler) throw new Error("the editor never registered for its design");
  return handler({ id: "cmd-1", projectId: designId, ...command });
}

describe("Elo in the email editor", () => {
  it("answers a read with the live design", async () => {
    const base = blankStarter();
    render(<Harness initial={base} seen={{ current: base }} />);
    await expect(run({ name: "read" })).resolves.toMatchObject({ ok: true, data: { document: base, name: "Black Friday" } });
  });

  it("applies a batch the person undoes in one step", async () => {
    const base = blankStarter();
    const seen = { current: base };
    render(<Harness initial={base} seen={seen} />);
    const title: Block = { id: "heading-1", kind: "heading", heading: { text: "Black Friday", level: 1 } };
    const button: Block = { id: "button-1", kind: "button", button: { label: "Ver ofertas", href: "https://loja.example.com" } };
    const steps = [
      { op: "add", focus: "heading-1", order: ["heading-1", "text", "footer"], blocks: { "heading-1": title } },
      { op: "add", focus: "button-1", order: ["heading-1", "text", "button-1", "footer"], blocks: { "button-1": button } },
    ];
    let reply: Awaited<ReturnType<ScreenHandler>> | undefined;
    await act(async () => {
      reply = await run({ name: "edit", args: { base, steps } });
    });
    expect(reply).toMatchObject({ ok: true, data: { conflicts: [], skipped: [] } });
    expect(seen.current.blocks.map((block) => block.id)).toEqual(["heading-1", "text", "button-1", "footer"]);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(seen.current.blocks.map((block) => block.id)).toEqual(["text", "footer"]);
  });
});
