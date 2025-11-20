"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { safeFindMany } from "@/lib/prisma-helpers";

// Schémas de validation
const CreateBadgeSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(255, "Le nom ne peut pas dépasser 255 caractères"),
  description: z.string().min(1, "La description est requise"),
  icone: z.string().min(1, "L'icône est requise").max(100),
  couleur: z.string().min(1, "La couleur est requise").max(50),
  type: z.enum(["Automatique", "Manuel"]).default("Manuel"),
  condition: z.string().optional(),
  actif: z.boolean().default(true),
  ordre: z.number().int().min(0).default(0),
});

const UpdateBadgeSchema = z.object({
  id: z.string().min(1, "ID requis"),
  nom: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  icone: z.string().min(1).max(100).optional(),
  couleur: z.string().min(1).max(50).optional(),
  type: z.enum(["Automatique", "Manuel"]).optional(),
  condition: z.string().optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().min(0).optional(),
});

const AttribuerBadgeSchema = z.object({
  badgeId: z.string().min(1, "ID du badge requis"),
  userId: z.string().min(1, "ID de l'utilisateur requis"),
  raison: z.string().optional(),
});

/**
 * Récupérer tous les badges
 */
export async function getAllBadges() {
  try {
    const badges = await safeFindMany(prisma.badge.findMany({
      orderBy: [
        { ordre: "asc" },
        { nom: "asc" },
      ],
    }));

    return { success: true, data: badges };
  } catch (error) {
    console.error("Erreur lors de la récupération des badges:", error);
    return { success: false, error: "Erreur lors de la récupération des badges" };
  }
}

/**
 * Récupérer les badges actifs
 */
export async function getActiveBadges() {
  try {
    const badges = await safeFindMany(prisma.badge.findMany({
      where: { actif: true },
      orderBy: [
        { ordre: "asc" },
        { nom: "asc" },
      ],
    }));

    return { success: true, data: badges };
  } catch (error) {
    console.error("Erreur lors de la récupération des badges actifs:", error);
    return { success: false, error: "Erreur lors de la récupération des badges actifs" };
  }
}

/**
 * Récupérer un badge par son ID
 */
export async function getBadgeById(id: string) {
  try {
    const badge = await prisma.badge.findUnique({
      where: { id },
      include: {
        Attributions: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10, // Dernières 10 attributions
        },
      },
    });

    if (!badge) {
      return { success: false, error: "Badge introuvable" };
    }

    return { success: true, data: badge };
  } catch (error) {
    console.error("Erreur lors de la récupération du badge:", error);
    return { success: false, error: "Erreur lors de la récupération du badge" };
  }
}

/**
 * Récupérer les badges d'un utilisateur
 */
