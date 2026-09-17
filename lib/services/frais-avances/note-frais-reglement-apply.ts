/**
 * Helpers transactionnels partagés 4.1 / 4.2 / 4.3.
 * Aucun commit propre ; aucun contrôle d'authz — appelés uniquement depuis
 * une TX déjà ouverte par les services publics.
 */
import { Prisma } from "@prisma/client";

/** Aligné sur NOTES_FRAIS_COMP_REFRESH_REQUIRED (compensation-service). */
export const NOTES_FRAIS_COMP_REFRESH_REQUIRED_MSG =
  "Montant demandé supérieur au restant actuel — actualisez les cibles et réessayez";

export type NotesFraisTx = Prisma.TransactionClient;

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function cmStatutApres(
  montantPaye: Prisma.Decimal,
  montantRestant: Prisma.Decimal
): string {
  if (montantRestant.lte(0)) return "Paye";
  if (montantPaye.gt(0)) return "PartiellementPaye";
  return "EnAttente";
}

export type NormalizedCompensationLigne = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  montant: string;
  rang: number;
};

export type PreparedCompensationLigne = {
  ligne: NormalizedCompensationLigne;
  cibleChoixId: string;
  restantAvant: Prisma.Decimal;
  autoriseRestantAvant: Prisma.Decimal;
};

/**
 * Verrouille dettes/CM dans un ordre déterministe (type puis id).
 */
export async function lockCompensationTargetsInTx(
  tx: NotesFraisTx,
  lignes: NormalizedCompensationLigne[]
): Promise<void> {
  const lockTargets = lignes
    .map((l) => ({ typeCible: l.typeCible, cibleId: l.cibleId }))
    .sort(
      (a, b) =>
        a.typeCible.localeCompare(b.typeCible) ||
        a.cibleId.localeCompare(b.cibleId)
    );
  for (const t of lockTargets) {
    if (t.typeCible === "DETTE_INITIALE") {
      await tx.$executeRaw`
        SELECT id FROM dettes_initiales WHERE id = ${t.cibleId} FOR UPDATE
      `;
    } else {
      await tx.$executeRaw`
        SELECT id FROM cotisations_mensuelles WHERE id = ${t.cibleId} FOR UPDATE
      `;
    }
  }
}

/**
 * Prépare / revalide les lignes compensation après verrous (sans écrire).
 */
export async function prepareCompensationLignesInTx(input: {
  tx: NotesFraisTx;
  adherentId: string;
  normalized: NormalizedCompensationLigne[];
  ciblesFresh: Map<
    string,
    {
      id: string;
      montantAutorise: Prisma.Decimal;
      montantUtilise: Prisma.Decimal;
    }
  >;
}): Promise<PreparedCompensationLigne[]> {
  const { tx, adherentId, normalized, ciblesFresh } = input;
  const prepared: PreparedCompensationLigne[] = [];

  for (const ligne of normalized) {
    const ck = `${ligne.typeCible}:${ligne.cibleId}`;
    const cibleChoix = ciblesFresh.get(ck);
    if (!cibleChoix) {
      throw new Error("Cible absente du choix ACTIF");
    }
    const autoriseRestant = money(cibleChoix.montantAutorise).minus(
      money(cibleChoix.montantUtilise)
    );
    const montant = money(ligne.montant);
    if (montant.gt(autoriseRestant)) {
      throw new Error(
        "Montant supérieur au plafond autorisé restant de la cible"
      );
    }

    if (ligne.typeCible === "DETTE_INITIALE") {
      const dette = await tx.detteInitiale.findFirst({
        where: { id: ligne.cibleId, adherentId },
        select: { id: true, montantRestant: true, montantPaye: true },
      });
      if (!dette) throw new Error("Cible introuvable");
      const restant = money(dette.montantRestant);
      if (montant.gt(restant)) {
        throw new Error(NOTES_FRAIS_COMP_REFRESH_REQUIRED_MSG);
      }
      prepared.push({
        ligne,
        cibleChoixId: cibleChoix.id,
        restantAvant: restant,
        autoriseRestantAvant: autoriseRestant,
      });
    } else {
      const cm = await tx.cotisationMensuelle.findFirst({
        where: {
          id: ligne.cibleId,
          adherentId,
          adherentBeneficiaireId: null,
          TypeCotisation: { categorie: { not: "Assistance" } },
        },
        select: {
          id: true,
          montantAttendu: true,
          montantPaye: true,
          montantRestant: true,
          statut: true,
        },
      });
      if (!cm) throw new Error("Cible introuvable");
      const restant = money(cm.montantRestant);
      if (montant.gt(restant)) {
        throw new Error(NOTES_FRAIS_COMP_REFRESH_REQUIRED_MSG);
      }
      prepared.push({
        ligne,
        cibleChoixId: cibleChoix.id,
        restantAvant: restant,
        autoriseRestantAvant: autoriseRestant,
      });
    }
  }
  return prepared;
}

/**
 * Crée le règlement COMPENSATION + lignes + Avoir/Utilisation + soldes + compteurs cibles.
 * N'incrémente pas le compteur choix (appelant).
 */
