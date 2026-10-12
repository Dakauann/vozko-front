import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { StudioProjectCard } from "@/lib/aichat/types";

const create = vi.fn();
let access = "allowed";
let pathname = "/dashboard";

vi.mock("@/hooks/use-studio-project-creator", () => ({ useStudioProjectCreator: () => ({ create, busy: null }) }));
vi.mock("@/hooks/use-access", () => ({ useAccess: () => ({ decideScreen: () => ({ status: access }) }) }));
vi.mock("@/lib/aichat/dock-state", () => ({ openDock: vi.fn() }));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => pathname,
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { StudioProjectCardView, studioOrderFromCard } from "./studio-project-card";

const t = ptMessages.aiChatPage.studioProject;
const order: StudioProjectCard["studioProject"] = {
  kind: "image",
  name: "Promoção de inverno",
  media: [{ mediaId: "m1", url: "https://cdn/m1.png", type: "image" }],
  sizes: [{ width: 1440, height: 1800 }, { width: 1440, height: 2560 }],
};
const created: StudioProjectCard = { kind: "studio_project", studioProject: { ...order, projectId: "p1" } };
const legacy: StudioProjectCard = { kind: "studio_project", studioProject: order };

function renderCard(shown: StudioProjectCard) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StudioProjectCardView card={shown} />
    </NextIntlClientProvider>,
  );
}

describe("StudioProjectCardView", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ ok: true, path: "/dashboard/studio/image/p1", projectId: "p1" });
    access = "allowed";
    pathname = "/dashboard";
  });

  it("links a project Elo already created straight to its editor and never creates another", () => {
    renderCard(created);
    expect(screen.getByText("Promoção de inverno")).toBeTruthy();
    const link = screen.getByRole("link", { name: t.open });
    expect(link.getAttribute("href")).toBe("/dashboard/studio/image/p1");
    fireEvent.click(link);
    expect(create).not.toHaveBeenCalled();
  });

  it("says the project is open only while its editor is the page on screen", () => {
    pathname = "/dashboard/studio/image/p1";
    renderCard(created);
    expect(screen.getByRole("button", { name: t.opened })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("creates the project of an older card only on a tap, with the order the server checked", async () => {
    renderCard(legacy);
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t.open }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({ kind: "image", sizes: order.sizes, media: [{ mediaId: "m1", type: "image" }] });
    await waitFor(() => expect(screen.getByRole("button", { name: t.opened })).toBeTruthy());
  });

  it("shows the reason when an older card cannot create its project", async () => {
    create.mockResolvedValue({ ok: false, error: "imagem ilegível" });
    renderCard(legacy);
    fireEvent.click(screen.getByRole("button", { name: t.open }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("imagem ilegível"));
  });

  it("never offers the editor to someone without access or for an unreadable order", () => {
    access = "denied";
    renderCard(created);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(t.noAccess)).toBeTruthy();
    const broken: StudioProjectCard = { kind: "studio_project", studioProject: { kind: "video", media: [{ mediaId: "x", url: "https://cdn/x", type: "pdf" }] } };
    expect(studioOrderFromCard(broken)).toBeNull();
    expect(studioOrderFromCard({ kind: "studio_project", studioProject: { kind: "video", aspect: "cinema" } })).toBeNull();
  });
});
