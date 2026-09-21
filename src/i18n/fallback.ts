export function humanizeMessageKey(key: string): string {
    const last = key.split(".").pop() ?? key;
    const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function reportMessageError(error: unknown): void {
    if (process.env.NODE_ENV !== "production") {
        console.error(error);
    }
}
