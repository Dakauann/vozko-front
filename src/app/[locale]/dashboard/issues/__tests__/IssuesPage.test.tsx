/**
 * @vitest-environment happy-dom
 */

import type { Issue, IssueListMeta } from "@/lib/issues/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import IssuesPage from "@/app/[locale]/dashboard/issues/page";

vi.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_target: unknown, prop: string) =>
          React.forwardRef(
            (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
              const {
                initial: _i,
                animate: _a,
                exit: _e,
                transition: _t,
                whileHover: _wh,
                whileTap: _wt,
                ...rest
              } = props;
              return React.createElement(prop, { ...rest, ref });
            },
          ),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: () => true,
    currentWorkspace: { id: "ws-1" },
  }),
}));

const listMock = vi.fn();
vi.mock("@/app/actions/issues", () => ({
  listIssuesAction: (...args: unknown[]) => listMock(...args),
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({
    badge,
    description,
    actions,
  }: {
    badge: string;
    description: string;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="page-header">
      <span>{badge}</span>
      <span>{description}</span>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

vi.mock("@/components/elevated-design/table/dashboard-table", () => ({
  DashboardTable: ({
    data,
    loading,
    emptyState,
    onRowClick,
    columns,
  }: {
    data: Issue[];
    loading: boolean;
    emptyState: { title: string; description: string };
    onRowClick: (row: Issue) => void;
    columns: {
      key: string;
      header: string;
      render: (row: Issue) => React.ReactNode;
    }[];
  }) => (
    <div data-testid="dashboard-table">
      {loading && <span data-testid="loading">Loading</span>}
      {!loading && data.length === 0 && (
        <div data-testid="empty-state">
          <span>{emptyState.title}</span>
          <span>{emptyState.description}</span>
        </div>
      )}
      {data.map((row) => (
        <div
          key={row.id}
          data-testid={`row-${row.id}`}
          onClick={() => onRowClick(row)}
        >
          {columns.map(
            (col: { key: string; render: (row: Issue) => React.ReactNode }) => (
              <span key={col.key}>{col.render(row)}</span>
            ),
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/elevated-design/elevated-input", () => ({
  default: (
    props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string },
  ) => (
    <input data-testid="search-input" placeholder={props.label} {...props} />
  ),
}));

vi.mock("@/components/elevated-design/elevated-select", () => ({
  ElevatedSelect: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (v: string) => void;
    value: string;
  }) => (
    <select
      data-testid="status-filter"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  ElevatedSelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

vi.mock("@/components/elevated-design/button", () => ({
  default: ({ title, link }: { title: string; link?: string }) => (
    <a data-testid="create-button" href={link}>
      {title}
    </a>
  ),
}));

function makeIssue(overrides: Partial<Issue> & { id: string }): Issue {
  return {
    title: "Test Issue",
    description: "Test description",
    status: "open",
    workspaceId: "ws-1",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function makeMeta(overrides?: Partial<IssueListMeta>): IssueListMeta {
  return {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
    ...overrides,
  };
}

describe("IssuesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    listMock.mockReturnValue(new Promise(() => {})); 
    render(<IssuesPage />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("renders issues after load", async () => {
    const issues = [
      makeIssue({ id: "i-1", title: "Bug in login" }),
      makeIssue({ id: "i-2", title: "Feature request", status: "closed" }),
    ];
    listMock.mockResolvedValue({
      issues,
      meta: makeMeta({ totalItems: 2 }),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("row-i-1")).toBeInTheDocument();
    });

    expect(screen.getByTestId("row-i-2")).toBeInTheDocument();
    expect(screen.getByText("Bug in login")).toBeInTheDocument();
    expect(screen.getByText("Feature request")).toBeInTheDocument();
  });

  it("shows empty state when no issues", async () => {
    listMock.mockResolvedValue({
      issues: [],
      meta: makeMeta(),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    expect(screen.getByText("empty.title")).toBeInTheDocument();
  });

  it("shows error when API returns error", async () => {
    listMock.mockResolvedValue({
      error: "Server error",
      issues: [],
      meta: makeMeta(),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("navigates to issue detail on row click", async () => {
    const issues = [makeIssue({ id: "i-1", title: "Click me" })];
    listMock.mockResolvedValue({
      issues,
      meta: makeMeta({ totalItems: 1 }),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("row-i-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("row-i-1"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/issues/i-1");
  });

  it("renders page header", async () => {
    listMock.mockResolvedValue({
      issues: [],
      meta: makeMeta(),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-header")).toBeInTheDocument();
    });

    expect(screen.getByText("header.badge")).toBeInTheDocument();
  });

  it("renders create button when user has permission", async () => {
    listMock.mockResolvedValue({
      issues: [],
      meta: makeMeta(),
    });

    render(<IssuesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-header")).toBeInTheDocument();
    });

    expect(screen.getByTestId("header-actions")).toBeInTheDocument();
    expect(screen.getByTestId("create-button")).toBeInTheDocument();
  });
});
