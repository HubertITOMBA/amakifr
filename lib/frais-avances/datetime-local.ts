/**
 * Conversion explicite datetime-local (composants locaux) → ISO UTC.
 * Refuse les dates calendaires invalides et les heures inexistantes (ex. DST).
 *
 * @param localValue - Valeur input `YYYY-MM-DDTHH:mm` ou `…:ss`
 * @returns ISO UTC (`…Z`)
 */
export function datetimeLocalToIso(localValue: string): string {
  if (typeof localValue !== "string" || !localValue.trim()) {
    throw new Error("Date/heure invalide");
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    localValue.trim()
  );
  if (!m) {
    throw new Error("Date/heure invalide");
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? "0");
  if (
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    h > 23 ||
    mi > 59 ||
    s > 59
  ) {
    throw new Error("Date/heure calendaire invalide");
  }
  const local = new Date(y, mo - 1, d, h, mi, s, 0);
  if (
    Number.isNaN(local.getTime()) ||
    local.getFullYear() !== y ||
    local.getMonth() !== mo - 1 ||
    local.getDate() !== d ||
    local.getHours() !== h ||
    local.getMinutes() !== mi ||
    local.getSeconds() !== s
  ) {
    throw new Error("Date/heure calendaire invalide");
  }
  const iso = local.toISOString();
  if (!iso.endsWith("Z") || Number.isNaN(new Date(iso).getTime())) {
    throw new Error("Date/heure invalide");
  }
  return iso;
}
