/**
 * Hand a generated file to the browser as a download.
 *
 * The blob-url-anchor-click-revoke dance was written out separately in every
 * place that produced a file, so each copy got to forget the revoke and leak the
 * object url for the life of the tab. One copy, revoked once.
 */
export function downloadTextFile(
    text: string,
    filename: string,
    mimeType = "text/plain;charset=utf-8;",
): void {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function downloadCsv(csvText: string, filename: string): void {
    downloadTextFile(csvText, filename, "text/csv;charset=utf-8;");
}
