import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { canMemberMessage } from "@/lib/services/chat/chat-helpers";
import type { CreateMyConversationResultDto } from "@/lib/services/chat/types";

const CreateSchema = z.object({
  type: z.enum(["Privee", "Groupe"]).default("Privee"),
  titre: z.string().trim().max(200).optional(),
  participantIds: z
    .array(z.string().min(1))
    .min(1, "Au moins un participant requis")
    .max(30),
});

/**
 * Crée une conversation (miroir Web createConversation).
 * Pas de find-or-create 1:1 — le Web crée toujours un nouveau thread.
 * V1 mobile : Privee (1 destinataire User.id) ou Groupe (+ titre).
 *
 * @param payload.participantIds - User.id destinataires (jamais Adherent.id)
 */
export async function createMyConversation(
  actor: AuthContext,
  payload: {
    type?: "Privee" | "Groupe";
    titre?: string;
    participantIds: string[];
  }
): Promise<CreateMyConversationResultDto> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Données invalides"
    );
  }

  const uniqueOthers = [
    ...new Set(
      parsed.data.participantIds.filter((id) => id !== actor.userId)
    ),
  ];
  if (uniqueOthers.length === 0) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Au moins un destinataire requis"
    );
  }

  if (parsed.data.type === "Privee" && uniqueOthers.length !== 1) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Une conversation privée nécessite exactement un destinataire"
    );
  }

  if (parsed.data.type === "Groupe") {
    if (!parsed.data.titre?.trim()) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Un titre est requis pour un groupe"
      );
    }
  }

  const targets = await db.user.findMany({
    where: { id: { in: uniqueOthers } },
    select: { id: true, status: true },
  });
  if (targets.length !== uniqueOthers.length) {
    throw new ServiceError(
      "NOT_FOUND",
      "Un ou plusieurs destinataires sont introuvables"
    );
  }
  for (const t of targets) {
    if (
      !canMemberMessage({
        actorUserId: actor.userId,
        targetUserId: t.id,
        targetStatus: t.status,
      })
    ) {
      throw new ServiceError(
        "FORBIDDEN",
        "Vous ne pouvez pas contacter cet utilisateur"
      );
    }
  }

  try {
    const conversation = await db.conversation.create({
      data: {
        titre:
          parsed.data.type === "Groupe"
            ? parsed.data.titre!.trim()
            : parsed.data.titre?.trim() || null,
        type: parsed.data.type,
        createdBy: actor.userId,
        Participants: {
          create: [
            { userId: actor.userId, role: "ADMIN" },
            ...uniqueOthers.map((userId) => ({
              userId,
              role: "Participant",
            })),
          ],
        },
      },
      select: { id: true },
    });

    return { id: conversation.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Destinataire invalide pour cette conversation"
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError(
        "CONFLICT",
        "Impossible de créer cette conversation"
      );
    }
    console.error(
      "[createMyConversation] Erreur:",
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : (error as Error)?.name
    );
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la création de la conversation"
    );
  }
}
