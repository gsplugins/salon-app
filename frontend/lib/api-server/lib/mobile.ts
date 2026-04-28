/**
 * Canonical mobile for DB lookup (E.164-style with leading +).
 * Bangladesh: national `01XXXXXXXXX` (11 digits) → `+8801XXXXXXXXX`.
 */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("880") && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+880${digits.slice(1)}`;
  }

  return `+${digits}`;
}

