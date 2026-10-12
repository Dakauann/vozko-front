import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { ANIMATION_RANGES, defaultVideoExport, type VideoExportRequest } from "@/lib/studio/animated-export";

import { ExportSettings, type ExportMoment } from "./export-settings";

const pt = ptMessages.studio.video.export;
const canvas = { width: 1080, height: 1920 };

function moment(overrides: Partial<ExportMoment> = {}): ExportMoment {
  return { area: null, useArea: false, onUseArea: vi.fn(), frameMs: 0, ...overrides };
}

function show(request: VideoExportRequest, onChange: (request: VideoExportRequest) => void, at: ExportMoment) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <TooltipProvider>
        <ExportSettings request={request} canvas={canvas} moment={at} onChange={onChange} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

function typeNumber(label: string, value: string) {
  const field = screen.getByRole("textbox", { name: label });
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("animation export settings", () => {
  it("takes any width and frame rate the renderer accepts, not only the presets", () => {
    const onChange = vi.fn();
    const request = defaultVideoExport("gif", canvas);
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <TooltipProvider>
          <ExportSettings request={request} canvas={canvas} moment={moment()} onChange={onChange} />
        </TooltipProvider>
      </NextIntlClientProvider>,
    );
    typeNumber(pt.widthExact, "1000");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ format: "gif", width: 1000 }));
    typeNumber(pt.widthExact, "50");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ width: ANIMATION_RANGES.width[0] }));
    typeNumber(pt.fpsExact, "30");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fps: 30 }));
    typeNumber(pt.fpsExact, "7");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fps: 7 }));
  });
});

describe("range and frame export settings", () => {
  it("asks to mark in and out before a range can be chosen, then offers the whole film or the marked area", () => {
    const onUseArea = vi.fn();
    show({ format: "mp4" }, vi.fn(), moment());
    expect(screen.getByText(pt.rangeHint)).toBeInTheDocument();
    cleanup();
    show({ format: "mp4" }, vi.fn(), moment({ area: { startMs: 1000, endMs: 3000 }, onUseArea }));
    fireEvent.click(screen.getByRole("button", { name: /0:01\.00/ }));
    expect(onUseArea).toHaveBeenCalledWith(true);
  });

  it("saves the frame at the playhead as png or jpeg, with jpeg quality", () => {
    const onChange = vi.fn();
    show({ format: "mp4" }, onChange, moment({ frameMs: 1500 }));
    fireEvent.click(screen.getByRole("button", { name: "PNG" }));
    expect(onChange).toHaveBeenLastCalledWith({ format: "png", atMs: 0 });
    cleanup();
    show({ format: "jpeg", atMs: 0, quality: 0.9 }, onChange, moment({ frameMs: 1500 }));
    expect(screen.getByText(/0:01\.15/)).toBeInTheDocument();
    expect(screen.getByText(pt.quality)).toBeInTheDocument();
    expect(screen.queryByText(pt.rangeHint)).not.toBeInTheDocument();
  });
});
