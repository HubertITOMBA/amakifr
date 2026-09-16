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
  montantDemande: number;
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
  montantAccepte?: number | null;
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
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    return await listAdminNotesFrais({
      actorUserId: userId,
      onlyAlerteSansDestinataire: opts?.onlyAlerteSansDestinataire,
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
