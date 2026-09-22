import type { MediaType } from "./types";

export const OUTBOUND_MEDIA_ACCEPT =
    "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt";

export function mediaTypeForFile(file: File): MediaType {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
}

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

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
