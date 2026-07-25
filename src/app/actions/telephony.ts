import type {
  TelephonyBoard,
  TelephonyOverview,
  TelephonyOverviewParams,
} from "@/lib/telephony/types";
import { apiClient } from "@/lib/api/browser-client";

function buildQueryString(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function getTelephonyOverviewAction(
  params: TelephonyOverviewParams = {},
) {
  const queryString = buildQueryString({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    direction: params.direction,
    call_type: params.callType,
    agent_id: params.agentId,
    member_id: params.memberId,
    service_level_seconds:
      params.serviceLevelSeconds != null
        ? String(params.serviceLevelSeconds)
        : undefined,
  });

  const response = await apiClient<TelephonyOverview>(
    `/telephony/overview${queryString}`,
    { method: "GET" },
  );

  if (response.error) {
    return {
      overview: null as TelephonyOverview | null,
      error: response.error.message,
    };
  }

  return {
    overview: response.data ?? null,
    error: null,
  };
}

export async function getTelephonyBoardAction() {
  const response = await apiClient<TelephonyBoard>("/telephony/board", {
    method: "GET",
  });

  if (response.error) {
    return {
      board: null as TelephonyBoard | null,
      error: response.error.message,
    };
  }

  return {
    board: response.data ?? null,
    error: null,
  };
}
