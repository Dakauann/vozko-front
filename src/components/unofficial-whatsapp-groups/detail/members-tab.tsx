"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { parseGroupLinkMembers } from "../kit/routes";
import { memberFiltersFromLink, memberLinkOf, memberLinkSignature, withMemberLink, type MemberFilters } from "./detail-model";
import { MEMBER_PAGE_SIZES, ParticipantsManager } from "./participants-manager";

export function MembersTab({ detail, onChanged }: { detail: GroupDetail; onChanged: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const link = parseGroupLinkMembers(searchParams);
  const linkSignature = memberLinkSignature(link);
  const [synced, setSynced] = useState(linkSignature);
  const [filters, setFilters] = useState<MemberFilters>(() => memberFiltersFromLink(link));

  if (linkSignature !== synced) {
    setSynced(linkSignature);
    setFilters(memberFiltersFromLink(link));
  }

  const changeFilters = useCallback(
    (next: MemberFilters) => {
      setFilters(next);
      const nextLink = memberLinkOf(next);
      setSynced(memberLinkSignature(nextLink));
      router.replace(`${pathname}${withMemberLink(searchParams.toString(), nextLink)}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <ParticipantsManager
      group={detail.group}
      seats={detail.numbers}
      mode="browse"
      pageSize={MEMBER_PAGE_SIZES[0]}
      counts={detail.members}
      filters={filters}
      onFiltersChange={changeFilters}
      onChanged={onChanged}
    />
  );
}
