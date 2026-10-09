import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { leadImportTrackerFor } from "@/components/leads/imports/use-lead-imports";
import {
  leadImportSummaryOf,
  type LeadImportCounts,
  type LeadImportField,
  type LeadImportJob,
  type LeadImportLimits,
} from "@/lib/leads/imports";

import { ImportLeadsDialog } from "../ImportLeadsDialog";

function translate(key: string, values?: Record<string, unknown>) {
  return values ? `${key} ${JSON.stringify(values)}` : key;
}

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign(translate, { has: () => true }),
  useFormatter: () => ({ number: (value: number) => String(value) }),
  useLocale: () => "pt",
}));

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const scope = vi.hoisted(() => ({ workspaceId: "ws-0" }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: scope.workspaceId }, can: () => true }),
}));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: "admin" } }),
}));

const actions = vi.hoisted(() => ({
  upload: vi.fn(),
  get: vi.fn(),
  dryRun: vi.fn(),
  start: vi.fn(),
  rejections: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/app/actions/lead-imports", () => ({
  uploadLeadImportAction: (...args: unknown[]) => actions.upload(...args),
  getLeadImportAction: (...args: unknown[]) => actions.get(...args),
  dryRunLeadImportAction: (...args: unknown[]) => actions.dryRun(...args),
  startLeadImportAction: (...args: unknown[]) => actions.start(...args),
  downloadLeadImportRejectionsAction: (...args: unknown[]) => actions.rejections(...args),
  listLeadImportsAction: (...args: unknown[]) => actions.list(...args),
}));

vi.mock("@/app/actions/medias", () => ({ uploadMediaAction: vi.fn() }));

vi.mock("@/lib/leads/template", () => ({ downloadLeadImportTemplate: vi.fn() }));

