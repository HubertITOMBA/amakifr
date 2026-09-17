/**
 * Choix de règlement adhérent après VALIDEE (lot 3).
 * Enregistre l'accord + cibles — sans écriture comptable ni mouvement de solde.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserReadSubmittedNotesFrais } from "@/lib/frais-avances/authz";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";

export type NotesFraisChoixActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_CHOIX_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_CHOIX_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de choix différent";

export const NOTES_FRAIS_CHOIX_REFRESH_REQUIRED =
  "Montant demandé supérieur au restant actuel — actualisez les cibles et réessayez";

export const NOTES_FRAIS_CHOIX_ALREADY_USED =
  "Remplacement impossible : des montants ont déjà été utilisés";

export type ModeReglementChoix = "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";
export type TypeCibleChoix = "COTISATION_MENSUELLE" | "DETTE_INITIALE";

export type CibleChoixInput = {
  typeCible: TypeCibleChoix;
  cibleId: string;
  montantAutorise: number | string;
  rang: number;
};

export type SetChoixReglementInput = {
  actorUserId: string;
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  mode: ModeReglementChoix;
  montantRemboursement: number | string;
  montantCompensation: number | string;
  cibles: CibleChoixInput[];
  client?: typeof db;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
};

export type CibleEligibleDto = {
  typeCible: TypeCibleChoix;
  cibleId: string;
  libelle: string;
  montantRestant: string;
};

export type ChoixReglementCibleDto = {
  typeCible: TypeCibleChoix;
  cibleId: string;
  montantAutorise: string;
  montantUtilise: string;
  montantRestantSnapshot: string;
  libelleSnapshot: string | null;
  rang: number;
};

export type ChoixReglementDto = {
  id: string;
  noteFraisId: string;
  mode: ModeReglementChoix;
  statut: string;
  montantReference: string;
  montantRemboursement: string;
  montantCompensation: string;
  montantRembourseUtilise: string;
  montantCompensationUtilise: string;
  remplaceChoixId: string | null;
  choisiAt: Date | string;
  Cibles: ChoixReglementCibleDto[];
};

/** Résumé archive — sans IDs de cibles ni libellés libres. */
export type ChoixReglementArchiveSummary = {
  modeReglement: ModeReglementChoix;
  montantRemboursementChoix: string;
  montantCompensationChoix: string;
};

function disabledResult(): NotesFraisChoixActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisChoixActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_CHOIX_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_CHOIX_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_CHOIX_REFRESH_REQUIRED) {
      code = "REFRESH_REQUIRED";
    }
    if (error.message === NOTES_FRAIS_CHOIX_ALREADY_USED) {
      code = "ALREADY_USED";
    }
    if (error.message.includes("Non autorisé")) code = "FORBIDDEN";
    if (error.message.includes("introuvable")) code = "NOT_FOUND";
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

function money(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function moneyEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.toFixed(2) === b.toFixed(2);
}

/**
 * Valide les montants du choix (égalité exacte, pas de min silencieux).
 */
