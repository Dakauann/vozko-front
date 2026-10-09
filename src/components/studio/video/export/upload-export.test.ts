import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/studio", () => ({ saveStudioExportAction: vi.fn() }));

import { saveStudioExportAction } from "@/app/actions/studio";
import type { ExportPhase } from "@/lib/studio/export";

import { uploadExport } from "./upload-export";

const save = vi.mocked(saveStudioExportAction);

const video = new Blob([new Uint8Array(1000)], { type: "video/mp4" });

describe("export upload", () => {
  it("sends the video to the backend and returns the library media", async () => {
    save.mockResolvedValueOnce({ data: { mediaId: "e-1", mediaUrl: "https://cdn.test/e-1.mp4" } });
    const phases: ExportPhase[] = [];
    expect(await uploadExport("p-1", video, (phase) => phases.push(phase))).toEqual({ status: "done", result: { mediaId: "e-1", mediaUrl: "https://cdn.test/e-1.mp4" } });
    expect(save).toHaveBeenCalledWith("p-1", video);
    expect(phases).toEqual([{ phase: "uploading" }]);
  });

  it("names a video over the limit and any other refusal", async () => {
    save.mockResolvedValueOnce({ error: "too large", status: 422, code: "export_too_large" });
    expect(await uploadExport("p-1", video, () => undefined)).toEqual({ status: "failed", reason: "too_large" });
    save.mockResolvedValueOnce({ error: "not an mp4", status: 422, code: "invalid_export" });
    expect(await uploadExport("p-1", video, () => undefined)).toEqual({ status: "failed", reason: "upload_failed" });
  });
});
