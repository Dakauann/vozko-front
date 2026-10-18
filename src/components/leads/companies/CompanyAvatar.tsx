"use client";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { companyImageUrl, type LeadCompany } from "@/lib/leads/companies";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-6 w-6", text: "text-2xs" },
  md: { box: "h-9 w-9", text: "text-sm" },
} as const;

export function CompanyAvatar({ company, size = "md" }: { company: Pick<LeadCompany, "id" | "name" | "image">; size?: keyof typeof SIZES }) {
  return (
    <ChannelAvatarImage
      name={company.name}
      seed={company.id}
      url={companyImageUrl(company)}
      className={cn(SIZES[size].box, "rounded-[--radius]")}
      textClassName={SIZES[size].text}
    />
  );
}
