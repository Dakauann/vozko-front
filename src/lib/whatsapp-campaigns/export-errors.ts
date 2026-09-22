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
