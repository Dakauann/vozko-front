import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) =>
    key === "sentence" ? "Responda /sair para não receber mais mensagens." : `${namespace}.${key}${values ? JSON.stringify(values) : ""}`,
}));

import { ExitLine } from "../campaign-message-composer";

const NS = "unofficialWhatsappCampaigns.form.exitLine";

describe("ExitLine", () => {
  it("asks for the exit and writes the localized line into every variant that lacks one", () => {
    const onChange = vi.fn();
    render(<ExitLine value={{ kind: "text", bodies: ["Oi", "Olá /parar"] }} onChange={onChange} />);

    expect(screen.getByText(`${NS}.missing`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `${NS}.insert` }));

    expect(onChange).toHaveBeenCalledWith({
      kind: "text",
      bodies: ["Oi\n\nResponda /sair para não receber mais mensagens.", "Olá /parar"],
    });
  });

  it("names the commands the contact sees once every variant shows one", () => {
    render(<ExitLine value={{ kind: "text", bodies: ["Oi /sair", "Olá /SAIR e /parar"] }} onChange={vi.fn()} />);

    expect(screen.getByText(`${NS}.shown{"commands":"/sair, /SAIR, /parar"}`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives an audio an exit text, with the line one click away and a preview of both messages", () => {
    const onChange = vi.fn();
    render(<ExitLine value={{ kind: "audio", bodies: [], mediaId: "m-1", fileName: "recado.ogg" }} onChange={onChange} />);

    expect(screen.getByText(`${NS}.missingAudio`)).toBeTruthy();
    expect(screen.getByText("recado.ogg")).toBeTruthy();
    expect(screen.getByText(`${NS}.previewEmpty`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `${NS}.insert` }));
    expect(onChange).toHaveBeenCalledWith({
      kind: "audio",
      bodies: [],
      mediaId: "m-1",
      fileName: "recado.ogg",
      exitText: "Responda /sair para não receber mais mensagens.",
    });

    fireEvent.change(screen.getByLabelText(`${NS}.textLabel`), { target: { value: "Envie /parar" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ exitText: "Envie /parar" }));
  });

  it("previews the exit text an audio already shows", () => {
    render(<ExitLine value={{ kind: "audio", bodies: [], mediaId: "m-1", exitText: "Responda /sair" }} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("Responda /sair")).toBeTruthy();
    expect(screen.getByText("Responda /sair")).toBeTruthy();
    expect(screen.getByText(`${NS}.shown{"commands":"/sair"}`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no insert while the message is locked", () => {
    render(<ExitLine value={{ kind: "text", bodies: ["Oi"] }} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
