import { Prisma, MoyenPaiement } from "@prisma/client";
import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { authorize } from "@/lib/authorize";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import {
  appliquerAvoirs,
  createAvoirFromPaymentSurplus,
} from "@/lib/services/paiements/avoir-allocation";

export type PayableTargetType =
  | "cotisation-mensuelle"
  | "dette-initiale"
  | "assistance"
  | "obligation";

export type DeclaredPaymentDto = {
  id: string;
  montant: string;
  moyenPaiement: string;
  reference: string;
  statut: string;
  targetType: PayableTargetType;
  targetId: string;
  message: string;
};

const DeclareSchema = z.object({
  targetType: z.enum([
    "cotisation-mensuelle",
    "dette-initiale",
    "assistance",
    "obligation",
  ]),
  targetId: z.string().min(1),
  amount: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide")
    .transform((s) => s.replace(",", ".")),
  paymentMethod: z.enum(["Virement", "Wero"]),
  justificatifChemin: z.string().trim().min(1, "Justificatif obligatoire"),
});

type DbClient = Prisma.TransactionClient | typeof db;

async function resolveSelfAdherentId(actor: AuthContext): Promise<string> {
  if (!actor?.userId?.trim()) {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }
  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
  }
  return adherent.id;
}

/**
 * Génère une référence de paiement non sensible (AMAKI-YYYY-TYPE-XXXX).
 */
export function buildPaymentReference(
  targetType: PayableTargetType,
  year: number = new Date().getFullYear()
): string {
  const typeCode =
    targetType === "cotisation-mensuelle"
      ? "COT"
      : targetType === "dette-initiale"
        ? "DET"
        : targetType === "assistance"
          ? "ASS"
          : "OBL";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `AMAKI-${year}-${typeCode}-${rand}${ts}`;
}

type OwnedTarget = {
  adherentId: string;
  montantRestant: Prisma.Decimal;
  statut?: string;
};

/**
 * Filtre Prisma pour un paiement EnAttente sur une cible donnée.
 */
export function pendingPaymentWhere(
  adherentId: string,
  targetType: PayableTargetType,
  targetId: string
): Prisma.PaiementCotisationWhereInput {
  const base: Prisma.PaiementCotisationWhereInput = {
    adherentId,
    statut: "EnAttente",
  };
  if (targetType === "cotisation-mensuelle") {
    return { ...base, cotisationMensuelleId: targetId };
  }
  if (targetType === "dette-initiale") {
    return { ...base, detteInitialeId: targetId };
  }
  if (targetType === "assistance") {
    return { ...base, assistanceId: targetId };
  }
  return { ...base, obligationCotisationId: targetId };
}

function pendingAlreadyMessage(targetType: PayableTargetType): string {
  if (targetType === "cotisation-mensuelle") {
    return "Un paiement est déjà en attente de validation pour cette cotisation.";
  }
  return "Un paiement est déjà en attente de validation pour cette échéance.";
}

/**
 * Charge la cible et vérifie ownership strict (id + adherentId).
 */
async function loadOwnedTarget(
  client: DbClient,
  adherentId: string,
  targetType: PayableTargetType,
  targetId: string
): Promise<OwnedTarget> {
  if (targetType === "cotisation-mensuelle") {
    const row = await client.cotisationMensuelle.findFirst({
      where: { id: targetId, adherentId },
      select: { adherentId: true, montantRestant: true, statut: true },
    });
    if (!row) throw new ServiceError("NOT_FOUND", "Cotisation introuvable");
    return row;
  }
  if (targetType === "dette-initiale") {
    const row = await client.detteInitiale.findFirst({
      where: { id: targetId, adherentId },
      select: { adherentId: true, montantRestant: true },
    });
    if (!row) throw new ServiceError("NOT_FOUND", "Dette introuvable");
    return row;
  }
  if (targetType === "assistance") {
    const row = await client.assistance.findFirst({
      where: { id: targetId, adherentId },
      select: { adherentId: true, montantRestant: true, statut: true },
    });
    if (!row) throw new ServiceError("NOT_FOUND", "Assistance introuvable");
    return row;
  }
  const row = await client.obligationCotisation.findFirst({
    where: { id: targetId, adherentId },
    select: { adherentId: true, montantRestant: true, statut: true },
  });
  if (!row) throw new ServiceError("NOT_FOUND", "Obligation introuvable");
  return row;
}

