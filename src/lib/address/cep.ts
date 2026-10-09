export interface CepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
}

export function cepDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function formatCep(raw: string): string {
  const digits = cepDigits(raw);
  return digits ? `${digits.slice(0, 5)}-${digits.slice(5)}` : raw;
}