vi.mock("@/components/elevated-design/elevated-select", () => ({
  ElevatedSelect: ({
    value,
    onValueChange,
    children,
    label,
    disabled,
    "aria-label": ariaLabel,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    label?: string;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <select
      aria-label={ariaLabel ?? label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  ElevatedSelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  ElevatedSelectLabel: () => null,
  ElevatedSelectItem: ({
    value,
    children,
    disabled,
    description,
  }: {
    value: string;
    children: ReactNode;
    disabled?: boolean;
    description?: string;
  }) => (
    <option value={value} disabled={disabled} data-description={description}>
      {children}
    </option>
  ),
}));

const FIELDS: LeadImportField[] = [
  { key: "number", group: "identity", allowed: true, sensitive: false, repeatable: false },
  { key: "phone:mobile", group: "phones", allowed: true, sensitive: false, repeatable: true },
  { key: "name", group: "contact", allowed: true, sensitive: false, repeatable: false },
  { key: "district", group: "address", requires: "leads:read_addresses", allowed: false, sensitive: false, repeatable: false },
  { key: "owner_email", group: "owner", requires: "leads:assign", allowed: true, sensitive: false, repeatable: false },
  { key: "custom_field:renda", group: "custom", label: "Renda", requires: "leads:read_sensitive", allowed: true, sensitive: true, repeatable: false },
];

function counts(overrides: Partial<LeadImportCounts> = {}): LeadImportCounts {
  return {
    rows: 3,
    created: 0,
    enriched: 0,
    unchanged: 0,
    skipped: 0,
    rejected: 0,
    conflicting: 0,
    blocked: 0,
    addressesAdded: 0,
    addressesLocated: 0,
    addressesFilled: 0,
    linksPlanned: 0,
    linksCreated: 0,
    issues: {},
    ...overrides,
  };
}

function job(overrides: Partial<LeadImportJob> = {}): LeadImportJob {
  return {
    id: "imp-1",
    status: "uploaded",
    fileName: "base.csv",
    sizeBytes: 300,
    totalRows: 3,
    processed: 0,
    preview: {
      headers: ["telefone", "celular 2", "nome", "bairro"],
      sample: [["5511999990000", "", "Ana", "Centro"], ["5511999990001", "11988887777", "Bruno", "Lapa"]],
      columns: [
        { index: 0, header: "telefone", field: "number" },
        { index: 1, header: "celular 2", field: "phone:mobile" },
        { index: 2, header: "nome", field: "name" },
        { index: 3, header: "bairro", field: "district" },
      ],
    },
    fields: FIELDS,
    options: { fillEmpty: true, seedInbox: false, seedConversations: false },
    createdAt: "2026-10-08T12:00:00Z",
    expiresAt: "2026-10-15T12:00:00Z",
    ...overrides,
  };
}

const LIMITS: LeadImportLimits = {
  maxBytes: 31457280,
  maxMegabytes: 30,
  maxRows: 150000,
  maxSeededConversations: 120,
  retentionDays: 7,
  maxUnusedUploads: 5,
};

function tracker() {
  return leadImportTrackerFor(scope.workspaceId, "u-1");
}

function Harness({ initial = null }: { initial?: string | null }) {
  const [jobId, setJobId] = useState<string | null>(initial);
  return <ImportLeadsDialog open onOpenChange={() => {}} jobId={jobId} onJobIdChange={setJobId} />;
}

function openWith(value: LeadImportJob) {
  tracker().track(value);
  return render(<Harness initial={value.id} />);
}

function columnSelect(header: string) {
  return screen.getByLabelText(`mapping.choose {"column":"${header}"}`) as HTMLSelectElement;
}

let workspaces = 0;

beforeEach(() => {
  vi.clearAllMocks();
  workspaces += 1;
  scope.workspaceId = `ws-${workspaces}`;
  actions.list.mockResolvedValue({ list: { items: [], limits: LIMITS } });
  actions.get.mockImplementation(async (id: string) => ({ job: tracker().get(id)?.job ?? job({ id }) }));
  actions.rejections.mockResolvedValue({ error: null });
});

describe("ImportLeadsDialog file step", () => {
  it("uploads the chosen sheet and opens the columns the server suggested", async () => {
    actions.upload.mockResolvedValue({ job: job() });
    render(<Harness />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["telefone,nome\n"], "base.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(actions.upload).toHaveBeenCalledWith(file));
    await screen.findByText("mapping.title");
    expect(columnSelect("telefone").value).toBe("number");
    expect(columnSelect("celular 2").value).toBe("phone:mobile");
    expect(columnSelect("bairro").value).toBe("__none");
    expect(screen.getByText(`mapping.recognised {"count":3,"total":4}`)).toBeInTheDocument();
    expect(screen.getByText("11988887777")).toBeInTheDocument();
    expect(tracker().get("imp-1")?.job?.status).toBe("uploaded");
  });

  it("toasts a refused upload with the coded message and the cap the server listed", async () => {
    actions.upload.mockResolvedValue({ error: { code: "lead_import_file_too_large", status: 413 } });
    render(<Harness />);
    await screen.findByText(/^file.limits/);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "big.csv")] } });

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("errorTitle", {
        description: `errors.lead_import_file_too_large {"megabytes":"30"}`,
      }),
    );
    expect(screen.queryByText("mapping.title")).toBeNull();
  });
});

