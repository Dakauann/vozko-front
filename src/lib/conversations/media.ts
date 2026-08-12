import type { MediaType } from "./types";

/**
 * What an operator may attach to an outbound message.
 *
 * One definition, used by the live composer AND the schedule dialog. It was a
 * string literal inside the composer's `<input accept=…>`; the moment a second
 * surface could attach a file, copying it would have guaranteed the two drift.
 *
 * This is the app's CURRENT, shipped answer — not a per-channel one. The Go
 * domain does model real per-channel limits (`channel.Capabilities.MediaLimits`
 * carries a MIME allowlist and a byte cap per kind, and Instagram's are notably
 * tighter: JPEG-only images, PDF-only documents), but nothing exposes them over
 * the API yet and official WhatsApp has no descriptor at all. Narrowing this
 * list by guessing would put unverified platform claims in the UI, which is
 * exactly what the product forbids. Surfacing the real limits is the follow-up.
 */
export const OUTBOUND_MEDIA_ACCEPT =
    "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt";

/** Maps a picked file onto the media kind the send path expects. */
export function mediaTypeForFile(file: File): MediaType {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
}

/**
 * Gives a pasted file a name.
 *
 * A file pasted from the clipboard arrives with an empty `name`, and the upload
 * endpoint stores that verbatim — producing an attachment the recipient cannot
 * identify and the operator cannot find again.
 */
export function normalizeUploadFile(file: File): File {
    if (file.name) return file;

    const extension =
        file.type.split("/")[1]?.split("+")[0]?.split(";")[0] || "bin";
    const prefix = file.type.startsWith("image/")
        ? "pasted-image"
        : file.type.startsWith("video/")
          ? "pasted-video"
          : file.type.startsWith("audio/")
            ? "pasted-audio"
            : "pasted-file";

    return new File([file], `${prefix}-${Date.now()}.${extension}`, {
        type: file.type || "application/octet-stream",
    });
}

/** Human-readable file size for an attachment chip. */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
