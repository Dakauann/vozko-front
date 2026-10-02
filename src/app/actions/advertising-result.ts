import { settleResult } from "./action-result";

export const settleAds = settleResult;

export const withAccount = (path: string, accountId: string) => `${path}?${new URLSearchParams({ accountId }).toString()}`;
