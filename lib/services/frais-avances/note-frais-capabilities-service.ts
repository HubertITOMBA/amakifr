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
  canUserRecordNoteFraisRestitution,
  canUserReadNoteFraisFinancialView,
  canUserReadNoteFraisRestitutionReference,
  canUserReadSubmittedNotesFrais,
  canUserRequestCancelNoteFraisReglement,
  canUserConfirmCancelNoteFraisReglement,
  canUserRefuseCancelNoteFraisReglement,
  canUserReadNoteFraisAnnulationAudit,
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
  canRecordRestitution: boolean;
  canReadRestitutionReference: boolean;
  canRequestCancel: boolean;
  canConfirmCancel: boolean;
  canRefuseCancel: boolean;
  canReadAnnulationAudit: boolean;
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
  /** Règlements REMBOURSEMENT restituables avec plafond serveur. */
  reglementsRestituables: Array<{
    id: string;
    operationId: string | null;
    resteRestituable: string;
  }>;
  /** Cibles annulables (XOR reglementId | operationId — MIXTE parent only). */
  ciblesAnnulables: Array<{
    reglementId?: string;
    operationId?: string;
    type: "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";
    label: string;
  }>;
  /** Demandes DEMANDEE en attente (countdown expiresAt). */
  demandesAnnulationPending: Array<{
    id: string;
    reglementId: string | null;
    operationId: string | null;
    expiresAt: string;
    cibleLabel: string;
    cibleTypes: Array<"REMBOURSEMENT" | "COMPENSATION" | "MIXTE">;
    /** True si l'acteur est l'auteur de la demande (ne peut pas confirmer). */
    isDemandeur: boolean;
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
    const canRecordRestitutionAuth = await canUserRecordNoteFraisRestitution(
      input.userId,
      client
    );
    const canReadRestitutionReference =
      await canUserReadNoteFraisRestitutionReference(input.userId, client);

    const canRequestCancelAuth =
      !isOwner &&
      (await canUserRequestCancelNoteFraisReglement(input.userId, client));
    const canConfirmCancelAuth =
      !isOwner &&
      (await canUserConfirmCancelNoteFraisReglement(input.userId, client));
    const canRefuseCancelAuth =
      !isOwner &&
      (await canUserRefuseCancelNoteFraisReglement(input.userId, client));
    const canReadAnnulationAudit =
      !isOwner &&
      (await canUserReadNoteFraisAnnulationAudit(input.userId, client));

    const reglementsCorrigeables: NoteFraisCapabilitiesDto["reglementsCorrigeables"] =
      [];
    const reglementsRestituables: NoteFraisCapabilitiesDto["reglementsRestituables"] =
      [];
    const ciblesAnnulables: NoteFraisCapabilitiesDto["ciblesAnnulables"] = [];
    const demandesAnnulationPending: NoteFraisCapabilitiesDto["demandesAnnulationPending"] =
      [];
    let canCorrectReference = false;
    let canCorrectMontant = false;
    let canRecordRestitution = false;
    let canRequestCancel = false;
    let canConfirmCancel = false;
    let canRefuseCancel = false;

    if (note.statut === "VALIDEE" && (canCorrectAuth || canRecordRestitutionAuth)) {
      const { computeReglementNetMontant } = await import(
        "@/lib/services/frais-avances/note-frais-correction-service"
      );
      const { computeResteRestituable } = await import(
        "@/lib/services/frais-avances/note-frais-restitution-service"
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
          Restitutions: { select: { montant: true } },
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
        const isRemb = r.type === "REMBOURSEMENT";
        let corrigible = net;
        if (isRemb) {
          const { resteRestituable, montantEncoreCorrigeable } = (() => {
            const calc = computeResteRestituable(
              r.montantTotal,
              r.Corrections.map((c) => c.montant),
              r.Restitutions.map((x) => x.montant)
            );
            return {
              resteRestituable: calc.resteRestituable,
              montantEncoreCorrigeable: calc.resteRestituable,
            };
          })();
          corrigible = montantEncoreCorrigeable;
          if (canRecordRestitutionAuth && resteRestituable.gt(0)) {
            canRecordRestitution = true;
            reglementsRestituables.push({
              id: r.id,
              operationId: r.operationId,
              resteRestituable: resteRestituable.toFixed(2),
            });
          }
        }
        if (canCorrectAuth) {
          const netStr = corrigible.toFixed(2);
          const canRef = isRemb;
          const canMont = corrigible.gt(0);
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
                (acc, inv) =>
                  acc.plus(new Prisma.Decimal(inv.montantRestaure)),
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
    }

    if (
      note.statut === "VALIDEE" &&
      (canRequestCancelAuth || canConfirmCancelAuth || canRefuseCancelAuth)
    ) {
      const { listPendingAnnulationDemandesForNote } = await import(
        "@/lib/services/frais-avances/note-frais-annulation-service"
      );
      const pending = await listPendingAnnulationDemandesForNote({
        noteId: note.id,
        client,
      });
      for (const p of pending) {
        const isDemandeur = p.demandeurUserId === input.userId;
        demandesAnnulationPending.push({
          id: p.id,
          reglementId: p.reglementId,
          operationId: p.operationId,
          expiresAt: p.expiresAt,
          cibleLabel: p.cibleLabel,
          cibleTypes: p.cibleTypes,
          isDemandeur,
        });
        if (!isDemandeur) {
          if (canConfirmCancelAuth) canConfirmCancel = true;
          if (canRefuseCancelAuth) canRefuseCancel = true;
        }
      }

      if (canRequestCancelAuth) {
        const pendingTargetKeys = new Set(
          pending.map((p) =>
            p.operationId ? `op:${p.operationId}` : `reg:${p.reglementId}`
          )
        );

        const simpleRegs = await client.noteFraisReglement.findMany({
          where: {
            noteFraisId: note.id,
            statut: "EXECUTE",
            operationId: null,
            type: { in: ["REMBOURSEMENT", "COMPENSATION"] },
          },
          select: {
            id: true,
            type: true,
            montantTotal: true,
            _count: {
              select: { Corrections: true, Restitutions: true },
            },
          },
        });
        for (const r of simpleRegs) {
          if (r._count.Corrections > 0 || r._count.Restitutions > 0) continue;
          if (pendingTargetKeys.has(`reg:${r.id}`)) continue;
          canRequestCancel = true;
          ciblesAnnulables.push({
            reglementId: r.id,
            type: r.type as "REMBOURSEMENT" | "COMPENSATION",
            label: `${r.type} · ${r.montantTotal.toFixed(2)} €`,
          });
        }

        const ops = await client.noteFraisReglementOperation.findMany({
          where: {
            noteFraisId: note.id,
            type: "MIXTE",
            statut: "EXECUTE",
          },
          select: {
            id: true,
            Reglements: {
              select: {
                id: true,
                type: true,
                montantTotal: true,
                _count: {
                  select: { Corrections: true, Restitutions: true },
                },
              },
            },
          },
        });
        for (const op of ops) {
          if (op.Reglements.length !== 2) continue;
          if (
            op.Reglements.some(
              (r) => r._count.Corrections > 0 || r._count.Restitutions > 0
            )
          ) {
            continue;
          }
          if (pendingTargetKeys.has(`op:${op.id}`)) continue;
          canRequestCancel = true;
          ciblesAnnulables.push({
            operationId: op.id,
            type: "MIXTE",
            label: "Opération MIXTE",
          });
        }
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
        canRecordRestitution,
        canReadRestitutionReference,
        canRequestCancel,
        canConfirmCancel,
        canRefuseCancel,
        canReadAnnulationAudit,
        plafondRemboursementRestant: plafondRemb,
        plafondCompensationRestant: plafondComp,
        modeChoix: mode,
        statut: note.statut,
        reglementsCorrigeables,
        reglementsRestituables,
        ciblesAnnulables,
        demandesAnnulationPending,
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
