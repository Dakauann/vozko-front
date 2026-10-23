export const UNOFFICIAL_CAMPAIGNS_PATH = "/dashboard/unofficial-whatsapp-campaigns";

export function wizardHref(id: string, step: string): string {
  return `${UNOFFICIAL_CAMPAIGNS_PATH}/new?draft=${encodeURIComponent(id)}&step=${step}`;
}
