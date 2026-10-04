import { describe, expect, it } from "vitest";

import {
  autofillValue,
  buildCreatePayload,
  buildUpdatePayload,
  canLinkPreset,
  capabilitySummary,
  initialRoleSource,
  isPermissionEditingLocked,
  knownPermissions,
  matchingPreset,
  permissionDiff,
  presetPermissions,
  presetRisks,
  roleSaveError,
  samePermissions,
  saveBlocker,
  shouldConfirmReplace,
  sourceForChosenPreset,
  type PermissionMap,
  type RoleDraft,
} from "./role-presets";
import type { AvailablePermission, Feature, PermissionEntry, RolePreset } from "./types";

const available: AvailablePermission[] = [
  { resource: "conversations", actions: ["read", "send", "view_others"] },
  {
    resource: "whatsapp_campaigns",
    actions: ["read", "start"],
    risks: {
      start: [
        { kind: "spends_balance", level: "high", description: "" },
        { kind: "contacts_customers", level: "high", description: "" },
      ],
    },
  },
  {
    resource: "call_recordings",
    actions: ["read"],
    risks: { read: [{ kind: "sensitive_data", level: "medium", description: "" }] },
  },
];

const entry = (resource: string, action: string) => ({ resource, action }) as PermissionEntry;

const operator: RolePreset = {
  key: "operator",
  name: "Operador",
  description: "",
  highlights: [],
  capabilities: ["inbox.view", "inbox.reply"],
  permissions: [entry("conversations", "read"), entry("conversations", "send")],
};

const marketing: RolePreset = {
  key: "marketing",
  name: "Marketing",
  description: "",
  highlights: [],
  capabilities: [],
  permissions: [
    entry("whatsapp_campaigns", "read"),
    entry("whatsapp_campaigns", "start"),
    entry("future_resource", "read"),
  ],
};

const features: Feature[] = [
  {
    key: "inbox",
    name: "Chat",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      { key: "inbox.view", description: "Ver conversas", requires: [entry("conversations", "read")], managersOnly: false, screens: [] },
      {
        key: "inbox.reply",
        description: "Responder",
        requires: [entry("conversations", "read"), entry("conversations", "send")],
        managersOnly: false,
        screens: [],
      },
      { key: "inbox.admin", description: "Gerir", requires: [entry("conversations", "read")], managersOnly: true, screens: [] },
      { key: "inbox.free", description: "Livre", requires: [], managersOnly: false, screens: [] },
    ],
  },
  {
    key: "campaigns",
    name: "Disparos",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      { key: "campaigns.view", description: "Ver", requires: [entry("whatsapp_campaigns", "read")], managersOnly: false, screens: [] },
    ],
  },
];

describe("samePermissions", () => {
  it("ignores order and duplicates", () => {
    expect(
      samePermissions(
        [entry("conversations", "send"), entry("conversations", "read"), entry("conversations", "read")],
        [entry("conversations", "read"), entry("conversations", "send")],
      ),
    ).toBe(true);
  });

  it("tells different sets apart", () => {
    expect(samePermissions([entry("conversations", "read")], [entry("conversations", "send")])).toBe(false);
    expect(samePermissions([], [entry("conversations", "read")])).toBe(false);
  });
});

describe("permissionDiff", () => {
  it("counts added and removed permissions", () => {
    expect(
      permissionDiff(
        [entry("conversations", "read"), entry("conversations", "view_others")],
        [entry("conversations", "read"), entry("conversations", "send")],
      ),
    ).toEqual({ added: 1, removed: 1, total: 2 });
  });

  it("is zero for equal sets", () => {
    expect(permissionDiff(operator.permissions, [...operator.permissions].reverse()).total).toBe(0);
  });
});

describe("knownPermissions", () => {
  it("drops resources and actions this build does not know", () => {
    expect(knownPermissions(marketing.permissions, available)).toEqual([
      entry("whatsapp_campaigns", "read"),
      entry("whatsapp_campaigns", "start"),
    ]);
    expect(knownPermissions([entry("conversations", "teleport")], available)).toEqual([]);
  });

  it("returns nothing when the catalog is empty", () => {
    expect(presetPermissions(operator, [])).toEqual([]);
  });
});

describe("matchingPreset", () => {
  it("finds the preset whose known permissions equal the role", () => {
    expect(
      matchingPreset([entry("whatsapp_campaigns", "start"), entry("whatsapp_campaigns", "read")], [operator, marketing], available)?.key,
    ).toBe("marketing");
  });

  it("returns null for a custom mix or an empty role", () => {
    expect(matchingPreset([entry("conversations", "read")], [operator, marketing], available)).toBeNull();
    expect(matchingPreset([], [operator], available)).toBeNull();
  });
});

describe("capabilitySummary", () => {
  it("lists fully granted capabilities grouped by feature", () => {
    const map: PermissionMap = { conversations: new Set(["read"]), whatsapp_campaigns: new Set(["read"]) };
    expect(capabilitySummary(features, map)).toEqual([
      { featureKey: "inbox", featureName: "Chat", capabilities: [{ key: "inbox.view", description: "Ver conversas" }] },
      { featureKey: "campaigns", featureName: "Disparos", capabilities: [{ key: "campaigns.view", description: "Ver" }] },
    ]);
  });

  it("skips managers-only and requirement-free capabilities and empty features", () => {
    const summary = capabilitySummary(features, { conversations: new Set(["read", "send"]) });
    expect(summary).toHaveLength(1);
    expect(summary[0].capabilities.map((c) => c.key)).toEqual(["inbox.view", "inbox.reply"]);
    expect(capabilitySummary(features, {})).toEqual([]);
  });
});

