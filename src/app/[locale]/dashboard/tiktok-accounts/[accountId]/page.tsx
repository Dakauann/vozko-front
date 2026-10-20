"use client";

import { use } from "react";

import { TiktokAccountView } from "@/components/tiktok/tiktok-account-view";

export default function TiktokAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return <TiktokAccountView accountId={accountId} />;
}
