import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

/**
 * Publie un rapport (DRAFT → PUBLISHED).
 * Déjà PUBLISHED → no-op (conserve publishedAt / publishedBy).
 * Appelant doit déjà avoir vérifié canWrite(updateRapportReunion).
 *
 * @throws {ServiceError} NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function publishRapportReunion(
  rapportId: string,
  publisherUserId: string
): Promise<{ id: string; statut: "PUBLISHED"; publishedAt: Date }> {
  const id = String(rapportId ?? "").trim();
  if (!id) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant de rapport requis");
  }
  if (!publisherUserId?.trim()) {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  try {
    const existing = await db.rapportReunion.findUnique({
      where: { id },
      select: {
        id: true,
        statut: true,
        publishedAt: true,
        publishedBy: true,
      },
    });
    if (!existing) {
      throw new ServiceError("NOT_FOUND", "Rapport non trouvé");
    }

    if (existing.statut === "PUBLISHED") {
      if (!existing.publishedAt) {
        throw new ServiceError(
          "INTERNAL_ERROR",
          "Rapport publié sans date de publication"
        );
      }
      return {
        id: existing.id,
        statut: "PUBLISHED",
        publishedAt: existing.publishedAt,
      };
    }

    const now = new Date();
    const updated = await db.rapportReunion.update({
      where: { id },
      data: {
        statut: "PUBLISHED",
        publishedAt: now,
        publishedBy: publisherUserId,
        updatedBy: publisherUserId,
      },
      select: { id: true, statut: true, publishedAt: true },
    });

    return {
      id: updated.id,
      statut: "PUBLISHED",
      publishedAt: updated.publishedAt ?? now,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[publishRapportReunion] Erreur:", error);
    throw new ServiceError("INTERNAL_ERROR", "Erreur lors de la publication");
  }
}

/**
 * Repasse un rapport en brouillon (PUBLISHED → DRAFT).
 * Déjà DRAFT → no-op.
 * publishedAt / publishedBy remis à null.
 * Avertissement métier : les adhérents perdent immédiatement l’accès lecture.
 *
 * @throws {ServiceError} NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function unpublishRapportReunion(
  rapportId: string,
  editorUserId: string
): Promise<{ id: string; statut: "DRAFT" }> {
  const id = String(rapportId ?? "").trim();
  if (!id) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant de rapport requis");
  }
  if (!editorUserId?.trim()) {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  try {
    const existing = await db.rapportReunion.findUnique({
      where: { id },
      select: { id: true, statut: true },
    });
    if (!existing) {
      throw new ServiceError("NOT_FOUND", "Rapport non trouvé");
    }

    if (existing.statut === "DRAFT") {
      return { id: existing.id, statut: "DRAFT" };
    }

    const updated = await db.rapportReunion.update({
      where: { id },
      data: {
        statut: "DRAFT",
        publishedAt: null,
        publishedBy: null,
        updatedBy: editorUserId,
      },
      select: { id: true, statut: true },
    });

    return { id: updated.id, statut: "DRAFT" };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[unpublishRapportReunion] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du retour en brouillon"
    );
  }
}
