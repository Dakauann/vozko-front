import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteGate } from "@/components/access/route-gate";
import type { FeatureCatalog } from "@/lib/access/decide";

let pathname = "/dashboard/funnels";
vi.mock("@/i18n/routing", () => ({
  usePathname: () => pathname,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/brand/circuit", () => ({ CircuitTraces: () => null }));
vi.mock("@/components/brand/light-pool", () => ({ LightPool: () => null }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) =>
    namespace === "errors.upcoming" ? `upcoming.${key}` : values?.feature ? `${key}:${values.feature}` : key,
}));

const workspace = {
  featureCatalog: { status: "ready", features: [] } as FeatureCatalog,
  permissionCatalog: [
    { resource: "stages", actions: ["read"], actionDescriptions: { read: "Visualizar etapas existentes" } },
  ],
  permissionsLoading: false,
  permissionsMap: {} as Record<string, Set<string>>,
  privileged: false,
  systemAdmin: false,
};
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => workspace }));

const funnels = {
  key: "funnels",
  name: "Funis",
  location: "",
  description: "",
  scopes: [],
  capabilities: [
    { key: "funnels.view", description: "", requires: [{ resource: "stages", action: "read" }], managersOnly: false, screens: ["funnels"] },
  ],
};

beforeEach(() => {
  pathname = "/dashboard/funnels";
  workspace.featureCatalog = { status: "ready", features: [funnels] } as FeatureCatalog;
  workspace.permissionsLoading = false;
  workspace.permissionsMap = {};
  workspace.privileged = false;
  workspace.systemAdmin = false;
});

const page = <p>page content</p>;

describe("RouteGate", () => {
  it("renders the page when the capability is held", () => {
    workspace.permissionsMap = { stages: new Set(["read"]) };
    render(<RouteGate>{page}</RouteGate>);
    expect(screen.getByText("page content")).toBeTruthy();
  });

  it("names the missing permission instead of the page", () => {
    render(<RouteGate>{page}</RouteGate>);
    expect(screen.queryByText("page content")).toBeNull();
    expect(screen.getByText("requires:Funis")).toBeTruthy();
    expect(screen.getByText("Visualizar etapas existentes")).toBeTruthy();
  });

  it("shows a skeleton, never the page, while loading", () => {
    workspace.permissionsLoading = true;
    workspace.permissionsMap = { stages: new Set(["read"]) };
    const { container } = render(<RouteGate>{page}</RouteGate>);
    expect(screen.queryByText("page content")).toBeNull();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  it("denies routes nobody registered", () => {
    pathname = "/dashboard/not-registered";
    workspace.privileged = true;
    render(<RouteGate>{page}</RouteGate>);
    expect(screen.queryByText("page content")).toBeNull();
    expect(screen.getByText("title")).toBeTruthy();
  });

  it("denies when the catalog could not be loaded", () => {
    workspace.featureCatalog = { status: "failed" };
    workspace.permissionsMap = { stages: new Set(["read"]) };
    render(<RouteGate>{page}</RouteGate>);
    expect(screen.queryByText("page content")).toBeNull();
  });

  it("opens the Facebook pages for people allowed in", () => {
    pathname = "/dashboard/facebook-pages/connect";
    workspace.privileged = true;
    workspace.systemAdmin = true;
    render(<RouteGate>{page}</RouteGate>);
    expect(screen.getByText("page content")).toBeTruthy();
    expect(screen.queryByText("upcoming.title")).toBeNull();
  });
});
