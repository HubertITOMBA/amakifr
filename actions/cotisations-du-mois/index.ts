"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Schémas de validation
const CreateCotisationDuMoisSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  mois: z.number().int().min(1).max(12),
  typeCotisationId: z.string().min(1, "Le type de cotisation est requis"),
  montantBase: z.number().min(0, "Le montant doit être positif"),
  dateEcheance: z.string().min(1, "La date d'échéance est requise"),
  description: z.string().optional(),
});

const UpdateCotisationDuMoisSchema = z.object({
  id: z.string().min(1, "L'ID est requis"),
  montantBase: z.number().min(0, "Le montant doit être positif").optional(),
  dateEcheance: z.string().optional(),
  description: z.string().optional(),
  statut: z.enum(["Planifie", "Cree", "Annule"]).optional(),
  adherentBeneficiaireId: z.string().optional(),
});

/**
 * Crée une nouvelle cotisation du mois
 * 
 * @param formData - Les données du formulaire contenant les champs de la cotisation du mois
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et id (string) de la cotisation créée
 */
export async function createCotisationDuMois(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      annee: parseInt(formData.get("annee") as string),
      mois: parseInt(formData.get("mois") as string),
      typeCotisationId: formData.get("typeCotisationId") as string,
      montantBase: parseFloat(formData.get("montantBase") as string),
      dateEcheance: formData.get("dateEcheance") as string,
      description: formData.get("description") as string || undefined,
      adherentBeneficiaireId: formData.get("adherentBeneficiaireId") as string || undefined,
    };

    const validatedData = CreateCotisationDuMoisSchema.parse(rawData);
    const periode = `${validatedData.annee}-${validatedData.mois.toString().padStart(2, '0')}`;

    // Vérifier que le type de cotisation existe
    const typeCotisation = await db.typeCotisationMensuelle.findUnique({
      where: { id: validatedData.typeCotisationId },
    });

    if (!typeCotisation) {
      return { success: false, error: "Type de cotisation introuvable" };
    }

    // Vérifications selon le type de cotisation
    if (typeCotisation.aBeneficiaire && validatedData.adherentBeneficiaireId) {
      // Pour les assistances (avec bénéficiaire) :
      // - Un adhérent ne peut avoir qu'une seule assistance par mois (peu importe le type)
      // - Plusieurs assistances du même type sont possibles si elles sont pour des adhérents différents
      const existingAssistance = await db.cotisationDuMois.findFirst({
        where: {
          periode,
          adherentBeneficiaireId: validatedData.adherentBeneficiaireId,
        },
      });

      if (existingAssistance) {
        const existingType = await db.typeCotisationMensuelle.findUnique({
          where: { id: existingAssistance.typeCotisationId },
        });
        return { 
          success: false, 
          error: `L'adhérent bénéficiaire a déjà une assistance pour ${periode} (${existingType?.nom || "type inconnu"})` 
        };
      }
    } else {
      // Pour les types sans bénéficiaire (forfait, etc.) :
      // - Un seul par période et type
      const existing = await db.cotisationDuMois.findFirst({
        where: {
          periode,
          typeCotisationId: validatedData.typeCotisationId,
          adherentBeneficiaireId: null,
        },
      });

      if (existing) {
        return { 
          success: false, 
          error: `Une cotisation du mois existe déjà pour ${periode} avec ce type de cotisation (${typeCotisation.nom})` 
        };
      }
    }

    // Créer la cotisation du mois
    const newCotisation = await db.cotisationDuMois.create({
      data: {
        periode,
        annee: validatedData.annee,
        mois: validatedData.mois,
        typeCotisationId: validatedData.typeCotisationId,
        montantBase: new Decimal(validatedData.montantBase),
        dateEcheance: new Date(validatedData.dateEcheance),
        description: validatedData.description,
        adherentBeneficiaireId: validatedData.adherentBeneficiaireId,
        statut: "Planifie",
        createdBy: session.user.id,
      },
      include: {
        TypeCotisation: true,
        CreatedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return { 
      success: true, 
      message: `Cotisation du mois créée avec succès pour ${periode}`,
      id: newCotisation.id,
      data: {
        ...newCotisation,
        montantBase: Number(newCotisation.montantBase),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de la cotisation du mois:", error);
    return { success: false, error: "Erreur lors de la création de la cotisation du mois" };
  } finally {
    revalidatePath("/admin/cotisations-du-mois");
  }
}

/**
 * Met à jour une cotisation du mois
 * 
 * @param formData - Les données du formulaire contenant l'ID et les champs à modifier
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateCotisationDuMois(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      id: formData.get("id") as string,
      montantBase: formData.get("montantBase") ? parseFloat(formData.get("montantBase") as string) : undefined,
      dateEcheance: formData.get("dateEcheance") as string || undefined,
      description: formData.get("description") as string || undefined,
      statut: formData.get("statut") as string || undefined,
      adherentBeneficiaireId: formData.get("adherentBeneficiaireId") as string || undefined,
    };

    const validatedData = UpdateCotisationDuMoisSchema.parse(rawData);

    // Vérifier que la cotisation existe
    const existing = await db.cotisationDuMois.findUnique({
      where: { id: validatedData.id },
    });

    if (!existing) {
      return { success: false, error: "Cotisation du mois introuvable" };
    }

    // Vérifier que la modification est autorisée (mois en cours ou prochain uniquement)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const canModify = 
      (existing.annee === currentYear && existing.mois === currentMonth) ||
      (existing.annee === nextYear && existing.mois === nextMonth);

    if (!canModify) {
      return { 
        success: false, 
        error: `Impossible de modifier une cotisation du mois passée. Seules les cotisations du mois en cours (${currentYear}-${currentMonth.toString().padStart(2, '0')}) ou du mois prochain (${nextYear}-${nextMonth.toString().padStart(2, '0')}) peuvent être modifiées.` 
      };
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (validatedData.montantBase !== undefined) {
      updateData.montantBase = new Decimal(validatedData.montantBase);
    }
    if (validatedData.dateEcheance) {
      updateData.dateEcheance = new Date(validatedData.dateEcheance);
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.statut) {
      updateData.statut = validatedData.statut;
    }
    if (validatedData.adherentBeneficiaireId !== undefined) {
      updateData.adherentBeneficiaireId = validatedData.adherentBeneficiaireId || null;
    }

    // Mettre à jour la cotisation
    const updated = await db.cotisationDuMois.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        TypeCotisation: true,
        CreatedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return { 
      success: true, 
      message: "Cotisation du mois mise à jour avec succès",
      data: {
        ...updated,
        montantBase: Number(updated.montantBase),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour de la cotisation du mois:", error);
    return { success: false, error: "Erreur lors de la mise à jour de la cotisation du mois" };
  } finally {
    revalidatePath("/admin/cotisations-du-mois");
  }
}

/**
 * Supprime une cotisation du mois
 * 
 * @param id - L'identifiant de la cotisation à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function deleteCotisationDuMois(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que la cotisation existe
    const existing = await db.cotisationDuMois.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            CotisationsMensuelles: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Cotisation du mois introuvable" };
    }

    // Vérifier si des cotisations mensuelles ont été créées à partir de cette planification
    if (existing._count.CotisationsMensuelles > 0) {
      return { 
        success: false, 
        error: `Impossible de supprimer cette cotisation du mois car ${existing._count.CotisationsMensuelles} cotisation(s) mensuelle(s) ont été créée(s) à partir de celle-ci` 
      };
    }

    // Supprimer la cotisation
    await db.cotisationDuMois.delete({
      where: { id },
    });

    return { 
      success: true, 
      message: "Cotisation du mois supprimée avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de la cotisation du mois:", error);
    return { success: false, error: "Erreur lors de la suppression de la cotisation du mois" };
  } finally {
    revalidatePath("/admin/cotisations-du-mois");
  }
}

/**
 * Récupère toutes les cotisations du mois pour l'admin
 * 
 * @returns Un objet avec success (boolean), data (array de cotisations) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getAllCotisationsDuMois() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisations = await db.cotisationDuMois.findMany({
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
            ordre: true,
            aBeneficiaire: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            CotisationsMensuelles: true,
          },
        },
      },
      orderBy: [
        { annee: 'desc' },
        { mois: 'desc' },
        { TypeCotisation: { ordre: 'asc' } },
      ],
    });

    // Conversion des Decimal en nombres et vérification des relations (sérialisation complète pour éviter les erreurs de passage aux composants clients)
    const cotisationsConverted = cotisations.map((cotisation: any) => {
      if (!cotisation.TypeCotisation) {
        console.error(`[getAllCotisationsDuMois] Cotisation ${cotisation.id} a un TypeCotisation null`);
        throw new Error(`Type de cotisation manquant pour la cotisation ${cotisation.id}`);
      }
      if (!cotisation.CreatedBy) {
        console.error(`[getAllCotisationsDuMois] Cotisation ${cotisation.id} a un CreatedBy null`);
        throw new Error(`Créateur manquant pour la cotisation ${cotisation.id}`);
      }
      
      return {
        id: cotisation.id,
        periode: cotisation.periode,
        annee: cotisation.annee,
        mois: cotisation.mois,
        typeCotisationId: cotisation.typeCotisationId,
        montantBase: Number(cotisation.montantBase),
        dateEcheance: cotisation.dateEcheance,
        description: cotisation.description,
        statut: cotisation.statut,
        adherentBeneficiaireId: cotisation.adherentBeneficiaireId,
        createdBy: cotisation.createdBy,
        createdAt: cotisation.createdAt,
        updatedAt: cotisation.updatedAt,
        TypeCotisation: {
          id: cotisation.TypeCotisation.id,
          nom: cotisation.TypeCotisation.nom,
          description: cotisation.TypeCotisation.description,
          montant: Number(cotisation.TypeCotisation.montant),
          obligatoire: cotisation.TypeCotisation.obligatoire,
          ordre: cotisation.TypeCotisation.ordre,
          aBeneficiaire: cotisation.TypeCotisation.aBeneficiaire,
        },
        CreatedBy: {
          name: cotisation.CreatedBy.name,
          email: cotisation.CreatedBy.email,
        },
        _count: {
          CotisationsMensuelles: cotisation._count.CotisationsMensuelles,
        },
      };
    });

    return { success: true, data: cotisationsConverted };
  } catch (error) {
    console.error("Erreur lors de la récupération des cotisations du mois:", error);
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      console.error("Stack:", error.stack);
      return { success: false, error: `Erreur lors du chargement de cotisation du mois: ${error.message}` };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère une cotisation du mois par son ID
 * 
 * @param id - L'identifiant de la cotisation
 * @returns Un objet avec success (boolean), data (cotisation) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getCotisationDuMoisById(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisation = await db.cotisationDuMois.findUnique({
      where: { id },
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            CotisationsMensuelles: true,
          },
        },
      },
    });

    if (!cotisation) {
      return { success: false, error: "Cotisation du mois introuvable" };
    }

    return { 
      success: true, 
      data: {
        ...cotisation,
        montantBase: Number(cotisation.montantBase),
        TypeCotisation: {
          ...cotisation.TypeCotisation,
          montant: Number(cotisation.TypeCotisation.montant),
        },
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la cotisation du mois:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

