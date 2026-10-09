import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";

const renameLeadAction = vi.fn();

vi.mock("@/app/actions/leads", () => ({
  renameLeadAction: (...args: unknown[]) => renameLeadAction(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { EditableLeadName } from "../EditableLeadName";

const record = (name: string, version: number) => ({
  id: "lead-1",
  workspaceId: "ws-1",
  number: "5511999990000",
  name,
  blocked: false,
  relativesCount: 0,
  referredCount: 0,
  version,
});

function renderName(props: Partial<React.ComponentProps<typeof EditableLeadName>> = {}) {
  const onLeadChanged = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <EditableLeadName
        leadId="lead-1"
        name="Ana"
        version={3}
        fallback="(11) 99999-0000"
        canEdit
        onLeadChanged={onLeadChanged}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, onLeadChanged };
}

function typeName(value: string) {
  fireEvent.click(screen.getByRole("button", { name: /Ana|Ana Paula|Ana Souza/ }));
  const input = screen.getByLabelText("Nome do contato");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditableLeadName", () => {
  it("sends the version it shows and reports the stored name with its new version", async () => {
    renameLeadAction.mockResolvedValue({ status: "saved", lead: record("Ana Paula", 4) });
    const { onLeadChanged } = renderName();

    typeName("Ana Paula");

    await waitFor(() => expect(onLeadChanged).toHaveBeenCalledWith({ name: "Ana Paula", version: 4 }));
    expect(renameLeadAction).toHaveBeenCalledWith("lead-1", "Ana Paula", 3);
    expect(toast.success).toHaveBeenCalledWith("Nome atualizado");
  });

  it("uses the version the save returned on the next edit", async () => {
    renameLeadAction
      .mockResolvedValueOnce({ status: "saved", lead: record("Ana Paula", 4) })
      .mockResolvedValueOnce({ status: "saved", lead: record("Ana Lima", 5) });
    renderName();

    typeName("Ana Paula");
    await waitFor(() => expect(screen.getByRole("button", { name: /Ana Paula/ })).toBeTruthy());
    typeName("Ana Lima");

    await waitFor(() => expect(renameLeadAction).toHaveBeenCalledTimes(2));
    expect(renameLeadAction.mock.calls[1]).toEqual(["lead-1", "Ana Lima", 4]);
  });

  it("shows the current name after a conflict and retries with the current version", async () => {
    renameLeadAction
      .mockResolvedValueOnce({ status: "conflict", current: record("Ana Souza", 5) })
      .mockResolvedValueOnce({ status: "saved", lead: record("Ana Paula", 6) });
    const { onLeadChanged } = renderName();

    typeName("Ana Paula");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Ana Souza");
    expect(onLeadChanged).toHaveBeenCalledWith({ name: "Ana Souza", version: 5 });
    const input = screen.getByLabelText("Nome do contato") as HTMLInputElement;
    expect(input.value).toBe("Ana Paula");

    fireEvent.blur(input);
    expect(renameLeadAction).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(renameLeadAction).toHaveBeenCalledTimes(2));
    expect(renameLeadAction.mock.calls[1]).toEqual(["lead-1", "Ana Paula", 5]);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  function renameElsewhere(view: ReturnType<typeof renderName>, name: string, version: number) {
    view.rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <EditableLeadName leadId="lead-1" name={name} version={version} fallback="(11) 99999-0000" canEdit />
      </NextIntlClientProvider>,
    );
  }

  it("sends the version the edit started from when someone renames the lead meanwhile", async () => {
    renameLeadAction.mockResolvedValue({ status: "conflict", current: record("Theirs", 7) });
    const view = renderName({ name: "Ana", version: 6 });

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    const input = screen.getByLabelText("Nome do contato") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Mine" } });
    renameElsewhere(view, "Theirs", 7);
    expect(input.value).toBe("Mine");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(renameLeadAction).toHaveBeenCalledWith("lead-1", "Mine", 6));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Theirs");
  });

  it("retries a conflict with the version the conflict returned", async () => {
    renameLeadAction
      .mockResolvedValueOnce({ status: "conflict", current: record("Theirs", 7) })
      .mockResolvedValueOnce({ status: "saved", lead: record("Mine", 8) });
    const view = renderName({ name: "Ana", version: 6 });

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    const input = screen.getByLabelText("Nome do contato");
    fireEvent.change(input, { target: { value: "Mine" } });
    renameElsewhere(view, "Theirs", 7);
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("alert");

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(renameLeadAction).toHaveBeenCalledTimes(2));
    expect(renameLeadAction.mock.calls[1]).toEqual(["lead-1", "Mine", 7]);
  });

  it("closes an untouched edit without saving and shows the newer name", () => {
    const view = renderName({ name: "Ana", version: 6 });

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    renameElsewhere(view, "Theirs", 7);
    fireEvent.keyDown(screen.getByLabelText("Nome do contato"), { key: "Enter" });

    expect(renameLeadAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Theirs/ }).textContent).toBe("Theirs");
  });

  it("explains a refusal by its code and keeps the draft", async () => {
    renameLeadAction.mockResolvedValue({
      status: "failed",
      error: { status: 428, code: "version_required", message: "Informe a versão carregada" },
    });
    renderName();

    typeName("Ana Paula");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ptMessages.leads.errors.version_required),
    );
    expect((screen.getByLabelText("Nome do contato") as HTMLInputElement).value).toBe("Ana Paula");
  });

  it("never shows the raw server text for an unknown refusal", async () => {
    renameLeadAction.mockResolvedValue({ status: "failed", error: { status: 500, message: "pq: deadlock" } });
    renderName();

    typeName("Ana Paula");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ptMessages.leads.rename.failed));
  });

  it("says the lead changed elsewhere when a conflict kept the same name", async () => {
    renameLeadAction.mockResolvedValue({ status: "conflict", current: record("Ana", 5) });
    renderName();

    typeName("Ana Paula");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(ptMessages.leads.rename.conflictOther);
  });

  it("links the conflict to the field it explains", async () => {
    renameLeadAction.mockResolvedValue({ status: "conflict", current: record("Ana Souza", 5) });
    renderName();

    typeName("Ana Paula");

    const alert = await screen.findByRole("alert");
    expect(alert.id).not.toBe("");
    expect(screen.getByLabelText("Nome do contato").getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("cancels the edit from the keyboard", () => {
    renderName();

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    fireEvent.change(screen.getByLabelText("Nome do contato"), { target: { value: "Ana Paula" } });
    fireEvent.click(screen.getByRole("button", { name: ptMessages.leads.rename.cancel }));

    expect(screen.queryByLabelText("Nome do contato")).toBeNull();
    expect(screen.getByRole("button", { name: /Ana/ }).textContent).toBe("Ana");
    expect(renameLeadAction).not.toHaveBeenCalled();
  });

  it("forgets what it learned about one lead when another lead is shown", async () => {
    renameLeadAction.mockResolvedValueOnce({ status: "saved", lead: record("Alice Renamed", 7) });
    const view = renderName({ name: "Alice", version: 6 });

    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    fireEvent.change(screen.getByLabelText("Nome do contato"), { target: { value: "Alice Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("Nome do contato"), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("button", { name: /Alice Renamed/ })).toBeTruthy());

    view.rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <EditableLeadName leadId="lead-2" name="Bruno" version={2} fallback="(11) 98888-0000" canEdit />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: /Bruno/ }).textContent).toBe("Bruno");
    renameLeadAction.mockResolvedValueOnce({ status: "saved", lead: { ...record("Bruno Silva", 3), id: "lead-2" } });
    fireEvent.click(screen.getByRole("button", { name: /Bruno/ }));
    expect((screen.getByLabelText("Nome do contato") as HTMLInputElement).value).toBe("Bruno");
    fireEvent.change(screen.getByLabelText("Nome do contato"), { target: { value: "Bruno Silva" } });
    fireEvent.keyDown(screen.getByLabelText("Nome do contato"), { key: "Enter" });

    await waitFor(() => expect(renameLeadAction).toHaveBeenCalledTimes(2));
    expect(renameLeadAction.mock.calls[1]).toEqual(["lead-2", "Bruno Silva", 2]);
  });

  it("closes the editor and its conflict when another lead is shown", async () => {
    renameLeadAction.mockResolvedValue({ status: "conflict", current: record("Ana Souza", 5) });
    const view = renderName();

    typeName("Ana Paula");
    await screen.findByRole("alert");

    view.rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <EditableLeadName leadId="lead-2" name="Bruno" version={2} fallback="(11) 98888-0000" canEdit />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText("Nome do contato")).toBeNull();
    expect(screen.getByRole("button", { name: /Bruno/ }).textContent).toBe("Bruno");
  });

  it("keeps a save that finishes after the lead changed away from the lead now shown", async () => {
    let finish!: (value: unknown) => void;
    renameLeadAction.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const view = renderName();

    typeName("Ana Paula");
    view.rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <EditableLeadName leadId="lead-2" name="Bruno" version={2} fallback="(11) 98888-0000" canEdit />
      </NextIntlClientProvider>,
    );
    finish({ status: "saved", lead: record("Ana Paula", 4) });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: /Bruno/ }).textContent).toBe("Bruno");
  });
});
