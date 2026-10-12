import { afterEach, describe, expect, it } from "vitest";

import { domMatches, domOffset, editableText, partCss, placeSelection, readSelection, renderParts, type RichPart } from "./rich-text-dom";

function host(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

const PARTS: RichPart[] = [
  { text: "Compre ", css: "font-weight: 400;" },
  { text: "agora😀", css: "font-weight: 700;" },
];

describe("partCss", () => {
  it("sizes the letters from the surface and draws underline, caps and spacing", () => {
    const css = partCss({ fill: "#ff0000", fontId: "inter", fontWeight: 700, fontSize: 0.1, italic: true, underline: true, caps: true, letterSpacing: 0.5 }, 200);
    expect(css).toContain('font: italic 700 20px "Inter"');
    expect(css).toContain("color: #ff0000");
    expect(css).toContain("letter-spacing: 10px");
    expect(css).toContain("text-decoration: underline");
    expect(css).toContain("text-transform: uppercase");
  });

  it("falls back to black ink without a fill", () => {
    expect(partCss({ fill: "", fontId: "inter", fontWeight: 400, fontSize: 0.1, italic: false, underline: false, caps: false, letterSpacing: 0 }, 100)).toContain("color: #000000");
  });
});

describe("editableText", () => {
  it("joins the spans and reads breaks as newlines without the trailing filler", () => {
    const root = host();
    renderParts(root, [{ text: "Oi\n", css: "" }], true);
    expect(editableText(root)).toBe("Oi\n");
    root.appendChild(document.createElement("br"));
    expect(editableText(root)).toBe("Oi\n\n");
  });

  it("reads a block the browser inserted as a new line", () => {
    const root = host();
    root.innerHTML = "<span>Oi</span><div>tudo</div>";
    expect(editableText(root)).toBe("Oi\ntudo");
  });
});

describe("renderParts and domMatches", () => {
  it("builds one span per part and notices text typed outside them", () => {
    const root = host();
    renderParts(root, PARTS, false);
    expect(root.querySelectorAll("span")).toHaveLength(2);
    expect(domMatches(root, PARTS, false)).toBe(true);
    expect(domMatches(root, PARTS, true)).toBe(false);
    root.appendChild(document.createTextNode("x"));
    expect(domMatches(root, PARTS, false)).toBe(false);
  });

  it("notices a style change", () => {
    const root = host();
    renderParts(root, PARTS, false);
    expect(domMatches(root, [PARTS[0], { ...PARTS[1], css: "font-weight: 400;" }], false)).toBe(false);
  });
});

describe("selection offsets", () => {
  it("places and reads a selection across spans in UTF-16 offsets", () => {
    const root = host();
    renderParts(root, PARTS, false);
    placeSelection(root, 3, 12);
    expect(readSelection(root)).toEqual({ start: 3, end: 12 });
    const selection = document.getSelection()!;
    expect(selection.anchorNode?.textContent).toBe("Compre ");
    expect(selection.focusNode?.textContent).toBe("agora😀");
  });

  it("measures a point given as an element child index", () => {
    const root = host();
    renderParts(root, PARTS, false);
    expect(domOffset(root, root, 1)).toBe(7);
    expect(domOffset(root, root, 2)).toBe(14);
  });

  it("puts a caret on a boundary at the end of the earlier span", () => {
    const root = host();
    renderParts(root, PARTS, false);
    placeSelection(root, 7, 7);
    expect(document.getSelection()!.anchorNode?.textContent).toBe("Compre ");
  });

  it("ignores a selection outside the editor", () => {
    const root = host();
    renderParts(root, PARTS, false);
    const other = host();
    other.textContent = "fora";
    document.getSelection()!.selectAllChildren(other);
    expect(readSelection(root)).toBeNull();
  });
});
