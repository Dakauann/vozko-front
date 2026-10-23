"use client";

import { use } from "react";

import { RcsSendersPage } from "@/components/carrier-messaging";

export default function RcsSmsRcsSenderPage({ params }: { params: Promise<{ senderId: string; locale: string }> }) {
  const { senderId } = use(params);
  return <RcsSendersPage key={senderId} initialSenderId={senderId} />;
}