export function validateChoixMontants(input: {
  mode: ModeReglementChoix;
  montantReference: Prisma.Decimal | number | string;
  montantRemboursement: number | string;
  montantCompensation: number | string;
  cibles: CibleChoixInput[];
}): {
  montantReference: string;
  montantRemboursement: string;
  montantCompensation: string;
  cibles: Array<CibleChoixInput & { montantAutoriseFixed: string }>;
} {
  const ref = money(input.montantReference);
  if (!(ref.gt(0))) throw new Error("Montant de référence invalide");

  const remb = money(input.montantRemboursement);
  const comp = money(input.montantCompensation);
  if (remb.lt(0) || comp.lt(0)) {
    throw new Error("Les montants ne peuvent pas être négatifs");
  }
  if (!moneyEq(remb.plus(comp), ref)) {
    throw new Error(
      "Remboursement + compensation doit être égal au montant accepté"
    );
  }

  if (input.mode === "REMBOURSEMENT") {
    if (!moneyEq(comp, money(0)) || input.cibles.length > 0) {
      throw new Error("Mode remboursement : compensation et cibles interdites");
    }
    if (!moneyEq(remb, ref)) {
      throw new Error("Mode remboursement : montant remboursement = accepté");
    }
  } else if (input.mode === "COMPENSATION") {
    if (!moneyEq(remb, money(0))) {
      throw new Error("Mode compensation : remboursement doit être 0");
    }
    if (input.cibles.length === 0) {
      throw new Error("Mode compensation : au moins une cible requise");
    }
  } else if (input.mode === "MIXTE") {
    if (!(remb.gt(0) && comp.gt(0))) {
      throw new Error("Mode mixte : remboursement et compensation > 0");
    }
    if (input.cibles.length === 0) {
      throw new Error("Mode mixte : au moins une cible requise");
    }
  } else {
    throw new Error("Mode de règlement invalide");
  }

  const seen = new Set<string>();
  let sumCibles = money(0);
  const normalizedCibles: Array<
    CibleChoixInput & { montantAutoriseFixed: string }
  > = [];

  for (const c of input.cibles) {
    const key = `${c.typeCible}:${c.cibleId}`;
    if (seen.has(key)) throw new Error("Cible en doublon");
    seen.add(key);
    if (!Number.isInteger(c.rang) || c.rang < 0) {
      throw new Error("Rang de cible invalide");
    }
    const m = money(c.montantAutorise);
    if (!(m.gt(0))) throw new Error("Montant cible doit être strictement positif");
    sumCibles = sumCibles.plus(m);
    normalizedCibles.push({
      ...c,
      montantAutoriseFixed: m.toFixed(2),
    });
  }

  if (input.cibles.length > 0 && !moneyEq(sumCibles, comp)) {
    throw new Error(
      "Somme des cibles doit être égale au montant de compensation"
    );
  }

  return {
    montantReference: ref.toFixed(2),
    montantRemboursement: remb.toFixed(2),
    montantCompensation: comp.toFixed(2),
    cibles: normalizedCibles,
  };
}

function sameChoixContent(
  a: {
    mode: string;
    montantReference: string;
    montantRemboursement: string;
    montantCompensation: string;
    cibles: Array<{
      typeCible: string;
      cibleId: string;
      montantAutorise: string;
      rang: number;
    }>;
  },
  b: {
    mode: string;
    montantReference: string;
    montantRemboursement: string;
    montantCompensation: string;
    cibles: Array<{
      typeCible: string;
      cibleId: string;
      montantAutorise: string;
      rang: number;
    }>;
  }
): boolean {
  if (
    a.mode !== b.mode ||
    a.montantReference !== b.montantReference ||
    a.montantRemboursement !== b.montantRemboursement ||
    a.montantCompensation !== b.montantCompensation ||
    a.cibles.length !== b.cibles.length
  ) {
    return false;
  }
  const sortKey = (c: { typeCible: string; cibleId: string; rang: number }) =>
    `${c.rang}:${c.typeCible}:${c.cibleId}`;
  const as = [...a.cibles].sort((x, y) =>
    sortKey(x).localeCompare(sortKey(y))
  );
  const bs = [...b.cibles].sort((x, y) =>
    sortKey(x).localeCompare(sortKey(y))
  );
  return as.every(
    (c, i) =>
      c.typeCible === bs[i].typeCible &&
      c.cibleId === bs[i].cibleId &&
      c.montantAutorise === bs[i].montantAutorise &&
      c.rang === bs[i].rang
  );
}

