/**
 * Who counts as a platform administrator.
 *
 * This lived as a private copy in three separate pages, which is how the three
 * spellings below accumulated: the backend issues the role as `admin`, but
 * older rows and at least one seed script wrote `ADMIN` and `administrator`,
 * and each page learned about them at a different time. A page that knew only
 * about `admin` locked out a real administrator, and a page that knew only
 * about the old spellings let one in who should not have been.
 *
 * One definition, so a page cannot disagree with its neighbour about who is an
 * admin. This is a UI affordance only: every admin route is enforced server
 * side by RequireRole on the admin subrouter, and hiding a page here does not
 * protect the data behind it.
 */
export function isSystemAdmin(role?: string | null): boolean {
    if (!role) return false;
    const normalized = role.trim().toLowerCase();
    return normalized === "admin" || normalized === "administrator";
}
