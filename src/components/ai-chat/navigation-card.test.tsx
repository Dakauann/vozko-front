import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { FeatureCatalog } from "@/lib/access/decide";

const workspace = vi.hoisted(() => ({
  featureCatalog: { status: "ready", features: [] } as unknown as FeatureCatalog,
  permissionCatalog: [],
  permissionsLoading: false,
  permissionsMap: {} as Record<string, Set<string>>,
  privileged: false,
  systemAdmin: false,
  can: () => false,
  currentWorkspace: { id: "ws-1" },
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => workspace }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/routing", () => ({
  useRouter: () => router,
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { ActionCardView } from "./action-card";

const agents = {
  key: "agents",
  name: "Agentes",
  location: "Menu lateral › Agentes",
  description: "",
  scopes: [],
  capabilities: [
    {
      key: "agents.details",
      description: "",
      requires: [
        { resource: "agents", action: "read" },
        { resource: "agents", action: "read_details" },
      ],
      managersOnly: false,
      screens: ["agent_detail"],
    },
  ],
};

const facebook = {
  key: "facebook",
  name: "Facebook",
  location: "Menu lateral › Facebook",
  description: "",
  scopes: [],
  capabilities: [{ key: "facebook.pages", description: "", requires: [], managersOnly: false, screens: ["facebook_pages"] }],
};

const navigation = ptMessages.aiChatPage.navigation;

function renderCard(screenKey: string, params?: Record<string, string>, live = false) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ActionCardView card={{ kind: "open_screen", destination: { screen: screenKey, params } }} live={live} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  router.push.mockClear();
  workspace.featureCatalog = { status: "ready", features: [agents] } as unknown as FeatureCatalog;
  workspace.permissionsMap = { agents: new Set(["read", "read_details"]) };
  workspace.permissionsLoading = false;
});

describe("navigation card", () => {
  it("links to the screen resolved from its key and params", () => {
    renderCard("agent_detail", { agentId: "7b1c2f9e" });
    expect(screen.getByText("Agentes")).toBeTruthy();
    expect(screen.getByRole("link", { name: navigation.open }).getAttribute("href")).toBe("/dashboard/agents/7b1c2f9e");
  });

  it("offers no link when the user cannot open the screen", () => {
    workspace.permissionsMap = { agents: new Set(["read"]) };
    renderCard("agent_detail", { agentId: "7b1c2f9e" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(navigation.noAccess)).toBeTruthy();
  });

  it("says an unreleased screen is coming soon and never opens it", () => {
    workspace.featureCatalog = { status: "ready", features: [agents, facebook] } as unknown as FeatureCatalog;
    localStorage.setItem("ai-chat:auto-open-screens", "on");
    renderCard("facebook_pages", undefined, true);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(navigation.upcoming)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("waits for permissions before linking", () => {
    workspace.permissionsLoading = true;
    renderCard("agent_detail", { agentId: "7b1c2f9e" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(navigation.checking)).toBeTruthy();
  });

  it("renders nothing for unknown screens or unsafe params", () => {
    const unknown = renderCard("nowhere");
    expect(unknown.container.textContent).toBe("");
    unknown.unmount();
    const unsafe = renderCard("agent_detail", { agentId: "../admin" });
    expect(unsafe.container.textContent).toBe("");
  });
});

describe("opening screens automatically", () => {
  it("asks the first time and remembers the answer", () => {
    renderCard("agent_detail", { agentId: "7b1c2f9e" }, true);
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: navigation.autoOpenYes }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/agents/7b1c2f9e");
    expect(localStorage.getItem("ai-chat:auto-open-screens")).toBe("on");
  });

  it("opens a live card on its own once allowed", () => {
    localStorage.setItem("ai-chat:auto-open-screens", "on");
    renderCard("agent_detail", { agentId: "7b1c2f9e" }, true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("never opens a card replayed from history", () => {
    localStorage.setItem("ai-chat:auto-open-screens", "on");
    renderCard("agent_detail", { agentId: "7b1c2f9e" }, false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("never opens a screen the person cannot open", () => {
    localStorage.setItem("ai-chat:auto-open-screens", "on");
    workspace.permissionsMap = { agents: new Set(["read"]) };
    renderCard("agent_detail", { agentId: "7b1c2f9e" }, true);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: navigation.autoOpenYes })).toBeNull();
  });

  it("keeps only the button after the person says no, and the switch changes it later", () => {
    renderCard("agent_detail", { agentId: "7b1c2f9e" }, true);
    fireEvent.click(screen.getByRole("button", { name: navigation.autoOpenNo }));
    expect(router.push).not.toHaveBeenCalled();
    const toggle = screen.getByRole("switch", { name: navigation.autoOpen });
    fireEvent.click(toggle);
    expect(localStorage.getItem("ai-chat:auto-open-screens")).toBe("on");
  });
});