function toChoixDto(row: {
  id: string;
  noteFraisId: string;
  mode: string;
  statut: string;
  montantReference: Prisma.Decimal;
  montantRemboursement: Prisma.Decimal;
  montantCompensation: Prisma.Decimal;
  montantRembourseUtilise: Prisma.Decimal;
  montantCompensationUtilise: Prisma.Decimal;
  remplaceChoixId: string | null;
  choisiAt: Date;
  Cibles?: Array<{
    typeCible: string;
    cibleId: string;
    montantAutorise: Prisma.Decimal;
    montantUtilise: Prisma.Decimal;
    montantRestantSnapshot: Prisma.Decimal;
    libelleSnapshot: string | null;
    rang: number;
  }>;
}): ChoixReglementDto {
  return {
    id: row.id,
    noteFraisId: row.noteFraisId,
    mode: row.mode as ModeReglementChoix,
    statut: row.statut,
    montantReference: row.montantReference.toFixed(2),
    montantRemboursement: row.montantRemboursement.toFixed(2),
    montantCompensation: row.montantCompensation.toFixed(2),
    montantRembourseUtilise: row.montantRembourseUtilise.toFixed(2),
    montantCompensationUtilise: row.montantCompensationUtilise.toFixed(2),
    remplaceChoixId: row.remplaceChoixId,
    choisiAt: row.choisiAt,
    Cibles: (row.Cibles ?? [])
      .slice()
      .sort((a, b) => a.rang - b.rang)
      .map((c) => ({
        typeCible: c.typeCible as TypeCibleChoix,
        cibleId: c.cibleId,
        montantAutorise: c.montantAutorise.toFixed(2),
        montantUtilise: c.montantUtilise.toFixed(2),
        montantRestantSnapshot: c.montantRestantSnapshot.toFixed(2),
        libelleSnapshot: c.libelleSnapshot,
        rang: c.rang,
      })),
  };
}

/**
 * Résumé archive (sans IDs cibles / libellés libres).
 */
export function toChoixReglementArchiveSummary(choix: {
  mode: string;
  montantRemboursement: Prisma.Decimal | number | string;
  montantCompensation: Prisma.Decimal | number | string;
}): ChoixReglementArchiveSummary {
  return {
    modeReglement: choix.mode as ModeReglementChoix,
    montantRemboursementChoix:
      normalizeNotesFraisMontant(choix.montantRemboursement) ?? "0.00",
    montantCompensationChoix:
      normalizeNotesFraisMontant(choix.montantCompensation) ?? "0.00",
  };
}

type TxClient = Prisma.TransactionClient;

/**
 * Vérifie qu'une cible appartient à l'adhérent et est éligible V1 (exact, pas de min).
 */
async function resolveEligibleCible(
  tx: TxClient,
  adherentId: string,
  c: CibleChoixInput & { montantAutoriseFixed: string }
): Promise<{ libelle: string; montantRestant: Prisma.Decimal }> {
  const demande = money(c.montantAutoriseFixed);

  if (c.typeCible === "DETTE_INITIALE") {
    const dette = await tx.detteInitiale.findFirst({
      where: { id: c.cibleId, adherentId },
      select: { id: true, annee: true, montantRestant: true },
    });
    if (!dette) throw new Error("Cible introuvable");
    const restant = money(dette.montantRestant);
    if (demande.gt(restant)) {
      throw new Error(NOTES_FRAIS_CHOIX_REFRESH_REQUIRED);
    }
    return {
      libelle: `Dette ${dette.annee}`,
      montantRestant: restant,
    };
  }

  if (c.typeCible === "COTISATION_MENSUELLE") {
    const cm = await tx.cotisationMensuelle.findFirst({
      where: {
        id: c.cibleId,
        adherentId,
        adherentBeneficiaireId: null,
        TypeCotisation: { categorie: { not: "Assistance" } },
      },
      select: {
        id: true,
        periode: true,
        montantRestant: true,
        TypeCotisation: { select: { nom: true, categorie: true } },
      },
    });
    if (!cm) throw new Error("Cible introuvable");
    const restant = money(cm.montantRestant);
    if (demande.gt(restant)) {
      throw new Error(NOTES_FRAIS_CHOIX_REFRESH_REQUIRED);
    }
    return {
      libelle: `${cm.periode} — ${cm.TypeCotisation.nom}`,
      montantRestant: restant,
    };
  }

  throw new Error("Type de cible invalide");
}

function choixHasUtilisation(choix: {
  montantRembourseUtilise: Prisma.Decimal;
  montantCompensationUtilise: Prisma.Decimal;
  Cibles: Array<{ montantUtilise: Prisma.Decimal }>;
}): boolean {
  if (choix.montantRembourseUtilise.gt(0)) return true;
  if (choix.montantCompensationUtilise.gt(0)) return true;
  return choix.Cibles.some((c) => c.montantUtilise.gt(0));
}

