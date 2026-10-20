import { toast } from "sonner";

import type { CrmBulkResult } from "./board";

type Translate = (key: string, values?: Record<string, number>) => string;

export interface BulkToaster {
  success: (message: string) => unknown;
  warning: (message: string) => unknown;
}

export function reportBulkResult(t: Translate, result: CrmBulkResult, toaster: BulkToaster = toast): void {
  const succeeded = result.succeeded ?? 0;
  const failed = result.failed?.length ?? 0;
  if (result.truncated) {
    toaster.warning(t("truncated", { succeeded, matched: result.matched ?? succeeded }));
    return;
  }
  if (failed > 0) {
    toaster.warning(t("partial", { succeeded, eligible: result.eligible ?? succeeded + failed, failed }));
    return;
  }
  toaster.success(t("updated", { count: succeeded }));
}
