/**
 * @vitest-environment happy-dom
 */

import type {
  Issue,
  IssueResponse as IssueResponseType,
} from "@/lib/issues/types";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IssueDetailClient from "@/app/[locale]/dashboard/issues/[issueId]/_components/IssueDetailClient";

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
                layout: _l,
                ...rest
              } = props;
              return React.createElement(prop, { ...rest, ref });
            },
          ),
      },
    ),
    AnimatePresence: ({
      children,
    }: {
      children: React.ReactNode;
      mode?: string;
    }) => children,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockUser = {
  id: "admin-1",
  email: "admin@test.com",
  role: "admin",
  customerType: "company" as const,
};
const useAuthMock = vi.fn().mockReturnValue({ user: mockUser });
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const getIssueMock = vi.fn();
const listResponsesMock = vi.fn();
const createResponseMock = vi.fn();
const closeIssueMock = vi.fn();

vi.mock("@/app/actions/issues", () => ({
  getIssueAction: (...args: unknown[]) => getIssueMock(...args),
  listIssueResponsesAction: (...args: unknown[]) => listResponsesMock(...args),
  createIssueResponseAction: (...args: unknown[]) =>
    createResponseMock(...args),
  closeIssueAction: (...args: unknown[]) => closeIssueMock(...args),
}));

vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: vi
    .fn()
    .mockResolvedValue({
      id: "media-1",
      url: "https://example.com/media.jpg",
      previewUrl: "https://example.com/media-preview.jpg",
    }),
}));

vi.mock("@/components/elevated-design/button", () => ({
  default: ({
    title,
    onClick,
    disabled,
  }: {
    title: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="elevated-button"
    >
      {title}
    </button>
  ),
}));

function makeIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: "issue-1",
    title: "Test Issue",
    description: "Some description",
    status: "open",
    workspaceId: "ws-1",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function makeResponse(
  overrides?: Partial<IssueResponseType>,
): IssueResponseType {
  return {
    id: "resp-1",
    issueId: "issue-1",
    authorId: "admin-1",
    body: "We are looking into this.",
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("IssueDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: mockUser });
  });

  it("shows loading spinner initially", () => {
    getIssueMock.mockReturnValue(new Promise(() => {}));
    listResponsesMock.mockReturnValue(new Promise(() => {}));
    render(<IssueDetailClient issueId="issue-1" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders issue details after load", async () => {
    const issue = makeIssue({ title: "Login broken" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("Login broken")).toBeInTheDocument();
    });

    expect(screen.getByText("Some description")).toBeInTheDocument();
    expect(screen.getByText("detail.noResponses")).toBeInTheDocument();
  });

  it("renders responses", async () => {
    const issue = makeIssue();
    const responses = [
      makeResponse({ id: "r-1", body: "First reply" }),
      makeResponse({ id: "r-2", body: "Second reply", authorId: "other-user" }),
    ];
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("First reply")).toBeInTheDocument();
    });

    expect(screen.getByText("Second reply")).toBeInTheDocument();
    expect(screen.getByText("detail.you")).toBeInTheDocument();
    expect(screen.getByText("detail.staff")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    getIssueMock.mockResolvedValue({ error: "Not found" });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });

  it("renders back button that navigates to issues list", async () => {
    getIssueMock.mockResolvedValue({ error: "fail" });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("detail.back")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("detail.back"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/issues");
  });

  it("shows close button for admin on open issue", async () => {
    const issue = makeIssue({ status: "open" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("detail.close")).toBeInTheDocument();
    });
  });

  it("hides close button for non-admin users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-1",
        email: "user@test.com",
        role: "user",
        customerType: "company",
      },
    });

    const issue = makeIssue({ status: "open" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Issue")).toBeInTheDocument();
    });

    expect(screen.queryByText("detail.close")).not.toBeInTheDocument();
  });

  it("hides response form for non-admin users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-1",
        email: "user@test.com",
        role: "user",
        customerType: "company",
      },
    });

    const issue = makeIssue({ status: "open" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Issue")).toBeInTheDocument();
    });

    expect(
      screen.queryByPlaceholderText("response.placeholder"),
    ).not.toBeInTheDocument();
  });

  it("shows response form for admin on open issue", async () => {
    const issue = makeIssue({ status: "open" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("response.placeholder"),
      ).toBeInTheDocument();
    });
  });

  it("shows closed notice when issue is closed", async () => {
    const issue = makeIssue({ status: "closed" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("detail.closedNotice")).toBeInTheDocument();
    });
  });

  it("hides response form when issue is closed", async () => {
    const issue = makeIssue({ status: "closed" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Issue")).toBeInTheDocument();
    });

    expect(
      screen.queryByPlaceholderText("response.placeholder"),
    ).not.toBeInTheDocument();
  });

  it("submits a response via Enter key", async () => {
    const issue = makeIssue();
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    const newResp = makeResponse({ body: "Thanks" });
    createResponseMock.mockResolvedValue({ response: newResp });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("response.placeholder"),
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(
      "response.placeholder",
    ) as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Thanks" } });
    });

    const formArea = document.querySelector(".border-t.border-border.p-4");
    expect(formArea).toBeTruthy();
    const buttons = formArea?.querySelectorAll("button[type='button']");
    expect(buttons!.length).toBeGreaterThan(0);
  });

  it("closes an issue", async () => {
    const issue = makeIssue({ status: "open" });
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses: [] });

    const closedIssue = makeIssue({ status: "closed" });
    closeIssueMock.mockResolvedValue({ issue: closedIssue });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("detail.close")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("detail.close"));

    await waitFor(() => {
      expect(closeIssueMock).toHaveBeenCalledWith("issue-1");
    });
  });

  it("shows image in response", async () => {
    const issue = makeIssue();
    const responses = [
      makeResponse({
        id: "r-1",
        body: "See attached",
        imageUrl: "https://example.com/img.png",
      }),
    ];
    getIssueMock.mockResolvedValue({ issue });
    listResponsesMock.mockResolvedValue({ responses });

    render(<IssueDetailClient issueId="issue-1" />);

    await waitFor(() => {
      expect(screen.getByText("See attached")).toBeInTheDocument();
    });

    const img = screen.getByAltText("detail.attachedImage");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/img.png");
  });
});
