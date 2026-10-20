import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { ButtonsField, ListSectionsField } from "./node-config-panel";

function withMessages(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const CAPITALIZED_LIST = '[{"Title":"Aulas Aquáticas","Rows":[{"ID":"1","Title":"Horários"},{"ID":"2","Title":"Materiais"}]}]';
const CANONICAL_LIST = '[{"title":"Aulas Aquáticas","rows":[{"id":"1","title":"Horários","description":""},{"id":"2","title":"Materiais","description":""}]}]';

describe("the options form", () => {
  it("refuses a capitalized list as illegible and offers a reset instead of guessing", () => {
    const onChange = vi.fn();
    render(withMessages(<ListSectionsField value={CAPITALIZED_LIST} onChange={onChange} />));

    expect(screen.getByText("Configuração ilegível")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Horários")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recomeçar as opções" }));
    expect(onChange).toHaveBeenCalledWith("[]");
  });

  it("binds the canonical list the server stores", () => {
    render(withMessages(<ListSectionsField value={CANONICAL_LIST} onChange={vi.fn()} />));

    expect(screen.queryByText("Configuração ilegível")).toBeNull();
    expect(screen.getByDisplayValue("Horários")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Materiais")).toBeInTheDocument();
  });

  it("refuses lowercase buttons as illegible", () => {
    render(withMessages(<ButtonsField value='[{"type":"reply","id":"sim","title":"Sim"}]' onChange={vi.fn()} />));

    expect(screen.getByText("Configuração ilegível")).toBeInTheDocument();
  });
});
