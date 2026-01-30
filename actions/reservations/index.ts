"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole, TypeRessource, StatutReservation } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isAfter, isBefore, addDays, startOfDay, endOfDay } from "date-fns";
import { safeFindMany } from "@/lib/prisma-helpers";

const CreateRessourceSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(255, "Le nom est trop long"),
  type: z.nativeEnum(TypeRessource),
  description: z.string().optional(),
  capacite: z.number().int().positive().optional(),
  localisation: z.string().max(255).optional(),
  image: z.string().max(500).optional(),
  actif: z.boolean().default(true),
  reservable: z.boolean().default(true),
  horairesOuverture: z.string().optional(),
  tarifHoraire: z.number().positive().optional(),
  tarifJournalier: z.number().positive().optional(),
});

const CreateReservationSchema = z.object({
  ressourceId: z.string().min(1, "La ressource est requise"),
  adherentId: z.string().optional(),
  dateDebut: z.date(),
  dateFin: z.date(),
  motif: z.string().optional(),
  nombrePersonnes: z.number().int().positive().optional(),
  commentaires: z.string().optional(),
  visiteurNom: z.string().max(255).optional(),
  visiteurEmail: z.string().email().optional(),
  visiteurTelephone: z.string().max(20).optional(),
}).refine((data) => isAfter(data.dateFin, data.dateDebut), {
  message: "La date de fin doit être après la date de début",
  path: ["dateFin"],
});

/**
 * Crée une nouvelle ressource
 */
export async function createRessource(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé." };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createRessource");
    if (!hasAccess) {
      return { success: false, error: "Droit de création de ressource requis." };
    }

    const rawData = {
      nom: formData.get("nom") as string,
      type: formData.get("type") as TypeRessource,
      description: formData.get("description") as string | undefined,
      capacite: formData.get("capacite") ? parseInt(formData.get("capacite") as string) : undefined,
      localisation: formData.get("localisation") as string | undefined,
      image: formData.get("image") as string | undefined,
      actif: formData.get("actif") === "true",
      reservable: formData.get("reservable") === "true",
      horairesOuverture: formData.get("horairesOuverture") as string | undefined,
      tarifHoraire: formData.get("tarifHoraire") ? parseFloat(formData.get("tarifHoraire") as string) : undefined,
      tarifJournalier: formData.get("tarifJournalier") ? parseFloat(formData.get("tarifJournalier") as string) : undefined,
    };

    const validatedData = CreateRessourceSchema.parse(rawData);

    const ressource = await prisma.ressource.create({
      data: {
        ...validatedData,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/admin/reservations");
    return {
      success: true,
      message: "Ressource créée avec succès",
      id: ressource.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de la ressource:", error);
    return { success: false, error: "Erreur lors de la création de la ressource" };
  }
}

/**
 * Récupère toutes les ressources
 */
export async function getAllRessources() {
  try {
    const ressources = await safeFindMany(prisma.ressource.findMany({
      include: {
        _count: {
          select: {
            reservations: true,
          },
        },
      },
      orderBy: {
        nom: "asc",
      },
    }));

    return {
      success: true,
      data: ressources,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des ressources:", error);
    return { success: false, error: "Erreur lors de la récupération des ressources" };
  }
}

/**
 * Crée une nouvelle réservation
 */
export async function createReservation(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createReservation");
    if (!hasAccess) {
      return { success: false, error: "Droit de création de réservation requis." };
    }

    // Récupérer l'adhérent si connecté (admin peut choisir un adhérent, sinon on utilise l'adhérent connecté)
    let adherentId: string | undefined;
    if (session.user.role !== UserRole.ADMIN) {
      const adherent = await prisma.adherent.findUnique({
        where: { userId: session.user.id },
      });
      adherentId = adherent?.id;
    } else {
      adherentId = formData.get("adherentId") as string | undefined;
    }

    const rawData = {
      ressourceId: formData.get("ressourceId") as string,
      adherentId,
      dateDebut: new Date(formData.get("dateDebut") as string),
      dateFin: new Date(formData.get("dateFin") as string),
      motif: formData.get("motif") as string | undefined,
      nombrePersonnes: formData.get("nombrePersonnes") ? parseInt(formData.get("nombrePersonnes") as string) : undefined,
      commentaires: formData.get("commentaires") as string | undefined,
      visiteurNom: formData.get("visiteurNom") as string | undefined,
      visiteurEmail: formData.get("visiteurEmail") as string | undefined,
      visiteurTelephone: formData.get("visiteurTelephone") as string | undefined,
    };

    const validatedData = CreateReservationSchema.parse(rawData);

    // Vérifier que la ressource existe et est réservable
    const ressource = await prisma.ressource.findUnique({
      where: { id: validatedData.ressourceId },
    });

    if (!ressource) {
      return { success: false, error: "Ressource non trouvée" };
    }

    if (!ressource.reservable || !ressource.actif) {
      return { success: false, error: "Cette ressource n'est pas réservable" };
    }

    // Vérifier les conflits de réservation
    const conflits = await prisma.reservation.findMany({
      where: {
        ressourceId: validatedData.ressourceId,
        statut: {
          not: StatutReservation.Annulee,
        },
        OR: [
          {
            AND: [
              { dateDebut: { lte: validatedData.dateDebut } },
              { dateFin: { gte: validatedData.dateDebut } },
            ],
          },
          {
            AND: [
              { dateDebut: { lte: validatedData.dateFin } },
              { dateFin: { gte: validatedData.dateFin } },
            ],
          },
          {
            AND: [
              { dateDebut: { gte: validatedData.dateDebut } },
              { dateFin: { lte: validatedData.dateFin } },
            ],
          },
        ],
      },
    });

    if (conflits.length > 0) {
      return {
        success: false,
        error: "Cette ressource est déjà réservée pour cette période",
      };
    }

    // Calculer la durée en heures
    const dureeHeures = (validatedData.dateFin.getTime() - validatedData.dateDebut.getTime()) / (1000 * 60 * 60);

    const reservation = await prisma.reservation.create({
      data: {
        ...validatedData,
        dureeHeures,
        statut: StatutReservation.EnAttente,
      },
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/reservations");

    return {
      success: true,
      message: "Réservation créée avec succès",
      id: reservation.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de la réservation:", error);
    return { success: false, error: "Erreur lors de la création de la réservation" };
  }
}

/**
 * Récupère toutes les réservations
 */
export async function getAllReservations() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllReservations");
    if (!hasAccess) {
      return { success: false, error: "Droit de consultation des réservations requis." };
    }

    const reservations = await safeFindMany(prisma.reservation.findMany({
      include: {
        Ressource: true,
        Adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        dateDebut: "desc",
      },
    }));

    return {
      success: true,
      data: reservations,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations:", error);
    return { success: false, error: "Erreur lors de la récupération des réservations" };
  }
}

/**
 * Confirme une réservation
 */
export async function confirmerReservation(reservationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé." };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "confirmerReservation");
    if (!hasAccess) {
      return { success: false, error: "Droit de confirmation des réservations requis." };
    }

    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        statut: StatutReservation.Confirmee,
        confirmeePar: session.user.id,
        dateConfirmation: new Date(),
      },
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/reservations");

    return {
      success: true,
      message: "Réservation confirmée avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la confirmation:", error);
    return { success: false, error: "Erreur lors de la confirmation" };
  }
}

/**
 * Annule une réservation
 */
export async function annulerReservation(reservationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur peut annuler cette réservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
      },
    });

    if (!reservation) {
      return { success: false, error: "Réservation non trouvée" };
    }

    // Seul un utilisateur avec droit d'annulation ou le propriétaire peut annuler
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasCancelRight = await canWrite(session.user.id, "annulerReservation");
    const isOwner = reservation.Adherent?.userId === session.user.id;
    if (!hasCancelRight && !isOwner) {
      return { success: false, error: "Vous n'êtes pas autorisé à annuler cette réservation" };
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        statut: StatutReservation.Annulee,
      },
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/reservations");

    return {
      success: true,
      message: "Réservation annulée avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de l'annulation:", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}

