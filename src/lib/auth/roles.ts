export function isSystemAdmin(role?: string | null): boolean {
    if (!role) return false;
    const normalized = role.trim().toLowerCase();
    return normalized === "admin" || normalized === "administrator";
}
