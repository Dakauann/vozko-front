import { describe, expect, it, vi } from "vitest";

import { blockSelection, createFormBuilderStore, readSelection, screenSelection, typingGroup } from "./builder-store";
import {
  addOption,
  addScreen,
  changeFieldKind,
  createBlock,
  createOption,
  createScreen,
  fieldsBefore,
  insertBlock,
  moveBlock,
  moveScreen,
  removeBlock,
  removeOption,
  removeScreen,
  setBranch,
  setBranching,
  setNextScreen,
  setVisibleIf,
  updateField,
} from "./document-edit";
import { createDraftSaver, type DraftSaveState } from "./draft-saver";
import { newKey } from "./keys";
import type { Document, Version } from "./types";

const copy = { label: "Nova pergunta", text: "Novo texto", options: ["Opção 1", "Opção 2"] };

function seeded(): Document {
  return {
    schema: 1,
    categories: ["LEAD_GENERATION"],
    screens: [
      {
        key: "s_aaaaaaaa",
        title: "Início",
        submitLabel: "Continuar",
        route: { next: "s_bbbbbbbb", branchOn: "f_interest", branches: [{ optionId: "o_buy00000", next: "s_cccccccc" }] },
        blocks: [
          { key: "b_name0000", field: { key: "f_name0000", kind: "short_text", label: "Nome", required: true, sensitive: false } },
          {
            key: "b_interest",
            field: {
              key: "f_interest",
              kind: "single_choice_radio",
              label: "Interesse",
              required: true,
              sensitive: false,
              options: [
                { id: "o_buy00000", title: "Comprar" },
                { id: "o_rent0000", title: "Alugar" },
              ],
            },
          },
        ],
      },
      {
        key: "s_bbbbbbbb",
        title: "Detalhes",
        submitLabel: "Continuar",
        route: { next: "s_cccccccc" },
        blocks: [{ key: "b_details0", field: { key: "f_details0", kind: "long_text", label: "Detalhes", required: false, sensitive: false }, visibleIf: { fieldKey: "f_interest", value: "o_rent0000" } }],
      },
      { key: "s_cccccccc", title: "Fim", submitLabel: "Enviar", route: {}, blocks: [] },
    ],
  };
}

function version(id: string, document: Document): Version {
  return { id, workspaceId: "w-1", formId: "f-1", number: 2, document, createdAt: "2026-10-19T12:00:00Z" };
}

describe("newKey", () => {
  it("makes a prefixed key of eight lowercase letters or digits", () => {
    for (const prefix of ["s_", "b_", "f_", "o_"] as const) expect(newKey(prefix)).toMatch(new RegExp(`^${prefix}[a-z0-9]{8}$`));
  });

  it("uses the random source it is given", () => {
    expect(newKey("f_", (length) => new Uint8Array(length))).toBe("f_aaaaaaaa");
  });
});

