/**
 * Lectures serveur admin Lot 3 (capacités + historiques paginés).
 *
 * - Aucune mutation / réserve / émission.
 * - Acteur ADMIN|PRESID obligatoire (défense en profondeur avec les actions).
 * - DTO explicites — jamais d’objet Prisma brut.
 * - Pas de token, secret, HTML, erreur provider brute, email destinataire clair.
 * - Motifs gels : uniquement si acteur autorisé ; jamais loggés.
 * - Curseurs liés à adherentId + kind + filtres effectifs ; ancre vérifiée.
 *
 * Module serveur — **ne pas** réexporter via le barrel public.
 */

import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { canAccessPreviewRappelsDette } from "@/lib/services/cotisations/rappel-dette/preview-access";
import { isRappelDetteEnvoiEnabled } from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";
import { isRappelDetteGelMutationEnabled } from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation";
import { formatGelsRevisionDecimal } from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-resolve";
import { maskRappelDetteRecipientEmail } from "@/lib/services/cotisations/rappel-dette/rappel-dette-prepare-confirmation";

export const RAPPEL_DETTE_ADMIN_READ_ACCESS_DENIED_MESSAGE =
  "Lectures rappel dette réservées aux administrateurs et au président." as const;

export const RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE =
  "RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE" as const;

/** Accepted fournisseur ≠ livraison boîte mail. */
export const RAPPEL_DETTE_EMAIL_ACCEPTED_MEANING =
  "provider_accepted_not_delivery" as const;

export const RAPPEL_DETTE_ADMIN_READ_DEFAULT_PAGE_SIZE = 20 as const;
export const RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE = 50 as const;
/** Taille max du curseur opaque (base64url) — alignée Zod actions. */
export const RAPPEL_DETTE_ADMIN_READ_MAX_CURSOR_CHARS = 512 as const;

export const RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS = "envois" as const;
export const RAPPEL_DETTE_ADMIN_READ_KIND_GELS = "gels" as const;

export type AdminReadActor = Pick<AuthContext, "userId" | "role">;

export type RappelDetteAdminCapabilities = {
  canAccess: true;
  envoiEnabled: boolean;
  gelMutationEnabled: boolean;
  /** Toujours false en v1 lectures — aucun renvoi proposé. */
  canProposeResend: false;
};

/** Filtres effectifs envois — aucun filtre client en v1. */
export type EnvoiListFilters = Record<string, never>;

/** Filtres effectifs gels — historique ACTIF+LEVE sans filtre client en v1. */
export type GelListFilters = Record<string, never>;

export type RappelDetteEnvoiListItem = {
  id: string;
  adherentId: string;
  reservationStatus: string;
  emailStatus: string;
  notifStatus: string;
  /** Signification UI : Accepted = accepté fournisseur, pas livré. */
  emailAcceptedMeaning: typeof RAPPEL_DETTE_EMAIL_ACCEPTED_MEANING | null;
  detteNette: string;
  gelsRevision: string | null;
  recipientMasked: string;
  reservedAt: string;
  callingAt: string | null;
  emailAcceptedAt: string | null;
  closedAt: string | null;
  unknownAt: string | null;
  /**
   * État métier reprenable (Completed + Accepted + emailAcceptedAt
   * + notif NotStarted|Failed) — indépendant du flag serveur.
   */
  notifResumeEligible: boolean;
  /**
   * Action actuellement autorisée : éligible **et** flag envoi serveur on.
   */
  canResumeNotif: boolean;
  /** Toujours false — pas de capacité « renvoyer ». */
  canProposeResend: false;
};

export type RappelDetteGelListItem = {
  id: string;
  adherentId: string;
  scope: "ADHERENT" | "LIGNE";
  statut: "ACTIF" | "LEVE";
  lineSource: "cotisation_mensuelle" | "dette_initiale" | null;
  lineLabel: string | null;
  motifCode: string;
  motifTexte: string;
  referenceDossier: string | null;
  posedAt: string;
  poseParUserId: string;
  poseParLabel: string;
  leveAt: string | null;
  leveParUserId: string | null;
  leveParLabel: string | null;
};

