import {
    type LeadCityCount,
    type LeadDistrictCount,
    type LeadOwnerCount,
} from '@/lib/leads/sections';

export interface LeadFilterChoice {
    value: string;
    label: string;
    color?: string;
    count?: number;
}

export function countedOptions<T extends LeadFilterChoice>(
    options: readonly T[],
    counts: Record<string, number> | undefined,
): T[] {
    if (!counts) return [...options];
    return options.map((option) => ({ ...option, count: counts[option.value] ?? 0 }));
}

export function keepSelected<T extends LeadFilterChoice>(
    options: readonly T[],
    selected: readonly string[],
    fallbackLabel: (value: string) => string,
): LeadFilterChoice[] {
    const listed = new Set(options.map((option) => option.value));
    const missing = selected
        .filter((value) => !listed.has(value))
        .map((value) => ({ value, label: fallbackLabel(value) }));
    return [...options, ...missing];
}

export function cityOptions(
    cities: readonly LeadCityCount[],
    selected: readonly string[],
    label: (city: LeadCityCount) => string,
): LeadFilterChoice[] {
    return keepSelected(
        cities.map((city) => ({ value: city.cityKey, label: label(city), count: city.count })),
        selected,
        (value) => value,
    );
}

export function districtOptions(
    districts: readonly LeadDistrictCount[],
    selected: readonly string[],
    label: (district: LeadDistrictCount) => string,
): LeadFilterChoice[] {
    return keepSelected(
        districts.map((district) => ({ value: district.pair, label: label(district), count: district.count })),
        selected,
        (value) => value,
    );
}

export function ownerOptions({
    owners,
    members,
    ownersTruncated,
    selected,
    unnamed,
}: {
    owners: readonly LeadOwnerCount[] | null;
    members: ReadonlyMap<string, string>;
    ownersTruncated: boolean;
    selected: readonly string[];
    unnamed: string;
}): LeadFilterChoice[] {
    const nameOf = (id: string, sent?: string) => sent?.trim() || members.get(id) || unnamed;
    const counted: LeadFilterChoice[] = (owners ?? []).map((owner) => ({
        value: owner.owner,
        label: nameOf(owner.owner, owner.name),
        count: owner.count,
    }));
    const listed = new Set(counted.map((option) => option.value));
    const everyOwnerCounted = owners !== null && !ownersTruncated;
    const idle: LeadFilterChoice[] = [...members]
        .filter(([id]) => !listed.has(id))
        .map(([id, name]) => (everyOwnerCounted ? { value: id, label: name, count: 0 } : { value: id, label: name }));
    return keepSelected([...counted, ...idle], selected, (value) => nameOf(value));
}