/**
 * Liste les cibles V1 éligibles (dette initiale + CM ordinaires, restant > 0).
 */
export async function listCiblesCompensationEligibles(input: {
  actorUserId: string;
  noteId: string;
  client?: typeof db;
}): Promise<NotesFraisChoixActionResult<CibleEligibleDto[]>> {
  try {
    assertNotesFraisEnabled();
    const client = input.client ?? db;
    const note = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        adherentId: true,
        demandeurUserId: true,
        montantAccepte: true,
      },
    });
    if (!note || note.demandeurUserId !== input.actorUserId) {
      throw new Error("Note introuvable");
    }
    if (note.statut !== "VALIDEE" || note.montantAccepte == null) {
      throw new Error("Choix réservé aux notes validées");
    }

    const [dettes, cms] = await Promise.all([
      client.detteInitiale.findMany({
        where: {
          adherentId: note.adherentId,
          montantRestant: { gt: 0 },
        },
        select: { id: true, annee: true, montantRestant: true },
        orderBy: { annee: "asc" },
      }),
      client.cotisationMensuelle.findMany({
        where: {
          adherentId: note.adherentId,
          adherentBeneficiaireId: null,
          montantRestant: { gt: 0 },
          TypeCotisation: { categorie: { not: "Assistance" } },
        },
        select: {
          id: true,
          periode: true,
          montantRestant: true,
          TypeCotisation: { select: { nom: true } },
        },
        orderBy: [{ annee: "asc" }, { mois: "asc" }],
      }),
    ]);

    const out: CibleEligibleDto[] = [
      ...dettes.map((d) => ({
        typeCible: "DETTE_INITIALE" as const,
        cibleId: d.id,
        libelle: `Dette ${d.annee}`,
        montantRestant: money(d.montantRestant).toFixed(2),
      })),
      ...cms.map((c) => ({
        typeCible: "COTISATION_MENSUELLE" as const,
        cibleId: c.id,
        libelle: `${c.periode} — ${c.TypeCotisation.nom}`,
        montantRestant: money(c.montantRestant).toFixed(2),
      })),
    ];
    return { success: true, data: out };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Lecture du choix ACTIF (owner ou responsable lecture).
 */
