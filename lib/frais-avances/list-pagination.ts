/**
 * Pagination / filtre état financier notes de frais (requêtes paramétrées).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const NOTES_FRAIS_LIST_DEFAULT_PAGE_SIZE = 20;

export type NotesFraisEtatFinancierFilter =
  | "NON_REGLEE"
  | "PARTIELLEMENT_REGLEE"
  | "REGLEE"
  | "all";

export type NotesFraisListPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/**
 * Normalise page / pageSize (défaut 20, max 100).
 */
export function normalizeNotesFraisListPagination(input?: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; skip: number } {
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(input?.pageSize ?? NOTES_FRAIS_LIST_DEFAULT_PAGE_SIZE))
  );
  const page = Math.max(1, Math.floor(input?.page ?? 1));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/**
 * Condition SQL paramétrée pour l'état financier (consommé vs accepté).
 * Incohérence consommé > accepté : ne matche aucun des trois états.
 */
export function sqlEtatFinancierCondition(
  etat: Exclude<NotesFraisEtatFinancierFilter, "all">
): Prisma.Sql {
  const consomme = Prisma.sql`(c."montantRembourseUtilise" + c."montantCompensationUtilise")`;
  if (etat === "NON_REGLEE") {
    return Prisma.sql`${consomme} = 0`;
  }
  if (etat === "PARTIELLEMENT_REGLEE") {
    return Prisma.sql`${consomme} > 0 AND ${consomme} < nf."montantAccepte"`;
  }
  return Prisma.sql`${consomme} = nf."montantAccepte"`;
}

type ListIdsResult = { ids: string[]; total: number };

/**
 * IDs + total pour liste admin (statut + état financier) avant fetch DTO.
 * Ordre stable : "createdAt" DESC, id DESC.
 */
export async function queryAdminNoteFraisListIds(input: {
  statutIn: string[];
  onlyAlerteSansDestinataire?: boolean;
  etatFinancier?: NotesFraisEtatFinancierFilter;
  page?: number;
  pageSize?: number;
  client?: typeof db;
}): Promise<ListIdsResult> {
  const client = input.client ?? db;
  const { page, pageSize, skip } = normalizeNotesFraisListPagination(input);
  const etat =
    input.etatFinancier && input.etatFinancier !== "all"
      ? input.etatFinancier
      : null;

  if (!etat) {
    const where = {
      statut: { in: input.statutIn as never[] },
      ...(input.onlyAlerteSansDestinataire
        ? { alerteSansDestinataire: true }
        : {}),
    };
    const [total, rows] = await Promise.all([
      client.noteFrais.count({ where }),
      client.noteFrais.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        select: { id: true },
      }),
    ]);
    return { ids: rows.map((r) => r.id), total };
  }

  const etatSql = sqlEtatFinancierCondition(etat);
  const statutSql = Prisma.join(
    input.statutIn.map((s) => Prisma.sql`${s}`),
    ", "
  );
  const alerteSql = input.onlyAlerteSansDestinataire
    ? Prisma.sql`AND nf."alerteSansDestinataire" = true`
    : Prisma.empty;

  const countRows = await client.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT nf.id)::bigint AS count
    FROM notes_frais nf
    INNER JOIN notes_frais_choix_reglement c
      ON c."noteFraisId" = nf.id AND c.statut = 'ACTIF'
    WHERE nf.statut IN (${statutSql})
      AND nf."montantAccepte" IS NOT NULL
      AND ${etatSql}
      ${alerteSql}
  `;
  const total = Number(countRows[0]?.count ?? 0);

  const idRows = await client.$queryRaw<Array<{ id: string }>>`
    SELECT nf.id
    FROM notes_frais nf
    INNER JOIN notes_frais_choix_reglement c
      ON c."noteFraisId" = nf.id AND c.statut = 'ACTIF'
    WHERE nf.statut IN (${statutSql})
      AND nf."montantAccepte" IS NOT NULL
      AND ${etatSql}
      ${alerteSql}
    ORDER BY nf."createdAt" DESC, nf.id DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;

  return { ids: idRows.map((r) => r.id), total };
}

/**
 * IDs + total liste comptabilité (VALIDEE + état).
 */
export async function queryComptabiliteNoteFraisListIds(input: {
  etatFinancier?: NotesFraisEtatFinancierFilter;
  page?: number;
  pageSize?: number;
  client?: typeof db;
}): Promise<ListIdsResult> {
  return queryAdminNoteFraisListIds({
    statutIn: ["VALIDEE"],
    etatFinancier: input.etatFinancier,
    page: input.page,
    pageSize: input.pageSize,
    client: input.client,
  });
}

/**
 * Construit le méta pagination.
 */
export function buildNotesFraisListPaginationMeta(input: {
  page: number;
  pageSize: number;
  total: number;
}): NotesFraisListPagination {
  const pageCount = input.total === 0 ? 0 : Math.ceil(input.total / input.pageSize);
  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    pageCount,
  };
}
