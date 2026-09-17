/**
 * Capacités UI notes de frais — calcul serveur uniquement.
 */
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import {
  canUserDecideNoteFrais,
  canUserExecuteNoteFraisCompensation,
  canUserExecuteNoteFraisRemboursement,
  canUserExecuteNoteFraisReglementMixte,
  canUserCorrectNoteFraisReglement,
  canUserReadNoteFraisFinancialView,
  canUserReadSubmittedNotesFrais,
} from "@/lib/frais-avances/authz";
import {
  moneyIsStrictlyPositive,
  moneyRestantNonNegatif,
} from "@/lib/frais-avances/money-cents";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import { Prisma } from "@prisma/client";

export type NoteFraisCapabilitiesDto = {
  noteId: string;
  isOwner: boolean;
  canReadLive: boolean;
  canReadFinancial: boolean;
  canDecide: boolean;
  canExecuteCompensation: boolean;
  canExecuteRemboursement: boolean;
  canExecuteMixte: boolean;
  canCorrectReference: boolean;
  canCorrectMontant: boolean;
  /** Plafonds restants (chaînes) si choix ACTIF. */
  plafondRemboursementRestant: string | null;
  plafondCompensationRestant: string | null;
  modeChoix: string | null;
  statut: string;
  /** Règlements corrigeables (id + type + net restant). */
  reglementsCorrigeables: Array<{
    id: string;
    type: "REMBOURSEMENT" | "COMPENSATION";
    netRestant: string;
    canCorrectReference: boolean;
    canCorrectMontant: boolean;
    lignesCompensation?: Array<{
      id: string;
      rang: number;
      typeCible: string;
      cibleId: string;
      montant: string;
      montantRestaurable: string;
    }>;
  }>;
};

export type NotesFraisCapabilitiesResult =
  | { success: true; data: NoteFraisCapabilitiesDto }
  | { success: false; error: string; code?: string };

/**
 * Calcule les capacités d'action UI pour une note et un acteur.
 *
 * @param input.userId - Acteur authentifié
 * @param input.noteId - Note cible
 */
