import { STUDIO_LIMITS } from "./document";

const TOKEN = /^[a-z0-9][a-z0-9_-]*$/;

export function runes(value: string): number {
  return [...value].length;
}

export function isValidToken(token: string): boolean {
  return runes(token) <= STUDIO_LIMITS.maxTokenRunes && TOKEN.test(token);
}
