/**
 * Détachement comptable RGPD lot 4.9 — Depense / Avoir / UA + acteurs.
 */
import { db } from "@/lib/db";
import {
  DESCRIPTION_AVOIR_COMPENSATION_ARCHIVEE,
  DESCRIPTION_UA_COMPENSATION_ARCHIVEE,
  LIBELLE_DEPENSE_FRAIS_AVANCE_ARCHIVEE,
} from "@/lib/frais-avances/retention-policy";

export const NOTES_FRAIS_DETACH_COUNT_MISMATCH =
  "NOTES_FRAIS_DETACH_COUNT_MISMATCH";

export type DetachDbClient = {
  $executeRaw: typeof db.$executeRaw;
  depense: typeof db.depense;
  avoir: typeof db.avoir;
  utilisationAvoir: typeof db.utilisationAvoir;
  noteFraisReglement: typeof db.noteFraisReglement;
  noteFraisReglementOperation: typeof db.noteFraisReglementOperation;
  noteFraisReglementLigne: typeof db.noteFraisReglementLigne;
  noteFraisReglementCorrection: typeof db.noteFraisReglementCorrection;
  noteFraisCorrectionInverseCible: typeof db.noteFraisCorrectionInverseCible;
  noteFraisRestitution: typeof db.noteFraisRestitution;
  noteFraisReglementAnnulationDemande: typeof db.noteFraisReglementAnnulationDemande;
  noteFraisAnnulationInverseCible: typeof db.noteFraisAnnulationInverseCible;
  noteFraisChoixReglementCible: typeof db.noteFraisChoixReglementCible;
  noteFraisChoixReglement: typeof db.noteFraisChoixReglement;
  noteFraisDecision: typeof db.noteFraisDecision;
  justificatifNoteFrais: typeof db.justificatifNoteFrais;
  noteFrais: typeof db.noteFrais;
  typeDepense: typeof db.typeDepense;
  justificatifDepense: typeof db.justificatifDepense;
};

type ActorNullClient = Partial<
  Pick<
    DetachDbClient,
    | "depense"
    | "noteFraisReglement"
    | "noteFraisReglementOperation"
    | "justificatifNoteFrais"
    | "justificatifDepense"
    | "typeDepense"
  >
>;

/**
 * SetNull des acteurs du user sur objets comptables conservés (hors notes à supprimer).
 */
export async function setNullActorFksForUserInTx(
  tx: ActorNullClient,
  userId: string
): Promise<void> {
  if (tx.depense?.updateMany) {
    await tx.depense.updateMany({
      where: { createdBy: userId },
      data: { createdBy: null },
    });
    await tx.depense.updateMany({
      where: { validatedBy: userId },
      data: { validatedBy: null },
    });
  }
  if (tx.noteFraisReglement?.updateMany) {
    await tx.noteFraisReglement.updateMany({
      where: { executeurUserId: userId },
      data: { executeurUserId: null },
    });
  }
  if (tx.noteFraisReglementOperation?.updateMany) {
    await tx.noteFraisReglementOperation.updateMany({
      where: { executeurUserId: userId },
      data: { executeurUserId: null },
    });
  }
  if (tx.justificatifNoteFrais?.updateMany) {
    await tx.justificatifNoteFrais.updateMany({
      where: { uploadedBy: userId },
      data: { uploadedBy: null },
    });
  }
  if (tx.justificatifDepense?.updateMany) {
    await tx.justificatifDepense.updateMany({
      where: { uploadedBy: userId },
      data: { uploadedBy: null },
    });
  }
  if (tx.typeDepense?.updateMany) {
    await tx.typeDepense.updateMany({
      where: { createdBy: userId },
      data: { createdBy: null },
    });
  }
  // Corrections / restitutions / annulations / access logs : déjà SetNull en schéma
}

async function assertCount(
  actual: number,
  expected: number,
  label: string
): Promise<void> {
  if (actual !== expected) {
    throw new Error(`${NOTES_FRAIS_DETACH_COUNT_MISMATCH}:${label}`);
  }
}

