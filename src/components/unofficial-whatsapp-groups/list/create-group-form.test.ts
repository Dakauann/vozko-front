import { describe, expect, it } from "vitest";

import {
  GROUP_DESCRIPTION_MAX_CHARS,
  GROUP_NAME_MAX_CHARS,
  categorySuggestions,
  createGroupIssues,
  createGroupPayload,
  numberRole,
  type CreateGroupForm,
} from "./create-group-form";

const form: CreateGroupForm = {
  name: "  Turma de outubro ",
  description: "  ",
  category: " Clientes ",
  instanceIds: ["n2", "n1"],
  adminsOnly: true,
  follow: false,
};

describe("createGroupIssues", () => {
  it("passes a named group with a number", () => {
    expect(createGroupIssues(form)).toEqual({});
  });

  it("asks for a name and a number", () => {
    expect(createGroupIssues({ ...form, name: "   ", instanceIds: [] })).toEqual({ name: "required", numbers: "required" });
  });

  it("refuses names and descriptions over the WhatsApp limits", () => {
    expect(createGroupIssues({ ...form, name: "x".repeat(GROUP_NAME_MAX_CHARS + 1) })).toEqual({ name: "tooLong" });
    expect(createGroupIssues({ ...form, description: "x".repeat(GROUP_DESCRIPTION_MAX_CHARS + 1) })).toEqual({ description: "tooLong" });
  });
});

describe("createGroupPayload", () => {
  it("trims the text, drops blanks and maps follow to skipFollow", () => {
    expect(createGroupPayload(form)).toEqual({
      name: "Turma de outubro",
      category: "Clientes",
      instanceIds: ["n2", "n1"],
      adminsOnly: true,
      skipFollow: true,
    });
  });

  it("keeps the description when there is one and follows by default", () => {
    expect(createGroupPayload({ ...form, description: " Avisos ", category: "", follow: true })).toEqual({
      name: "Turma de outubro",
      description: "Avisos",
      instanceIds: ["n2", "n1"],
      adminsOnly: true,
      skipFollow: false,
    });
  });
});

describe("numberRole", () => {
  it("makes the first picked number the creator and the rest admins", () => {
    expect(numberRole(["n2", "n1"], "n2")).toBe("creator");
    expect(numberRole(["n2", "n1"], "n1")).toBe("admin");
    expect(numberRole(["n2", "n1"], "n3")).toBeUndefined();
  });
});

describe("categorySuggestions", () => {
  const categories = ["Clientes", "Vendas", "Clientes VIP"];

  it("offers every category before typing", () => {
    expect(categorySuggestions(categories, "")).toEqual(categories);
  });

  it("filters by what was typed and hides the exact match", () => {
    expect(categorySuggestions(categories, " cli")).toEqual(["Clientes", "Clientes VIP"]);
    expect(categorySuggestions(categories, "clientes")).toEqual(["Clientes VIP"]);
  });
});