export async function applyCompensationReglementInTx(input: {
  tx: NotesFraisTx;
  noteId: string;
  adherentId: string;
  choixId: string;
  executeurUserId: string;
  executeAt: Date;
  montantTotal: string;
  prepared: PreparedCompensationLigne[];
  /** Clé métier 4.1 ; null pour enfant MIXTE. */
  idempotencyKey: string | null;
  operationId: string | null;
  beforeApplyLigne?: (index: number) => Promise<void>;
}): Promise<{ reglementId: string }> {
  const {
    tx,
    noteId,
    adherentId,
    choixId,
    executeurUserId,
    executeAt,
    montantTotal,
    prepared,
    idempotencyKey,
    operationId,
  } = input;

  const reglement = await tx.noteFraisReglement.create({
    data: {
      noteFraisId: noteId,
      choixId,
      type: "COMPENSATION",
      statut: "EXECUTE",
      montantTotal: money(montantTotal),
      idempotencyKey,
      operationId,
      executeurUserId,
      executeAt,
    },
  });

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]!;
    if (input.beforeApplyLigne) await input.beforeApplyLigne(i);
    const montant = money(p.ligne.montant);
    let restantApres: Prisma.Decimal;

    if (p.ligne.typeCible === "DETTE_INITIALE") {
      const dette = await tx.detteInitiale.findUniqueOrThrow({
        where: { id: p.ligne.cibleId },
      });
      const newPaye = money(dette.montantPaye).plus(montant);
      await tx.detteInitiale.update({
        where: { id: p.ligne.cibleId },
        data: { montantPaye: newPaye },
      });
      const after = await tx.detteInitiale.findUniqueOrThrow({
        where: { id: p.ligne.cibleId },
        select: { montantRestant: true },
      });
      restantApres = money(after.montantRestant);
    } else {
      const cm = await tx.cotisationMensuelle.findUniqueOrThrow({
        where: { id: p.ligne.cibleId },
      });
      const newPaye = money(cm.montantPaye).plus(montant);
      let newRestant = money(cm.montantRestant).minus(montant);
      if (newRestant.lt(0)) newRestant = money(0);
      const statut = cmStatutApres(newPaye, newRestant);
      await tx.cotisationMensuelle.update({
        where: { id: p.ligne.cibleId },
        data: {
          montantPaye: newPaye,
          montantRestant: newRestant,
          statut,
        },
      });
      restantApres = newRestant;
    }

    const ligneRow = await tx.noteFraisReglementLigne.create({
      data: {
        reglementId: reglement.id,
        typeLigne: "COMPENSATION",
        typeCible: p.ligne.typeCible,
        cibleId: p.ligne.cibleId,
        rang: p.ligne.rang,
        montant,
        montantRestantCibleAvant: p.restantAvant,
        montantRestantCibleApres: restantApres,
        montantAutoriseRestantAvant: p.autoriseRestantAvant,
      },
    });

    const avoir = await tx.avoir.create({
      data: {
        adherentId,
        montant,
        montantUtilise: montant,
        montantRestant: money(0),
        paiementId: null,
        description: `Compensation note de frais ${noteId}`,
        origine: "COMPENSATION_NOTE_FRAIS",
        statut: "Utilise",
        noteFraisReglementLigneId: ligneRow.id,
      },
    });

    await tx.utilisationAvoir.create({
      data: {
        avoirId: avoir.id,
        montant,
        detteInitialeId:
          p.ligne.typeCible === "DETTE_INITIALE" ? p.ligne.cibleId : null,
        cotisationMensuelleId:
          p.ligne.typeCible === "COTISATION_MENSUELLE"
            ? p.ligne.cibleId
            : null,
        assistanceId: null,
        obligationCotisationId: null,
        description: `Compensation note de frais ${noteId}`,
        noteFraisReglementLigneId: ligneRow.id,
      },
    });

    await tx.noteFraisChoixReglementCible.update({
      where: { id: p.cibleChoixId },
      data: {
        montantUtilise: { increment: montant },
      },
    });
  }

  return { reglementId: reglement.id };
}

/**
 * Crée le règlement REMBOURSEMENT + ligne rang=1 sans cible.
 * N'incrémente pas le compteur choix (appelant).
 */
export async function createRemboursementReglementInTx(input: {
  tx: NotesFraisTx;
  noteId: string;
  choixId: string;
  executeurUserId: string;
  executeAt: Date;
  montant: Prisma.Decimal | string;
  moyen: "VIREMENT" | "ESPECES";
  reference: string;
  referenceNormalisee: string;
  /** Clé métier 4.2 ; null pour enfant MIXTE. */
  idempotencyKey: string | null;
  operationId: string | null;
}): Promise<{ reglementId: string }> {
  const montant = money(input.montant);
  const reglement = await input.tx.noteFraisReglement.create({
    data: {
      noteFraisId: input.noteId,
      choixId: input.choixId,
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: montant,
      moyen: input.moyen,
      reference: input.reference,
      referenceNormalisee: input.referenceNormalisee,
      idempotencyKey: input.idempotencyKey,
      operationId: input.operationId,
      executeurUserId: input.executeurUserId,
      executeAt: input.executeAt,
    },
  });

  await input.tx.noteFraisReglementLigne.create({
    data: {
      reglementId: reglement.id,
      typeLigne: "REMBOURSEMENT",
      typeCible: null,
      cibleId: null,
      rang: 1,
      montant,
      montantRestantCibleAvant: null,
      montantRestantCibleApres: null,
      montantAutoriseRestantAvant: null,
    },
  });

  return { reglementId: reglement.id };
}
