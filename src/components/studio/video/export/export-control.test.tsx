import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { MP4_EXPORT, type VideoExportRequest } from "@/lib/studio/animated-export";
import { newMediaClip } from "@/lib/studio/document";

import { ExportControl } from "./export-control";
import type { VideoExportState } from "./video-exporter";

const current: { state: VideoExportState } = { state: { status: "idle" } };
const permissions = { ads: true };

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ permissionsLoading: false, can: (resource: string) => resource === "ads" && permissions.ads }),
}));

vi.mock("@/components/media/media-download-button", () => ({ MediaDownloadButton: () => null }));
vi.mock("@/components/media/sound-video", () => ({ SoundVideo: () => null }));
const view = { range: { inMs: 2000 as number | null, outMs: 6000 as number | null }, playheadMs: 4321 };
const started: VideoExportRequest[] = [];

vi.mock("../editor-context", () => ({
  useEditorState: () => 15_000,
  useViewState: (selector: (state: typeof view) => unknown) => selector(view),
  useVideoEditor: () => ({ view: { getState: () => view } }),
}));
vi.mock("../use-video-export", () => ({ useVideoExport: () => ({ state: current.state, start: (request: VideoExportRequest) => started.push(request), reset: vi.fn() }) }));

const t = ptMessages.studio.video.export;

function openDone(outdated: boolean, request: VideoExportRequest = MP4_EXPORT) {
  current.state = { status: "done", outdated, request, result: { mediaId: "m-9", mediaUrl: "https://cdn/m-9.mp4" } } as VideoExportState;
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ExportControl />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: t.button }));
}

describe("ExportControl, use in an ad", () => {
  beforeEach(() => {
    permissions.ads = true;
  });

  it("opens ad creation with the exported video chosen", () => {
    openDone(false);
    expect(screen.getByRole("link", { name: t.useInAd }).getAttribute("href")).toBe("/dashboard/advertising?create=1&media=m-9&mediaKind=video");
  });

  it("hides the shortcut while the export no longer matches the project", () => {
    openDone(true);
    expect(screen.queryByRole("link", { name: t.useInAd })).toBeNull();
  });

  it("is not offered to someone who cannot create ads", () => {
    permissions.ads = false;
    openDone(false);
    expect(screen.queryByRole("link", { name: t.useInAd })).toBeNull();
  });
});

describe("ExportControl with an animation", () => {
  it("keeps the ad shortcut for MP4 exports only", () => {
    permissions.ads = true;
    openDone(false, { format: "gif" } as VideoExportRequest);
    expect(screen.queryByRole("link", { name: t.useInAd })).toBeNull();
  });
});

describe("ExportControl when a LUT cannot be read", () => {
  it("names the clip whose LUT stopped the export", () => {
    const clip = { ...newMediaClip("video", "film", 0, 1000), id: "shot", name: "Abertura", color: { lut: { assetId: "teal" } } };
    current.state = { status: "failed", code: "lut_unavailable", request: MP4_EXPORT, clip };
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ExportControl />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: t.button }));
    expect(screen.getByRole("alert").textContent).toBe(t.errors.lut_unavailable.replace("{name}", "Abertura"));
  });
});

describe("ExportControl with a frame or a range", () => {
  it("offers a saved frame as an ad image", () => {
    permissions.ads = true;
    openDone(false, { format: "png", atMs: 1000 });
    expect(screen.getByText(t.doneFrame)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.useInAd }).getAttribute("href")).toBe("/dashboard/advertising?create=1&media=m-9&mediaKind=image");
  });

  it("starts a frame at the playhead and a video on the marked area when chosen", () => {
    current.state = { status: "idle" };
    started.length = 0;
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ExportControl />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: t.button }));
    fireEvent.click(screen.getByRole("button", { name: /0:02\.00/ }));
    fireEvent.click(screen.getByRole("button", { name: t.start }));
    fireEvent.click(screen.getByRole("button", { name: "PNG" }));
    fireEvent.click(screen.getByRole("button", { name: t.start }));
    expect(started).toEqual([{ format: "mp4", range: { startMs: 2000, endMs: 6000 } }, { format: "png", atMs: 4321 }]);
  });
});
