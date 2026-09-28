import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DealAutomationDraft, DealAutomationSetting } from "@/components/channels/deal-automation-setting";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const funnels = vi.hoisted(() => ({ list: [] as Array<{ id: string; name: string }> }));
vi.mock("@/app/actions/crm-board", () => ({
  listPipelinesAction: async () => ({ pipelines: funnels.list }),
}));

const api = vi.hoisted(() => ({
  current: { data: { pipelineId: "", enabled: false } } as { data?: { pipelineId: string; enabled: boolean }; error?: { status: number } },
  saved: [] as string[],
  saveResult: {} as { error?: { status: number; message: string } },
}));
vi.mock("@/lib/deal-automation/client", () => ({
  getDealAutomation: async () => api.current,
  saveDealAutomation: async (_: unknown, pipelineId: string) => {
    api.saved.push(pipelineId);
    return api.saveResult.error ? { error: api.saveResult.error } : { data: { pipelineId, enabled: pipelineId !== "" } };
  },
}));

let choose: ((value: string) => void) | undefined;
vi.mock("@/components/elevated-design/elevated-select", () => ({
  ElevatedSelect: ({ value, onValueChange, children, placeholder, label }: { value?: string; onValueChange: (v: string) => void; children: React.ReactNode; placeholder?: string; label?: string }) => {
    choose = onValueChange;
    return (
      <div data-testid="select" data-value={value ?? ""} data-placeholder={placeholder} data-label={label}>
        {children}
      </div>
    );
  },
  ElevatedSelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <span data-option={value}>{children}</span>,
}));

const channel = { entryType: "instagram", kind: "account" as const, containerId: "acc-1" };

const toggle = () => screen.getByRole("switch");
const isOn = () => toggle().getAttribute("aria-checked") === "true";

beforeEach(() => {
  funnels.list = [
    { id: "deals", name: "Vendas" },
    { id: "renewals", name: "Renovações" },
  ];
  api.current = { data: { pipelineId: "deals", enabled: true } };
  api.saved = [];
  api.saveResult = {};
  choose = undefined;
});

describe("DealAutomationSetting", () => {
  it("is a switch that shows the saved funnel when on", async () => {
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(isOn()).toBe(true));
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("deals");
    expect(screen.getByText("Vendas")).toBeTruthy();
    expect(screen.queryByText("off")).toBeNull();
  });

  it("hides the funnel picker while off", async () => {
    api.current = { data: { pipelineId: "", enabled: false } };
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(toggle().hasAttribute("disabled")).toBe(false));
    expect(isOn()).toBe(false);
    expect(screen.queryByTestId("select")).toBeNull();
  });

  it("asks for a funnel when turned on, and saves only once one is chosen", async () => {
    api.current = { data: { pipelineId: "", enabled: false } };
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(toggle().hasAttribute("disabled")).toBe(false));
    fireEvent.click(toggle());
    const select = await screen.findByTestId("select");
    expect(select.getAttribute("data-placeholder")).toBe("choose");
    expect(screen.getByText("pickToFinish")).toBeTruthy();
    expect(api.saved).toEqual([]);
    choose?.("renewals");
    await waitFor(() => expect(api.saved).toEqual(["renewals"]));
    expect(screen.queryByText("pickToFinish")).toBeNull();
  });

  it("turns on straight away when there is a single funnel", async () => {
    funnels.list = [{ id: "deals", name: "Vendas" }];
    api.current = { data: { pipelineId: "", enabled: false } };
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(toggle().hasAttribute("disabled")).toBe(false));
    fireEvent.click(toggle());
    await waitFor(() => expect(api.saved).toEqual(["deals"]));
    await waitFor(() => expect(screen.getByTestId("select").getAttribute("data-value")).toBe("deals"));
  });

  it("turning off saves an empty funnel and hides the picker", async () => {
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(isOn()).toBe(true));
    fireEvent.click(toggle());
    await waitFor(() => expect(api.saved).toEqual([""]));
    await waitFor(() => expect(isOn()).toBe(false));
    expect(screen.queryByTestId("select")).toBeNull();
  });

  it("switching funnels saves the new one", async () => {
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(choose).toBeDefined());
    choose?.("renewals");
    await waitFor(() => expect(api.saved).toEqual(["renewals"]));
  });

  it("rolls back and explains a refused save", async () => {
    api.saveResult = { error: { status: 403, message: "forbidden" } };
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(isOn()).toBe(true));
    fireEvent.click(toggle());
    await waitFor(() => expect(screen.getByText("noPermission")).toBeTruthy());
    expect(isOn()).toBe(true);
    expect(screen.getByTestId("select").getAttribute("data-value")).toBe("deals");
  });

  it("stays off and points to the funnels page when no deal funnel exists", async () => {
    funnels.list = [];
    api.current = { data: { pipelineId: "", enabled: false } };
    render(<DealAutomationSetting channel={channel} />);
    await waitFor(() => expect(screen.getByText("noFunnels")).toBeTruthy());
    expect(toggle().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByTestId("select")).toBeNull();
  });

  it("stays disabled while loading or when the caller disables it", async () => {
    render(<DealAutomationSetting channel={channel} disabled />);
    expect(toggle().hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(isOn()).toBe(true));
    expect(toggle().hasAttribute("disabled")).toBe(true);
  });
});

describe("DealAutomationDraft", () => {
  it("holds the choice for a channel that does not exist yet, without saving", async () => {
    const onChange = vi.fn();
    render(<DealAutomationDraft value="" onChange={onChange} />);
    await waitFor(() => expect(toggle().hasAttribute("disabled")).toBe(false));
    expect(isOn()).toBe(false);
    fireEvent.click(toggle());
    expect(await screen.findByTestId("select")).toBeTruthy();
    choose?.("renewals");
    expect(onChange).toHaveBeenCalledWith("renewals");
    expect(api.saved).toEqual([]);
  });

  it("picks the only funnel straight away and clears it when turned off", async () => {
    funnels.list = [{ id: "deals", name: "Vendas" }];
    const onChange = vi.fn();
    const { rerender } = render(<DealAutomationDraft value="" onChange={onChange} />);
    await waitFor(() => expect(toggle().hasAttribute("disabled")).toBe(false));
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith("deals");
    rerender(<DealAutomationDraft value="deals" onChange={onChange} />);
    expect(isOn()).toBe(true);
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(api.saved).toEqual([]);
  });

  it("stays off when no deal funnel exists", async () => {
    funnels.list = [];
    render(<DealAutomationDraft value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("noFunnels")).toBeTruthy());
    expect(toggle().hasAttribute("disabled")).toBe(true);
  });
});
