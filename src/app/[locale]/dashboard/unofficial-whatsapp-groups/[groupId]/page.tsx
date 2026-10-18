"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { GroupDetailView } from "@/components/unofficial-whatsapp-groups/detail/group-detail-view";

export default function UnofficialGroupDetailPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = String(params?.groupId ?? "");
  return (
    <Suspense fallback={<ScreenLoader fit="screen" />}>
      <GroupDetailView key={groupId} groupId={groupId} />
    </Suspense>
  );
}
