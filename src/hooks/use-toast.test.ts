import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sonner = vi.hoisted(() => {
  const plain = vi.fn(() => "plain-id");
  return Object.assign(plain, {
    error: vi.fn(() => "error-id"),
    success: vi.fn(() => "success-id"),
    dismiss: vi.fn(),
  });
});
vi.mock("sonner", () => ({ toast: sonner }));

import { toast, useToast } from "./use-toast";

describe("use-toast forwards to sonner", () => {
  beforeEach(() => {
    sonner.mockClear();
    sonner.error.mockClear();
    sonner.success.mockClear();
    sonner.dismiss.mockClear();
  });

  it("sends a destructive toast as a sonner error with its description", () => {
    toast({ title: "Falhou", description: "Motivo", variant: "destructive" });
    expect(sonner.error).toHaveBeenCalledWith("Falhou", expect.objectContaining({ description: "Motivo" }));
    expect(sonner).not.toHaveBeenCalled();
  });

  it("sends a success toast as a sonner success", () => {
    toast({ title: "Pronto", variant: "success" });
    expect(sonner.success).toHaveBeenCalledWith("Pronto", expect.objectContaining({ description: undefined }));
  });

  it("sends a plain toast through sonner itself", () => {
    toast({ title: "Salvo", description: "Tudo certo" });
    expect(sonner).toHaveBeenCalledWith("Salvo", expect.objectContaining({ description: "Tudo certo" }));
    expect(sonner.error).not.toHaveBeenCalled();
  });

  it("promotes the description to the message when there is no title", () => {
    toast({ description: "Somente o motivo", variant: "destructive" });
    expect(sonner.error).toHaveBeenCalledWith("Somente o motivo", expect.objectContaining({ description: undefined }));
  });

  it("forwards duration and action", () => {
    const action = { label: "Tentar de novo", onClick: () => undefined };
    toast({ title: "Erro", variant: "destructive", duration: 9000, action });
    expect(sonner.error).toHaveBeenCalledWith("Erro", expect.objectContaining({ duration: 9000, action }));
  });

  it("dismisses the toast it showed", () => {
    const shown = toast({ title: "Erro", variant: "destructive" });
    expect(shown.id).toBe("error-id");
    shown.dismiss();
    expect(sonner.dismiss).toHaveBeenCalledWith("error-id");
  });

  it("returns a stable toast function from the hook", () => {
    const { result, rerender } = renderHook(() => useToast());
    const first = result.current.toast;
    rerender();
    expect(result.current.toast).toBe(first);
    result.current.toast({ title: "Oi" });
    expect(sonner).toHaveBeenCalledWith("Oi", expect.anything());
    result.current.dismiss("plain-id");
    expect(sonner.dismiss).toHaveBeenCalledWith("plain-id");
  });
});
