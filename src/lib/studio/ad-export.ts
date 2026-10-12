export type AdExportBlock = "oneArtboard" | "rasterOnly";

const AD_IMAGE_FORMATS: readonly string[] = ["png", "jpeg"];

export function adExportBlock(format: string, artboardCount: number): AdExportBlock | null {
  if (!AD_IMAGE_FORMATS.includes(format)) return "rasterOnly";
  if (artboardCount !== 1) return "oneArtboard";
  return null;
}

export function adExportRequest<R extends { transparent: boolean }>(request: R): R {
  return { ...request, transparent: false };
}