export type AdminReadPage<T> = {
  items: T[];
  pageSize: number;
  hasMore: boolean;
  /** Curseur opaque pour la page suivante (absent si !hasMore). */
  nextCursor: string | null;
};

export type AdminReadFailure = {
  ok: false;
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | typeof RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE
    | "INTERNAL_ERROR";
  message: string;
};

export type GetCapabilitiesResult =
  | { ok: true; data: RappelDetteAdminCapabilities }
  | AdminReadFailure;

export type ListEnvoisResult =
  | { ok: true; data: AdminReadPage<RappelDetteEnvoiListItem> }
  | AdminReadFailure;

export type ListGelsResult =
  | { ok: true; data: AdminReadPage<RappelDetteGelListItem> }
  | AdminReadFailure;

type EnvoiCursorV1 = {
  v: 1;
  kind: typeof RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS;
  adherentId: string;
  filters: EnvoiListFilters;
  reservedAt: string;
  id: string;
};

type GelCursorV1 = {
  v: 1;
  kind: typeof RAPPEL_DETTE_ADMIN_READ_KIND_GELS;
  adherentId: string;
  filters: GelListFilters;
  posedAt: string;
  id: string;
};

const EMPTY_ENVOI_FILTERS: EnvoiListFilters = {};
const EMPTY_GEL_FILTERS: GelListFilters = {};

function fail(
  code: AdminReadFailure["code"],
  message: string
): AdminReadFailure {
  return { ok: false, code, message };
}

/**
 * Garde acteur ADMIN|PRESID avant toute lecture métier.
 *
 * @param actor - Session uniquement
 */
export function assertAdminReadActor(
  actor: AdminReadActor | null | undefined
): AdminReadFailure | null {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    return fail("UNAUTHENTICATED", "Non authentifié");
  }
  if (!canAccessPreviewRappelsDette(actor.role)) {
    return fail("FORBIDDEN", RAPPEL_DETTE_ADMIN_READ_ACCESS_DENIED_MESSAGE);
  }
  return null;
}

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function clampPageSize(raw: number | undefined): number {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.trunc(raw)
      : RAPPEL_DETTE_ADMIN_READ_DEFAULT_PAGE_SIZE;
  if (n < 1) return RAPPEL_DETTE_ADMIN_READ_DEFAULT_PAGE_SIZE;
  return Math.min(n, RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE);
}

function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function isEmptyFiltersObject(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as object).length === 0;
}

function sameInstant(a: Date, iso: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return a.getTime() === t;
}

/**
 * Décode et valide un curseur envois (structure / taille / kind).
 * Ne constitue **pas** une autorisation d’accès.
 *
 * @param raw - Curseur opaque
 * @param adherentId - Adhérent de la requête
 * @param filters - Filtres effectifs de la requête
 */
export function decodeAndValidateEnvoiCursor(
  raw: string,
  adherentId: string,
  filters: EnvoiListFilters
): { ok: true; cursor: EnvoiCursorV1 } | AdminReadFailure {
  const trimmed = String(raw ?? "").trim();
  if (
    !trimmed ||
    trimmed.length > RAPPEL_DETTE_ADMIN_READ_MAX_CURSOR_CHARS
  ) {
    return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
  }
  try {
    const o = JSON.parse(
      Buffer.from(trimmed, "base64url").toString("utf8")
    ) as Partial<EnvoiCursorV1> & { kind?: string };
    if (
      o.v !== 1 ||
      o.kind !== RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS ||
      typeof o.adherentId !== "string" ||
      !o.adherentId.trim() ||
      o.adherentId.length > 64 ||
      typeof o.reservedAt !== "string" ||
      !o.reservedAt.trim() ||
      Number.isNaN(Date.parse(o.reservedAt)) ||
      typeof o.id !== "string" ||
      !o.id.trim() ||
      o.id.length > 64 ||
      !isEmptyFiltersObject(o.filters)
    ) {
      return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
    }
    if (o.adherentId.trim() !== adherentId) {
      return fail(
        "VALIDATION_ERROR",
        "Curseur incompatible avec l’adhérent demandé"
      );
    }
    if (!isEmptyFiltersObject(filters)) {
      return fail(
        "VALIDATION_ERROR",
        "Curseur incompatible avec les filtres demandés"
      );
    }
    return {
      ok: true,
      cursor: {
        v: 1,
        kind: RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS,
        adherentId: o.adherentId.trim(),
        filters: EMPTY_ENVOI_FILTERS,
        reservedAt: o.reservedAt.trim(),
        id: o.id.trim(),
      },
    };
  } catch {
    return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
  }
}

