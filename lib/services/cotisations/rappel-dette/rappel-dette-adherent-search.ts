/**
 * Recherche d’adhérents pour opérations rappels Lot 3 (ADMIN|PRESID).
 * Lecture bornée — aucune mutation, pas de chargement massif.
 * Module serveur — ne pas réexporter via le barrel public.
 */

import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessPreviewRappelsDette } from "@/lib/services/cotisations/rappel-dette/preview-access";
import { buildHomonymFicheReferences } from "@/lib/services/cotisations/rappel-dette/preview-display";
import {
  RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT,
  RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS,
  type RappelDetteAdherentSearchItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search-constants";

export {
  RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT,
  RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS,
  RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE,
  type RappelDetteAdherentSearchItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search-constants";

export const RAPPEL_DETTE_ADHERENT_SEARCH_ACCESS_DENIED_MESSAGE =
  "Recherche adhérents rappels réservée aux administrateurs et au président." as const;

export const RAPPEL_DETTE_ADHERENT_SEARCH_QUERY_TOO_SHORT_MESSAGE =
  "Saisissez au moins 2 caractères pour rechercher." as const;

export const RAPPEL_DETTE_ADHERENT_SEARCH_TECHNICAL_ERROR_MESSAGE =
  "Erreur technique lors de la recherche d’adhérents." as const;

export type RappelDetteAdherentSearchActor = {
  userId: string;
  role: unknown;
};

export type RappelDetteAdherentSearchSuccess = {
  ok: true;
  query: string;
  items: RappelDetteAdherentSearchItem[];
  truncated: boolean;
  limit: typeof RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT;
};

export type RappelDetteAdherentSearchFailure = {
  ok: false;
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "INTERNAL_ERROR";
  message: string;
};

export type RappelDetteAdherentSearchResult =
  | RappelDetteAdherentSearchSuccess
  | RappelDetteAdherentSearchFailure;

export type SearchRappelDetteAdherentsDeps = {
  /** Sous-ensemble injectable (tests) — uniquement `findMany`. */
  prisma?: {
    adherent: {
      findMany: PrismaClient["adherent"]["findMany"];
    };
  };
};

function fail(
  code: RappelDetteAdherentSearchFailure["code"],
  message: string
): RappelDetteAdherentSearchFailure {
  return { ok: false, code, message };
}

/**
 * Normalise la requête : trim, collapse espaces internes.
 *
 * @param raw - Saisie utilisateur
 */
export function normalizeAdherentSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Recherche bornée d’adhérents (firstname / lastname, mode insensitive).
 * Prend limit+1 pour détecter la troncature. Ordre déterministe.
 *
 * @param input - Acteur session + query
 * @param deps - Prisma injectable (tests)
 */
export async function searchRappelDetteAdherents(
  input: {
    actor: RappelDetteAdherentSearchActor | null | undefined;
    query: string;
  },
  deps: SearchRappelDetteAdherentsDeps = {}
): Promise<RappelDetteAdherentSearchResult> {
  const actor = input.actor;
  if (!actor?.userId || String(actor.userId).trim() === "") {
    return fail(
      "UNAUTHENTICATED",
      RAPPEL_DETTE_ADHERENT_SEARCH_ACCESS_DENIED_MESSAGE
    );
  }
  if (!canAccessPreviewRappelsDette(actor.role)) {
    return fail(
      "FORBIDDEN",
      RAPPEL_DETTE_ADHERENT_SEARCH_ACCESS_DENIED_MESSAGE
    );
  }

  const query = normalizeAdherentSearchQuery(input.query);
  if (query.length < RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS) {
    return fail(
      "VALIDATION_ERROR",
      RAPPEL_DETTE_ADHERENT_SEARCH_QUERY_TOO_SHORT_MESSAGE
    );
  }
  if (query.length > 64) {
    return fail("VALIDATION_ERROR", "Requête trop longue");
  }

  const prisma = deps.prisma ?? db;
  const take = RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT + 1;

  try {
    const rows = await prisma.adherent.findMany({
      where: {
        OR: [
          { firstname: { contains: query, mode: "insensitive" } },
          { lastname: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }, { id: "asc" }],
      take,
    });

    const truncated = rows.length > RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT;
    const sliced = truncated
      ? rows.slice(0, RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT)
      : rows;

    const displayRows = sliced.map((r) => ({
      adherentId: r.id,
      displayName: `${r.firstname} ${r.lastname}`.trim(),
    }));
    const homonymRefs = buildHomonymFicheReferences(displayRows);

    const items: RappelDetteAdherentSearchItem[] = sliced.map((r) => ({
      adherentId: r.id,
      firstname: r.firstname,
      lastname: r.lastname,
      disambiguationLabel: homonymRefs.get(r.id) ?? null,
    }));

    return {
      ok: true,
      query,
      items,
      truncated,
      limit: RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT,
    };
  } catch (error) {
    console.error("[searchRappelDetteAdherents]", {
      category: "prisma_error",
      name: error instanceof Error ? error.name : "unknown",
    });
    return fail(
      "INTERNAL_ERROR",
      RAPPEL_DETTE_ADHERENT_SEARCH_TECHNICAL_ERROR_MESSAGE
    );
  }
}