describe("ImportLeadsDialog mapping step", () => {
  it("offers every field of the catalog and locks the ones the person may not map, with the reason", () => {
    openWith(job());
    const options = within(columnSelect("bairro")).getAllByRole("option") as HTMLOptionElement[];

    expect(options.map((option) => option.value)).toEqual([
      "__none",
      "number",
      "phone:mobile",
      "name",
      "district",
      "owner_email",
      "custom_field:renda",
    ]);
    const district = options.find((option) => option.value === "district");
    expect(district?.disabled).toBe(true);
    expect(district?.dataset.description).toBe("requires.leads_read_addresses");
    const sensitive = options.find((option) => option.value === "custom_field:renda");
    expect(sensitive?.textContent).toBe(`fields.custom {"label":"Renda"}`);
    expect(sensitive?.dataset.description).toBe("mapping.sensitive");
  });

  it("moves a single use field from the column that had it and lets phones repeat", () => {
    openWith(job());

    fireEvent.change(columnSelect("bairro"), { target: { value: "name" } });
    expect(columnSelect("bairro").value).toBe("name");
    expect(columnSelect("nome").value).toBe("__none");

    fireEvent.change(columnSelect("telefone"), { target: { value: "phone:mobile" } });
    expect(columnSelect("telefone").value).toBe("phone:mobile");
    expect(columnSelect("celular 2").value).toBe("phone:mobile");
  });

  it("simulates with the mapped columns and the policy", async () => {
    actions.dryRun.mockResolvedValue({ job: job({ status: "analyzing" }) });
    openWith(job());

    fireEvent.click(screen.getByRole("button", { name: "dryRun.run" }));

    await waitFor(() => expect(actions.dryRun).toHaveBeenCalled());
    expect(actions.dryRun).toHaveBeenCalledWith("imp-1", {
      columns: [
        { index: 0, field: "number" },
        { index: 1, field: "phone:mobile" },
        { index: 2, field: "name" },
      ],
      onExisting: "fill_empty",
      seedInbox: false,
    });
    await screen.findByRole("button", { name: "dryRun.running" });
    expect(tracker().get("imp-1")?.job?.status).toBe("analyzing");
    expect(columnSelect("telefone").disabled).toBe(true);
  });

  it("starts a suggested column the person may not map as not imported and leaves it out of the simulation", async () => {
    actions.dryRun.mockResolvedValue({ job: job({ status: "analyzing" }) });
    openWith(job());

    expect(columnSelect("bairro").value).toBe("__none");
    fireEvent.click(screen.getByRole("button", { name: "dryRun.run" }));

    await waitFor(() => expect(actions.dryRun).toHaveBeenCalled());
    const [, sent] = actions.dryRun.mock.calls[0];
    expect(sent.columns.map((column: { index: number }) => column.index)).toEqual([0, 1, 2]);
  });

  it("refuses to simulate with nothing mapped and says why", () => {
    openWith(job({ preview: { ...job().preview, columns: [] } }));

    expect(screen.getByRole("button", { name: "dryRun.run" })).toBeDisabled();
    expect(screen.getByText("mapping.nothingMapped")).toBeInTheDocument();
  });

  it("shows a mapping refusal next to the columns instead of a toast", async () => {
    actions.dryRun.mockResolvedValue({
      error: {
        code: "lead_import_mapping_invalid",
        status: 400,
        expected: { rule: "needs_pair", field: "longitude", column: "-1" },
      },
    });
    openWith(job());

    fireEvent.click(screen.getByRole("button", { name: "dryRun.run" }));

    await screen.findByText(`mappingRules.needs_pair {"column":"","field":"fields.longitude"}`);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("toasts a permission refusal naming the permission", async () => {
    actions.dryRun.mockResolvedValue({
      error: { code: "lead_import_forbidden", status: 403, expected: { permission: "leads:assign" } },
    });
    openWith(job());

    fireEvent.click(screen.getByRole("button", { name: "dryRun.run" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("errorTitle", {
        description: `errors.lead_import_forbidden {"permission":"permissions.leads_assign"}`,
      }),
    );
  });

  it("locks completing existing leads for someone who cannot edit them", () => {
    openWith(job({ options: { fillEmpty: false, seedInbox: false, seedConversations: false } }));
    const policy = screen.getByLabelText("existing.label") as HTMLSelectElement;

    expect(policy.value).toBe("skip");
    const fill = within(policy).getByRole("option", { name: "existing.fillEmpty" }) as HTMLOptionElement;
    expect(fill.disabled).toBe(true);
    expect(fill.dataset.description).toBe("existing.fillEmptyLocked");
  });

  it("shows the dry run counts and starts the import from them", async () => {
    actions.start.mockResolvedValue({ job: job({ status: "importing", startedAt: "2026-10-08T12:05:00Z" }) });
    openWith(
      job({
        status: "analyzed",
        dryRun: counts({ rows: 3, created: 2, enriched: 1, linksPlanned: 1, issues: { phone_invalid: 1 } }),
        settings: {
          columns: job().preview.columns,
          onExisting: "fill_empty",
          seedInbox: false,
          seedConversations: false,
        },
      }),
    );

    expect(screen.getByText("counts.planned.created")).toBeInTheDocument();
    expect(screen.getByText("counts.planned.enriched")).toBeInTheDocument();
    expect(screen.getByText("counts.planned.links")).toBeInTheDocument();
    expect(screen.getByText(`issues.title {"count":"1"}`)).toBeInTheDocument();
    expect(screen.getByText(`file.rows {"count":3}`)).toBeInTheDocument();
    expect(screen.getByText("reasons.phone_invalid")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `start.action {"count":3}` }));

    await waitFor(() => expect(actions.start).toHaveBeenCalledWith("imp-1"));
    await screen.findByRole("button", { name: "closeBackground" });
  });

  it("asks for a new simulation after the columns change", () => {
    openWith(job({ status: "analyzed", dryRun: counts({ created: 3 }) }));
    expect(screen.getByRole("button", { name: `start.action {"count":3}` })).toBeInTheDocument();

    fireEvent.change(columnSelect("bairro"), { target: { value: "owner_email" } });

    expect(screen.getByText("dryRun.stale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dryRun.again" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: `start.action {"count":3}` })).toBeNull();
  });
});

describe("ImportLeadsDialog seed options", () => {
  it("hides inbox seeding when the server does not offer it", () => {
    openWith(job());
    expect(screen.queryByText("seedInbox.label")).toBeNull();
  });

  it("offers the example conversation only when the server allows it and inbox seeding is on", () => {
    openWith(job({ options: { fillEmpty: true, seedInbox: true, seedConversations: false } }));
    fireEvent.click(screen.getByText("seedInbox.label"));
    expect(screen.queryByText("seedConversations.label")).toBeNull();
  });

  it("sends the example conversation script with the dry run", async () => {
    const seeding = { fillEmpty: true, seedInbox: true, seedConversations: true };
    actions.dryRun.mockResolvedValue({ job: job({ status: "analyzing", options: seeding }) });
    openWith(job({ options: seeding }));

    fireEvent.click(screen.getByText("seedInbox.label"));
    fireEvent.click(screen.getByText("seedConversations.label"));
    expect(screen.getByRole("button", { name: "dryRun.run" })).toBeDisabled();

    const body = screen.getAllByRole("textbox")[0];
    fireEvent.change(body, { target: { value: "Oi {{1}}, tudo bem?" } });
    fireEvent.click(screen.getByRole("button", { name: "dryRun.run" }));

    await waitFor(() => expect(actions.dryRun).toHaveBeenCalled());
    const [, sent] = actions.dryRun.mock.calls[0];
    expect(sent.seedInbox).toBe(true);
    expect(sent.seedConversations).toEqual({ bodies: ["Oi {{1}}, tudo bem?"], maxMessages: 4 });
    await screen.findByRole("button", { name: "dryRun.running" });
    expect(screen.getByLabelText("seedConversations.mediaKind")).toBeDisabled();
    expect(screen.getByLabelText("seedConversations.maxMessages")).toBeDisabled();
  });

  it("keeps the script of the last simulation without asking to type it again", () => {
    openWith(
      job({
        status: "analyzed",
        options: { fillEmpty: true, seedInbox: true, seedConversations: true },
        dryRun: counts({ created: 3 }),
        settings: { columns: job().preview.columns, onExisting: "fill_empty", seedInbox: true, seedConversations: true },
      }),
    );

    expect(screen.getByText("seedConversations.kept")).toBeInTheDocument();
    expect(screen.queryByText("seedConversations.invalid")).toBeNull();
    expect(screen.queryByText("seedConversations.variantsTitle")).toBeNull();
    expect(screen.getByRole("button", { name: `start.action {"count":3}` })).toBeEnabled();
  });

  it("asks for a new script once the mapping changes after a simulation with one", () => {
    openWith(
      job({
        status: "analyzed",
        options: { fillEmpty: true, seedInbox: true, seedConversations: true },
        dryRun: counts({ created: 3 }),
        settings: { columns: job().preview.columns, onExisting: "fill_empty", seedInbox: true, seedConversations: true },
      }),
    );

    fireEvent.change(columnSelect("bairro"), { target: { value: "owner_email" } });

    expect(screen.queryByText("seedConversations.kept")).toBeNull();
    expect(screen.getByText("seedConversations.rewrite")).toBeInTheDocument();
    expect(screen.queryByText("seedConversations.invalid")).toBeNull();
    expect(screen.getByRole("button", { name: "dryRun.again" })).toBeDisabled();
  });

  it("asks for the script again when the simulation that carried it failed", () => {
    openWith(
      job({
        status: "failed",
        failureCode: "stalled",
        options: { fillEmpty: true, seedInbox: true, seedConversations: true },
        settings: { columns: job().preview.columns, onExisting: "fill_empty", seedInbox: true, seedConversations: true },
      }),
    );

    expect(screen.queryByText("seedConversations.kept")).toBeNull();
    expect(screen.getByText("seedConversations.rewrite")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dryRun.again" })).toBeDisabled();
  });

  it("opens a blank script when the person chooses to write a new one", () => {
    openWith(
      job({
        status: "analyzed",
        options: { fillEmpty: true, seedInbox: true, seedConversations: true },
        dryRun: counts({ created: 3 }),
        settings: { columns: job().preview.columns, onExisting: "fill_empty", seedInbox: true, seedConversations: true },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "seedConversations.writeNew" }));

    expect(screen.getByText("seedConversations.variantsTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dryRun.again" })).toBeDisabled();
  });
});

describe("ImportLeadsDialog progress", () => {
  it("follows the import while it runs and ends with the result and the rejections file", async () => {
    const running = job({ status: "importing", stage: "rows", processed: 1, startedAt: "2026-10-08T12:05:00Z" });
    openWith(running);

    expect(screen.getByText(`progress.rows {"processed":"1","total":"3"}`)).toBeInTheDocument();
    expect(screen.getByText("progress.stages.rows")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");

    act(() => tracker().track({ ...running, stage: "links", processed: 3 }));
    expect(screen.getByText(`progress.rows {"processed":"3","total":"3"}`)).toBeInTheDocument();
    expect(screen.getByText("progress.stages.links")).toBeInTheDocument();

    act(() =>
      tracker().track({
        ...running,
        status: "done",
        processed: 3,
        finishedAt: "2026-10-08T12:06:00Z",
        result: counts({ created: 2, rejected: 1, linksCreated: 1, issues: { duplicate: 1 } }),
        seed: { queued: 2 },
      }),
    );

    expect(screen.getByText("counts.done.created")).toBeInTheDocument();
    expect(screen.getByText("counts.done.links")).toBeInTheDocument();
    expect(screen.getByText(`rejections.notice {"count":1}`)).toBeInTheDocument();
    expect(screen.getByText(`seed.queued {"count":2}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "rejections.download" }));
    await waitFor(() => expect(actions.rejections).toHaveBeenCalledWith("imp-1", "pt"));
  });

  it("lists every reason in the issues breakdown", () => {
    const reasons = ["duplicate", "invalid", "phone_invalid", "email_invalid", "owner_not_found", "relation_self", "record_invalid", "address_invalid", "consent_date_invalid"];
    openWith(
      job({
        status: "done",
        startedAt: "2026-10-08T12:05:00Z",
        result: counts({ created: 1, issues: Object.fromEntries(reasons.map((reason) => [reason, 1])) }),
      }),
    );

    for (const reason of reasons) expect(screen.getByText(`reasons.${reason}`)).toBeInTheDocument();
  });

  it("names the reason when the import stops", () => {
    openWith(job({ status: "failed", failureCode: "stalled", startedAt: "2026-10-08T12:05:00Z", result: counts({ created: 1 }) }));

    expect(screen.getByText("failure.title")).toBeInTheDocument();
    expect(screen.getByText("failure.stalled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "another" })).toBeInTheDocument();
  });

  it("offers a new import when the import no longer exists", async () => {
    actions.get.mockResolvedValue({ error: { status: 404, code: "lead_import_not_found" } });
    const remembered = job({ status: "importing", startedAt: "2026-10-08T12:05:00Z" });
    tracker().track(remembered);
    render(<Harness initial="imp-1" />);

    await waitFor(() => expect(screen.getByText(`gone {"days":7}`)).toBeInTheDocument(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "another" }));
    expect(screen.getByRole("button", { name: "file.choose" })).toBeInTheDocument();
  });

  it("says the import no longer exists without a number of days until the server sent its retention", async () => {
    actions.list.mockReturnValue(new Promise(() => {}));
    actions.get.mockResolvedValue({ error: { status: 404, code: "lead_import_not_found" } });
    tracker().track(job({ status: "importing", startedAt: "2026-10-08T12:05:00Z" }));
    render(<Harness initial="imp-1" />);

    await waitFor(() => expect(screen.getByText("goneNoLimit")).toBeInTheDocument(), { timeout: 4000 });
  });
});

describe("ImportLeadsDialog server limits", () => {
  it("states the file caps the server enforces", async () => {
    render(<Harness />);
    expect(await screen.findByText(`file.limits {"megabytes":"30","rows":"150000"}`)).toBeInTheDocument();
  });

  it("states no caps it has not received from the server", async () => {
    actions.list.mockResolvedValue({ list: { items: [], limits: null } });
    render(<Harness />);
    await waitFor(() => expect(actions.list).toHaveBeenCalled());
    expect(screen.queryByText(/^file\.limits/)).toBeNull();
  });

  it("names the server's cap of example conversations", async () => {
    const seeding = { fillEmpty: true, seedInbox: true, seedConversations: true };
    openWith(job({ options: seeding }));
    fireEvent.click(screen.getByText("seedInbox.label"));
    fireEvent.click(screen.getByText("seedConversations.label"));
    expect(await screen.findByText(`seedConversations.costNotice {"max":"120"}`)).toBeInTheDocument();
  });

  it("explains the cost without a number until the server sent the cap", () => {
    actions.list.mockReturnValue(new Promise(() => {}));
    const seeding = { fillEmpty: true, seedInbox: true, seedConversations: true };
    openWith(job({ options: seeding }));
    fireEvent.click(screen.getByText("seedInbox.label"));
    fireEvent.click(screen.getByText("seedConversations.label"));
    expect(screen.getByText("seedConversations.costNoticeNoLimit")).toBeInTheDocument();
  });
});

describe("ImportLeadsDialog stored script", () => {
  const seeding = { fillEmpty: true, seedInbox: true, seedConversations: true };
  const seedScript = { bodies: ["Oi {{1}}, tudo bem?"], maxMessages: 3, context: "escola", attachment: { mediaId: "m-1", kind: "image" } };
  const analyzed = () =>
    job({
      status: "analyzed",
      options: seeding,
      dryRun: counts({ created: 3 }),
      settings: { columns: job().preview.columns, onExisting: "fill_empty", seedInbox: true, seedConversations: true, seedScript },
    });

  it("shows the script of the last simulation so the importer can read it", () => {
    openWith(analyzed());

    expect(screen.getByDisplayValue("Oi {{1}}, tudo bem?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("escola")).toBeInTheDocument();
    expect(screen.getByText("seedConversations.savedMedia")).toBeInTheDocument();
    expect(screen.queryByText("seedConversations.kept")).toBeNull();
    expect(screen.queryByText("seedConversations.rewrite")).toBeNull();
    expect(screen.getByRole("button", { name: `start.action {"count":3}` })).toBeEnabled();
  });

  it("sends the stored script again when the columns change", async () => {
    actions.dryRun.mockResolvedValue({ job: job({ status: "analyzing", options: seeding }) });
    openWith(analyzed());

    fireEvent.change(columnSelect("bairro"), { target: { value: "owner_email" } });
    fireEvent.click(screen.getByRole("button", { name: "dryRun.again" }));

    await waitFor(() => expect(actions.dryRun).toHaveBeenCalled());
    const [, sent] = actions.dryRun.mock.calls[0];
    expect(sent.seedConversations).toEqual(seedScript);
  });

  it("offers the stored script again after a simulation that failed", () => {
    openWith(job({ ...analyzed(), status: "failed", failureCode: "stalled", dryRun: undefined }));

    expect(screen.getByDisplayValue("Oi {{1}}, tudo bem?")).toBeInTheDocument();
    expect(screen.queryByText("seedConversations.rewrite")).toBeNull();
    expect(screen.getByRole("button", { name: "dryRun.again" })).toBeEnabled();
  });
});

describe("ImportLeadsDialog address placement", () => {
  const finished = (overrides: Partial<LeadImportJob> = {}) =>
    job({
      status: "done",
      processed: 3,
      startedAt: "2026-10-08T12:05:00Z",
      finishedAt: "2026-10-08T12:06:00Z",
      result: counts({ created: 100, addressesAdded: 90, addressesLocated: 10, noAddress: 10 }),
      placement: { onMap: 52, approximate: 30, pending: 6, notFound: 0, quotaExceeded: 2, refused: 0 },
      ...overrides,
    });

  it("splits the import's addresses by how precisely the map places them", () => {
    openWith(finished());

    const card = screen.getByRole("region", { name: "placement.title" });
    const row = (key: string) => within(card).getByText(`placement.rows.${key}`).closest("div") as HTMLElement;
    expect(within(row("precise")).getByText("52")).toBeInTheDocument();
    expect(within(row("approximate")).getByText("30")).toBeInTheDocument();
    expect(within(row("pending")).getByText("8")).toBeInTheDocument();
    expect(within(row("noAddress")).getByText("10")).toBeInTheDocument();
    expect(within(card).queryByText("placement.rows.notLocated")).toBeNull();
    expect(within(card).getByText("placement.source")).toBeInTheDocument();
  });

  it("names the addresses that could not be located when there are some", () => {
    openWith(finished({ placement: { onMap: 52, approximate: 30, pending: 6, notFound: 3, quotaExceeded: 0, refused: 1 } }));

    const card = screen.getByRole("region", { name: "placement.title" });
    const row = within(card).getByText("placement.rows.notLocated").closest("div") as HTMLElement;
    expect(within(row).getByText("4")).toBeInTheDocument();
  });

  it("says n/d for an import that was never measured instead of zero", () => {
    openWith(finished({ placement: undefined, result: counts({ created: 100, addressesAdded: 90, addressesLocated: 10 }) }));

    const card = screen.getByRole("region", { name: "placement.title" });
    expect(within(card).getAllByText("n/d")).toHaveLength(4);
    expect(within(card).queryByText("0")).toBeNull();
  });

  it("shows how many rows brought no address in the simulation, or n/d when it was not counted", () => {
    openWith(job({ status: "analyzed", dryRun: counts({ created: 3, addressesAdded: 2, addressesFilled: 1, noAddress: 1 }) }));
    expect(screen.getByText("addresses.filled")).toBeInTheDocument();
    const noAddress = screen.getByText("addresses.noAddress").nextElementSibling as HTMLElement;
    expect(noAddress).toHaveTextContent("1");
  });

  it("marks the rows without an address as unknown for a simulation that did not count them", () => {
    openWith(job({ status: "analyzed", dryRun: counts({ created: 3, addressesAdded: 2 }) }));
    const noAddress = screen.getByText("addresses.noAddress").nextElementSibling as HTMLElement;
    expect(noAddress).toHaveTextContent("n/d");
  });

  it("warns about example conversations it could not confirm after a restart", () => {
    openWith(finished({ seed: { queued: 10, unconfirmed: 3 } }));
    expect(screen.getByText(`seed.unconfirmed {"count":3}`)).toBeInTheDocument();
  });
});

describe("ImportLeadsDialog imports from the server list", () => {
  it("loads the full import the person opens from the list", async () => {
    const listedJob = job({ status: "done", startedAt: "2026-10-08T12:05:00Z", result: counts({ created: 2 }) });
    const summary = leadImportSummaryOf(listedJob);
    actions.list.mockResolvedValue({ list: { items: [summary], limits: LIMITS } });
    actions.get.mockResolvedValue({ job: listedJob });
    const stop = tracker().subscribe(() => {});
    await waitFor(() => expect(tracker().get("imp-1")).toBeDefined());

    render(<Harness initial="imp-1" />);
    expect(screen.getByText("file.loading")).toBeInTheDocument();

    await waitFor(() => expect(actions.get).toHaveBeenCalledWith("imp-1"));
    expect(await screen.findByText("counts.done.created")).toBeInTheDocument();
    stop();
  });
});