/**
 * Décode et valide un curseur gels (structure / taille / kind).
 *
 * @param raw - Curseur opaque
 * @param adherentId - Adhérent de la requête
 * @param filters - Filtres effectifs
 */
export function decodeAndValidateGelCursor(
  raw: string,
  adherentId: string,
  filters: GelListFilters
): { ok: true; cursor: GelCursorV1 } | AdminReadFailure {
  const trimmed = String(raw ?? "").trim();
  if (
    !trimmed ||
    trimmed.length > RAPPEL_DETTE_ADMIN_READ_MAX_CURSOR_CHARS
  ) {
    return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
  }
  try {
    const o = JSON.parse(
      Buffer.from(trimmed, "base64url").toString("utf8")
    ) as Partial<GelCursorV1> & { kind?: string };
    if (
      o.v !== 1 ||
      o.kind !== RAPPEL_DETTE_ADMIN_READ_KIND_GELS ||
      typeof o.adherentId !== "string" ||
      !o.adherentId.trim() ||
      o.adherentId.length > 64 ||
      typeof o.posedAt !== "string" ||
      !o.posedAt.trim() ||
      Number.isNaN(Date.parse(o.posedAt)) ||
      typeof o.id !== "string" ||
      !o.id.trim() ||
      o.id.length > 64 ||
      !isEmptyFiltersObject(o.filters)
    ) {
      return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
    }
    if (o.adherentId.trim() !== adherentId) {
      return fail(
        "VALIDATION_ERROR",
        "Curseur incompatible avec l’adhérent demandé"
      );
    }
    if (!isEmptyFiltersObject(filters)) {
      return fail(
        "VALIDATION_ERROR",
        "Curseur incompatible avec les filtres demandés"
      );
    }
    return {
      ok: true,
      cursor: {
        v: 1,
        kind: RAPPEL_DETTE_ADMIN_READ_KIND_GELS,
        adherentId: o.adherentId.trim(),
        filters: EMPTY_GEL_FILTERS,
        posedAt: o.posedAt.trim(),
        id: o.id.trim(),
      },
    };
  } catch {
    return fail("VALIDATION_ERROR", "Curseur de pagination invalide");
  }
}

function buildEnvoiNextCursor(input: {
  adherentId: string;
  reservedAt: Date;
  id: string;
}): string {
  const payload: EnvoiCursorV1 = {
    v: 1,
    kind: RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS,
    adherentId: input.adherentId,
    filters: EMPTY_ENVOI_FILTERS,
    reservedAt: input.reservedAt.toISOString(),
    id: input.id,
  };
  return encodeCursor(payload);
}

function buildGelNextCursor(input: {
  adherentId: string;
  posedAt: Date;
  id: string;
}): string {
  const payload: GelCursorV1 = {
    v: 1,
    kind: RAPPEL_DETTE_ADMIN_READ_KIND_GELS,
    adherentId: input.adherentId,
    filters: EMPTY_GEL_FILTERS,
    posedAt: input.posedAt.toISOString(),
    id: input.id,
  };
  return encodeCursor(payload);
}

function isSourceUnavailableError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  return (
    error.code === "P2021" ||
    error.code === "P2022" ||
    error.code === "P2010"
  );
}

function userLabel(u: {
  name: string | null;
  email: string | null;
} | null): string {
  if (!u) return "—";
  const name = String(u.name ?? "").trim();
  if (name) return name;
  const email = String(u.email ?? "").trim();
  if (email) return maskRappelDetteRecipientEmail(email);
  return "—";
}

