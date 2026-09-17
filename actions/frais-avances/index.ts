"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  NOTES_FRAIS_DISABLED_MESSAGE,
  isNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserReadSubmittedNotesFrais } from "@/lib/frais-avances/authz";
import {
  createNoteFraisDraft,
  deleteNoteFraisJustificatif,
  getNoteFraisForUser,
  listAdminNotesFrais,
  listMyNotesFrais,
  submitNoteFrais,
  updateNoteFraisDraft,
  uploadNoteFraisJustificatif,
} from "@/lib/services/frais-avances/note-frais-service";

function disabled() {
  return {
    success: false as const,
    error: NOTES_FRAIS_DISABLED_MESSAGE,
    code: "NOTES_FRAIS_DISABLED",
  };
}

async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }
  return session.user.id;
}

/** @deprecated Preferer canUserReadSubmittedNotesFrais depuis authz. */
export async function userCanReadSubmittedNotesFrais(
  userId: string
): Promise<boolean> {
  return canUserReadSubmittedNotesFrais(userId);
}

export async function actionCreateNoteFraisDraft(form: {
  libelle: string;
  description?: string;
  dateDepense: string;
  /** Chaîne monétaire (ex. "10.01"). */
  montantDemande: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const result = await createNoteFraisDraft({
      userId,
      libelle: form.libelle,
      description: form.description,
      dateDepense: new Date(form.dateDepense),
      montantDemande: form.montantDemande,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionUpdateNoteFraisDraft(form: {
  noteId: string;
  expectedVersion: number;
  libelle?: string;
  description?: string;
  dateDepense?: string;
  montantDemande?: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const result = await updateNoteFraisDraft({
      userId,
      noteId: form.noteId,
      expectedVersion: form.expectedVersion,
      libelle: form.libelle,
      description: form.description,
      dateDepense: form.dateDepense ? new Date(form.dateDepense) : undefined,
      montantDemande: form.montantDemande,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionUploadNoteFraisJustificatif(formData: FormData) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const noteId = String(formData.get("noteId") || "");
    const expectedVersion = Number(formData.get("expectedVersion"));
    const file = formData.get("file");
    if (!noteId || !(file instanceof File) || !Number.isInteger(expectedVersion)) {
      return { success: false as const, error: "Paramètres invalides" };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadNoteFraisJustificatif({
      userId,
      noteId,
      expectedVersion,
      buffer,
      claimedMime: file.type,
      originalName: file.name || "justificatif",
    });
    if (result.success) {
      revalidatePath(`/user/frais-avances/${noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionDeleteNoteFraisJustificatif(form: {
  noteId: string;
  justificatifId: string;
  expectedVersion: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const result = await deleteNoteFraisJustificatif({
      userId,
      noteId: form.noteId,
      justificatifId: form.justificatifId,
      expectedVersion: form.expectedVersion,
    });
    if (result.success) {
      revalidatePath(`/user/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionSubmitNoteFrais(form: {
  noteId: string;
  idempotencyKey: string;
  expectedVersion: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const result = await submitNoteFrais({
      userId,
      noteId: form.noteId,
      idempotencyKey: form.idempotencyKey,
      expectedVersion: form.expectedVersion,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Décision TRESOR/ADMIN sur une note SOUMISE.
 */
export async function actionDecideNoteFrais(form: {
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  outcome: "VALIDEE" | "REJETEE";
  montantAccepte?: string | number | null;
  motif?: string | null;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const result = await decideNoteFrais({
      actorUserId: userId,
      noteId: form.noteId,
      expectedVersion: form.expectedVersion,
      idempotencyKey: form.idempotencyKey,
      outcome: form.outcome,
      montantAccepte: form.montantAccepte,
      motif: form.motif,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Brouillon de correction lié à une note REJETEE du même propriétaire.
 */
export async function actionCreateCorrectedNoteFraisDraft(form: {
  corrigeNoteFraisId: string;
  libelle?: string;
  description?: string | null;
  dateDepense?: string;
  montantDemande?: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { createCorrectedNoteFraisDraft } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const result = await createCorrectedNoteFraisDraft({
      userId,
      corrigeNoteFraisId: form.corrigeNoteFraisId,
      libelle: form.libelle,
      description: form.description,
      dateDepense: form.dateDepense ? new Date(form.dateDepense) : undefined,
      montantDemande: form.montantDemande,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath(`/user/frais-avances/${result.data.id}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Cibles V1 éligibles pour compensation (owner, note VALIDEE).
 */
export async function actionListCiblesCompensationNoteFrais(noteId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { listCiblesCompensationEligibles } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );
    return await listCiblesCompensationEligibles({
      actorUserId: userId,
      noteId,
    });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Lecture du choix ACTIF (owner ou responsable).
 */
export async function actionGetChoixReglementNoteFrais(noteId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { getChoixReglementActif } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );
    return await getChoixReglementActif({
      actorUserId: userId,
      noteId,
    });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Enregistre ou remplace le choix de règlement (owner, sans effet financier).
 */
export async function actionSetChoixReglementNoteFrais(form: {
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  mode: "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";
  montantRemboursement: string | number;
  montantCompensation: string | number;
  cibles: Array<{
    typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
    cibleId: string;
    montantAutorise: string | number;
    rang: number;
  }>;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { setChoixReglement } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );
    const result = await setChoixReglement({
      actorUserId: userId,
      noteId: form.noteId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      mode: form.mode,
      montantRemboursement: form.montantRemboursement,
      montantCompensation: form.montantCompensation,
      cibles: form.cibles,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionListMyNotesFrais() {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    return await listMyNotesFrais(userId);
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionListAdminNotesFrais(opts?: {
  onlyAlerteSansDestinataire?: boolean;
  statut?: "SOUMISE" | "VALIDEE" | "REJETEE" | "all";
  etatFinancier?:
    | "NON_REGLEE"
    | "PARTIELLEMENT_REGLEE"
    | "REGLEE"
    | "all";
  page?: number;
  pageSize?: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    return await listAdminNotesFrais({
      actorUserId: userId,
      onlyAlerteSansDestinataire: opts?.onlyAlerteSansDestinataire,
      statut: opts?.statut,
      etatFinancier: opts?.etatFinancier,
      page: opts?.page,
      pageSize: opts?.pageSize,
    });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Capacités UI pour une note (boutons / parcours).
 */
export async function actionGetNoteFraisCapabilities(noteId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { getNoteFraisCapabilities } = await import(
      "@/lib/services/frais-avances/note-frais-capabilities-service"
    );
    return await getNoteFraisCapabilities({ userId, noteId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Capacités navigation (menus) — flag off → tout false.
 */
export async function actionGetNotesFraisNavCapabilities() {
  try {
    const userId = await requireSessionUserId();
    const { getNotesFraisNavCapabilities } = await import(
      "@/lib/services/frais-avances/note-frais-capabilities-service"
    );
    return await getNotesFraisNavCapabilities({ userId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Liste comptable VALIDEE (COMCPT / ADMIN / TRESOR).
 */
export async function actionListNotesFraisComptabilite(opts?: {
  etatFinancier?:
    | "NON_REGLEE"
    | "PARTIELLEMENT_REGLEE"
    | "REGLEE"
    | "all";
  page?: number;
  pageSize?: number;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { listNotesFraisComptabilite } = await import(
      "@/lib/services/frais-avances/note-frais-comptabilite-list-service"
    );
    return await listNotesFraisComptabilite({
      userId,
      etatFinancier: opts?.etatFinancier,
      page: opts?.page,
      pageSize: opts?.pageSize,
    });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

export async function actionGetNoteFrais(noteId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    return await getNoteFraisForUser({ userId, noteId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Vue financière comptable (ADMIN|TRESOR|COMCPT) : règlements + référence.
 * Sans justificatifs ni description. Ne remplace pas le détail live.
 */
export async function actionGetNoteFraisFinancialView(noteId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { getNoteFraisFinancialView } = await import(
      "@/lib/services/frais-avances/note-frais-financial-view-service"
    );
    return await getNoteFraisFinancialView({ userId, noteId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Liste archive privée (ADMIN|TRESOR|COMCPT). Indépendant du flag pour la lecture
 * des données déjà archivées — mais on garde le flag module pour cohérence UI locale.
 */
export async function actionListNotesFraisArchives() {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { listNotesFraisArchives } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    return await listNotesFraisArchives({ userId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Détail archive privée.
 */
export async function actionGetNotesFraisArchive(archiveId: string) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    const { getNotesFraisArchive } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    return await getNotesFraisArchive({ userId, archiveId });
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Exécute une compensation (partielle) sur le choix ACTIF COMPENSATION|MIXTE.
 */
export async function actionExecuteNoteFraisCompensation(form: {
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  lignes: Array<{
    typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
    cibleId: string;
    montant: string | number;
    rang: number;
  }>;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const result = await executeNoteFraisCompensation({
      actorUserId: userId,
      noteId: form.noteId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      lignes: form.lignes,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Exécute un remboursement (partiel) sur le choix ACTIF REMBOURSEMENT|MIXTE.
 * Montant en chaîne décimale ; aucune horloge/now acceptée du client.
 */
export async function actionExecuteNoteFraisRemboursement(form: {
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  montant: string;
  moyen: "VIREMENT" | "ESPECES";
  reference: string;
  executeAt: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const result = await executeNoteFraisRemboursement({
      actorUserId: userId,
      noteId: form.noteId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      montant: form.montant,
      moyen: form.moyen,
      reference: form.reference,
      executeAt: form.executeAt,
      // clock / now volontairement absents — horloge serveur uniquement
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Exécute compensation + remboursement atomiques (choix MIXTE).
 */
export async function actionExecuteNoteFraisReglementMixte(form: {
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  montantRembourse: string;
  moyen: "VIREMENT" | "ESPECES";
  reference: string;
  executeAt: string;
  lignesCompensation: Array<{
    typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
    cibleId: string;
    montant: string;
    rang: number;
  }>;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );
    const result = await executeNoteFraisReglementMixte({
      actorUserId: userId,
      noteId: form.noteId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      montantRembourse: form.montantRembourse,
      moyen: form.moyen,
      reference: form.reference,
      executeAt: form.executeAt,
      lignesCompensation: form.lignesCompensation,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Correction append-only d'un règlement (REFERENCE | MONTANT_NEGATIF).
 * Montants en chaînes décimales positives ; stockage négatif côté serveur.
 */
export async function actionCorrectNoteFraisReglement(form: {
  noteId: string;
  reglementId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  type: "REFERENCE" | "MONTANT_NEGATIF";
  motif: string;
  referenceApres?: string;
  montantACorriger?: string;
  allocations?: Array<{
    reglementLigneId: string;
    montantARestaurer: string;
  }>;
  preuveKind?: string;
  preuveRef?: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const result = await correctNoteFraisReglement({
      actorUserId: userId,
      noteId: form.noteId,
      reglementId: form.reglementId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      type: form.type,
      motif: form.motif,
      referenceApres: form.referenceApres,
      montantACorriger: form.montantACorriger,
      allocations: form.allocations,
      preuveKind: form.preuveKind,
      preuveRef: form.preuveRef,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Enregistre une restitution réelle sur un remboursement (lot 4.7).
 * Montant en chaîne décimale positive ; référence obligatoire.
 */
export async function actionRecordNoteFraisRestitution(form: {
  noteId: string;
  reglementId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  montant: string;
  moyen: "VIREMENT" | "ESPECES";
  reference: string;
  dateRestitution: string;
  motif: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );
    const result = await recordNoteFraisRestitution({
      actorUserId: userId,
      noteId: form.noteId,
      reglementId: form.reglementId,
      expectedNoteVersion: form.expectedNoteVersion,
      idempotencyKey: form.idempotencyKey,
      montant: form.montant,
      moyen: form.moyen,
      reference: form.reference,
      dateRestitution: form.dateRestitution,
      motif: form.motif,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Demande d'annulation de règlement (lot 4.8) — XOR reglementId | operationId.
 */
export async function actionRequestNoteFraisReglementAnnulation(form: {
  noteId: string;
  reglementId?: string | null;
  operationId?: string | null;
  idempotencyKey: string;
  motif: string;
  preuveKind:
    | "REJET_BANQUE"
    | "ANNULATION_VIREMENT"
    | "RECU_CAISSE_ANNULE"
    | "TRACE_ETABLISSEMENT"
    | "PV_TRESORERIE"
    | "JUSTIFICATIF_INTERNE"
    | "AUTRE_TRACE";
  preuveRef: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.idempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { requestNoteFraisReglementAnnulation } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );
    const result = await requestNoteFraisReglementAnnulation({
      actorUserId: userId,
      noteId: form.noteId,
      reglementId: form.reglementId,
      operationId: form.operationId,
      idempotencyKey: form.idempotencyKey,
      motif: form.motif,
      preuveKind: form.preuveKind,
      preuveRef: form.preuveRef,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Confirmation d'annulation (lot 4.8) — effet financier.
 */
export async function actionConfirmNoteFraisReglementAnnulation(form: {
  noteId: string;
  demandeId: string;
  expectedNoteVersion: number;
  decisionIdempotencyKey: string;
  /** Attestation obligatoire — `true` uniquement (jamais case UI seule). */
  attestation: boolean;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.decisionIdempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence de décision requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    if (form.attestation !== true) {
      return {
        success: false as const,
        error: "Attestation obligatoire",
        code: "ANNULATION_ATTESTATION_REQUIRED",
      };
    }
    const { confirmNoteFraisReglementAnnulation } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );
    const result = await confirmNoteFraisReglementAnnulation({
      actorUserId: userId,
      noteId: form.noteId,
      demandeId: form.demandeId,
      expectedNoteVersion: form.expectedNoteVersion,
      decisionIdempotencyKey: form.decisionIdempotencyKey,
      attestation: true,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
      revalidatePath("/admin/finances/synthese");
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Refus d'annulation (lot 4.8) — sans effet financier.
 */
export async function actionRefuseNoteFraisReglementAnnulation(form: {
  noteId: string;
  demandeId: string;
  decisionIdempotencyKey: string;
  decisionMotif: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!form.decisionIdempotencyKey?.trim()) {
      return {
        success: false as const,
        error: "Clé d'idempotence de décision requise",
        code: "IDEMPOTENCY_REQUIRED",
      };
    }
    const { refuseNoteFraisReglementAnnulation } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );
    const result = await refuseNoteFraisReglementAnnulation({
      actorUserId: userId,
      noteId: form.noteId,
      demandeId: form.demandeId,
      decisionIdempotencyKey: form.decisionIdempotencyKey,
      decisionMotif: form.decisionMotif,
    });
    if (result.success) {
      revalidatePath("/user/frais-avances");
      revalidatePath("/admin/frais-avances");
      revalidatePath(`/user/frais-avances/${form.noteId}`);
      revalidatePath(`/admin/frais-avances/${form.noteId}`);
    }
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}