describe("autofillValue", () => {
  it("follows the preset while the field is untouched", () => {
    expect(autofillValue("Operador", "Operador", "Marketing")).toBe("Marketing");
    expect(autofillValue("", "", "Marketing")).toBe("Marketing");
    expect(autofillValue("   ", "Operador", "Marketing")).toBe("Marketing");
  });

  it("keeps what the user typed", () => {
    expect(autofillValue("Atendente SP", "Operador", "Marketing")).toBe("Atendente SP");
  });
});

describe("presetRisks", () => {
  it("collects distinct risks with high ones first and ignores unknown resources", () => {
    expect(
      presetRisks([entry("call_recordings", "read"), entry("whatsapp_campaigns", "start"), entry("future_resource", "read")], available),
    ).toEqual([
      { kind: "spends_balance", level: "high" },
      { kind: "contacts_customers", level: "high" },
      { kind: "sensitive_data", level: "medium" },
    ]);
  });
});

describe("shouldConfirmReplace", () => {
  it("asks only when the user changed permissions away from the baseline", () => {
    const changed = [entry("conversations", "read")];
    expect(shouldConfirmReplace(operator.permissions, operator.permissions, marketing.permissions)).toBe(false);
    expect(shouldConfirmReplace(changed, operator.permissions, marketing.permissions)).toBe(true);
    expect(shouldConfirmReplace(marketing.permissions, operator.permissions, marketing.permissions)).toBe(false);
    expect(shouldConfirmReplace([], [], operator.permissions)).toBe(false);
  });
});

describe("link or copy", () => {
  const draft = (source: RoleDraft["source"]): RoleDraft => ({
    name: "  Supervisor SP ",
    description: " ",
    permissions: [entry("conversations", "read")],
    source,
  });

  it("starts from the role's own preset and link state", () => {
    expect(initialRoleSource()).toEqual({ kind: "blank" });
    expect(initialRoleSource({ presetKey: "supervisor", linked: true })).toEqual({ kind: "preset", key: "supervisor", linked: true });
    expect(initialRoleSource({ presetKey: undefined, linked: false })).toEqual({ kind: "blank" });
  });

  it("locks permission editing only while linked", () => {
    expect(isPermissionEditingLocked({ kind: "preset", key: "operator", linked: true })).toBe(true);
    expect(isPermissionEditingLocked({ kind: "preset", key: "operator", linked: false })).toBe(false);
    expect(isPermissionEditingLocked({ kind: "blank" })).toBe(false);
  });

  it("links by default on create and only to the role's own preset on edit", () => {
    expect(sourceForChosenPreset("operator")).toEqual({ kind: "preset", key: "operator", linked: true });
    expect(sourceForChosenPreset("operator", { presetKey: "operator" })).toEqual({ kind: "preset", key: "operator", linked: true });
    expect(sourceForChosenPreset("sales", { presetKey: "operator" })).toEqual({ kind: "preset", key: "sales", linked: false });
    expect(canLinkPreset("sales", { presetKey: undefined })).toBe(false);
  });

  it("creates with the preset key and link flag", () => {
    expect(buildCreatePayload(draft({ kind: "preset", key: "supervisor", linked: true }))).toEqual({
      name: "Supervisor SP",
      description: undefined,
      permissions: [entry("conversations", "read")],
      presetKey: "supervisor",
      linked: true,
    });
    expect(buildCreatePayload(draft({ kind: "blank" }))).toEqual({
      name: "Supervisor SP",
      description: undefined,
      permissions: [entry("conversations", "read")],
    });
  });

  it("never sends permissions for a role that stays linked", () => {
    expect(buildUpdatePayload(draft({ kind: "preset", key: "supervisor", linked: true }), { presetKey: "supervisor", linked: true })).toEqual({
      name: "Supervisor SP",
      description: undefined,
    });
  });

  it("re-links with linked true and no permissions", () => {
    expect(buildUpdatePayload(draft({ kind: "preset", key: "supervisor", linked: true }), { presetKey: "supervisor", linked: false })).toEqual({
      name: "Supervisor SP",
      description: undefined,
      linked: true,
    });
  });

  it("detaches with linked false when a linked role becomes a copy", () => {
    expect(buildUpdatePayload(draft({ kind: "preset", key: "supervisor", linked: false }), { presetKey: "supervisor", linked: true })).toEqual({
      name: "Supervisor SP",
      description: undefined,
      permissions: [entry("conversations", "read")],
      linked: false,
    });
  });

  it("sends plain permissions for an unlinked role", () => {
    expect(buildUpdatePayload(draft({ kind: "blank" }), { presetKey: undefined, linked: false })).toEqual({
      name: "Supervisor SP",
      description: undefined,
      permissions: [entry("conversations", "read")],
    });
  });
});

describe("roleSaveError", () => {
  it("maps backend codes to a field and a message key", () => {
    expect(roleSaveError("role_name_taken", "x")).toEqual({ field: "name", messageKey: "errors.nameTaken" });
    expect(roleSaveError("role_linked", "x")).toEqual({ field: "form", messageKey: "errors.roleLinked" });
    expect(roleSaveError("unknown_role_preset", "x")).toEqual({ field: "form", messageKey: "errors.unknownPreset" });
    expect(roleSaveError(undefined, "Falhou")).toEqual({ field: "form", message: "Falhou" });
  });
});

describe("saveBlocker", () => {
  it("blocks an empty or blank name and a role without permissions", () => {
    expect(saveBlocker("   ", 3)).toBe("name");
    expect(saveBlocker("Operador", 0)).toBe("permissions");
    expect(saveBlocker("Operador", 2)).toBeNull();
  });
});
