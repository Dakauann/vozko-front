import { describe, expect, it } from "vitest";

import type { Feature, PermissionEntry } from "@/lib/workspace/types";

import { type AccessState, decidePath, decideScreen, screenCapability } from "./decide";

const features: Feature[] = [
  {
    key: "funnels",
    name: "Funis",
    location: "Menu lateral › Funis",
    description: "",
    scopes: [],
    capabilities: [
      { key: "funnels.view", description: "Ver os funis", requires: [{ resource: "stages", action: "read" }], managersOnly: false, screens: ["funnels"] },
      { key: "funnels.edit", description: "Editar", requires: [{ resource: "stages", action: "update" }], managersOnly: false, screens: [] },
    ],
  },
  {
    key: "business_phones",
    name: "Telefones",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      { key: "business_phones.connect", description: "Conectar", requires: [], managersOnly: true, screens: ["business_phone_connect"] },
    ],
  },
  {
    key: "team",
    name: "Equipe",
    location: "",
    description: "",
    scopes: [],
    capabilities: [{ key: "team.workspace", description: "", requires: [], managersOnly: false, screens: ["workspace"] }],
  },
];

function member(held: PermissionEntry[], overrides: Partial<AccessState> = {}): AccessState {
  const keys = new Set(held.map((p) => `${p.resource}:${p.action}`));
  return {
    catalog: { status: "ready", features },
    permissionsLoading: false,
    privileged: false,
    systemAdmin: false,
    has: (p) => keys.has(`${p.resource}:${p.action}`),
    ...overrides,
  };
}

const readStages = { resource: "stages", action: "read" } as const;

describe("decideScreen", () => {
  it("opens a screen when every requirement of its capability is held", () => {
    expect(decideScreen("funnels", member([readStages]))).toEqual({ status: "allowed" });
  });

  it("never needs an action permission to see a screen", () => {
    expect(decideScreen("funnels", member([readStages])).status).toBe("allowed");
  });

  it("names what is missing", () => {
    const decision = decideScreen("funnels", member([]));
    expect(decision.status).toBe("denied");
    if (decision.status === "denied") {
      expect(decision.missing).toEqual([readStages]);
      expect(decision.feature?.name).toBe("Funis");
    }
  });

  it("keeps manager-only screens closed to members, even with no requirements", () => {
    const decision = decideScreen("business_phone_connect", member([]));
    expect(decision.status).toBe("denied");
    if (decision.status === "denied") expect(decision.managersOnly).toBe(true);
  });

  it("opens capabilities without requirements to every member", () => {
    expect(decideScreen("workspace", member([])).status).toBe("allowed");
  });

  it("lets owners and admins through every registered screen", () => {
    expect(decideScreen("business_phone_connect", member([], { privileged: true })).status).toBe("allowed");
    expect(decideScreen("funnels", member([], { privileged: true, catalog: { status: "failed" } })).status).toBe("allowed");
  });

  it("waits while permissions or the catalog load", () => {
    expect(decideScreen("funnels", member([readStages], { permissionsLoading: true })).status).toBe("loading");
    expect(decideScreen("funnels", member([readStages], { catalog: { status: "loading" } })).status).toBe("loading");
    expect(decideScreen("funnels", member([], { privileged: true, permissionsLoading: true })).status).toBe("loading");
  });

  it("fails closed when the catalog is unavailable or does not know the screen", () => {
    expect(decideScreen("funnels", member([readStages], { catalog: { status: "failed" } })).status).toBe("denied");
    expect(decideScreen("sales", member([readStages])).status).toBe("denied");
  });
});

describe("decidePath", () => {
  it("routes screens through their capability", () => {
    expect(decidePath("/dashboard/funnels", member([readStages])).status).toBe("allowed");
    expect(decidePath("/dashboard/funnels", member([])).status).toBe("denied");
  });

  it("denies unknown routes", () => {
    expect(decidePath("/dashboard/secret", member([], { privileged: true })).status).toBe("denied");
  });

  it("opens personal pages to everyone signed in", () => {
    expect(decidePath("/dashboard/profile", member([])).status).toBe("allowed");
  });

  it("keeps platform pages for platform admins", () => {
    expect(decidePath("/dashboard/users", member([], { privileged: true })).status).toBe("denied");
    expect(decidePath("/dashboard/users", member([], { systemAdmin: true })).status).toBe("allowed");
  });

  it("keeps manager pages for owners and admins once the workspace is known", () => {
    expect(decidePath("/dashboard/affiliate", member([])).status).toBe("denied");
    expect(decidePath("/dashboard/affiliate", member([], { privileged: true })).status).toBe("allowed");
    expect(decidePath("/dashboard/affiliate", member([], { privileged: true, permissionsLoading: true })).status).toBe("loading");
  });
});

describe("screenCapability", () => {
  it("finds the capability and feature that open a screen", () => {
    const found = screenCapability(features, "funnels");
    expect(found?.capability.key).toBe("funnels.view");
    expect(found?.feature.key).toBe("funnels");
    expect(screenCapability(features, "sales")).toBeNull();
  });
});

describe("released channels", () => {
  const facebook: Feature = {
    key: "facebook",
    name: "Facebook",
    location: "",
    description: "",
    scopes: [],
    capabilities: [{ key: "facebook.view", description: "", requires: [], managersOnly: false, screens: ["facebook_pages", "facebook_connect"] }],
  };

  it("open Facebook through its capability, like every other channel", () => {
    const catalog = { status: "ready" as const, features: [...features, facebook] };
    expect(decideScreen("facebook_pages", member([], { catalog })).status).toBe("allowed");
    expect(decidePath("/dashboard/facebook-pages/123", member([], { catalog, privileged: true })).status).toBe("allowed");
    expect(decideScreen("facebook_pages", member([], { permissionsLoading: true })).status).toBe("loading");
  });
});
