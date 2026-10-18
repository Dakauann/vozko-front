import { displayPhone, jidLocal } from "@/components/unofficial-whatsapp-groups/kit/format";
import type { PersonIdentitySource } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import type { GroupPerson } from "@/lib/unofficial-whatsapp-groups/types";

export const MIN_GROUP_OPTIONS = [2, 3, 5, 10] as const;

export const DEFAULT_MIN_GROUPS = 2;

export const PEOPLE_PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_PEOPLE_PAGE_SIZE = 50;

interface PeopleFilters {
  search: string;
  minGroups: number;
}

export function parsePeopleQuery(params: URLSearchParams): PeopleFilters {
  const search = (params.get("search") ?? "").trim();
  const raw = params.get("minGroups");
  const parsed = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
  const minGroups = Number.isInteger(parsed) && parsed >= DEFAULT_MIN_GROUPS ? parsed : DEFAULT_MIN_GROUPS;
  return { search, minGroups };
}

export function minGroupOptions(current: number): number[] {
  return [...new Set<number>([...MIN_GROUP_OPTIONS, current])].sort((a, b) => a - b);
}

export function peopleHref(search: string, minGroups: number): string {
  return groupsRoutes.people({
    search,
    minGroups: minGroups === DEFAULT_MIN_GROUPS ? undefined : minGroups,
  });
}

function isFilledIdentifier(name: string, person: GroupPerson): boolean {
  return name === person.phone || name === person.jid || (person.jid !== "" && name === jidLocal(person.jid));
}

export function personSource(person: GroupPerson): PersonIdentitySource {
  const name = person.name.trim();
  return {
    displayName: name && !isFilledIdentifier(name, person) ? name : undefined,
    leadName: person.leadName,
    phone: person.phone,
    jid: person.jid,
  };
}

export function isHiddenNumber(person: Pick<GroupPerson, "phone" | "jid">): boolean {
  return displayPhone(person.phone, person.jid) === null;
}

export function memberSearchOf(person: GroupPerson): string | undefined {
  const phone = person.phone?.trim();
  if (phone) return phone;
  if (!isHiddenNumber(person)) return jidLocal(person.jid);
  return personSource(person).displayName;
}

export function pageCounts(people: GroupPerson[]): { withLead: number; hidden: number; maxGroups: number } {
  return people.reduce(
    (counts, person) => ({
      withLead: counts.withLead + (person.leadId ? 1 : 0),
      hidden: counts.hidden + (isHiddenNumber(person) ? 1 : 0),
      maxGroups: Math.max(counts.maxGroups, person.groupCount),
    }),
    { withLead: 0, hidden: 0, maxGroups: 0 },
  );
}
