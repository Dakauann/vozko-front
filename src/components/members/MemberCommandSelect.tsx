"use client";

import { useMemo } from "react";

import { ElevatedCommandSelect, type ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { useMemberSearch } from "@/components/leads/use-member-search";
import { memberDisplayName } from "@/hooks/use-assignable-members";

const NO_OPTIONS: ElevatedCommandOption[] = [];
const NO_ONE: readonly string[] = [];

interface MemberCommandSelectText {
  label: string;
  search: string;
  empty: string;
  failed: string;
}

export function MemberCommandSelect({
  value,
  selectedValue,
  onChange,
  text,
  leadingOptions = NO_OPTIONS,
  excluded = NO_ONE,
  disabled = false,
}: {
  value: string;
  selectedValue?: string | null;
  onChange: (userId: string) => void;
  text: MemberCommandSelectText;
  leadingOptions?: ElevatedCommandOption[];
  excluded?: readonly string[];
  disabled?: boolean;
}) {
  const { ownerName, setSearch, found, searching } = useMemberSearch();
  const currentName = value ? ownerName(value) : null;

  const options = useMemo(() => {
    const members = found.members
      .filter((member) => !excluded.includes(member.userId))
      .map((member) => ({ value: member.userId, label: memberDisplayName(member) }));
    const current = value && !members.some((option) => option.value === value) ? [{ value, label: currentName ?? value }] : [];
    return [...leadingOptions, ...current, ...members];
  }, [found.members, excluded, value, currentName, leadingOptions]);

  return (
    <div className="space-y-1">
      <ElevatedCommandSelect
        label={text.label}
        options={options}
        value={selectedValue === undefined ? value || null : selectedValue}
        onValueChange={onChange}
        onSearch={setSearch}
        isLoading={searching}
        searchPlaceholder={text.search}
        emptyMessage={text.empty}
        disabled={disabled}
        fullWidth
      />
      {found.failed ? <p className="pl-1 text-xs text-destructive-ink">{text.failed}</p> : null}
    </div>
  );
}
