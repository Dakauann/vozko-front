"use client";

import { VIDEO_ASPECT_SIZES, type StudioKind } from "@/lib/studio/document";
import type { DeviceCapabilities } from "@/lib/studio/telemetry";

import { mediaWorkerSupported } from "../media/media-worker";

type GpuNavigator = Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> }; deviceMemory?: number };

const UNKNOWN_CARD = { gpuVendor: "", gpuRenderer: "" };

function graphicsCard(): Pick<DeviceCapabilities, "gpuVendor" | "gpuRenderer"> {
  const canvas = window.document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return UNKNOWN_CARD;
  const unmasked = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = gl.getParameter(unmasked ? unmasked.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
  const renderer = gl.getParameter(unmasked ? unmasked.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { gpuVendor: String(vendor ?? ""), gpuRenderer: String(renderer ?? "") };
}

function describedCard(): Pick<DeviceCapabilities, "gpuVendor" | "gpuRenderer"> {
  try {
    return graphicsCard();
  } catch {
    return UNKNOWN_CARD;
  }
}

async function webgpuAvailable(gpu: GpuNavigator["gpu"]): Promise<boolean> {
  if (!gpu) return false;
  return (await gpu.requestAdapter().catch(() => null)) !== null;
}

async function exportEncoders(kind: StudioKind): Promise<Pick<DeviceCapabilities, "encodeVideo" | "encodeAudio">> {
  if (kind !== "video") return { encodeVideo: false, encodeAudio: false };
  const { browserEncoders } = await import("../video/export/browser-export");
  const { width, height } = VIDEO_ASPECT_SIZES.story;
  const encoders = await browserEncoders(width, height).catch(() => ({ video: false, audio: false }));
  return { encodeVideo: encoders.video, encodeAudio: encoders.audio };
}

export async function probeDevice(kind: StudioKind): Promise<Partial<DeviceCapabilities>> {
  const browser = navigator as GpuNavigator;
  const [webgpu, encoders] = await Promise.all([webgpuAvailable(browser.gpu), exportEncoders(kind)]);
  return {
    ...describedCard(),
    ...encoders,
    webgpu,
    decode: mediaWorkerSupported(),
    pixelRatio: window.devicePixelRatio || 0,
    cores: browser.hardwareConcurrency || 0,
    memoryGb: browser.deviceMemory ?? 0,
  };
}
