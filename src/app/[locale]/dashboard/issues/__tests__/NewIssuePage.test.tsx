/**
 * @vitest-environment happy-dom
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewIssuePage from "@/app/[locale]/dashboard/issues/new/page";

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
    currentWorkspace: { id: "ws-1" },
  }),
}));

const createIssueMock = vi.fn();
vi.mock("@/app/actions/issues", () => ({
  createIssueAction: (...args: unknown[]) => createIssueMock(...args),
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

vi.mock("@/components/elevated-design/elevated-input", () => ({
  default: (
    props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string },
  ) => (
    <input
      data-testid="title-input"
      placeholder={props.label}
      value={props.value}
      onChange={props.onChange}
      maxLength={props.maxLength}
      disabled={props.disabled}
      id={props.id}
    />
  ),
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
    <button type="button" onClick={onClick} disabled={disabled}>
      {title}
    </button>
  ),
}));

describe("NewIssuePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with title and description fields", () => {
    render(<NewIssuePage />);

    expect(screen.getByText("form.title")).toBeInTheDocument();
    expect(screen.getByText("form.subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("title-input")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("form.descriptionPlaceholder"),
    ).toBeInTheDocument();
  });

  it("renders back button", () => {
    render(<NewIssuePage />);

    expect(screen.getByText("form.back")).toBeInTheDocument();
    fireEvent.click(screen.getByText("form.back"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/issues");
  });

  it("shows validation error for empty title", async () => {
    render(<NewIssuePage />);

    const submitButton = screen.getByText("form.submit");
    expect(submitButton).toBeDisabled();
  });

  it("submits form with valid data", async () => {
    createIssueMock.mockResolvedValue({
      issue: { id: "new-issue-1" },
    });

    render(<NewIssuePage />);

    const titleInput = screen.getByTestId("title-input");

    fireEvent.change(titleInput, { target: { value: "Bug report" } });

    const form = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(form!);
    });

    await waitFor(() => {
      expect(createIssueMock).toHaveBeenCalledWith({
        title: "Bug report",
        description: "",
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard/issues/new-issue-1");
    });
  });

  it("shows error when API fails", async () => {
    createIssueMock.mockResolvedValue({
      error: "Server error",
    });

    render(<NewIssuePage />);

    const titleInput = screen.getByTestId("title-input");
    fireEvent.change(titleInput, { target: { value: "Bug" } });

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows error when API throws", async () => {
    createIssueMock.mockRejectedValue(new Error("network"));

    render(<NewIssuePage />);

    const titleInput = screen.getByTestId("title-input");
    fireEvent.change(titleInput, { target: { value: "Bug" } });

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText("form.error.submitFailed")).toBeInTheDocument();
    });
  });

  it("renders cancel button that navigates back", () => {
    render(<NewIssuePage />);

    fireEvent.click(screen.getByText("form.cancel"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/issues");
  });

  it("shows character count for title", () => {
    render(<NewIssuePage />);

    const titleInput = screen.getByTestId("title-input");
    fireEvent.change(titleInput, { target: { value: "Hello" } });

    expect(screen.getByText("5/255")).toBeInTheDocument();
  });

  it("shows character count for description", () => {
    render(<NewIssuePage />);

    const descInput = screen.getByPlaceholderText(
      "form.descriptionPlaceholder",
    );
    fireEvent.change(descInput, { target: { value: "Test desc" } });

    expect(screen.getByText("9/1000")).toBeInTheDocument();
  });
});
