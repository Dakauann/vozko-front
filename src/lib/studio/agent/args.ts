type Args = Record<string, unknown>;

export function argsOf(value: unknown): Args {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Args) : {};
}

export function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function textField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function numberList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const numbers = value.filter((item): item is number => numberField(item) !== undefined);
  return numbers.length > 0 ? numbers : undefined;
}

export function textList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const texts = value.filter((item): item is string => textField(item) !== undefined);
  return texts.length > 0 ? texts : undefined;
}

export function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}
