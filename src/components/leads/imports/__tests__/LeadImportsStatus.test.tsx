import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { leadImportSummaryOf, type LeadImportJob, type LeadImportStatus } from "@/lib/leads/imports";

import { LeadImportsStatus } from "../LeadImportsStatus";
import { leadImportTrackerFor } from "../use-lead-imports";

function translate(key: string, values?: Record<string, unknown>) {
  return values ? `${key} ${JSON.stringify(values)}` : key;
}

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign(translate, { has: () => true }),
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const scope = vi.hoisted(() => ({ workspaceId: "ws-status-0" }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: scope.workspaceId } }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));

const getJob = vi.hoisted(() => vi.fn());
const listJobs = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/lead-imports", () => ({
  getLeadImportAction: (...args: unknown[]) => getJob(...args),
  listLeadImportsAction: (...args: unknown[]) => listJobs(...args),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function job(id: string, status: LeadImportStatus, extra: Partial<LeadImportJob> = {}): LeadImportJob {
  return {
    id,
    status,
    fileName: `${id}.csv`,
    sizeBytes: 10,
    totalRows: 10,
    processed: 4,
    preview: { headers: ["telefone"], sample: [], columns: [] },
    fields: [],
    options: { fillEmpty: true, seedInbox: false, seedConversations: false },
    createdAt: "2026-10-08T12:00:00Z",
    expiresAt: "2026-10-15T12:00:00Z",
    ...extra,
  };
}

const done = (id: string) =>
  job(id, "done", {
    processed: 10,
    result: {
      rows: 10,
      created: 7,
      enriched: 2,
      unchanged: 1,
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
    },
  });

let run = 0;

beforeEach(() => {
  vi.clearAllMocks();
  run += 1;
  scope.workspaceId = `ws-status-${run}`;
  getJob.mockImplementation(async (id: string) => ({ job: job(id, "importing") }));
  listJobs.mockResolvedValue({ list: { items: [], limits: null } });
});

function tracker() {
  return leadImportTrackerFor(scope.workspaceId, "u-1");
}

describe("LeadImportsStatus", () => {
  it("renders nothing until an import is tracked", () => {
    const { container } = render(<LeadImportsStatus onOpen={vi.fn()} onImported={vi.fn()} visibleJobId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the imports the server lists for the person, newest first, without loading each one", async () => {
    const finished = leadImportSummaryOf(done("server"));
    listJobs.mockResolvedValue({ list: { items: [finished], limits: null } });
    render(<LeadImportsStatus onOpen={vi.fn()} onImported={vi.fn()} visibleJobId={null} />);

    await waitFor(() => expect(screen.getByText("server.csv")).toBeInTheDocument());
    expect(screen.getByText(`status.done {"created":7}`)).toBeInTheDocument();
    expect(listJobs).toHaveBeenCalledTimes(1);
    expect(getJob).not.toHaveBeenCalled();
  });

  it("lists tracked imports with their state and opens one", () => {
    tracker().track(done("old"));
    tracker().track(job("live", "importing"));
    const onOpen = vi.fn();
    render(<LeadImportsStatus onOpen={onOpen} onImported={vi.fn()} visibleJobId={null} />);

    expect(screen.getByText(`status.running {"count":1}`)).toBeInTheDocument();
    expect(screen.getByText(`status.importing {"processed":"4","total":"10"}`)).toBeInTheDocument();
    expect(screen.getByText(`status.done {"created":7}`)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /status.button/ })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "progress.label" })).toHaveAttribute("aria-valuenow", "40");
    fireEvent.click(screen.getByText("live.csv"));
    expect(onOpen).toHaveBeenCalledWith("live");
  });

  it("dismisses a finished import but not a running one", () => {
    tracker().track(done("old"));
    tracker().track(job("live", "importing"));
    render(<LeadImportsStatus onOpen={vi.fn()} onImported={vi.fn()} visibleJobId={null} />);

    expect(screen.queryByRole("button", { name: `status.dismiss {"file":"live.csv"}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `status.dismiss {"file":"old.csv"}` }));
    expect(tracker().get("old")).toBeUndefined();
  });

  it("reloads the list and toasts when an import finishes in the background", () => {
    tracker().track(job("live", "importing"));
    const onImported = vi.fn();
    const onOpen = vi.fn();
    render(<LeadImportsStatus onOpen={onOpen} onImported={onImported} visibleJobId={null} />);

    act(() => tracker().track(done("live")));

    expect(onImported).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    const [title, options] = toastMock.success.mock.calls[0];
    expect(title).toBe(`toast.done {"file":"live.csv"}`);
    expect(options.description).toBe(`toast.doneDescription {"created":7,"enriched":2}`);
    options.action.onClick();
    expect(onOpen).toHaveBeenCalledWith("live");
  });

  it("stays quiet about the import the dialog is showing, but still reloads", () => {
    tracker().track(job("live", "importing"));
    const onImported = vi.fn();
    render(<LeadImportsStatus onOpen={vi.fn()} onImported={onImported} visibleJobId="live" />);

    act(() => tracker().track(done("live")));

    expect(onImported).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("names the reason when a background import stops", () => {
    tracker().track(job("live", "importing"));
    render(<LeadImportsStatus onOpen={vi.fn()} onImported={vi.fn()} visibleJobId={null} />);

    act(() => tracker().track(job("live", "failed", { failureCode: "file_unavailable" })));

    expect(toastMock.error).toHaveBeenCalledWith(
      `toast.failed {"file":"live.csv"}`,
      expect.objectContaining({ description: "failure.file_unavailable" }),
    );
  });
});