export async function getChoixReglementActif(input: {
  actorUserId: string;
  noteId: string;
  client?: typeof db;
}): Promise<NotesFraisChoixActionResult<ChoixReglementDto | null>> {
  try {
    assertNotesFraisEnabled();
    const client = input.client ?? db;
    const note = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: { id: true, demandeurUserId: true, statut: true },
    });
    if (!note) throw new Error("Note introuvable");

    const isOwner = note.demandeurUserId === input.actorUserId;
    if (!isOwner) {
      const asAdmin = await canUserReadSubmittedNotesFrais(input.actorUserId);
      if (!asAdmin || note.statut === "BROUILLON") {
        throw new Error("Note introuvable");
      }
    }

    const choix = await client.noteFraisChoixReglement.findFirst({
      where: { noteFraisId: input.noteId, statut: "ACTIF" },
      include: { Cibles: true },
    });
    return {
      success: true,
      data: choix ? toChoixDto(choix) : null,
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Crée ou remplace le choix ACTIF (owner uniquement, utilise = 0).
 */
export async function setChoixReglement(
  input: SetChoixReglementInput
): Promise<
  NotesFraisChoixActionResult<{
    choix: ChoixReglementDto;
    replaced: boolean;
    noteVersion: number;
  }>
> {
  try {
    assertNotesFraisEnabled();
    const client = input.client ?? db;
    const key = String(input.idempotencyKey || "").trim();
    if (!key || key.length > 64) {
      throw new Error("Clé d'idempotence invalide");
    }

    const existing = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        version: true,
        adherentId: true,
        demandeurUserId: true,
        montantAccepte: true,
      },
    });
    if (!existing || existing.demandeurUserId !== input.actorUserId) {
      throw new Error("Note introuvable");
    }
    if (existing.statut !== "VALIDEE" || existing.montantAccepte == null) {
      throw new Error("Choix réservé aux notes validées");
    }

    const preview = validateChoixMontants({
      mode: input.mode,
      montantReference: existing.montantAccepte,
      montantRemboursement: input.montantRemboursement,
      montantCompensation: input.montantCompensation,
      cibles: input.cibles,
    });

    const byKey = await client.noteFraisChoixReglement.findUnique({
      where: { idempotencyKey: key },
      include: { Cibles: true },
    });
    if (byKey) {
      if (byKey.noteFraisId !== input.noteId) {
        throw new Error(NOTES_FRAIS_CHOIX_IDEMPOTENCY_CONFLICT);
      }
      const dto = toChoixDto(byKey);
      if (
        sameChoixContent(
          {
            mode: input.mode,
            montantReference: preview.montantReference,
            montantRemboursement: preview.montantRemboursement,
            montantCompensation: preview.montantCompensation,
            cibles: preview.cibles.map((c) => ({
              typeCible: c.typeCible,
              cibleId: c.cibleId,
              montantAutorise: c.montantAutoriseFixed,
              rang: c.rang,
            })),
          },
          {
            mode: dto.mode,
            montantReference: dto.montantReference,
            montantRemboursement: dto.montantRemboursement,
            montantCompensation: dto.montantCompensation,
            cibles: dto.Cibles.map((c) => ({
              typeCible: c.typeCible,
              cibleId: c.cibleId,
              montantAutorise: c.montantAutorise,
              rang: c.rang,
            })),
          }
        )
      ) {
        const note = await client.noteFrais.findUniqueOrThrow({
          where: { id: input.noteId },
          select: { version: true },
        });
        return {
          success: true,
          data: { choix: dto, replaced: false, noteVersion: note.version },
          message: "Choix déjà enregistré",
        };
      }
      throw new Error(NOTES_FRAIS_CHOIX_IDEMPOTENCY_CONFLICT);
    }

    const result = await client.$transaction(async (tx) => {
      if (input.beforeDemandeurLock) await input.beforeDemandeurLock();
      await lockUserRowForNotesFrais(tx, existing.demandeurUserId);
      if (input.afterDemandeurLock) await input.afterDemandeurLock();

      if (input.beforeNoteLock) await input.beforeNoteLock();
      await tx.$executeRaw`
        SELECT id FROM notes_frais WHERE id = ${input.noteId} FOR UPDATE
      `;
      if (input.afterNoteLock) await input.afterNoteLock();

      const current = await tx.noteFrais.findUnique({
        where: { id: input.noteId },
        select: {
          id: true,
          statut: true,
          version: true,
          adherentId: true,
          demandeurUserId: true,
          montantAccepte: true,
        },
      });
      if (!current || current.demandeurUserId !== input.actorUserId) {
        throw new Error("Note introuvable");
      }
      if (current.statut !== "VALIDEE" || current.montantAccepte == null) {
        throw new Error("Choix réservé aux notes validées");
      }
      if (current.version !== input.expectedNoteVersion) {
        throw new Error(NOTES_FRAIS_CHOIX_VERSION_CONFLICT);
      }

      const content = validateChoixMontants({
        mode: input.mode,
        montantReference: current.montantAccepte,
        montantRemboursement: input.montantRemboursement,
        montantCompensation: input.montantCompensation,
        cibles: input.cibles,
      });

      const existingByKey = await tx.noteFraisChoixReglement.findUnique({
        where: { idempotencyKey: key },
        include: { Cibles: true },
      });
      if (existingByKey) {
        const dto = toChoixDto(existingByKey);
        if (
          sameChoixContent(
            {
              mode: input.mode,
              montantReference: content.montantReference,
              montantRemboursement: content.montantRemboursement,
              montantCompensation: content.montantCompensation,
              cibles: content.cibles.map((c) => ({
                typeCible: c.typeCible,
                cibleId: c.cibleId,
                montantAutorise: c.montantAutoriseFixed,
                rang: c.rang,
              })),
            },
            {
              mode: dto.mode,
              montantReference: dto.montantReference,
              montantRemboursement: dto.montantRemboursement,
              montantCompensation: dto.montantCompensation,
              cibles: dto.Cibles.map((c) => ({
                typeCible: c.typeCible,
                cibleId: c.cibleId,
                montantAutorise: c.montantAutorise,
                rang: c.rang,
              })),
            }
          )
        ) {
          return {
            kind: "already" as const,
            choix: dto,
            noteVersion: current.version,
          };
        }
        throw new Error(NOTES_FRAIS_CHOIX_IDEMPOTENCY_CONFLICT);
      }

      const actifs = await tx.noteFraisChoixReglement.findMany({
        where: { noteFraisId: input.noteId, statut: "ACTIF" },
        include: { Cibles: true },
      });
      if (actifs.length > 1) {
        throw new Error("État incohérent : plusieurs choix ACTIF");
      }

      let remplaceChoixId: string | null = null;
      if (actifs.length === 1) {
        const actif = actifs[0];
        if (choixHasUtilisation(actif)) {
          throw new Error(NOTES_FRAIS_CHOIX_ALREADY_USED);
        }
        remplaceChoixId = actif.id;
        await tx.noteFraisChoixReglement.update({
          where: { id: actif.id },
          data: { statut: "REMPLACE" },
        });
      }

      const resolvedCibles: Array<{
        typeCible: TypeCibleChoix;
        cibleId: string;
        montantAutorise: Prisma.Decimal;
        montantRestantSnapshot: Prisma.Decimal;
        libelleSnapshot: string;
        rang: number;
      }> = [];

      for (const c of content.cibles) {
        const resolved = await resolveEligibleCible(
          tx,
          current.adherentId,
          c
        );
        resolvedCibles.push({
          typeCible: c.typeCible,
          cibleId: c.cibleId,
          montantAutorise: money(c.montantAutoriseFixed),
          montantRestantSnapshot: resolved.montantRestant,
          libelleSnapshot: resolved.libelle.slice(0, 120),
          rang: c.rang,
        });
      }

      const choisiAt = new Date();
      const created = await tx.noteFraisChoixReglement.create({
        data: {
          noteFraisId: input.noteId,
          mode: input.mode,
          statut: "ACTIF",
          montantReference: money(content.montantReference),
          montantRemboursement: money(content.montantRemboursement),
          montantCompensation: money(content.montantCompensation),
          montantRembourseUtilise: money(0),
          montantCompensationUtilise: money(0),
          remplaceChoixId,
          idempotencyKey: key,
          choisiAt,
          Cibles: {
            create: resolvedCibles.map((c) => ({
              typeCible: c.typeCible,
              cibleId: c.cibleId,
              montantAutorise: c.montantAutorise,
              montantUtilise: money(0),
              montantRestantSnapshot: c.montantRestantSnapshot,
              libelleSnapshot: c.libelleSnapshot,
              rang: c.rang,
            })),
          },
        },
        include: { Cibles: true },
      });

      // Contrôle transactionnel : un seul ACTIF
      const actifsApres = await tx.noteFraisChoixReglement.count({
        where: { noteFraisId: input.noteId, statut: "ACTIF" },
      });
      if (actifsApres !== 1) {
        throw new Error("État incohérent : plusieurs choix ACTIF");
      }

      const bumped = await tx.noteFrais.updateMany({
        where: {
          id: input.noteId,
          version: input.expectedNoteVersion,
          statut: "VALIDEE",
        },
        data: { version: { increment: 1 } },
      });
      if (bumped.count !== 1) {
        throw new Error(NOTES_FRAIS_CHOIX_VERSION_CONFLICT);
      }

      return {
        kind: "created" as const,
        choix: toChoixDto(created),
        replaced: remplaceChoixId != null,
        noteVersion: input.expectedNoteVersion + 1,
      };
    });

    if (result.kind === "already") {
      return {
        success: true,
        data: {
          choix: result.choix,
          replaced: false,
          noteVersion: result.noteVersion,
        },
        message: "Choix déjà enregistré",
      };
    }

    return {
      success: true,
      data: {
        choix: result.choix,
        replaced: result.replaced,
        noteVersion: result.noteVersion,
      },
      message: result.replaced ? "Choix remplacé" : "Choix enregistré",
    };
  } catch (error) {
    return mapError(error);
  }
}