export async function getNoteFraisCapabilities(input: {
  userId: string;
  noteId: string;
  client?: typeof db;
}): Promise<NotesFraisCapabilitiesResult> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();

    const note = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        demandeurUserId: true,
        ChoixReglements: {
          where: { statut: "ACTIF" },
          take: 1,
          select: {
            mode: true,
            montantRemboursement: true,
            montantCompensation: true,
            montantRembourseUtilise: true,
            montantCompensationUtilise: true,
          },
        },
      },
    });
    if (!note) {
      return { success: false, error: "Note introuvable", code: "NOT_FOUND" };
    }

    const isOwner = note.demandeurUserId === input.userId;
    const canReadLive =
      isOwner || (await canUserReadSubmittedNotesFrais(input.userId, client));
    const canReadFinancial = await canUserReadNoteFraisFinancialView(
      input.userId,
      client
    );
    const canDecide =
      note.statut === "SOUMISE" &&
      (await canUserDecideNoteFrais(input.userId, client));

    const choix = note.ChoixReglements[0] ?? null;
    let plafondRemb: string | null = null;
    let plafondComp: string | null = null;
    if (choix) {
      try {
        plafondRemb = moneyRestantNonNegatif(
          normalizeNotesFraisMontant(choix.montantRemboursement) ?? "0",
          normalizeNotesFraisMontant(choix.montantRembourseUtilise) ?? "0"
        );
        plafondComp = moneyRestantNonNegatif(
          normalizeNotesFraisMontant(choix.montantCompensation) ?? "0",
          normalizeNotesFraisMontant(choix.montantCompensationUtilise) ?? "0"
        );
      } catch {
        plafondRemb = "0.00";
        plafondComp = "0.00";
      }
    }

    const valideeAvecChoix = note.statut === "VALIDEE" && choix != null;
    const mode = choix?.mode ?? null;

    const canExecuteRemboursement =
      valideeAvecChoix &&
      (mode === "REMBOURSEMENT" || mode === "MIXTE") &&
      moneyIsStrictlyPositive(plafondRemb ?? "0") &&
      (await canUserExecuteNoteFraisRemboursement(input.userId, client));

    const canExecuteCompensation =
      valideeAvecChoix &&
      (mode === "COMPENSATION" || mode === "MIXTE") &&
      moneyIsStrictlyPositive(plafondComp ?? "0") &&
      (await canUserExecuteNoteFraisCompensation(input.userId, client));

    const canExecuteMixte =
      valideeAvecChoix &&
      mode === "MIXTE" &&
      moneyIsStrictlyPositive(plafondRemb ?? "0") &&
      moneyIsStrictlyPositive(plafondComp ?? "0") &&
      (await canUserExecuteNoteFraisReglementMixte(input.userId, client));

    const canCorrectAuth = await canUserCorrectNoteFraisReglement(
      input.userId,
      client
    );

    const reglementsCorrigeables: NoteFraisCapabilitiesDto["reglementsCorrigeables"] =
      [];
    let canCorrectReference = false;
    let canCorrectMontant = false;

    if (note.statut === "VALIDEE" && canCorrectAuth) {
      const { computeReglementNetMontant } = await import(
        "@/lib/services/frais-avances/note-frais-correction-service"
      );
      const regs = await client.noteFraisReglement.findMany({
        where: {
          noteFraisId: note.id,
          statut: "EXECUTE",
          type: { in: ["REMBOURSEMENT", "COMPENSATION"] },
        },
        include: {
          Corrections: {
            where: { type: "MONTANT_NEGATIF" },
            select: { montant: true },
          },
          Lignes: {
            where: { typeLigne: "COMPENSATION" },
            orderBy: { rang: "asc" },
            include: {
              InversesCorrection: { select: { montantRestaure: true } },
            },
          },
        },
      });
      for (const r of regs) {
        const net = computeReglementNetMontant(
          r.montantTotal,
          r.Corrections.map((c) => c.montant)
        );
        const netStr = net.toFixed(2);
        const isRemb = r.type === "REMBOURSEMENT";
        const canRef = isRemb;
        const canMont = net.gt(0);
        if (canRef) canCorrectReference = true;
        if (canMont) canCorrectMontant = true;
        const entry: NoteFraisCapabilitiesDto["reglementsCorrigeables"][number] =
          {
            id: r.id,
            type: r.type as "REMBOURSEMENT" | "COMPENSATION",
            netRestant: netStr,
            canCorrectReference: canRef,
            canCorrectMontant: canMont,
          };
        if (r.type === "COMPENSATION") {
          entry.lignesCompensation = r.Lignes.map((l) => {
            const prior = l.InversesCorrection.reduce(
              (acc, inv) => acc.plus(new Prisma.Decimal(inv.montantRestaure)),
              new Prisma.Decimal(0)
            );
            const resto = new Prisma.Decimal(l.montant).minus(prior);
            return {
              id: l.id,
              rang: l.rang,
              typeCible: l.typeCible ?? "",
              cibleId: l.cibleId ?? "",
              montant: l.montant.toFixed(2),
              montantRestaurable: resto.gt(0) ? resto.toFixed(2) : "0.00",
            };
          });
        }
        reglementsCorrigeables.push(entry);
      }
    }

    return {
      success: true,
      data: {
        noteId: note.id,
        isOwner,
        canReadLive,
        canReadFinancial,
        canDecide,
        canExecuteCompensation,
        canExecuteRemboursement,
        canExecuteMixte,
        canCorrectReference,
        canCorrectMontant,
        plafondRemboursementRestant: plafondRemb,
        plafondCompensationRestant: plafondComp,
        modeChoix: mode,
        statut: note.statut,
        reglementsCorrigeables,
      },
    };
  } catch (error) {
    if (error instanceof NotesFraisDisabledError) {
      return {
        success: false,
        error: error.message,
        code: "NOTES_FRAIS_DISABLED",
      };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erreur inattendue" };
  }
}

/**
 * Capacités de navigation globales (sans note).
 */
export async function getNotesFraisNavCapabilities(input: {
  userId: string;
  client?: typeof db;
}): Promise<{
  success: true;
  data: {
    canReadLive: boolean;
    canReadFinancial: boolean;
    canAccessMemberArea: boolean;
  };
}> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
  } catch {
    return {
      success: true,
      data: {
        canReadLive: false,
        canReadFinancial: false,
        canAccessMemberArea: false,
      },
    };
  }
  const [canReadLive, canReadFinancial] = await Promise.all([
    canUserReadSubmittedNotesFrais(input.userId, client),
    canUserReadNoteFraisFinancialView(input.userId, client),
  ]);
  return {
    success: true,
    data: {
      canReadLive,
      canReadFinancial,
      canAccessMemberArea: true,
    },
  };
}
