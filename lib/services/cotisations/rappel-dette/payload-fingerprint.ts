import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { getParisYmd } from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import type { RappelRetainedLine } from "@/lib/services/cotisations/rappel-dette/types";

/**
 * Identifiant de contrat pour le lien/template de détail confirmé.
 * Pas une route HTTP : intégration UI/lien restante (hors cette passe).
 */
export const RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT =
  "rappel-dette.detail-link.v1.pending-integration" as const;

/**
 * Catalogue serveur immuable : version template → contrat lien détail.
 * Figé à l’exécution (`Object.freeze`) ; résolution **propriétés propres** uniquement.
 * Paramètres **internes serveur** — pas librement pilotables par un formulaire.
 * Toute version hors catalogue (y compris héritées : constructor, toString, __proto__)
 * → null. Pas de valeur libre ni de route HTTP réelle.
 */
export const RAPPEL_DETTE_TEMPLATE_REGISTRY: Readonly<
  Record<string, string>
> = Object.freeze({
  "email-rappel-dette-v1": RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
});

/**
 * Résout le contrat lien détail depuis une version template catalogue.
 * Ignore les propriétés héritées du prototype.
 *
 * @param templateVersion - Clé catalogue serveur
 * @returns Contrat, ou null si version inconnue / non propre
 */
export function resolveTemplateDetailLinkContract(
  templateVersion: string
): string | null {
  const key = templateVersion.trim();
  if (
    !Object.prototype.hasOwnProperty.call(RAPPEL_DETTE_TEMPLATE_REGISTRY, key)
  ) {
    return null;
  }
  return RAPPEL_DETTE_TEMPLATE_REGISTRY[key] ?? null;
}

/** Version de schéma d’empreinte (évolutions futures). */
export const RAPPEL_DETTE_FINGERPRINT_SCHEMA_VERSION = 1 as const;

export type RappelDetteFingerprintLine = {
  source: string;
  id: string;
  montantRestant: string;
  dueDateYmd: string;
};

/**
 * Payload canonique confirmé (serveur).
 * Exclut volontairement `computedAt` et tout timestamp de réponse HTTP.
 */
export type RappelDetteFingerprintPayload = {
  schemaVersion: typeof RAPPEL_DETTE_FINGERPRINT_SCHEMA_VERSION;
  adherentId: string;
  recipientUserId: string;
  recipientEmail: string;
  templateVersion: string;
  templateDetailLinkContract: string;
  montantBrut: string;
  avoirDisponible: string;
  detteNette: string;
  retainedLines: RappelDetteFingerprintLine[];
};

/**
 * Normalise une adresse email pour empreinte (trim + minuscules).
 *
 * @param email - Adresse brute
 */
export function normalizeRecipientEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Montant canonique à 2 décimales (empreinte stable).
 *
 * @param value - Decimal Prisma
 */
export function canonicalMoneyString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

/**
 * Date civile Europe/Paris `YYYY-MM-DD`.
 *
 * @param date - Instant
 */
export function parisDueDateYmd(date: Date): string {
  const { year, month, day } = getParisYmd(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Construit le payload d’empreinte à partir du snapshot serveur recalculé.
 * Ne lit aucune donnée « client » de montants : uniquement le résultat serveur.
 *
 * @param params - Cible, destinataire, template et lignes retenues serveur
 */
export function buildRappelDetteFingerprintPayload(params: {
  adherentId: string;
  recipientUserId: string;
  recipientEmail: string;
  templateVersion: string;
  /** Doit être le contrat catalogue (persisté) — pas une valeur libre non reconstructible. */
  templateDetailLinkContract: string;
  montantBrut: Prisma.Decimal;
  avoirDisponible: Prisma.Decimal;
  detteNette: Prisma.Decimal;
  retainedLines: ReadonlyArray<RappelRetainedLine>;
}): RappelDetteFingerprintPayload {
  const lines: RappelDetteFingerprintLine[] = params.retainedLines.map((l) => ({
    source: l.source,
    id: l.id,
    montantRestant: canonicalMoneyString(l.montantRestant),
    dueDateYmd: parisDueDateYmd(l.dueDate),
  }));
  lines.sort((a, b) => {
    const s = a.source.localeCompare(b.source);
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  return {
    schemaVersion: RAPPEL_DETTE_FINGERPRINT_SCHEMA_VERSION,
    adherentId: params.adherentId,
    recipientUserId: params.recipientUserId,
    recipientEmail: normalizeRecipientEmail(params.recipientEmail),
    templateVersion: params.templateVersion.trim(),
    templateDetailLinkContract: params.templateDetailLinkContract.trim(),
    montantBrut: canonicalMoneyString(params.montantBrut),
    avoirDisponible: canonicalMoneyString(params.avoirDisponible),
    detteNette: canonicalMoneyString(params.detteNette),
    retainedLines: lines,
  };
}

/**
 * Sérialisation canonique déterministe (clés objet triées, tableaux déjà ordonnés).
 *
 * @param value - Valeur JSON-compatible
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/**
 * Empreinte SHA-256 hex du payload canonique (sans computedAt).
 *
 * @param payload - Payload serveur
 * @returns Hex 64 caractères
 */
export function hashRappelDetteFingerprint(
  payload: RappelDetteFingerprintPayload
): string {
  const body = canonicalJson(payload);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * Construit et empreinte en une étape.
 *
 * @param params - Paramètres du payload
 */
export function computeRappelDetteFingerprint(
  params: Parameters<typeof buildRappelDetteFingerprintPayload>[0]
): { payload: RappelDetteFingerprintPayload; fingerprint: string } {
  const payload = buildRappelDetteFingerprintPayload(params);
  return { payload, fingerprint: hashRappelDetteFingerprint(payload) };
}
