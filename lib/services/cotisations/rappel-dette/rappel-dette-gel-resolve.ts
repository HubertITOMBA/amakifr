/**
 * Résolveur serveur des gels rappel dette (lecture seule).
 *
 * - Client Prisma **fourni** uniquement (tx en transaction — jamais de fallback `db`).
 * - Absence de ligne `rappel_dette_gel_revisions` → révision `0`.
 * - Erreur de lecture → `GEL_SOURCE_UNAVAILABLE` (fail-closed ≠ absence).
 * - Aucun gel / révision fourni par le client HTTP.
 *
 * Module serveur — **ne pas** réexporter via le barrel public.
 */

import type { Prisma } from "@prisma/client";
import {
  frozenLineKey,
  type RappelDebtSource,
} from "@/lib/services/cotisations/rappel-dette/types";

export const GEL_SOURCE_UNAVAILABLE = "GEL_SOURCE_UNAVAILABLE" as const;

/**
 * Sous-ensemble Prisma suffisant pour la lecture gels (tx ou client).
 */
export type RappelDetteGelPrisma = Pick<
  Prisma.TransactionClient,
  "rappelDetteGel" | "rappelDetteGelRevision"
>;

export type ResolveRappelDetteGelsSuccess = {
  ok: true;
  /** Compteur monotonique (bigint JS — pas de littéral `0n`, cible ES2017). */
  gelsRevision: bigint;
  /** Sérialisation décimale stable pour jetons / DTO (pas de `Number`). */
  gelsRevisionDecimal: string;
  frozenAdherent: boolean;
  frozenLineKeys: ReadonlySet<string>;
};

export type ResolveRappelDetteGelsFailure = {
  ok: false;
  code: typeof GEL_SOURCE_UNAVAILABLE;
  message: string;
};

export type ResolveRappelDetteGelsResult =
  | ResolveRappelDetteGelsSuccess
  | ResolveRappelDetteGelsFailure;

export type ResolveRappelDetteGelsInput = {
  /** Client de lecture — en TX : exclusivement le `tx` fourni. */
  prisma: RappelDetteGelPrisma;
  adherentId: string;
};

/**
 * Sérialise une révision bigint en chaîne décimale (jetons / DTO).
 *
 * @param revision - Compteur gels
 */
export function formatGelsRevisionDecimal(revision: bigint): string {
  return revision.toString(10);
}

/**
 * Parse une révision décimale (claims jeton). Refuse toute forme non entière ≥ 0.
 *
 * @param raw - Chaîne issue du jeton / DTO
 */
export function parseGelsRevisionDecimal(raw: string): bigint | null {
  const t = String(raw ?? "").trim();
  if (!/^[0-9]+$/.test(t)) return null;
  try {
    return BigInt(t);
  } catch {
    return null;
  }
}

/**
 * Compare deux révisions bigint (égalité stricte).
 *
 * @param a - Révision A
 * @param b - Révision B
 */
export function gelsRevisionsEqual(a: bigint, b: bigint): boolean {
  return a === b;
}

/**
 * Lit les gels ACTIF et la révision pour un adhérent.
 *
 * @param input - Client Prisma + adhérent
 */
export async function resolveRappelDetteGels(
  input: ResolveRappelDetteGelsInput
): Promise<ResolveRappelDetteGelsResult> {
  const adherentId = String(input.adherentId ?? "").trim();
  if (!adherentId) {
    return {
      ok: false,
      code: GEL_SOURCE_UNAVAILABLE,
      message: "Adhérent requis pour la lecture des gels",
    };
  }

  try {
    const [gels, revRow] = await Promise.all([
      input.prisma.rappelDetteGel.findMany({
        where: { adherentId, statut: "ACTIF" },
        select: {
          scope: true,
          lineSource: true,
          cotisationMensuelleId: true,
          detteInitialeId: true,
        },
      }),
      input.prisma.rappelDetteGelRevision.findUnique({
        where: { adherentId },
        select: { revision: true },
      }),
    ]);

    // Absence de ligne révision = 0 (≠ erreur de lecture).
    const gelsRevision = revRow?.revision ?? BigInt(0);

    let frozenAdherent = false;
    const frozenLineKeys = new Set<string>();

    for (const gel of gels) {
      if (gel.scope === "ADHERENT") {
        frozenAdherent = true;
        continue;
      }
      if (gel.scope === "LIGNE" && gel.lineSource) {
        const source = gel.lineSource as RappelDebtSource;
        const lineId =
          source === "cotisation_mensuelle"
            ? gel.cotisationMensuelleId
            : gel.detteInitialeId;
        if (lineId) {
          frozenLineKeys.add(frozenLineKey(source, lineId));
        }
      }
    }

    return {
      ok: true,
      gelsRevision,
      gelsRevisionDecimal: formatGelsRevisionDecimal(gelsRevision),
      frozenAdherent,
      frozenLineKeys,
    };
  } catch (error) {
    console.error("[resolveRappelDetteGels]", {
      category: "gel_source_unavailable",
      adherentIdLength: adherentId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      code: GEL_SOURCE_UNAVAILABLE,
      message: "Source des gels indisponible",
    };
  }
}
