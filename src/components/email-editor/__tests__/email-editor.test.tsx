import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import { findBlock } from "@/lib/email-design/document";
import type { Document, Hint, Issue } from "@/lib/email-design/types";

import { EmailEditor, type EmailEditorProps } from "../email-editor";
import { blankStarter, newsletterStarter, promotionStarter } from "./fixtures";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

interface HarnessProps extends Partial<Omit<EmailEditorProps, "value" | "onChange">> {
  initial: Document;
  onDocument: (document: Document) => void;
}

function Harness({ initial, onDocument, ...rest }: HarnessProps) {
  const [document, setDocument] = useState(initial);
  return (
    <NextIntlClientProvider locale="pt" messages={pt}>
      <EmailEditor
        value={document}
        onChange={(next) => {
          onDocument(next);
          setDocument(next);
        }}
        {...rest}
      />
    </NextIntlClientProvider>
  );
}

function setup(initial: Document, props: Partial<EmailEditorProps> = {}) {
  const seen = { current: initial };
  const view = render(<Harness initial={initial} onDocument={(next) => (seen.current = next)} {...props} />);
  return { seen, view };
}

function block(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function inspector(): HTMLElement {
  return screen.getByRole("complementary", { name: "Propriedades" });
}

function rootIds(document: Document): string[] {
  return document.blocks.map((item) => item.id);
}

describe("EmailEditor", () => {
  it("selects a block and shows its toolbar and inspector", () => {
    setup(newsletterStarter());
    fireEvent.click(block("Título: Novidades do mês"));
    expect(screen.getByRole("toolbar", { name: "Ações do bloco Título" })).toBeInTheDocument();
    expect(within(inspector()).getByRole("heading", { name: "Título" })).toBeInTheDocument();
  });

  it("updates the document when the heading text is edited in the inspector", () => {
    const { seen } = setup(newsletterStarter());
    fireEvent.click(block("Título: Novidades do mês"));
    fireEvent.change(within(inspector()).getByRole("textbox", { name: "Texto do título" }), { target: { value: "Ofertas da semana" } });
    const found = findBlock(seen.current, "title");
    expect(found?.block.kind === "heading" && found.block.heading.text).toBe("Ofertas da semana");
  });

  it("updates the heading when it is typed on the canvas", () => {
    const { seen } = setup(newsletterStarter());
    const editable = within(block("Título: Novidades do mês")).getByRole("textbox", { name: "Texto do título" });
    editable.textContent = "Novidades de outubro";
    fireEvent.input(editable);
    const found = findBlock(seen.current, "title");
    expect(found?.block.kind === "heading" && found.block.heading.text).toBe("Novidades de outubro");
  });

  it("adds a block from the palette after the selection and selects it", () => {
    const { seen } = setup(newsletterStarter());
    fireEvent.click(block("Título: Novidades do mês"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Botão" }));
    const ids = rootIds(seen.current);
    const added = seen.current.blocks[2];
    expect(added.kind).toBe("button");
    expect(ids.indexOf(added.id)).toBe(ids.indexOf("title") + 1);
    expect(within(inspector()).getByRole("heading", { name: "Botão" })).toBeInTheDocument();
  });

  it("keeps new blocks above the footer", () => {
    const { seen } = setup(blankStarter());
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Divisor" }));
    expect(seen.current.blocks.map((item) => item.kind)).toEqual(["text", "divider", "footer"]);
  });

  it("deletes the selected block with the Delete key and undoes it", () => {
    const { seen } = setup(newsletterStarter());
    const title = block("Título: Novidades do mês");
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: "Delete" });
    expect(rootIds(seen.current)).not.toContain("title");
    fireEvent.keyDown(screen.getByRole("region", { name: "Editor de e-mail" }), { key: "z", ctrlKey: true });
    expect(rootIds(seen.current)).toContain("title");
    fireEvent.keyDown(screen.getByRole("region", { name: "Editor de e-mail" }), { key: "z", ctrlKey: true, shiftKey: true });
    expect(rootIds(seen.current)).not.toContain("title");
  });

  it("never deletes the footer", () => {
    const { seen } = setup(blankStarter());
    const footer = block("Rodapé: Sua empresa");
    fireEvent.click(footer);
    fireEvent.keyDown(footer, { key: "Delete" });
    expect(rootIds(seen.current)).toContain("footer");
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("reorders the selected block with Alt and the arrow keys", () => {
    const { seen } = setup(newsletterStarter());
    const title = block("Título: Novidades do mês");
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: "ArrowDown", altKey: true });
    expect(rootIds(seen.current).slice(0, 3)).toEqual(["top", "intro", "title"]);
    fireEvent.keyDown(block("Título: Novidades do mês"), { key: "ArrowUp", altKey: true });
    expect(rootIds(seen.current).slice(0, 3)).toEqual(["top", "title", "intro"]);
  });

  it("duplicates with the toolbar and with Ctrl+D", () => {
    const { seen } = setup(newsletterStarter());
    const title = block("Título: Novidades do mês");
    fireEvent.click(title);
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Ações do bloco Título" })).getByRole("button", { name: "Duplicar" }));
    expect(seen.current.blocks.filter((item) => item.kind === "heading")).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole("region", { name: "Editor de e-mail" }), { key: "d", ctrlKey: true });
    expect(seen.current.blocks.filter((item) => item.kind === "heading")).toHaveLength(3);
  });

  it("deselects with Escape and shows the email settings", () => {
    setup(newsletterStarter());
    const title = block("Título: Novidades do mês");
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: "Escape" });
    expect(screen.queryByRole("toolbar", { name: "Ações do bloco Título" })).not.toBeInTheDocument();
    expect(within(inspector()).getByRole("heading", { name: "E-mail" })).toBeInTheDocument();
  });

  it("edits the document settings", () => {
    const { seen } = setup(newsletterStarter());
    fireEvent.change(within(inspector()).getByRole("textbox", { name: "Texto de pré-visualização" }), { target: { value: "Só hoje" } });
    expect(seen.current.settings.preheader).toBe("Só hoje");
  });

  it("reads typed rich text back into paragraphs", () => {
    const { seen } = setup(newsletterStarter());
    const intro = screen.getByRole("group", { name: (name) => name.startsWith("Texto: Olá, {{first_name|cliente}}!") });
    fireEvent.click(intro);
    const editor = within(intro).getByRole("textbox", { name: "Texto do bloco" });
    editor.innerHTML = "<p>Primeira</p><div>Segunda <b>forte</b></div>";
    fireEvent.input(editor);
    const found = findBlock(seen.current, "intro");
    expect(found?.block.kind === "text" && found.block.text.paragraphs).toEqual([{ runs: [{ text: "Primeira" }] }, { runs: [{ text: "Segunda " }, { text: "forte", bold: true }] }]);
    expect(editor.innerHTML).toBe("<p>Primeira</p><p>Segunda <strong>forte</strong></p>");
  });

  it("applies bold to the selected text from the toolbar", () => {
    const { seen } = setup(blankStarter());
    const text = block("Texto: Escreva sua mensagem aqui.");
    fireEvent.click(text);
    const editor = within(text).getByRole("textbox", { name: "Texto do bloco" });
    const node = editor.querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 7);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Ações do bloco Texto" })).getByRole("button", { name: "Negrito" }));
    const found = findBlock(seen.current, "text");
    expect(found?.block.kind === "text" && found.block.text.paragraphs).toEqual([{ runs: [{ text: "Escreva", bold: true }, { text: " sua mensagem aqui." }] }]);
  });

  it("lists translated issues and hints and jumps to the field", () => {
    const issues: Issue[] = [{ code: "image_src_missing", block_id: "hero", field: "src" }];
    const hints: Hint[] = [{ code: "no_call_to_action" }];
    setup(promotionStarter(), { issues, hints });
    expect(screen.getByText("Informe o endereço da imagem.")).toBeInTheDocument();
    expect(screen.getByText("Inclua um botão ou um link para o leitor saber o que fazer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Informe o endereço da imagem/ }));
    const field = within(inspector()).getByRole("textbox", { name: "Endereço da imagem" });
    expect(document.activeElement).toBe(field);
  });

  it("shows a fallback for codes it does not know", () => {
    setup(promotionStarter(), { issues: [{ code: "brand_new_code" }] });
    expect(screen.getByText("Há um problema neste ponto (brand_new_code).")).toBeInTheDocument();
  });

  it("asks for a preview and shows the backend HTML in a sandboxed frame", () => {
    const onRequestPreview = vi.fn();
    const initial = newsletterStarter();
    const seen = { current: initial };
    const track = (next: Document) => (seen.current = next);
    const { rerender } = render(<Harness initial={initial} onDocument={track} onRequestPreview={onRequestPreview} />);
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    expect(onRequestPreview).toHaveBeenCalledTimes(1);
    rerender(<Harness initial={initial} onDocument={track} onRequestPreview={onRequestPreview} previewHtml="<html><head></head><body>Oi</body></html>" />);
    const frame = screen.getByTitle("Pré-visualização do e-mail");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame.getAttribute("srcdoc")).toContain("Oi");
    fireEvent.click(screen.getByRole("button", { name: "Fundo escuro" }));
    expect(screen.getByTitle("Pré-visualização do e-mail").getAttribute("srcdoc")).toContain("#121212");
  });

  it("offers a starter prompt when only the footer is left", () => {
    const initial: Document = { version: 1, settings: {}, blocks: [blankStarter().blocks[1]] };
    const { seen } = setup(initial);
    expect(screen.getByText("Vamos montar seu e-mail")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Título" }));
    expect(seen.current.blocks.map((item) => item.kind)).toEqual(["heading", "footer"]);
  });

  it("changes the columns ratio and keeps the children", () => {
    const { seen } = setup(newsletterStarter());
    fireEvent.click(block("Colunas"));
    fireEvent.click(within(inspector()).getByRole("button", { name: "Três colunas iguais" }));
    const found = findBlock(seen.current, "stories");
    expect(found?.block.kind === "columns" && found.block.columns.columns.map((column) => column.blocks.length)).toEqual([2, 1, 0]);
  });

  it("does not edit when read only", () => {
    const { seen } = setup(newsletterStarter(), { readOnly: true });
    const initial = seen.current;
    const title = block("Título: Novidades do mês");
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: "Delete" });
    act(() => {
      fireEvent.keyDown(screen.getByRole("region", { name: "Editor de e-mail" }), { key: "d", ctrlKey: true });
    });
    expect(seen.current).toBe(initial);
    expect(screen.getByRole("button", { name: "Adicionar Botão" })).toBeDisabled();
  });
});