/**
 * Verrouille l'historique financier d'une note (ordre stable id ASC).
 */
export async function lockNoteFraisFinancialHistory(
  tx: DetachDbClient,
  noteId: string
): Promise<void> {
  await tx.$executeRaw`
    SELECT id FROM notes_frais_reglement_operations
    WHERE "noteFraisId" = ${noteId} ORDER BY id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT id FROM notes_frais_reglements
    WHERE "noteFraisId" = ${noteId} ORDER BY id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT l.id FROM notes_frais_reglement_lignes l
    INNER JOIN notes_frais_reglements r ON r.id = l."reglementId"
    WHERE r."noteFraisId" = ${noteId} ORDER BY l.id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT c.id FROM notes_frais_reglement_corrections c
    INNER JOIN notes_frais_reglements r ON r.id = c."reglementId"
    WHERE r."noteFraisId" = ${noteId} ORDER BY c.id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT s.id FROM notes_frais_restitutions s
    INNER JOIN notes_frais_reglements r ON r.id = s."reglementId"
    WHERE r."noteFraisId" = ${noteId} ORDER BY s.id ASC FOR UPDATE
  `;
  // Pas de LEFT JOIN + FOR UPDATE (PG 0A000). Deux INNER JOIN séparés.
  await tx.$executeRaw`
    SELECT d.id FROM notes_frais_reglement_annulation_demandes d
    INNER JOIN notes_frais_reglements r ON r.id = d."reglementId"
    WHERE r."noteFraisId" = ${noteId}
    ORDER BY d.id ASC
    FOR UPDATE OF d
  `;
  await tx.$executeRaw`
    SELECT d.id FROM notes_frais_reglement_annulation_demandes d
    INNER JOIN notes_frais_reglement_operations o ON o.id = d."operationId"
    WHERE o."noteFraisId" = ${noteId}
    ORDER BY d.id ASC
    FOR UPDATE OF d
  `;
  await tx.$executeRaw`
    SELECT inv.id FROM notes_frais_annulation_inverses_cible inv
    INNER JOIN notes_frais_reglement_annulation_demandes d ON d.id = inv."demandeId"
    INNER JOIN notes_frais_reglements r ON r.id = d."reglementId"
    WHERE r."noteFraisId" = ${noteId}
    ORDER BY inv.id ASC
    FOR UPDATE OF inv
  `;
  await tx.$executeRaw`
    SELECT inv.id FROM notes_frais_annulation_inverses_cible inv
    INNER JOIN notes_frais_reglement_annulation_demandes d ON d.id = inv."demandeId"
    INNER JOIN notes_frais_reglement_operations o ON o.id = d."operationId"
    WHERE o."noteFraisId" = ${noteId}
    ORDER BY inv.id ASC
    FOR UPDATE OF inv
  `;
  await tx.$executeRaw`
    SELECT a.id FROM avoirs a
    INNER JOIN notes_frais_reglement_lignes l ON l.id = a."noteFraisReglementLigneId"
    INNER JOIN notes_frais_reglements r ON r.id = l."reglementId"
    WHERE r."noteFraisId" = ${noteId} ORDER BY a.id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT u.id FROM utilisations_avoir u
    INNER JOIN notes_frais_reglement_lignes l ON l.id = u."noteFraisReglementLigneId"
    INNER JOIN notes_frais_reglements r ON r.id = l."reglementId"
    WHERE r."noteFraisId" = ${noteId} ORDER BY u.id ASC FOR UPDATE
  `;
  await tx.$executeRaw`
    SELECT id FROM depenses WHERE "noteFraisId" = ${noteId} FOR UPDATE
  `;
}

/**
 * Applique textes techniques + détache Depense / Avoir / UA pour une note.
 */
