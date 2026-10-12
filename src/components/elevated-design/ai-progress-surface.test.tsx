import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => motion.reduced }));

import { AI_PROGRESS_PILL_HEIGHT } from "@/lib/ai-progress";

import { AI_PROGRESS_FRAME, AiProgressPill, AiProgressSurface } from "./ai-progress-surface";

const surface = (root: HTMLElement) => root.querySelector<HTMLElement>("[data-ai-progress]")!;

beforeEach(() => {
  motion.reduced = false;
});

describe("AiProgressSurface", () => {
  it("sweeps the box with the Elo glow and names the work in a polite live status", () => {
    const { container } = render(<AiProgressSurface label="Gerando imagem" className="aspect-video" />);
    const root = surface(container);
    expect(root).toHaveAttribute("data-ai-progress", "running");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("vz-ai-card");
    expect(root.className).toContain("vz-ai-job");
    expect(root.className).toContain("aspect-video");
    expect(root.querySelector("[data-job-sweep].vz-ai-ring")).not.toBeNull();
    expect(root.querySelector(".vz-ai-halo")).not.toBeNull();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Gerando imagem");
    expect(root.querySelector("[data-job-pill]")).toHaveTextContent("Gerando imagem");
  });

  it("never blocks the pointer", () => {
    const { container } = render(<AiProgressSurface label="Removendo o fundo" />);
    expect(surface(container).className).toContain("pointer-events-none");
  });

  it("shows a known progress as a labelled bar and a percentage", () => {
    render(<AiProgressSurface label="Gerando imagem" progress={42} />);
    expect(screen.getByRole("progressbar", { name: "Gerando imagem" })).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("has no bar when the progress is unknown", () => {
    render(<AiProgressSurface label="Gerando imagem" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("turns into the error state with the failure and its reason", () => {
    const { container } = render(<AiProgressSurface label="O fundo não foi removido" detail="O provedor está ocupado" failed progress={30} />);
    const root = surface(container);
    expect(root).toHaveAttribute("data-ai-progress", "failed");
    expect(root).not.toHaveAttribute("aria-busy");
    expect(root.className).toContain("border-destructive");
    expect(root.querySelector("[data-job-sweep]")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("O fundo não foi removido. O provedor está ocupado");
    expect(root.querySelector("[data-job-pill]")).toHaveAttribute("title", "O fundo não foi removido. O provedor está ocupado");
  });

  it("stands still when the person prefers reduced motion", () => {
    motion.reduced = true;
    const { container } = render(<AiProgressSurface label="Gerando imagem" />);
    const root = surface(container);
    expect(root).toHaveAttribute("data-motion", "static");
    expect(root.querySelector<HTMLElement>("[data-job-sweep]")!.style.animation).toBe("none");
    expect(root.querySelector<HTMLElement>(".vz-ai-halo")!.style.animation).toBe("none");
    expect(root.querySelector(".animate-spin")).toBeNull();
  });

  it("animates otherwise", () => {
    const { container } = render(<AiProgressSurface label="Gerando imagem" />);
    expect(surface(container)).toHaveAttribute("data-motion", "animated");
    expect(surface(container).querySelector(".animate-spin")).not.toBeNull();
  });

  it("can show only a small spinner badge, or nothing but the sweep", () => {
    const { container, rerender } = render(<AiProgressSurface label="Removendo o fundo" indicator="badge" />);
    expect(container.querySelector("[data-job-spinner]")).not.toBeNull();
    expect(container.querySelector("[data-job-pill]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Removendo o fundo");
    rerender(<AiProgressSurface label="Removendo o fundo" indicator="none" />);
    expect(container.querySelector("[data-job-spinner]")).toBeNull();
    expect(container.querySelector("[data-job-pill]")).toBeNull();
  });

  it("sits flush without the glow and stays silent when it has no label", () => {
    const { container } = render(<AiProgressSurface flush />);
    const root = surface(container);
    expect(root.querySelector(".vz-ai-halo")).toBeNull();
    expect(root.querySelector<HTMLElement>("[data-job-sweep]")!.style.inset).toBe("0px");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers ready frames for a status strip and a square placeholder", () => {
    expect(AI_PROGRESS_FRAME.strip).toContain("w-full");
    expect(AI_PROGRESS_FRAME.square).toContain("aspect-square");
  });
});

describe("AiProgressPill", () => {
  it("is the status pill on its own, hidden from assistive tech because the surface announces", () => {
    const { container } = render(<AiProgressPill label="Removendo o fundo" placement="below" className="absolute" style={{ left: 4 }} />);
    const pill = container.querySelector<HTMLElement>("[data-job-pill]")!;
    expect(pill).toHaveAttribute("data-job-pill", "below");
    expect(pill).toHaveAttribute("aria-hidden", "true");
    expect(pill.style).toMatchObject({ left: "4px", height: `${AI_PROGRESS_PILL_HEIGHT}px` });
    expect(pill.className).toContain("whitespace-nowrap");
  });
});