/**
 * État métier : reprise notification seule possible d’après la persistance.
 * Indépendant du flag serveur et de notificationId (Created reste non éligible).
 *
 * @param row - Statuts + preuve Accepted
 */
export function notifResumeEligible(row: {
  reservationStatus: string;
  emailStatus: string;
  notifStatus: string;
  emailAcceptedAt: Date | string | null | undefined;
}): boolean {
  if (row.reservationStatus !== "Completed") return false;
  if (row.emailStatus !== "Accepted") return false;
  if (row.emailAcceptedAt == null) return false;
  if (typeof row.emailAcceptedAt === "string") {
    const t = row.emailAcceptedAt.trim();
    if (!t || Number.isNaN(Date.parse(t))) return false;
  }
  return (
    row.notifStatus === "NotStarted" || row.notifStatus === "Failed"
  );
}

/**
 * Capacité effective de reprise notif : éligible **et** flag envoi serveur.
 *
 * @param row - État persisté
 * @param envoiEnabled - Flag serveur (défaut : lecture activation)
 */
export function canResumeNotif(
  row: {
    reservationStatus: string;
    emailStatus: string;
    notifStatus: string;
    emailAcceptedAt: Date | string | null | undefined;
  },
  envoiEnabled: boolean = isRappelDetteEnvoiEnabled()
): boolean {
  return notifResumeEligible(row) && envoiEnabled === true;
}

/**
 * Capacités admin (booléens flags) — lectures OK même si flags off.
 *
 * @param actor - Session
 */
export function getRappelDetteAdminCapabilities(
  actor: AdminReadActor | null | undefined
): GetCapabilitiesResult {
  const denied = assertAdminReadActor(actor);
  if (denied) return denied;

  return {
    ok: true,
    data: {
      canAccess: true,
      envoiEnabled: isRappelDetteEnvoiEnabled(),
      gelMutationEnabled: isRappelDetteGelMutationEnabled(),
      canProposeResend: false,
    },
  };
}

/**
 * Historique des envois d’un adhérent (paginé, ordre reservedAt DESC, id DESC).
 *
 * @param input - Acteur + adherentId + pagination
 */
