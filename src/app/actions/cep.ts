import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import type { CepAddress } from "@/lib/address/cep";

export type CepLookup =
  | { status: "found"; address: CepAddress }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "unavailable"; error: CodedError };

function isCepAddress(value: unknown): value is CepAddress {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return ["cep", "localidade", "uf"].every((key) => typeof row[key] === "string");
}

export async function searchCepAction(cep: string): Promise<CepLookup> {
  const response = await apiClient<CepAddress>(`/cep/search?cep=${encodeURIComponent(cep)}`, { method: "GET" });
  if (response.error) {
    if (response.error.status === 404) return { status: "not_found" };
    if (response.error.status === 400) return { status: "invalid" };
    return { status: "unavailable", error: codedErrorOf(response.error) };
  }
  if (!isCepAddress(response.data)) return { status: "unavailable", error: { message: "Empty response" } };
  const data = response.data;
  return {
    status: "found",
    address: {
      cep: data.cep,
      logradouro: data.logradouro ?? "",
      complemento: data.complemento ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade,
      uf: data.uf,
      ...(data.ibge ? { ibge: data.ibge } : {}),
    },
  };
}
