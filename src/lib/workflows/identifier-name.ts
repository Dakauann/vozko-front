export const IDENTIFIER_NAME_MAX_LENGTH = 64;

const IDENTIFIER_NAME_PATTERN = new RegExp(`^[a-z0-9_]{1,${IDENTIFIER_NAME_MAX_LENGTH}}$`);

export function isIdentifierName(name: string): boolean {
  return IDENTIFIER_NAME_PATTERN.test(name);
}

export function toIdentifierName(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, IDENTIFIER_NAME_MAX_LENGTH);
}
