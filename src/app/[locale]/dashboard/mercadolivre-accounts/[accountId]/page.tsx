"use client";

import { use } from "react";

import { MercadoLivreAccountView } from "@/components/mercadolivre/mercadolivre-account-view";

export default function MercadoLivreAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return <MercadoLivreAccountView accountId={accountId} />;
}