describe("document edits", () => {
  it("adds a screen and a block with fresh keys and default options", () => {
    const screen = createScreen({ title: "Nova tela", submitLabel: "Continuar" });
    const block = createBlock({ field: "multi_choice_chips" }, copy);
    const next = insertBlock(addScreen(seeded(), screen), screen.key, block);
    const added = next.screens[3];
    expect(added.key).toMatch(/^s_[a-z0-9]{8}$/);
    expect(added.blocks[0].key).toMatch(/^b_/);
    expect(added.blocks[0].field?.key).toMatch(/^f_/);
    expect(added.blocks[0].field?.options?.map((option) => option.title)).toEqual(["Opção 1", "Opção 2"]);
    expect(added.blocks[0].field?.options?.every((option) => /^o_[a-z0-9]{8}$/.test(option.id))).toBe(true);
  });

  it("gives a display block its text, and none to an image", () => {
    expect(createBlock({ display: "heading" }, copy).display).toEqual({ kind: "heading", text: "Novo texto" });
    expect(createBlock({ display: "image" }, copy).display).toEqual({ kind: "image" });
  });

  it("never changes keys when blocks and screens move", () => {
    const moved = moveBlock(moveScreen(seeded(), 0, 1), "b_interest", "s_bbbbbbbb", 0);
    expect(moved.screens.map((screen) => screen.key)).toEqual(["s_bbbbbbbb", "s_aaaaaaaa", "s_cccccccc"]);
    expect(moved.screens[0].blocks.map((block) => block.key)).toEqual(["b_interest", "b_details0"]);
    expect(moved.screens[0].blocks[0].field?.key).toBe("f_interest");
  });

  it("reorders blocks inside a screen", () => {
    expect(moveBlock(seeded(), "b_interest", "s_aaaaaaaa", 0).screens[0].blocks.map((block) => block.key)).toEqual(["b_interest", "b_name0000"]);
  });

  it("drops routes, branches and conditions that pointed at a deleted screen or field", () => {
    const withoutScreen = removeScreen(seeded(), "s_cccccccc");
    expect(withoutScreen.screens[0].route).toEqual({ next: "s_bbbbbbbb", branchOn: "f_interest" });
    expect(withoutScreen.screens[1].route).toEqual({});
    const withoutField = removeBlock(seeded(), "b_interest");
    expect(withoutField.screens[0].route).toEqual({ next: "s_bbbbbbbb" });
    expect(withoutField.screens[1].blocks[0].visibleIf).toBeUndefined();
  });

  it("drops the branch and the condition of a deleted option", () => {
    const withoutBuy = removeOption(seeded(), "b_interest", "o_buy00000");
    expect(withoutBuy.screens[0].route.branches).toBeUndefined();
    const withoutRent = removeOption(seeded(), "b_interest", "o_rent0000");
    expect(withoutRent.screens[1].blocks[0].visibleIf).toBeUndefined();
  });

  it("maps options to later screens and keeps a default", () => {
    let doc = setBranching(seeded(), "s_aaaaaaaa", null);
    expect(doc.screens[0].route).toEqual({ next: "s_bbbbbbbb" });
    doc = setBranching(doc, "s_aaaaaaaa", "f_interest");
    doc = setBranch(doc, "s_aaaaaaaa", "o_rent0000", "s_cccccccc");
    doc = setNextScreen(doc, "s_aaaaaaaa", "s_bbbbbbbb");
    expect(doc.screens[0].route).toEqual({ next: "s_bbbbbbbb", branchOn: "f_interest", branches: [{ optionId: "o_rent0000", next: "s_cccccccc" }] });
    expect(setBranch(doc, "s_aaaaaaaa", "o_rent0000", null).screens[0].route.branches).toBeUndefined();
  });

  it("clears empty values instead of saving empty strings", () => {
    const doc = updateField(updateField(seeded(), "b_name0000", { help: "Como prefere ser chamado" }), "b_name0000", { help: "" });
    expect(doc.screens[0].blocks[0].field).not.toHaveProperty("help");
  });

  it("changes a field kind, keeping options between choice kinds and dropping the binding", () => {
    const bound = updateField(seeded(), "b_interest", { binding: { target: "address.city" } });
    const dropdown = changeFieldKind(bound, "b_interest", "single_choice_dropdown", copy);
    expect(dropdown.screens[0].blocks[1].field?.options).toHaveLength(2);
    expect(dropdown.screens[0].blocks[1].field?.binding).toBeUndefined();
    expect(dropdown.screens[0].route.branchOn).toBe("f_interest");
    const text = changeFieldKind(bound, "b_interest", "short_text", copy);
    expect(text.screens[0].blocks[1].field?.options).toBeUndefined();
    expect(text.screens[0].route.branchOn).toBeUndefined();
    expect(text.screens[1].blocks[0].visibleIf).toBeUndefined();
  });

  it("lists only the fields placed before a block as condition candidates", () => {
    expect(fieldsBefore(seeded(), "b_details0").map((ref) => ref.field.key)).toEqual(["f_name0000", "f_interest"]);
    expect(fieldsBefore(seeded(), "b_name0000")).toEqual([]);
  });

  it("sets and clears a visibility condition", () => {
    const doc = setVisibleIf(seeded(), "b_details0", { fieldKey: "f_interest", value: "o_buy00000", negate: true });
    expect(doc.screens[1].blocks[0].visibleIf).toEqual({ fieldKey: "f_interest", value: "o_buy00000", negate: true });
    expect(setVisibleIf(doc, "b_details0", null).screens[1].blocks[0]).not.toHaveProperty("visibleIf");
  });

  it("returns the same document when nothing changes", () => {
    const doc = seeded();
    expect(moveScreen(doc, 1, 1)).toBe(doc);
    expect(removeBlock(doc, "b_missing")).toBe(doc);
  });
});

