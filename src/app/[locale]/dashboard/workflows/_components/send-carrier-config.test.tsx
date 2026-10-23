import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { SendCarrierPreview } from "./node-previews/send-carrier-preview";
import { SendCarrierConfigSection } from "./send-carrier-config";

const listRcsSendersAction = vi.fn();
const listSmsRoutesAction = vi.fn();

vi.mock("@/app/actions/rcs", () => ({ listRcsSendersAction: (...args: unknown[]) => listRcsSendersAction(...args) }));
vi.mock("@/app/actions/sms", () => ({ listSmsRoutesAction: (...args: unknown[]) => listSmsRoutesAction(...args) }));

vi.mock("@/components/rcs/composer/RcsComposer", () => ({
  RcsComposer: ({ value, onChange, bindings }: { value: { text?: string }; onChange: (content: { text: string }) => void; bindings: unknown[] }) => (
    <textarea aria-label="rcs composer" data-bindings={bindings.length} value={value.text ?? ""} onChange={(event) => onChange({ text: event.target.value })} />
  ),
}));

vi.mock("@/components/sms/SmsComposer", () => ({
  SmsComposer: ({ value, onChange, brandPrefix }: { value: string; onChange: (text: string) => void; brandPrefix?: string }) => (
    <textarea aria-label="sms composer" data-prefix={brandPrefix ?? ""} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@/components/elevated-design/elevated-command-select", () => ({
  ElevatedCommandSelect: ({ label, options, onValueChange }: { label: string; options: { value: string; label: string }[]; onValueChange: (value: string) => void }) => (
    <select aria-label={label} onChange={(event) => onValueChange(event.target.value)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const copy = ptMessages.workflowsPage.carrierNode;
const BOTH = [{ value: "rcs", label: "RCS" }, { value: "sms", label: "SMS" }];
const SMS_ONLY = [{ value: "sms", label: "SMS" }];
const soon = ptMessages.carrierMessaging.comingSoon;
const defaults = { channel: "rcs", sender_id: "", route_id: "", content: { text: "" }, text: "", marketing: true };

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}

function sender(id: string, brand: string) {
  return { id, brand_name: brand, logo_url: "", banner_url: "", color: "#0B57D0", description: "", status: "launched", can_send: true };
}

beforeEach(() => {
  listRcsSendersAction.mockReset();
  listSmsRoutesAction.mockReset();
  listRcsSendersAction.mockResolvedValue({ data: { senders: [sender("snd-1", "Loja Ana")] }, error: null });
  listSmsRoutesAction.mockResolvedValue({ data: { routes: [{ id: "rt-1", brand_prefix: "LOJA", kind: "shared", number: "", status: "active", can_send: true }] }, error: null });
});

describe("SendCarrierConfigSection", () => {
  it("picks an RCS sender and edits the content without campaign bindings", async () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={BOTH} config={{}} defaults={defaults} onChange={onChange} />, { wrapper });
    await waitFor(() => expect(screen.getByRole("option", { name: "Loja Ana" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(copy.sender), { target: { value: "snd-1" } });
    expect(onChange).toHaveBeenCalledWith({ sender_id: "snd-1", _display_sender_id: "Loja Ana" });
    const composer = screen.getByLabelText("rcs composer");
    expect(composer.getAttribute("data-bindings")).toBe("0");
    fireEvent.change(composer, { target: { value: "Oi" } });
    expect(onChange).toHaveBeenCalledWith({ content: { text: "Oi" } });
  });

  it("switches to SMS and binds the route and its text", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SendCarrierConfigSection channelOptions={BOTH} config={{}} defaults={defaults} onChange={onChange} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: copy.channels.sms }));
    expect(onChange).toHaveBeenCalledWith({ channel: "sms" });
    rerender(<SendCarrierConfigSection channelOptions={BOTH} config={{ channel: "sms", route_id: "rt-1" }} defaults={defaults} onChange={onChange} />);
    await waitFor(() => expect(screen.getByLabelText("sms composer").getAttribute("data-prefix")).toBe("LOJA"));
    fireEvent.change(screen.getByLabelText("sms composer"), { target: { value: "Oi" } });
    expect(onChange).toHaveBeenCalledWith({ text: "Oi" });
  });

  it("turns marketing off", () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={BOTH} config={{}} defaults={defaults} onChange={onChange} />, { wrapper });
    fireEvent.click(screen.getByRole("switch", { name: new RegExp(copy.marketing) }));
    expect(onChange).toHaveBeenCalledWith({ marketing: false });
  });

  it("offers only the channels the backend schema lists and never loads RCS senders while RCS is coming soon", async () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={SMS_ONLY} config={{ channel: "sms" }} defaults={defaults} onChange={onChange} />, { wrapper });
    expect(screen.getByRole("button", { name: copy.channels.sms })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.channels.rcs })).toBeNull();
    await waitFor(() => expect(listSmsRoutesAction).toHaveBeenCalled());
    expect(listRcsSendersAction).not.toHaveBeenCalled();
  });

  it("never loads SMS routes while only RCS is offered", async () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={[{ value: "rcs", label: "RCS" }]} config={{ channel: "rcs" }} defaults={defaults} onChange={onChange} />, { wrapper });
    await waitFor(() => expect(listRcsSendersAction).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: copy.channels.sms })).toBeNull();
    expect(listSmsRoutesAction).not.toHaveBeenCalled();
  });

  it("explains an existing RCS node instead of showing its sender and composer", () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={SMS_ONLY} config={{ channel: "rcs" }} defaults={defaults} onChange={onChange} />, { wrapper });
    expect(screen.getByText(soon.nodeBody)).toBeTruthy();
    expect(screen.queryByLabelText("rcs composer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: copy.channels.sms }));
    expect(onChange).toHaveBeenCalledWith({ channel: "sms" });
  });

  it("shows the illegible state instead of guessing an unreadable config", () => {
    const onChange = vi.fn();
    render(<SendCarrierConfigSection channelOptions={BOTH} config={{ channel: "fax" }} defaults={defaults} onChange={onChange} />, { wrapper });
    expect(screen.getByText("Configuração ilegível")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recomeçar as opções" }));
    expect(onChange).toHaveBeenCalledWith(defaults);
  });
});

describe("SendCarrierPreview", () => {
  it("shows the channel and the message", () => {
    render(<SendCarrierPreview config={{ channel: "sms", text: "Seu cupom chegou" }} />, { wrapper });
    expect(screen.getByText(copy.channels.sms)).toBeTruthy();
    expect(screen.getByText("Seu cupom chegou")).toBeTruthy();
  });
});