export async function listRappelDetteEnvoisByAdherent(input: {
  actor: AdminReadActor | null | undefined;
  adherentId: string;
  pageSize?: number;
  cursor?: string | null;
}): Promise<ListEnvoisResult> {
  const denied = assertAdminReadActor(input.actor);
  if (denied) return denied;

  const adherentId = String(input.adherentId ?? "").trim();
  if (!adherentId || adherentId.length > 64) {
    return fail("VALIDATION_ERROR", "Adhérent requis");
  }

  const pageSize = clampPageSize(input.pageSize);
  const filters = EMPTY_ENVOI_FILTERS;
  let cursor: EnvoiCursorV1 | null = null;
  if (input.cursor != null && String(input.cursor).trim() !== "") {
    const decoded = decodeAndValidateEnvoiCursor(
      String(input.cursor),
      adherentId,
      filters
    );
    if (!decoded.ok) return decoded;
    cursor = decoded.cursor;
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { id: adherentId },
      select: { id: true },
    });
    if (!adherent) {
      return fail("NOT_FOUND", "Adhérent introuvable");
    }

    if (cursor) {
      const anchor = await db.rappelDetteEnvoi.findUnique({
        where: { id: cursor.id },
        select: { id: true, adherentId: true, reservedAt: true },
      });
      if (!anchor) {
        return fail(
          "VALIDATION_ERROR",
          "Ancre de pagination introuvable ou supprimée"
        );
      }
      if (anchor.adherentId !== adherentId) {
        return fail(
          "VALIDATION_ERROR",
          "Curseur incompatible avec l’adhérent demandé"
        );
      }
      if (!sameInstant(anchor.reservedAt, cursor.reservedAt)) {
        return fail(
          "VALIDATION_ERROR",
          "Curseur de pagination incompatible avec l’ancre"
        );
      }
    }

    const where: Prisma.RappelDetteEnvoiWhereInput = {
      adherentId,
      ...(cursor
        ? {
            OR: [
              { reservedAt: { lt: new Date(cursor.reservedAt) } },
              {
                reservedAt: new Date(cursor.reservedAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };

    const rows = await db.rappelDetteEnvoi.findMany({
      where,
      orderBy: [{ reservedAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      select: {
        id: true,
        adherentId: true,
        reservationStatus: true,
        emailStatus: true,
        notifStatus: true,
        detteNette: true,
        gelsRevision: true,
        recipientEmail: true,
        reservedAt: true,
        callingAt: true,
        emailAcceptedAt: true,
        closedAt: true,
        unknownAt: true,
      },
    });

    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const envoiEnabled = isRappelDetteEnvoiEnabled();

    const items: RappelDetteEnvoiListItem[] = slice.map((row) => {
      const emailAcceptedMeaning =
        row.emailStatus === "Accepted"
          ? RAPPEL_DETTE_EMAIL_ACCEPTED_MEANING
          : null;
      const eligible = notifResumeEligible(row);
      return {
        id: row.id,
        adherentId: row.adherentId,
        reservationStatus: row.reservationStatus,
        emailStatus: row.emailStatus,
        notifStatus: row.notifStatus,
        emailAcceptedMeaning,
        detteNette: row.detteNette.toFixed(2),
        gelsRevision:
          row.gelsRevision == null
            ? null
            : formatGelsRevisionDecimal(row.gelsRevision),
        recipientMasked: maskRappelDetteRecipientEmail(row.recipientEmail),
        reservedAt: row.reservedAt.toISOString(),
        callingAt: toIso(row.callingAt),
        emailAcceptedAt: toIso(row.emailAcceptedAt),
        closedAt: toIso(row.closedAt),
        unknownAt: toIso(row.unknownAt),
        notifResumeEligible: eligible,
        canResumeNotif: eligible && envoiEnabled,
        canProposeResend: false,
      };
    });

    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? buildEnvoiNextCursor({
            adherentId: last.adherentId,
            reservedAt: last.reservedAt,
            id: last.id,
          })
        : null;

    return {
      ok: true,
      data: { items, pageSize, hasMore, nextCursor },
    };
  } catch (error) {
    if (isSourceUnavailableError(error)) {
      console.error("[listRappelDetteEnvoisByAdherent]", {
        category: "source_unavailable",
        adherentIdLength: adherentId.length,
        prismaCode:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,
      });
      return fail(
        RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
        "Source des envois indisponible"
      );
    }
    console.error("[listRappelDetteEnvoisByAdherent]", {
      category: "read_error",
      adherentIdLength: adherentId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return fail("INTERNAL_ERROR", "Échec de lecture de l’historique des envois");
  }
}

/**
 * Historique des gels d’un adhérent (ACTIF + LEVE), paginé.
 * Ordre posedAt DESC, id DESC.
 *
 * @param input - Acteur + adherentId + pagination
 */
export async function listRappelDetteGelsByAdherent(input: {
  actor: AdminReadActor | null | undefined;
  adherentId: string;
  pageSize?: number;
  cursor?: string | null;
}): Promise<ListGelsResult> {
  const denied = assertAdminReadActor(input.actor);
  if (denied) return denied;

  const adherentId = String(input.adherentId ?? "").trim();
  if (!adherentId || adherentId.length > 64) {
    return fail("VALIDATION_ERROR", "Adhérent requis");
  }

  const pageSize = clampPageSize(input.pageSize);
  const filters = EMPTY_GEL_FILTERS;
  let cursor: GelCursorV1 | null = null;
  if (input.cursor != null && String(input.cursor).trim() !== "") {
    const decoded = decodeAndValidateGelCursor(
      String(input.cursor),
      adherentId,
      filters
    );
    if (!decoded.ok) return decoded;
    cursor = decoded.cursor;
  }

  const includeMotifs = canAccessPreviewRappelsDette(input.actor!.role);

  try {
    const adherent = await db.adherent.findUnique({
      where: { id: adherentId },
      select: { id: true },
    });
    if (!adherent) {
      return fail("NOT_FOUND", "Adhérent introuvable");
    }

    if (cursor) {
      const anchor = await db.rappelDetteGel.findUnique({
        where: { id: cursor.id },
        select: { id: true, adherentId: true, posedAt: true },
      });
      if (!anchor) {
        return fail(
          "VALIDATION_ERROR",
          "Ancre de pagination introuvable ou supprimée"
        );
      }
      if (anchor.adherentId !== adherentId) {
        return fail(
          "VALIDATION_ERROR",
          "Curseur incompatible avec l’adhérent demandé"
        );
      }
      if (!sameInstant(anchor.posedAt, cursor.posedAt)) {
        return fail(
          "VALIDATION_ERROR",
          "Curseur de pagination incompatible avec l’ancre"
        );
      }
    }

    const where: Prisma.RappelDetteGelWhereInput = {
      adherentId,
      ...(cursor
        ? {
            OR: [
              { posedAt: { lt: new Date(cursor.posedAt) } },
              {
                posedAt: new Date(cursor.posedAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };

    const rows = await db.rappelDetteGel.findMany({
      where,
      orderBy: [{ posedAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      select: {
        id: true,
        adherentId: true,
        scope: true,
        statut: true,
        lineSource: true,
        cotisationMensuelleId: true,
        detteInitialeId: true,
        motifCode: true,
        motifTexte: true,
        referenceDossier: true,
        posedAt: true,
        poseParUserId: true,
        leveAt: true,
        leveParUserId: true,
        PosePar: { select: { name: true, email: true } },
        LevePar: { select: { name: true, email: true } },
        CotisationMensuelle: {
          select: { periode: true, annee: true, mois: true },
        },
        DetteInitiale: { select: { annee: true } },
      },
    });

    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;

    const items: RappelDetteGelListItem[] = slice.map((row) => {
      let lineLabel: string | null = null;
      if (row.scope === "LIGNE" && row.lineSource === "cotisation_mensuelle") {
        const cm = row.CotisationMensuelle;
        lineLabel = cm
          ? `CM ${cm.periode}`
          : row.cotisationMensuelleId
            ? `CM ${row.cotisationMensuelleId.slice(0, 8)}…`
            : "CM";
      } else if (row.scope === "LIGNE" && row.lineSource === "dette_initiale") {
        const di = row.DetteInitiale;
        lineLabel = di
          ? `DI ${di.annee}`
          : row.detteInitialeId
            ? `DI ${row.detteInitialeId.slice(0, 8)}…`
            : "DI";
      }

      return {
        id: row.id,
        adherentId: row.adherentId,
        scope: row.scope,
        statut: row.statut,
        lineSource: row.lineSource,
        lineLabel,
        motifCode: includeMotifs ? row.motifCode : "",
        motifTexte: includeMotifs ? row.motifTexte : "",
        referenceDossier: includeMotifs ? row.referenceDossier : null,
        posedAt: row.posedAt.toISOString(),
        poseParUserId: row.poseParUserId,
        poseParLabel: userLabel(row.PosePar),
        leveAt: toIso(row.leveAt),
        leveParUserId: row.leveParUserId,
        leveParLabel: row.leveParUserId ? userLabel(row.LevePar) : null,
      };
    });

    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? buildGelNextCursor({
            adherentId: last.adherentId,
            posedAt: last.posedAt,
            id: last.id,
          })
        : null;

    return {
      ok: true,
      data: { items, pageSize, hasMore, nextCursor },
    };
  } catch (error) {
    if (isSourceUnavailableError(error)) {
      console.error("[listRappelDetteGelsByAdherent]", {
        category: "source_unavailable",
        adherentIdLength: adherentId.length,
        prismaCode:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,
      });
      return fail(
        RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
        "Source des gels indisponible"
      );
    }
    console.error("[listRappelDetteGelsByAdherent]", {
      category: "read_error",
      adherentIdLength: adherentId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return fail("INTERNAL_ERROR", "Échec de lecture de l’historique des gels");
  }
}
