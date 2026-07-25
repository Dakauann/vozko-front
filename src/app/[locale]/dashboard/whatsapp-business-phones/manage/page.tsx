"use client";

import WhatsAppBusinessPhonesPage from "../page";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManageAllBusinessPhonesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isSystemAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isLoading && !isSystemAdmin) {
      router.replace("/dashboard/whatsapp-business-phones");
    }
  }, [isLoading, isSystemAdmin, router]);

  if (isLoading || !isSystemAdmin) {
    return null;
  }

  return <WhatsAppBusinessPhonesPage adminAllMode />;
}
