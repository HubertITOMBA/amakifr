"use server"

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole, TypeAdhesion, TypeCotisation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Date limite pour considérer un adhérent comme "ancien" (10/10/2026)
const DATE_LIMITE_ANCIENS_ADHERENTS = new Date("2026-10-10");

// Schémas de validation
const UpdateConfigurationFraisAdhesionSchema = z.object({
  montant: z.number().positive("Le montant doit être positif"),
  description: z.string().optional(),
});

const MarquerAncienAdherentSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  datePremiereAdhesion: z.date().optional(),
});

const CreerObligationFraisAdhesionSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
});

const MarquerFraisAdhesionPayeSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  datePaiement: z.date(),
  montant: z.number().positive("Le montant doit être positif"),
});

/**
 * Récupère la configuration actuelle des frais d'adhésion
 * 
 * @returns La configuration active des frais d'adhésion ou null si aucune configuration n'existe
 */
export async function getConfigurationFraisAdhesion() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const config = await prisma.configurationFraisAdhesion.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: config
        ? {
            ...config,
            montantFraisAdhesion: Number(config.montantFraisAdhesion),
          }
        : null,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la configuration:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Crée ou met à jour la configuration des frais d'adhésion
 * 
 * @param data - Les données contenant le montant et la description
 * @returns Un objet avec success (boolean) et message ou error
 */