describe("builder store", () => {
  it("undoes structural edits one at a time and keeps the selection with them", () => {
    const store = createFormBuilderStore(seeded());
    const option = createOption("Trocar");
    store.getState().apply((doc) => addOption(doc, "b_interest", option), blockSelection("b_interest"));
    store.getState().apply((doc) => removeBlock(doc, "b_name0000"), screenSelection("s_aaaaaaaa"));
    expect(store.getState().document.screens[0].blocks).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document.screens[0].blocks).toHaveLength(2);
    expect(readSelection(store.getState().selection)).toEqual({ kind: "block", key: "b_interest" });
    store.getState().undo();
    expect(store.getState().document.screens[0].blocks[1].field?.options).toHaveLength(2);
    store.getState().redo();
    expect(store.getState().document.screens[0].blocks[1].field?.options?.[2]).toEqual(option);
  });

  it("groups typing in one property into a single undo step", () => {
    const store = createFormBuilderStore(seeded());
    for (const label of ["N", "No", "Nom", "Nome completo"]) {
      store.getState().applyAs(typingGroup("b_name0000", "label"), (doc) => updateField(doc, "b_name0000", { label }));
    }
    store.getState().applyAs(typingGroup("b_name0000", "help"), (doc) => updateField(doc, "b_name0000", { help: "Como no documento" }));
    expect(store.getState().document.screens[0].blocks[0].field?.label).toBe("Nome completo");
    store.getState().undo();
    expect(store.getState().document.screens[0].blocks[0].field).toMatchObject({ label: "Nome completo" });
    expect(store.getState().document.screens[0].blocks[0].field).not.toHaveProperty("help");
    store.getState().undo();
    expect(store.getState().document.screens[0].blocks[0].field?.label).toBe("Nome");
    expect(store.getState().canUndo).toBe(false);
  });

  it("reads screen and block selections apart", () => {
    expect(readSelection(screenSelection("s_aaaaaaaa"))).toEqual({ kind: "screen", key: "s_aaaaaaaa" });
    expect(readSelection(blockSelection("b_aaaaaaaa"))).toEqual({ kind: "block", key: "b_aaaaaaaa" });
    expect(readSelection([])).toBeNull();
  });
});

describe("draft saver", () => {
  it("saves on the latest base and moves the base to the version the server returns", async () => {
    const save = vi.fn().mockResolvedValueOnce({ data: version("v-2", seeded()), error: null }).mockResolvedValueOnce({ data: version("v-3", seeded()), error: null });
    const states: DraftSaveState[] = [];
    const saver = createDraftSaver("v-1", { save, onState: (state) => states.push(state) });
    await saver.request(seeded());
    await saver.request(seeded());
    expect(save.mock.calls.map((call) => call[1])).toEqual(["v-1", "v-2"]);
    expect(saver.base()).toBe("v-3");
    expect(states.at(-1)?.status).toBe("saved");
  });

  it("saves only the newest document when edits arrive during a save", async () => {
    let release: (value: unknown) => void = () => {};
    const first = new Promise((resolve) => (release = resolve));
    const save = vi.fn().mockImplementationOnce(() => first.then(() => ({ data: version("v-2", seeded()), error: null }))).mockResolvedValue({ data: version("v-3", seeded()), error: null });
    const saver = createDraftSaver("v-1", { save, onState: () => {} });
    const a = saver.request(seeded());
    const latest = { ...seeded(), categories: ["SURVEY" as const] };
    saver.request(seeded());
    const c = saver.request(latest);
    release(undefined);
    await Promise.all([a, c]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]).toEqual([latest, "v-2"]);
  });

  it("stops saving on a stale base and asks to reload", async () => {
    const save = vi.fn().mockResolvedValue({ data: null, error: { status: 409, code: "whatsapp_form_stale_draft" } });
    const onStale = vi.fn();
    const states: DraftSaveState[] = [];
    const saver = createDraftSaver("v-1", { save, onState: (state) => states.push(state), onStale });
    await saver.request(seeded());
    await saver.request(seeded());
    expect(save).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe("stale");
    saver.rebase("v-9");
    save.mockResolvedValueOnce({ data: version("v-10", seeded()), error: null });
    await saver.request(seeded());
    expect(save.mock.calls[1][1]).toBe("v-9");
    expect(saver.base()).toBe("v-10");
  });

  it("keeps a failed document for retry and reports the problems of a refusal", async () => {
    const problems = [{ code: "too_long", block: "b_name0000", property: "label", limit: 20 }];
    const save = vi.fn().mockResolvedValueOnce({ data: null, error: { status: 422, code: "whatsapp_form_invalid", details: { problems } } }).mockResolvedValueOnce({ data: version("v-2", seeded()), error: null });
    const states: DraftSaveState[] = [];
    const saver = createDraftSaver("v-1", { save, onState: (state) => states.push(state) });
    await saver.request(seeded());
    expect(states.at(-1)).toMatchObject({ status: "failed", problems });
    await saver.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.status).toBe("saved");
  });
});
