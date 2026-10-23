import { describe, expect, it } from "vitest";

import {
  activeMarks,
  canonicalHtml,
  deleteRange,
  domToParagraphs,
  insertPlainText,
  insertText,
  placeSelection,
  pointToPosition,
  readSelection,
  renderParagraphs,
  setLink,
  splitParagraph,
  toggleMark,
  type TextRange,
} from "./rich-text";
import type { Paragraph } from "./types";

function html(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root;
}

function range(startParagraph: number, startOffset: number, endParagraph = startParagraph, endOffset = startOffset): TextRange {
  return { start: { paragraph: startParagraph, offset: startOffset }, end: { paragraph: endParagraph, offset: endOffset } };
}

const SAMPLE: Paragraph[] = [
  { runs: [{ text: "Olá " }, { text: "mundo", bold: true }, { text: " e " }, { text: "site", link: { href: "https://a.com" }, underline: true }] },
  { runs: [{ text: "linha\nquebrada", italic: true }] },
  { runs: [] },
];

describe("domToParagraphs", () => {
  it("reads paragraphs and the allowed marks", () => {
    const root = html('<p>Olá <strong>mundo</strong> e <a href="https://a.com"><u>site</u></a></p><p><em>linha<br>quebrada</em></p><p><br></p>');
    expect(domToParagraphs(root)).toEqual(SAMPLE);
  });

  it("accepts b and i as bold and italic and ignores other elements and attributes", () => {
    const root = html('<p style="color:red"><b class="x">a</b><i>b</i><span style="font-weight:bold">c</span><font color="red">d</font><img src="x.png"><script>alert(1)</script></p>');
    expect(domToParagraphs(root)).toEqual([{ runs: [{ text: "a", bold: true }, { text: "b", italic: true }, { text: "cd" }] }]);
  });

  it("drops links without href and merges equal neighbours", () => {
    const root = html("<p><a>sem</a> link <strong>a</strong><strong>b</strong></p>");
    expect(domToParagraphs(root)).toEqual([{ runs: [{ text: "sem link " }, { text: "ab", bold: true }] }]);
  });

  it("turns loose inline content and divs into paragraphs", () => {
    const root = html("solto<div>bloco</div><div><p>aninhado</p></div>");
    expect(domToParagraphs(root)).toEqual([{ runs: [{ text: "solto" }] }, { runs: [{ text: "bloco" }] }, { runs: [{ text: "aninhado" }] }]);
  });

  it("reads non breaking spaces as spaces", () => {
    expect(domToParagraphs(html("<p>a\u00a0\u00a0b</p>"))).toEqual([{ runs: [{ text: "a  b" }] }]);
  });

  it("keeps one empty paragraph for an empty editor", () => {
    expect(domToParagraphs(html(""))).toEqual([{ runs: [] }]);
  });

  it("keeps a soft break at the end of a paragraph", () => {
    expect(domToParagraphs(html("<p>fim<br><br></p>"))).toEqual([{ runs: [{ text: "fim\n" }] }]);
  });
});

describe("renderParagraphs", () => {
  it("round trips through the DOM", () => {
    const root = document.createElement("div");
    renderParagraphs(root, SAMPLE);
    expect(root.innerHTML).toBe('<p>Olá <strong>mundo</strong> e <a href="https://a.com"><u>site</u></a></p><p><em>linha<br>quebrada</em></p><p><br></p>');
    expect(domToParagraphs(root)).toEqual(SAMPLE);
  });

  it("nests marks in a fixed order", () => {
    const paragraphs: Paragraph[] = [{ runs: [{ text: "x", bold: true, italic: true, underline: true, link: { href: "https://b.com" } }] }];
    expect(canonicalHtml(document, paragraphs)).toBe('<p><a href="https://b.com"><strong><em><u>x</u></em></strong></a></p>');
  });

  it("escapes text and attributes", () => {
    const root = document.createElement("div");
    const paragraphs: Paragraph[] = [{ runs: [{ text: "<b>&", link: { href: 'https://x.com/?a="1"&b=2' } }] }];
    renderParagraphs(root, paragraphs);
    expect(root.querySelector("b")).toBeNull();
    expect(domToParagraphs(root)).toEqual(paragraphs);
  });
});

