import { apiClient } from "@/lib/api/browser-client";
import { SectionError } from "@/lib/analytics/section-query";
import {
  dispatchReportPath,
  dispatchReportQuery,
  type DispatchReportParams,
  type DispatchReportPayloads,
  type DispatchReportSection,
} from "@/lib/whatsapp-campaigns/dispatch-report";

export async function fetchDispatchReportSection<S extends DispatchReportSection>(
  section: S,
  params: DispatchReportParams,
  signal?: AbortSignal,
): Promise<DispatchReportPayloads[S]> {
  const query = new URLSearchParams(dispatchReportQuery(params)).toString();
  const url = `${dispatchReportPath(section)}?${query}`;

  const response = await apiClient<DispatchReportPayloads[S]>(url, { method: "GET", signal });

  if (response.error) {
    throw new SectionError(response.error.message, response.error.status);
  }
  if (!response.data) {
    throw new SectionError(`dispatch report section ${section} came back empty`);
  }
  return response.data;
}