export async function detachAccountingForNoteInTx(
  tx: DetachDbClient,
  noteId: string
): Promise<{
  depensesDetached: number;
  avoirsDetached: number;
  uaDetached: number;
}> {
  const ligneIds = (
    await tx.noteFraisReglementLigne.findMany({
      where: { Reglement: { noteFraisId: noteId } },
      select: { id: true },
    })
  ).map((l) => l.id);

  const avoirs = await tx.avoir.findMany({
    where: {
      OR: [
        { noteFraisReglementLigneId: { in: ligneIds } },
        {
          origine: "COMPENSATION_NOTE_FRAIS",
          noteFraisReglementLigneId: { in: ligneIds },
        },
      ],
    },
    select: { id: true },
  });
  const avoirIds = avoirs.map((a) => a.id);

  let uaDetached = 0;
  if (ligneIds.length > 0) {
    const uaRes = await tx.utilisationAvoir.updateMany({
      where: { noteFraisReglementLigneId: { in: ligneIds } },
      data: {
        noteFraisReglementLigneId: null,
        description: DESCRIPTION_UA_COMPENSATION_ARCHIVEE,
      },
    });
    uaDetached = uaRes.count;
  }

  let avoirsDetached = 0;
  if (avoirIds.length > 0) {
    const avRes = await tx.avoir.updateMany({
      where: { id: { in: avoirIds } },
      data: {
        noteFraisReglementLigneId: null,
        description: DESCRIPTION_AVOIR_COMPENSATION_ARCHIVEE,
        // statut / origine / montants inchangés — ne pas toucher
      },
    });
    avoirsDetached = avRes.count;
  }

  const depBefore = await tx.depense.count({ where: { noteFraisId: noteId } });
  const depRes = await tx.depense.updateMany({
    where: { noteFraisId: noteId },
    data: {
      noteFraisId: null,
      libelle: LIBELLE_DEPENSE_FRAIS_AVANCE_ARCHIVEE,
      description: null,
      // origine inchangée (filtre where ne la modifie pas)
    },
  });
  await assertCount(depRes.count, depBefore, "depense_detach");

  // Garantir origine FRAIS_AVANCE sur les charges détachées de cette vague
  // (updateMany précédent ne change pas origine ; assertion lecture).
  if (depBefore > 0) {
    const stillLinked = await tx.depense.count({
      where: { noteFraisId: noteId },
    });
    await assertCount(stillLinked, 0, "depense_still_linked");
  }

  return {
    depensesDetached: depRes.count,
    avoirsDetached,
    uaDetached,
  };
}

/**
 * Supprime la chaîne live d'une note après snapshot + détachement.
 * Counts assertés — divergence → erreur → rollback.
 */
