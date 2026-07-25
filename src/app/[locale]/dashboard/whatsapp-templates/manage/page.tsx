"use client";

import WhatsAppTemplatesPage from "../page";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManageAllTemplatesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isSystemAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isLoading && !isSystemAdmin) {
      router.replace("/dashboard/whatsapp-templates");
    }
  }, [isLoading, isSystemAdmin, router]);

  if (isLoading || !isSystemAdmin) {
    return null;
  }

  return <WhatsAppTemplatesPage adminAllMode />;
}
