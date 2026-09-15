/**
 * Autorisation stricte de la base PG jetable frais avancés.
 * Un nom contenant « test » ne suffit PAS.
 */

export const NOTES_FRAIS_PG_TEST_ALLOWLIST = {
  hostname: "127.0.0.1",
  port: 55432,
  database: "amaki_notes_frais_test",
  username: "amaki_test",
} as const;

export type ParsedPgUrl = {
  hostname: string;
  port: number;
  database: string;
  username: string;
  raw: string;
};

/**
 * Parse une URL postgres ; lève si invalide.
 */
export function parsePostgresUrl(url: string): ParsedPgUrl {
  const normalized = url.trim().replace(/^postgresql:/i, "http:");
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    throw new Error("URL PostgreSQL invalide");
  }
  const database = (u.pathname || "").replace(/^\//, "").split("?")[0] || "";
  const port = u.port ? Number(u.port) : 5432;
  if (!u.hostname || !database || !u.username) {
    throw new Error("URL PostgreSQL incomplète (host/database/user requis)");
  }
  return {
    hostname: u.hostname,
    port,
    database,
    username: decodeURIComponent(u.username),
    raw: url.trim(),
  };
}

/**
 * True seulement si l'URL correspond exactement à l'allowlist Docker locale.
 */
export function isAllowedNotesFraisPgTestUrl(url: string): boolean {
  try {
    const p = parsePostgresUrl(url);
    return (
      p.hostname === NOTES_FRAIS_PG_TEST_ALLOWLIST.hostname &&
      p.port === NOTES_FRAIS_PG_TEST_ALLOWLIST.port &&
      p.database === NOTES_FRAIS_PG_TEST_ALLOWLIST.database &&
      p.username === NOTES_FRAIS_PG_TEST_ALLOWLIST.username
    );
  } catch {
    return false;
  }
}

/**
 * Résout TEST_DATABASE_URL pour les tests PG.
 * - Aucun fallback vers DATABASE_URL
 * - Refus si égal à DATABASE_URL (même valeur = risque de mauvaise cible)
 * - Allowlist host/port/db/user obligatoire
 */
export function resolveAuthorizedNotesFraisPgTestUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const dedicated = env.TEST_DATABASE_URL?.trim();
  if (!dedicated) {
    throw new Error("TEST_DATABASE_URL absent — tests PG non autorisés");
  }
  const fallback = env.DATABASE_URL?.trim();
  if (fallback && fallback === dedicated) {
    throw new Error(
      "TEST_DATABASE_URL identique à DATABASE_URL — refus (pas de fallback implicite)"
    );
  }
  if (!isAllowedNotesFraisPgTestUrl(dedicated)) {
    const p = parsePostgresUrl(dedicated);
    throw new Error(
      `Base PG refusée (hors allowlist). Reçu ${p.hostname}:${p.port}/${p.database} user=${p.username} ; attendu ${NOTES_FRAIS_PG_TEST_ALLOWLIST.hostname}:${NOTES_FRAIS_PG_TEST_ALLOWLIST.port}/${NOTES_FRAIS_PG_TEST_ALLOWLIST.database} user=${NOTES_FRAIS_PG_TEST_ALLOWLIST.username}`
    );
  }
  return dedicated;
}