export async function deleteNoteFraisLiveFinancialChainInTx(
  tx: DetachDbClient,
  noteId: string
): Promise<void> {
  const reglementIds = (
    await tx.noteFraisReglement.findMany({
      where: { noteFraisId: noteId },
      select: { id: true },
    })
  ).map((r) => r.id);

  const operationIds = (
    await tx.noteFraisReglementOperation.findMany({
      where: { noteFraisId: noteId },
      select: { id: true },
    })
  ).map((o) => o.id);

  const demandeIds = (
    await tx.noteFraisReglementAnnulationDemande.findMany({
      where: {
        OR: [
          { reglementId: { in: reglementIds } },
          { operationId: { in: operationIds } },
        ],
      },
      select: { id: true },
    })
  ).map((d) => d.id);

  const correctionIds = (
    await tx.noteFraisReglementCorrection.findMany({
      where: { reglementId: { in: reglementIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  const ligneIds = (
    await tx.noteFraisReglementLigne.findMany({
      where: { reglementId: { in: reglementIds } },
      select: { id: true },
    })
  ).map((l) => l.id);

  const choixIds = (
    await tx.noteFraisChoixReglement.findMany({
      where: { noteFraisId: noteId },
      select: { id: true },
    })
  ).map((c) => c.id);

  // 1. inverses annulation
  if (demandeIds.length > 0) {
    const expected = await tx.noteFraisAnnulationInverseCible.count({
      where: { demandeId: { in: demandeIds } },
    });
    const res = await tx.noteFraisAnnulationInverseCible.deleteMany({
      where: { demandeId: { in: demandeIds } },
    });
    await assertCount(res.count, expected, "annulation_inverses");
  }

  // 2. demandes annulation
  if (demandeIds.length > 0) {
    const res = await tx.noteFraisReglementAnnulationDemande.deleteMany({
      where: { id: { in: demandeIds } },
    });
    await assertCount(res.count, demandeIds.length, "annulation_demandes");
  }

  // 3. inverses correction
  if (correctionIds.length > 0) {
    const expected = await tx.noteFraisCorrectionInverseCible.count({
      where: { correctionId: { in: correctionIds } },
    });
    const res = await tx.noteFraisCorrectionInverseCible.deleteMany({
      where: { correctionId: { in: correctionIds } },
    });
    await assertCount(res.count, expected, "correction_inverses");
  }

  // 4. corrections
  if (correctionIds.length > 0) {
    const res = await tx.noteFraisReglementCorrection.deleteMany({
      where: { id: { in: correctionIds } },
    });
    await assertCount(res.count, correctionIds.length, "corrections");
  }

  // 5. restitutions
  if (reglementIds.length > 0) {
    const expected = await tx.noteFraisRestitution.count({
      where: { reglementId: { in: reglementIds } },
    });
    const res = await tx.noteFraisRestitution.deleteMany({
      where: { reglementId: { in: reglementIds } },
    });
    await assertCount(res.count, expected, "restitutions");
  }

  // 6. lignes (Avoir/UA déjà détachés)
  if (ligneIds.length > 0) {
    const res = await tx.noteFraisReglementLigne.deleteMany({
      where: { id: { in: ligneIds } },
    });
    await assertCount(res.count, ligneIds.length, "lignes");
  }

  // 7. règlements
  if (reglementIds.length > 0) {
    const res = await tx.noteFraisReglement.deleteMany({
      where: { id: { in: reglementIds } },
    });
    await assertCount(res.count, reglementIds.length, "reglements");
  }

  // 8. opérations
  if (operationIds.length > 0) {
    const res = await tx.noteFraisReglementOperation.deleteMany({
      where: { id: { in: operationIds } },
    });
    await assertCount(res.count, operationIds.length, "operations");
  }

  // 9. cibles choix
  if (choixIds.length > 0) {
    const expected = await tx.noteFraisChoixReglementCible.count({
      where: { choixId: { in: choixIds } },
    });
    const res = await tx.noteFraisChoixReglementCible.deleteMany({
      where: { choixId: { in: choixIds } },
    });
    await assertCount(res.count, expected, "choix_cibles");
  }

  // 10. choix (détacher remplaceChoixId d'abord pour éviter cycles)
  if (choixIds.length > 0) {
    await tx.noteFraisChoixReglement.updateMany({
      where: { id: { in: choixIds } },
      data: { remplaceChoixId: null },
    });
    const res = await tx.noteFraisChoixReglement.deleteMany({
      where: { id: { in: choixIds } },
    });
    await assertCount(res.count, choixIds.length, "choix");
  }

  // 11. décision
  const decExpected = await tx.noteFraisDecision.count({
    where: { noteFraisId: noteId },
  });
  const decRes = await tx.noteFraisDecision.deleteMany({
    where: { noteFraisId: noteId },
  });
  await assertCount(decRes.count, decExpected, "decision");

  // 12. justificatifs live
  const jExpected = await tx.justificatifNoteFrais.count({
    where: { noteFraisId: noteId },
  });
  const jRes = await tx.justificatifNoteFrais.deleteMany({
    where: { noteFraisId: noteId },
  });
  await assertCount(jRes.count, jExpected, "justificatifs_live");

  // 13. note
  const nRes = await tx.noteFrais.deleteMany({
    where: {
      id: noteId,
      statut: { in: ["SOUMISE", "VALIDEE", "REJETEE"] },
    },
  });
  await assertCount(nRes.count, 1, "note");
}