/**
 * Récupère les réservations pour une ressource et une période
 */
export async function getReservationsByRessource(ressourceId: string, dateDebut?: Date, dateFin?: Date) {
  try {
    const where: any = {
      ressourceId,
      statut: {
        not: StatutReservation.Annulee,
      },
    };

    if (dateDebut && dateFin) {
      where.OR = [
        {
          AND: [
            { dateDebut: { gte: dateDebut } },
            { dateDebut: { lte: dateFin } },
          ],
        },
        {
          AND: [
            { dateFin: { gte: dateDebut } },
            { dateFin: { lte: dateFin } },
          ],
        },
        {
          AND: [
            { dateDebut: { lte: dateDebut } },
            { dateFin: { gte: dateFin } },
          ],
        },
      ];
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        dateDebut: "asc",
      },
    });

    return {
      success: true,
      data: reservations,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération:", error);
    return { success: false, error: "Erreur lors de la récupération" };
  }
}

/**
 * Récupère les statistiques des réservations
 */
export async function getReservationsStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getReservationsStats");
    if (!hasAccess) {
      return { success: false, error: "Droit de consultation des statistiques réservations requis." };
    }

    // Helper pour gérer l'absence de table
    const safeCount = async (query: Promise<number>): Promise<number> => {
      try {
        return await query;
      } catch (error: any) {
        // Si la table n'existe pas (code P2021 pour Prisma)
        if (error?.code === 'P2021') {
          return 0;
        }
        throw error;
      }
    };

    const [
      totalReservations,
      reservationsEnAttente,
      reservationsConfirmees,
      reservationsAujourdhui,
      ressourcesActives,
    ] = await Promise.all([
      safeCount(prisma.reservation.count()),
      safeCount(prisma.reservation.count({
        where: { statut: StatutReservation.EnAttente },
      })),
      safeCount(prisma.reservation.count({
        where: { statut: StatutReservation.Confirmee },
      })),
      safeCount(prisma.reservation.count({
        where: {
          dateDebut: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date()),
          },
          statut: {
            not: StatutReservation.Annulee,
          },
        },
      })),
      safeCount(prisma.ressource.count({
        where: { actif: true, reservable: true },
      })),
    ]);

    return {
      success: true,
      data: {
        totalReservations,
        reservationsEnAttente,
        reservationsConfirmees,
        reservationsAujourdhui,
        ressourcesActives,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

