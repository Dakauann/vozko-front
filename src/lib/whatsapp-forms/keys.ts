const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 8;

export type KeyPrefix = "s_" | "b_" | "f_" | "o_";

export type RandomBytes = (length: number) => Uint8Array;

function cryptoBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function newKey(prefix: KeyPrefix, random: RandomBytes = cryptoBytes): string {
  const bytes = random(KEY_LENGTH);
  let suffix = "";
  for (let i = 0; i < KEY_LENGTH; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length];
  return prefix + suffix;
}
