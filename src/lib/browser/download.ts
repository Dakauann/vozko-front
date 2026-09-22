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
