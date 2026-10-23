import type { Review } from "@/lib/email-campaigns/types";

import { useEmailFormat } from "../shared";
import { useReais } from "./ReviewPanels";

export function useLaunchCost(review: Review | undefined) {
  const reais = useReais();
  const { number } = useEmailFormat();
  return {
    total: review ? reais(review.send.total_brl) : "",
    unit: review ? reais(review.send.unit_brl, true) : "",
    first: review ? reais(review.first_batch.total_brl) : "",
    count: number(review?.send.units ?? 0),
    batch: number(review?.batch_size ?? 0),
  };
}
