import { MERCADOLIVRE_ERROR_CODES, type MercadoLivreErrorCode } from "@/lib/mercadolivre/types";

type MercadoLivreErrorKey = `errors.${MercadoLivreErrorCode}` | "errors.generic";

export function mercadoLivreErrorKey(code: string | undefined): MercadoLivreErrorKey {
  if (code && (MERCADOLIVRE_ERROR_CODES as readonly string[]).includes(code)) return `errors.${code as MercadoLivreErrorCode}`;
  return "errors.generic";
}
