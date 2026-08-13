/**
 * The four outcomes an export can fail with, as translation sub-keys.
 *
 * Two of them are things the operator can act on and must therefore be told
 * apart: `tooLarge` means narrow the period, `busy` means someone else is
 * exporting and it is worth retrying. Collapsing them into a generic failure —
 * which is what the single "Falha ao exportar" message used to do — leaves an
 * operator retrying a request that will never succeed, or giving up on one that
 * would have succeeded a minute later.
 *
 * Returns a sub-key rather than a message so both the campaign detail screen
 * (`detail.export.*`) and the disparos dialog (`campaignsSummary.export.*`) can
 * prefix it with their own namespace.
 */
export type ExportErrorKey = "noEntries" | "tooLarge" | "busy" | "error";

export function exportErrorKey(error: string): ExportErrorKey {
    switch (error) {
        case "noEntries":
        case "tooLarge":
        case "busy":
            return error;
        default:
            return "error";
    }
}