export async function getUserBadges(userId: string) {
  try {
    const attributions = await prisma.badgeAttribution.findMany({
      where: { userId },
      include: {
        Badge: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: attributions };
  } catch (error) {
    console.error("Erreur lors de la récupération des badges de l'utilisateur:", error);
    return { success: false, error: "Erreur lors de la récupération des badges" };
  }
}

/**
 * Créer un nouveau badge (admin uniquement)
 */
export async function createBadge(data: z.infer<typeof CreateBadgeSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateBadgeSchema.parse(data);

    const badge = await prisma.badge.create({
      data: validatedData,
    });

    revalidatePath("/admin/badges");
    return { success: true, data: badge, message: "Badge créé avec succès" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du badge:", error);
    return { success: false, error: "Erreur lors de la création du badge" };
  }
}

/**
 * Mettre à jour un badge (admin uniquement)
 */
export async function updateBadge(data: z.infer<typeof UpdateBadgeSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateBadgeSchema.parse(data);
    const { id, ...updateData } = validatedData;

    const badge = await prisma.badge.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/badges");
    return { success: true, data: badge, message: "Badge mis à jour avec succès" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du badge:", error);
    return { success: false, error: "Erreur lors de la mise à jour du badge" };
  }
}

/**
 * Supprimer un badge (admin uniquement)
 */
export async function deleteBadge(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.badge.delete({
      where: { id },
    });

    revalidatePath("/admin/badges");
    return { success: true, message: "Badge supprimé avec succès" };
  } catch (error) {
    console.error("Erreur lors de la suppression du badge:", error);
    return { success: false, error: "Erreur lors de la suppression du badge" };
  }
}

/**
 * Attribuer un badge à un utilisateur (admin uniquement)
 */
export async function attribuerBadge(data: z.infer<typeof AttribuerBadgeSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = AttribuerBadgeSchema.parse(data);

    // Vérifier que le badge existe
    const badge = await prisma.badge.findUnique({
      where: { id: validatedData.badgeId },
    });

    if (!badge) {
      return { success: false, error: "Badge introuvable" };
    }

    if (!badge.actif) {
      return { success: false, error: "Ce badge n'est pas actif" };
    }

    // Vérifier si le badge n'est pas déjà attribué
    const existing = await prisma.badgeAttribution.findUnique({
      where: {
        badgeId_userId: {
          badgeId: validatedData.badgeId,
          userId: validatedData.userId,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Ce badge est déjà attribué à cet utilisateur" };
    }

    // Attribuer le badge
    const attribution = await prisma.badgeAttribution.create({
      data: {
        badgeId: validatedData.badgeId,
        userId: validatedData.userId,
        attribuePar: session.user.id,
        raison: validatedData.raison,
      },
      include: {
        Badge: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath("/admin/badges");
    revalidatePath(`/user/profile`);
    revalidatePath(`/admin/users/${validatedData.userId}/consultation`);

    return { 
      success: true, 
      data: attribution, 
      message: `Badge "${badge.nom}" attribué avec succès` 
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de l'attribution du badge:", error);
    return { success: false, error: "Erreur lors de l'attribution du badge" };
  }
}

/**
 * Retirer un badge d'un utilisateur (admin uniquement)
 */
export async function retirerBadge(badgeId: string, userId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.badgeAttribution.delete({
      where: {
        badgeId_userId: {
          badgeId,
          userId,
        },
      },
    });

    revalidatePath("/admin/badges");
    revalidatePath(`/user/profile`);
    revalidatePath(`/admin/users/${userId}/consultation`);

    return { success: true, message: "Badge retiré avec succès" };
  } catch (error) {
    console.error("Erreur lors du retrait du badge:", error);
    return { success: false, error: "Erreur lors du retrait du badge" };
  }
}

/**
 * Vérifier et attribuer les badges automatiques pour un utilisateur
 */
export async function verifierBadgesAutomatiques(userId: string) {
  try {
    // Récupérer tous les badges automatiques actifs
    const badgesAutomatiques = await prisma.badge.findMany({
      where: {
        type: "Automatique",
        actif: true,
      },
    });

    const badgesAttribues: string[] = [];

    for (const badge of badgesAutomatiques) {
      // Vérifier si le badge est déjà attribué
      const existing = await prisma.badgeAttribution.findUnique({
        where: {
          badgeId_userId: {
            badgeId: badge.id,
            userId,
          },
        },
      });

      if (existing) continue;

      // Vérifier la condition du badge
      let conditionMet = false;

      try {
        if (badge.condition) {
          const condition = JSON.parse(badge.condition);
          conditionMet = await evaluerConditionBadge(userId, condition);
        }
      } catch (error) {
        console.error(`Erreur lors de l'évaluation de la condition pour le badge ${badge.id}:`, error);
        continue;
      }

      if (conditionMet) {
        // Attribuer le badge
        await prisma.badgeAttribution.create({
          data: {
            badgeId: badge.id,
            userId,
            attribuePar: null, // Automatique
            raison: "Attribution automatique",
          },
        });

        badgesAttribues.push(badge.id);
      }
    }

    if (badgesAttribues.length > 0) {
      revalidatePath(`/user/profile`);
      revalidatePath(`/admin/users/${userId}/consultation`);
    }

    return { 
      success: true, 
      data: { badgesAttribues: badgesAttribues.length },
      message: `${badgesAttribues.length} badge(s) automatique(s) attribué(s)` 
    };
  } catch (error) {
    console.error("Erreur lors de la vérification des badges automatiques:", error);
    return { success: false, error: "Erreur lors de la vérification des badges automatiques" };
  }
}

/**
 * Évaluer une condition de badge automatique
 */
async function evaluerConditionBadge(userId: string, condition: any): Promise<boolean> {
  const { type, valeur } = condition;

  switch (type) {
    case "premiere_cotisation":
      // Vérifier si l'utilisateur a payé au moins une cotisation
      const cotisations = await prisma.cotisationMensuelle.findFirst({
        where: {
          adherentId: userId,
          statut: { in: ["Paye", "PartiellementPaye"] },
        },
      });
      return !!cotisations;

    case "cotisant_actif":
      // Vérifier si l'utilisateur a payé 3 cotisations consécutives
      const cotisationsRecentes = await prisma.cotisationMensuelle.findMany({
        where: {
          adherentId: userId,
          statut: "Paye",
        },
        orderBy: {
          periode: "desc",
        },
        take: 3,
      });
      return cotisationsRecentes.length >= 3;

    case "participation_evenement":
      // Vérifier si l'utilisateur a participé à au moins un événement
      const inscriptions = await prisma.inscriptionEvenement.findFirst({
        where: {
          adherentId: userId,
        },
      });
      return !!inscriptions;

    case "idee_validee":
      // Vérifier si l'utilisateur a une idée validée
      const idees = await prisma.idee.findFirst({
        where: {
          adherentId: userId,
          statut: "Validee",
        },
      });
      return !!idees;

    case "participation_vote":
      // Vérifier si l'utilisateur a participé à un vote
      const votes = await prisma.vote.findFirst({
        where: {
          adherentId: userId,
        },
      });
      return !!votes;

    case "anciennete":
      // Vérifier l'ancienneté (en années)
      const adherent = await prisma.adherent.findUnique({
        where: { id: userId },
        select: { datePremiereAdhesion: true },
      });
      if (!adherent?.datePremiereAdhesion) return false;
      const annees = Math.floor(
        (new Date().getTime() - new Date(adherent.datePremiereAdhesion).getTime()) / 
        (1000 * 60 * 60 * 24 * 365)
      );
      return annees >= (valeur || 1);

    case "fidélite":
      // Vérifier l'ancienneté de 3 ans
      const adherentFidelite = await prisma.adherent.findUnique({
        where: { id: userId },
        select: { datePremiereAdhesion: true },
      });
      if (!adherentFidelite?.datePremiereAdhesion) return false;
      const anneesFidelite = Math.floor(
        (new Date().getTime() - new Date(adherentFidelite.datePremiereAdhesion).getTime()) / 
        (1000 * 60 * 60 * 24 * 365)
      );
      return anneesFidelite >= 3;

    default:
      return false;
  }
}