export async function updateConfigurationFraisAdhesion(
  data: z.infer<typeof UpdateConfigurationFraisAdhesionSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = UpdateConfigurationFraisAdhesionSchema.parse(data);

    // Désactiver toutes les configurations existantes
    await prisma.configurationFraisAdhesion.updateMany({
      where: { actif: true },
      data: { actif: false },
    });

    // Créer une nouvelle configuration
    const nouvelleConfig = await prisma.configurationFraisAdhesion.create({
      data: {
        montantFraisAdhesion: validatedData.montant,
        description: validatedData.description || `Frais d'adhésion fixés à ${validatedData.montant.toFixed(2)}€`,
        actif: true,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/admin/finances/frais-adhesion");

    return {
      success: true,
      message: `Configuration des frais d'adhésion mise à jour : ${validatedData.montant.toFixed(2)}€`,
      data: {
        ...nouvelleConfig,
        montantFraisAdhesion: Number(nouvelleConfig.montantFraisAdhesion),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour de la configuration:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Récupère la liste des adhérents avec leur statut de frais d'adhésion
 * 
 * @returns La liste des adhérents avec leurs informations de frais d'adhésion
 */
export async function getAdherentsFraisAdhesion() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
          },
        },
        ObligationsCotisation: {
          where: {
            type: TypeCotisation.Adhesion,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: [
        { lastname: "asc" },
        { firstname: "asc" },
      ],
    });

    const adherentsWithStatus = adherents.map((adherent) => {
      const obligationAdhesion = adherent.ObligationsCotisation.find(
        (obligation) => obligation.type === TypeCotisation.Adhesion
      );

      return {
        id: adherent.id,
        firstname: adherent.firstname,
        lastname: adherent.lastname,
        email: adherent.User?.email || null,
        status: adherent.User?.status || "Inactif",
        typeAdhesion: adherent.typeAdhesion,
        datePremiereAdhesion: adherent.datePremiereAdhesion,
        fraisAdhesionPaye: adherent.fraisAdhesionPaye,
        datePaiementFraisAdhesion: adherent.datePaiementFraisAdhesion,
        estAncienAdherent: adherent.estAncienAdherent,
        obligationAdhesion: obligationAdhesion
          ? {
              id: obligationAdhesion.id,
              montantAttendu: Number(obligationAdhesion.montantAttendu),
              montantPaye: Number(obligationAdhesion.montantPaye),
              montantRestant: Number(obligationAdhesion.montantRestant),
              statut: obligationAdhesion.statut,
              dateEcheance: obligationAdhesion.dateEcheance,
            }
          : null,
      };
    });

    return { success: true, data: adherentsWithStatus };
  } catch (error) {
    console.error("Erreur lors de la récupération des adhérents:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Marque un adhérent comme ancien adhérent
 * 
 * @param data - Les données contenant l'ID de l'adhérent et optionnellement la date de première adhésion
 * @returns Un objet avec success (boolean) et message ou error
 */
export async function marquerAncienAdherent(
  data: z.infer<typeof MarquerAncienAdherentSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = MarquerAncienAdherentSchema.parse(data);

    const adherent = await prisma.adherent.findUnique({
      where: { id: validatedData.adherentId },
      include: {
        ObligationsCotisation: {
          where: {
            type: TypeCotisation.Adhesion,
            statut: { not: "Paye" },
          },
        },
      },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Supprimer les obligations de frais d'adhésion non payées
    if (adherent.ObligationsCotisation.length > 0) {
      await prisma.obligationCotisation.deleteMany({
        where: {
          id: { in: adherent.ObligationsCotisation.map((ob) => ob.id) },
        },
      });
    }

    // Mettre à jour l'adhérent
    const updatedAdherent = await prisma.adherent.update({
      where: { id: validatedData.adherentId },
      data: {
        estAncienAdherent: true,
        fraisAdhesionPaye: true,
        typeAdhesion: TypeAdhesion.Renouvellement,
        datePremiereAdhesion: validatedData.datePremiereAdhesion || adherent.datePremiereAdhesion || new Date(),
        datePaiementFraisAdhesion: validatedData.datePremiereAdhesion || adherent.datePaiementFraisAdhesion || new Date(),
      },
    });

    revalidatePath("/admin/finances/frais-adhesion");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: `L'adhérent ${updatedAdherent.firstname} ${updatedAdherent.lastname} a été marqué comme ancien adhérent.`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors du marquage de l'ancien adhérent:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Crée manuellement une obligation de frais d'adhésion pour un adhérent
 * 
 * @param data - Les données contenant l'ID de l'adhérent
 * @returns Un objet avec success (boolean) et message ou error
 */
export async function creerObligationFraisAdhesion(
  data: z.infer<typeof CreerObligationFraisAdhesionSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = CreerObligationFraisAdhesionSchema.parse(data);

    const adherent = await prisma.adherent.findUnique({
      where: { id: validatedData.adherentId },
      include: {
        ObligationsCotisation: {
          where: {
            type: TypeCotisation.Adhesion,
            statut: { not: "Paye" },
          },
        },
      },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    if (adherent.fraisAdhesionPaye) {
      return { success: false, error: "Les frais d'adhésion ont déjà été payés pour cet adhérent." };
    }

    if (adherent.ObligationsCotisation.length > 0) {
      return { success: false, error: "Une obligation de frais d'adhésion existe déjà pour cet adhérent." };
    }

    // Récupérer la configuration des frais d'adhésion
    const config = await prisma.configurationFraisAdhesion.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return { success: false, error: "Aucune configuration de frais d'adhésion trouvée. Veuillez configurer les frais d'adhésion d'abord." };
    }

    const montantFraisAdhesion = Number(config.montantFraisAdhesion);

    // Créer l'obligation
    const obligation = await prisma.obligationCotisation.create({
      data: {
        adherentId: validatedData.adherentId,
        type: TypeCotisation.Adhesion,
        montantAttendu: montantFraisAdhesion,
        montantPaye: 0,
        montantRestant: montantFraisAdhesion,
        dateEcheance: new Date(),
        periode: `Adhesion-${new Date().getFullYear()}`,
        statut: "EnAttente",
        description: `Frais d'adhésion pour l'année ${new Date().getFullYear()}`,
      },
    });

    // Mettre à jour l'adhérent
    await prisma.adherent.update({
      where: { id: validatedData.adherentId },
      data: {
        typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
        estAncienAdherent: false,
      },
    });

    revalidatePath("/admin/finances/frais-adhesion");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: `Obligation de frais d'adhésion créée pour ${adherent.firstname} ${adherent.lastname} (${montantFraisAdhesion.toFixed(2)}€).`,
      data: {
        ...obligation,
        montantAttendu: Number(obligation.montantAttendu),
        montantPaye: Number(obligation.montantPaye),
        montantRestant: Number(obligation.montantRestant),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de l'obligation:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Marque les frais d'adhésion comme payés pour un adhérent
 * 
 * @param data - Les données contenant l'ID de l'adhérent, la date de paiement et le montant
 * @returns Un objet avec success (boolean) et message ou error
 */
export async function marquerFraisAdhesionPaye(
  data: z.infer<typeof MarquerFraisAdhesionPayeSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = MarquerFraisAdhesionPayeSchema.parse(data);

    const adherent = await prisma.adherent.findUnique({
      where: { id: validatedData.adherentId },
      include: {
        ObligationsCotisation: {
          where: {
            type: TypeCotisation.Adhesion,
          },
        },
      },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Mettre à jour ou créer l'obligation
    let obligation = adherent.ObligationsCotisation.find(
      (ob) => ob.type === TypeCotisation.Adhesion
    );

    if (obligation) {
      obligation = await prisma.obligationCotisation.update({
        where: { id: obligation.id },
        data: {
          montantPaye: validatedData.montant,
          montantRestant: Math.max(0, Number(obligation.montantAttendu) - validatedData.montant),
          statut: validatedData.montant >= Number(obligation.montantAttendu) ? "Paye" : "PartiellementPaye",
        },
      });
    } else {
      // Créer une obligation si elle n'existe pas
      obligation = await prisma.obligationCotisation.create({
        data: {
          adherentId: validatedData.adherentId,
          type: TypeCotisation.Adhesion,
          montantAttendu: validatedData.montant,
          montantPaye: validatedData.montant,
          montantRestant: 0,
          dateEcheance: validatedData.datePaiement,
          periode: `Adhesion-${validatedData.datePaiement.getFullYear()}`,
          statut: "Paye",
          description: `Frais d'adhésion payés le ${validatedData.datePaiement.toLocaleDateString("fr-FR")}`,
        },
      });
    }

    // Mettre à jour l'adhérent
    await prisma.adherent.update({
      where: { id: validatedData.adherentId },
      data: {
        fraisAdhesionPaye: true,
        datePaiementFraisAdhesion: validatedData.datePaiement,
        typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
      },
    });

    revalidatePath("/admin/finances/frais-adhesion");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: `Les frais d'adhésion ont été marqués comme payés pour ${adherent.firstname} ${adherent.lastname}.`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors du marquage des frais comme payés:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Détermine si un adhérent est considéré comme "ancien" basé sur les critères
 * 
 * @param adherent - L'objet adhérent avec ses propriétés
 * @returns true si l'adhérent est considéré comme ancien, false sinon
 */
export async function estAncienAdherent(adherent: {
  estAncienAdherent?: boolean;
  datePremiereAdhesion?: Date | null;
  created_at?: Date | null;
}): Promise<boolean> {
  // Si flag manuel activé
  if (adherent.estAncienAdherent) {
    return true;
  }

  // Si date de première adhésion renseignée et antérieure à la date limite
  if (adherent.datePremiereAdhesion && adherent.datePremiereAdhesion < DATE_LIMITE_ANCIENS_ADHERENTS) {
    return true;
  }

  // Si création de l'adhérent avant la date limite
  if (adherent.created_at && new Date(adherent.created_at) < DATE_LIMITE_ANCIENS_ADHERENTS) {
    return true;
  }

  return false;
}

