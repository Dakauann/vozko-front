"use client";

import { use } from "react";

import { EmailDesignEditor } from "@/components/email-campaigns/designs/EmailDesignEditor";

export default function EmailDesignPage({ params }: { params: Promise<{ designId: string; locale: string }> }) {
  const { designId } = use(params);
  return <EmailDesignEditor designId={designId} />;
}