describe("model edits", () => {
  it("toggles a mark on and off across runs", () => {
    const paragraphs: Paragraph[] = [{ runs: [{ text: "Olá mundo" }] }];
    const bold = toggleMark(paragraphs, range(0, 4, 0, 9), "bold");
    expect(bold).toEqual([{ runs: [{ text: "Olá " }, { text: "mundo", bold: true }] }]);
    expect(toggleMark(bold, range(0, 4, 0, 9), "bold")).toEqual([{ runs: [{ text: "Olá mundo" }] }]);
    expect(toggleMark(bold, range(0, 0, 0, 9), "bold")).toEqual([{ runs: [{ text: "Olá mundo", bold: true }] }]);
  });

  it("reports the marks of a selection", () => {
    expect(activeMarks(SAMPLE, range(0, 4, 0, 9))).toEqual({ bold: true, italic: false, underline: false, href: null });
    expect(activeMarks(SAMPLE, range(0, 12, 0, 14))).toEqual({ bold: false, italic: false, underline: true, href: "https://a.com" });
    expect(activeMarks(SAMPLE, range(0, 6))).toEqual({ bold: true, italic: false, underline: false, href: null });
  });

  it("sets and removes a link", () => {
    const paragraphs: Paragraph[] = [{ runs: [{ text: "veja aqui" }] }];
    const linked = setLink(paragraphs, range(0, 5, 0, 9), "https://x.com").paragraphs;
    expect(linked).toEqual([{ runs: [{ text: "veja " }, { text: "aqui", link: { href: "https://x.com" } }] }]);
    expect(setLink(linked, range(0, 5, 0, 9), null).paragraphs).toEqual(paragraphs);
  });

  it("inserts the address as linked text when nothing is selected", () => {
    const edit = setLink([{ runs: [{ text: "a" }] }], range(0, 1), "https://x.com");
    expect(edit.paragraphs).toEqual([{ runs: [{ text: "a" }, { text: "https://x.com", link: { href: "https://x.com" } }] }]);
    expect(edit.caret).toEqual({ paragraph: 0, offset: 14 });
  });

  it("splits a paragraph at the caret and replaces a selection", () => {
    const edit = splitParagraph([{ runs: [{ text: "Olá " }, { text: "mundo", bold: true }] }], range(0, 6));
    expect(edit.paragraphs).toEqual([{ runs: [{ text: "Olá " }, { text: "mu", bold: true }] }, { runs: [{ text: "ndo", bold: true }] }]);
    expect(edit.caret).toEqual({ paragraph: 1, offset: 0 });
  });

  it("deletes across paragraphs", () => {
    const edit = deleteRange([{ runs: [{ text: "abc" }] }, { runs: [{ text: "def" }] }], range(0, 1, 1, 2));
    expect(edit.paragraphs).toEqual([{ runs: [{ text: "af" }] }]);
    expect(edit.caret).toEqual({ paragraph: 0, offset: 1 });
  });

  it("inserts text with the surrounding format", () => {
    const edit = insertText([{ runs: [{ text: "ab", bold: true }] }], range(0, 1), "{{first_name}}");
    expect(edit.paragraphs).toEqual([{ runs: [{ text: "a{{first_name}}b", bold: true }] }]);
    expect(edit.caret).toEqual({ paragraph: 0, offset: 15 });
  });

  it("pastes plain text as paragraphs", () => {
    const edit = insertPlainText([{ runs: [{ text: "ab" }] }], range(0, 1), "x\r\ny\nz");
    expect(edit.paragraphs).toEqual([{ runs: [{ text: "ax" }] }, { runs: [{ text: "y" }] }, { runs: [{ text: "zb" }] }]);
    expect(edit.caret).toEqual({ paragraph: 2, offset: 1 });
  });
});

describe("selection mapping", () => {
  it("maps DOM points to text positions and back", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderParagraphs(root, SAMPLE);
    const strong = root.querySelector("strong")?.firstChild as Text;
    expect(pointToPosition(root, strong, 2)).toEqual({ paragraph: 0, offset: 6 });
    const emText = root.querySelector("em")?.lastChild as Text;
    expect(pointToPosition(root, emText, 3)).toEqual({ paragraph: 1, offset: 9 });
    expect(pointToPosition(root, root.children[2], 0)).toEqual({ paragraph: 2, offset: 0 });

    placeSelection(root, range(0, 5, 1, 2));
    expect(readSelection(root)).toEqual(range(0, 5, 1, 2));
    placeSelection(root, range(2, 0));
    expect(readSelection(root)).toEqual(range(2, 0));
    root.remove();
  });

  it("ignores points outside the editor", () => {
    const root = html("<p>a</p>");
    expect(pointToPosition(root, document.body, 0)).toBeNull();
  });
});
