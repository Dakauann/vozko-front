"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HowToAddPhonePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/whatsapp-business-phones/connect");
  }, [router]);

  return null;
}
