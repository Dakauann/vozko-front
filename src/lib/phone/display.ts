const NON_GEOGRAPHIC = /^0(300|303|500|800|900)\d{7}$/;
const BRAZIL_NATIONAL = /^[1-9]{2}(9\d{8}|[2-9]\d{7})$/;

function brazilianNational(digits: string): string | null {
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return BRAZIL_NATIONAL.test(national) ? national : null;
}

export function formatPhoneForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\+?\d+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");

  if (NON_GEOGRAPHIC.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  const national = trimmed.startsWith("+") && !digits.startsWith("55") ? null : brazilianNational(digits);
  if (national) {
    const areaCode = national.slice(0, 2);
    const subscriber = national.slice(2);
    const split = subscriber.length - 4;
    return `+55 (${areaCode}) ${subscriber.slice(0, split)}-${subscriber.slice(split)}`;
  }

  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return trimmed;
}
