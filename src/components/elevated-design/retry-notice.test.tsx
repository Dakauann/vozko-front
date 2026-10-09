import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RetryNotice } from "./retry-notice";

describe("RetryNotice", () => {
  it("states the failure and retries on the link", () => {
    const onRetry = vi.fn();
    render(<RetryNotice message="Falhou." retryLabel="Tentar de novo" onRetry={onRetry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Falhou.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("holds the link while a retry is running", () => {
    render(<RetryNotice message="Falhou." retryLabel="Tentar de novo" onRetry={() => undefined} retrying />);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeDisabled();
  });

  it("states the failure alone when nothing can be retried", () => {
    render(<RetryNotice message="Falhou." retryLabel="Tentar de novo" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