/**
 * Déclare un paiement Wero/Virement en EnAttente — SANS crédit immédiat.
 * Justificatif obligatoire. Montant revalidé serveur.
 * Un seul EnAttente par (adhérent, cible) — protection concurrence via
 * transaction Serializable (pas de migration).
 */
export async function declareBankOrWeroPayment(
  actor: AuthContext,
  raw: unknown
): Promise<DeclaredPaymentDto> {
  const adherentId = await resolveSelfAdherentId(actor);

  const parsed = DeclareSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Données invalides"
    );
  }
  const data = parsed.data;

  // Compte actif requis (hors transaction — lecture stable)
  const account = await db.comptePaiementAssociation.findFirst({
    where: { actifPourPaiement: true },
  });
  if (!account) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Aucun compte de paiement configuré"
    );
  }
  if (data.paymentMethod === "Wero") {
    if (!account.weroActif || !account.telephoneWero) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Wero n'est pas disponible actuellement"
      );
    }
  }

  const reference = buildPaymentReference(data.targetType);
  const moyen: MoyenPaiement =
    data.paymentMethod === "Wero" ? MoyenPaiement.Wero : MoyenPaiement.Virement;

  try {
    const paiement = await db.$transaction(
      async (tx) => {
        const existingPending = await tx.paiementCotisation.findFirst({
          where: pendingPaymentWhere(
            adherentId,
            data.targetType,
            data.targetId
          ),
          select: { id: true },
        });
        if (existingPending) {
          throw new ServiceError(
            "PAYMENT_ALREADY_PENDING",
            pendingAlreadyMessage(data.targetType)
          );
        }

        const target = await loadOwnedTarget(
          tx,
          adherentId,
          data.targetType,
          data.targetId
        );

        const amount = new Prisma.Decimal(data.amount);
        if (amount.lte(0)) {
          throw new ServiceError("VALIDATION_ERROR", "Montant invalide");
        }
        // Surpaiement autorisé : l'excédent est ventilé à la validation admin
        // (cible plafonnée → dettes → avoir). Le montant déclaré est conservé tel quel.
        if (target.montantRestant.lte(0) || target.statut === "Paye") {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "Cette ligne est déjà soldée"
          );
        }

        return tx.paiementCotisation.create({
          data: {
            adherentId,
            montant: amount,
            moyenPaiement: moyen,
            reference,
            description: `Déclaration ${data.paymentMethod} — en attente de validation`,
            statut: "EnAttente",
            justificatifChemin: data.justificatifChemin,
            createdBy: actor.userId,
            cotisationMensuelleId:
              data.targetType === "cotisation-mensuelle"
                ? data.targetId
                : null,
            detteInitialeId:
              data.targetType === "dette-initiale" ? data.targetId : null,
            assistanceId:
              data.targetType === "assistance" ? data.targetId : null,
            obligationCotisationId:
              data.targetType === "obligation" ? data.targetId : null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return {
      id: paiement.id,
      montant: decimalToMoneyString(paiement.montant),
      moyenPaiement: paiement.moyenPaiement,
      reference: paiement.reference ?? reference,
      statut: paiement.statut,
      targetType: data.targetType,
      targetId: data.targetId,
      message:
        "Votre paiement a été enregistré et sera vérifié par l'association.",
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    // Conflit d'écriture Serializable (double POST concurrent) → même règle métier
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new ServiceError(
        "PAYMENT_ALREADY_PENDING",
        pendingAlreadyMessage(data.targetType)
      );
    }
    console.error("[declareBankOrWeroPayment]", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la déclaration du paiement"
    );
  }
}

/**
 * Applique le crédit comptable d'un paiement Valide (transaction interne).
 * Miroir createPaiement : plafond sur la cible, excédent → autres dettes → Avoir.
 */
export async function applyValidatedPaymentCredit(
  tx: Prisma.TransactionClient,
  paiement: {
    id: string;
    adherentId: string;
    montant: Prisma.Decimal;
    cotisationMensuelleId: string | null;
    detteInitialeId: string | null;
    assistanceId: string | null;
    obligationCotisationId: string | null;
  }
): Promise<{ creditedToTarget: string; surplus: string }> {
  const amount = new Prisma.Decimal(paiement.montant);
  let credited = new Prisma.Decimal(0);

  if (paiement.cotisationMensuelleId) {
    const cot = await tx.cotisationMensuelle.findFirst({
      where: {
        id: paiement.cotisationMensuelleId,
        adherentId: paiement.adherentId,
      },
    });
    if (!cot) throw new ServiceError("NOT_FOUND", "Cotisation introuvable");

    const restantApresAvoirs = await appliquerAvoirs(
      paiement.adherentId,
      new Prisma.Decimal(cot.montantRestant),
      "cotisationMensuelle",
      cot.id,
      tx
    );
    const room = new Prisma.Decimal(cot.montantAttendu).minus(cot.montantPaye);
    const maxCredit = room.gt(0) ? room : new Prisma.Decimal(0);
    credited = Prisma.Decimal.min(amount, restantApresAvoirs, maxCredit);

    if (credited.gt(0)) {
      const paye = new Prisma.Decimal(cot.montantPaye).plus(credited);
      const restantRaw = restantApresAvoirs.minus(credited);
      const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
      const statut = restant.lte(0)
        ? "Paye"
        : paye.gt(0)
          ? "PartiellementPaye"
          : "EnAttente";
      await tx.cotisationMensuelle.update({
        where: { id: cot.id },
        data: { montantPaye: paye, montantRestant: restant, statut },
      });
    }
  } else if (paiement.detteInitialeId) {
    const dette = await tx.detteInitiale.findFirst({
      where: { id: paiement.detteInitialeId, adherentId: paiement.adherentId },
    });
    if (!dette) throw new ServiceError("NOT_FOUND", "Dette introuvable");

    const restantApresAvoirs = await appliquerAvoirs(
      paiement.adherentId,
      new Prisma.Decimal(dette.montantRestant),
      "detteInitiale",
      dette.id,
      tx
    );
    credited = Prisma.Decimal.min(amount, restantApresAvoirs);

    if (credited.gt(0)) {
      const paye = new Prisma.Decimal(dette.montantPaye).plus(credited);
      await tx.detteInitiale.update({
        where: { id: dette.id },
        data: { montantPaye: paye },
      });
    }
  } else if (paiement.assistanceId) {
    const ass = await tx.assistance.findFirst({
      where: { id: paiement.assistanceId, adherentId: paiement.adherentId },
    });
    if (!ass) throw new ServiceError("NOT_FOUND", "Assistance introuvable");

    const restantApresAvoirs = await appliquerAvoirs(
      paiement.adherentId,
      new Prisma.Decimal(ass.montantRestant),
      "assistance",
      ass.id,
      tx
    );
    credited = Prisma.Decimal.min(amount, restantApresAvoirs);

    if (credited.gt(0)) {
      const paye = new Prisma.Decimal(ass.montantPaye).plus(credited);
      const restantRaw = restantApresAvoirs.minus(credited);
      const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
      const statut = restant.lte(0) ? "Paye" : "EnAttente";
      await tx.assistance.update({
        where: { id: ass.id },
        data: { montantPaye: paye, montantRestant: restant, statut },
      });
    }
  } else if (paiement.obligationCotisationId) {
    const obl = await tx.obligationCotisation.findFirst({
      where: {
        id: paiement.obligationCotisationId,
        adherentId: paiement.adherentId,
      },
    });
    if (!obl) throw new ServiceError("NOT_FOUND", "Obligation introuvable");

    const restantApresAvoirs = await appliquerAvoirs(
      paiement.adherentId,
      new Prisma.Decimal(obl.montantRestant),
      "obligationCotisation",
      obl.id,
      tx
    );
    credited = Prisma.Decimal.min(amount, restantApresAvoirs);

    if (credited.gt(0)) {
      const paye = new Prisma.Decimal(obl.montantPaye).plus(credited);
      const restantRaw = restantApresAvoirs.minus(credited);
      const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
      const statut = restant.lte(0)
        ? "Paye"
        : paye.gt(0)
          ? "PartiellementPaye"
          : "EnAttente";
      await tx.obligationCotisation.update({
        where: { id: obl.id },
        data: { montantPaye: paye, montantRestant: restant, statut },
      });
    }
  } else {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Paiement sans cible comptable"
    );
  }

  const surplus = amount.minus(credited);
  if (surplus.gt(0)) {
    await createAvoirFromPaymentSurplus(tx, {
      adherentId: paiement.adherentId,
      paiementId: paiement.id,
      montant: surplus,
      exclude: {
        cotisationMensuelleId: paiement.cotisationMensuelleId,
        detteInitialeId: paiement.detteInitialeId,
        assistanceId: paiement.assistanceId,
      },
    });
  }

  return {
    creditedToTarget: credited.toString(),
    surplus: surplus.toString(),
  };
}

/**
 * Débite une cible du montant crédité précédemment (correction admin).
 */
async function debitTargetByAmount(
  tx: Prisma.TransactionClient,
  params: {
    montant: Prisma.Decimal;
    cotisationMensuelleId: string | null;
    detteInitialeId: string | null;
    assistanceId: string | null;
    obligationCotisationId: string | null;
  }
): Promise<void> {
  const amount = new Prisma.Decimal(params.montant);
  if (amount.lte(0)) return;

  if (params.cotisationMensuelleId) {
    const cot = await tx.cotisationMensuelle.findFirst({
      where: { id: params.cotisationMensuelleId },
    });
    if (!cot) return;
    const payeRaw = new Prisma.Decimal(cot.montantPaye).minus(amount);
    const paye = payeRaw.gt(0) ? payeRaw : new Prisma.Decimal(0);
    const restantRaw = new Prisma.Decimal(cot.montantAttendu).minus(paye);
    const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
    const statut = restant.lte(0)
      ? "Paye"
      : paye.gt(0)
        ? "PartiellementPaye"
        : "EnAttente";
    await tx.cotisationMensuelle.update({
      where: { id: cot.id },
      data: { montantPaye: paye, montantRestant: restant, statut },
    });
    return;
  }

  if (params.detteInitialeId) {
    const dette = await tx.detteInitiale.findFirst({
      where: { id: params.detteInitialeId },
    });
    if (!dette) return;
    const payeRaw = new Prisma.Decimal(dette.montantPaye).minus(amount);
    const paye = payeRaw.gt(0) ? payeRaw : new Prisma.Decimal(0);
    await tx.detteInitiale.update({
      where: { id: dette.id },
      data: { montantPaye: paye },
    });
    return;
  }

  if (params.assistanceId) {
    const ass = await tx.assistance.findFirst({
      where: { id: params.assistanceId },
    });
    if (!ass) return;
    const payeRaw = new Prisma.Decimal(ass.montantPaye).minus(amount);
    const paye = payeRaw.gt(0) ? payeRaw : new Prisma.Decimal(0);
    const restantRaw = new Prisma.Decimal(ass.montant).minus(paye);
    const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
    const statut = restant.lte(0) ? "Paye" : "EnAttente";
    await tx.assistance.update({
      where: { id: ass.id },
      data: { montantPaye: paye, montantRestant: restant, statut },
    });
    return;
  }

  if (params.obligationCotisationId) {
    const obl = await tx.obligationCotisation.findFirst({
      where: { id: params.obligationCotisationId },
    });
    if (!obl) return;
    const payeRaw = new Prisma.Decimal(obl.montantPaye).minus(amount);
    const paye = payeRaw.gt(0) ? payeRaw : new Prisma.Decimal(0);
    const restantRaw = new Prisma.Decimal(obl.montant).minus(paye);
    const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
    const statut = restant.lte(0)
      ? "Paye"
      : paye.gt(0)
        ? "PartiellementPaye"
        : "EnAttente";
    await tx.obligationCotisation.update({
      where: { id: obl.id },
      data: { montantPaye: paye, montantRestant: restant, statut },
    });
  }
}

/**
 * Annule l'avoir créé par un paiement (excédent) et reverse ses utilisations.
 *
 * @returns Montant initial de l'avoir (surplus), ou 0 s'il n'y en avait pas
 */
export async function reverseAvoirFromPayment(
  tx: Prisma.TransactionClient,
  paiementId: string
): Promise<Prisma.Decimal> {
  const avoir = await tx.avoir.findUnique({
    where: { paiementId },
    include: { Utilisations: true },
  });
  if (!avoir) return new Prisma.Decimal(0);

  for (const u of avoir.Utilisations) {
    await debitTargetByAmount(tx, {
      montant: new Prisma.Decimal(u.montant),
      cotisationMensuelleId: u.cotisationMensuelleId,
      detteInitialeId: u.detteInitialeId,
      assistanceId: u.assistanceId,
      obligationCotisationId: u.obligationCotisationId,
    });
  }

  await tx.utilisationAvoir.deleteMany({ where: { avoirId: avoir.id } });
  await tx.avoir.delete({ where: { id: avoir.id } });
  return new Prisma.Decimal(avoir.montant);
}

/**
 * Inverse le crédit d'un paiement Valide (cible + avoir d'excédent).
 */
export async function reverseValidatedPaymentCredit(
  tx: Prisma.TransactionClient,
  paiement: {
    id: string;
    montant: Prisma.Decimal;
    cotisationMensuelleId: string | null;
    detteInitialeId: string | null;
    assistanceId: string | null;
    obligationCotisationId: string | null;
  }
): Promise<{ creditedToTarget: string; surplus: string }> {
  const surplus = await reverseAvoirFromPayment(tx, paiement.id);
  const creditedRaw = new Prisma.Decimal(paiement.montant).minus(surplus);
  const credited = creditedRaw.gt(0) ? creditedRaw : new Prisma.Decimal(0);
  if (credited.gt(0)) {
    await debitTargetByAmount(tx, {
      montant: credited,
      cotisationMensuelleId: paiement.cotisationMensuelleId,
      detteInitialeId: paiement.detteInitialeId,
      assistanceId: paiement.assistanceId,
      obligationCotisationId: paiement.obligationCotisationId,
    });
  }
  return {
    creditedToTarget: credited.toString(),
    surplus: surplus.toString(),
  };
}

const MOIS_COURTS: Record<number, string> = {
  1: "janvier",
  2: "février",
  3: "mars",
  4: "avril",
  5: "mai",
  6: "juin",
  7: "juillet",
  8: "août",
  9: "septembre",
  10: "octobre",
  11: "novembre",
  12: "décembre",
};

/**
 * Libellé du moyen de paiement pour les notifications adhérent.
 */
export function formatMoyenPaiementLabel(moyen: string): string {
  switch (moyen) {
    case "Especes":
      return "espèces";
    case "Cheque":
      return "chèque";
    case "Virement":
      return "virement bancaire";
    case "CarteBancaire":
      return "carte bancaire";
    case "Wero":
      return "Wero";
    default:
      return moyen;
  }
}

type PaiementNotifyRelations = {
  montant: Prisma.Decimal;
  moyenPaiement: string;
  reference: string | null;
  Adherent: { userId: string } | null;
  CotisationMensuelle: {
    mois: number;
    annee: number;
    TypeCotisation: { nom: string } | null;
  } | null;
  DetteInitiale: { annee: number } | null;
  Assistance: { type: string } | null;
  ObligationCotisation: { periode: string } | null;
};

/**
 * Libellé de la cible comptable (cotisation, dette, etc.).
 */
export function formatPaymentTargetLabel(
  paiement: PaiementNotifyRelations
): string {
  if (paiement.CotisationMensuelle) {
    const cm = paiement.CotisationMensuelle;
    const typeNom = cm.TypeCotisation?.nom?.trim();
    const periode = `${MOIS_COURTS[cm.mois] ?? cm.mois} ${cm.annee}`;
    return typeNom ? `${typeNom} (${periode})` : `cotisation de ${periode}`;
  }
  if (paiement.DetteInitiale) {
    return `dette initiale ${paiement.DetteInitiale.annee}`;
  }
  if (paiement.Assistance) {
    return "assistance";
  }
  if (paiement.ObligationCotisation) {
    const periode = paiement.ObligationCotisation.periode?.trim();
    return periode
      ? `obligation de cotisation (${periode})`
      : "obligation de cotisation";
  }
  return "votre échéance";
}

const paiementNotifyInclude = {
  Adherent: { select: { userId: true } },
  CotisationMensuelle: {
    select: {
      mois: true,
      annee: true,
      TypeCotisation: { select: { nom: true } },
    },
  },
  DetteInitiale: { select: { annee: true } },
  Assistance: { select: { type: true } },
  ObligationCotisation: { select: { periode: true } },
} as const;

/**
 * Notifie l'adhérent du résultat d'une validation / d'un rejet de paiement.
 * Best-effort : une erreur de notification ne fait pas échouer l'opération métier.
 */
export async function notifyAdherentPaymentDecision(params: {
  paiement: PaiementNotifyRelations;
  decision: "valide" | "rejete";
}): Promise<void> {
  try {
    const userId = params.paiement.Adherent?.userId?.trim();
    if (!userId) return;

    const montant = Number(params.paiement.montant)
      .toFixed(2)
      .replace(".", ",");
    const moyen = formatMoyenPaiementLabel(params.paiement.moyenPaiement);
    const cible = formatPaymentTargetLabel(params.paiement);
    const ref = params.paiement.reference?.trim();

    if (params.decision === "valide") {
      await db.notification.create({
        data: {
          userId,
          type: "Cotisation",
          titre: "Paiement validé",
          message: [
            `Votre paiement par ${moyen} de ${montant} € concernant ${cible} a été validé par l'administration.`,
            "Le montant a été crédité sur votre situation.",
            ref ? `Référence : ${ref}.` : null,
          ]
            .filter(Boolean)
            .join(" "),
          lien: "/paiement",
          lue: false,
        },
      });
      return;
    }

    await db.notification.create({
      data: {
        userId,
        type: "Cotisation",
        titre: "Paiement rejeté",
        message: [
          `Votre paiement par ${moyen} de ${montant} € concernant ${cible} a été rejeté par l'administration.`,
          "Aucun montant n'a été crédité.",
          ref ? `Référence : ${ref}.` : null,
          "Pour toute question, contactez le bureau.",
        ]
          .filter(Boolean)
          .join(" "),
        lien: "/paiement",
        lue: false,
      },
    });
  } catch (error) {
    console.error(
      "[notifyAdherentPaymentDecision] Échec d'envoi de la notification:",
      error
    );
  }
}

/**
 * Valide un paiement EnAttente ou Annule → Valide + crédit (ventilation excédent).
 * Notifie l'adhérent (moyen de paiement + objet).
 */
export async function validatePendingPayment(
  actor: AuthContext,
  paiementId: string
): Promise<{ id: string; statut: string; creditedToTarget?: string; surplus?: string }> {
  await authorize({
    actor,
    permissionKey: "createPaiement",
    type: "WRITE",
  });

  const result = await db.$transaction(async (tx) => {
    const paiement = await tx.paiementCotisation.findUnique({
      where: { id: paiementId },
      include: paiementNotifyInclude,
    });
    if (!paiement) {
      throw new ServiceError("NOT_FOUND", "Paiement introuvable");
    }
    if (paiement.statut !== "EnAttente" && paiement.statut !== "Annule") {
      throw new ServiceError(
        "CONFLICT",
        "Ce paiement ne peut pas être validé (statut actuel incompatible)"
      );
    }

    const previousStatut = paiement.statut;
    const claimed = await tx.paiementCotisation.updateMany({
      where: {
        id: paiementId,
        statut: { in: ["EnAttente", "Annule"] },
      },
      data: {
        statut: "Valide",
        description:
          (paiement.description ?? "") +
          (paiement.description ? " | " : "") +
          (previousStatut === "Annule"
            ? "Revalidé par l'administration"
            : "Validé par l'administration"),
      },
    });
    if (claimed.count !== 1) {
      throw new ServiceError(
        "CONFLICT",
        "Ce paiement ne peut pas être validé (statut actuel incompatible)"
      );
    }

    const allocation = await applyValidatedPaymentCredit(tx, paiement);

    return {
      id: paiement.id,
      statut: "Valide" as const,
      creditedToTarget: allocation.creditedToTarget,
      surplus: allocation.surplus,
      paiement,
      previousStatut,
    };
  });

  // Notification pour validation d'un paiement en attente (et revalidation)
  await notifyAdherentPaymentDecision({
    paiement: result.paiement,
    decision: "valide",
  });

  return {
    id: result.id,
    statut: result.statut,
    creditedToTarget: result.creditedToTarget,
    surplus: result.surplus,
  };
}

/**
 * Rejette un paiement :
 * - EnAttente → Annule (aucun crédit) + notification
 * - Valide → Annule + inverse du crédit / avoir (correction) + notification
 */
export async function rejectPendingPayment(
  actor: AuthContext,
  paiementId: string
): Promise<{ id: string; statut: string; reversed?: boolean }> {
  await authorize({
    actor,
    permissionKey: "createPaiement",
    type: "WRITE",
  });

  const result = await db.$transaction(async (tx) => {
    const paiement = await tx.paiementCotisation.findUnique({
      where: { id: paiementId },
      include: paiementNotifyInclude,
    });
    if (!paiement) {
      throw new ServiceError("NOT_FOUND", "Paiement introuvable");
    }
    if (paiement.statut !== "EnAttente" && paiement.statut !== "Valide") {
      throw new ServiceError(
        "CONFLICT",
        "Ce paiement ne peut pas être rejeté (statut actuel incompatible)"
      );
    }

    const wasValide = paiement.statut === "Valide";

    if (wasValide) {
      await reverseValidatedPaymentCredit(tx, paiement);
    }

    const claimed = await tx.paiementCotisation.updateMany({
      where: {
        id: paiementId,
        statut: wasValide ? "Valide" : "EnAttente",
      },
      data: {
        statut: "Annule",
        description:
          (paiement.description ?? "") +
          (paiement.description ? " | " : "") +
          (wasValide
            ? "Annulation admin (crédit rétabli)"
            : "Rejeté par l'administration"),
      },
    });
    if (claimed.count !== 1) {
      throw new ServiceError(
        "CONFLICT",
        "Ce paiement ne peut pas être rejeté (statut actuel incompatible)"
      );
    }

    return {
      id: paiement.id,
      statut: "Annule" as const,
      reversed: wasValide,
      paiement,
    };
  });

  await notifyAdherentPaymentDecision({
    paiement: result.paiement,
    decision: "rejete",
  });

  return {
    id: result.id,
    statut: result.statut,
    reversed: result.reversed,
  };
}
