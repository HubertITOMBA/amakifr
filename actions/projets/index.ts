"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StatutProjet, StatutSousProjet } from "@prisma/client";
import { logCreation, logModification, logDeletion } from "@/lib/activity-logger";

// Schémas de validation
const CreateProjetSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre ne peut pas dépasser 255 caractères"),
  description: z.string().min(1, "La description est requise"),
  statut: z.enum(["Planifie", "EnCours", "EnPause", "Termine", "Annule"]).default("Planifie"),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

const UpdateProjetSchema = CreateProjetSchema.extend({
  id: z.string().min(1, "L'ID du projet est requis"),
});

const CreateSousProjetSchema = z.object({
  projetId: z.string().min(1, "L'ID du projet est requis"),
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre ne peut pas dépasser 255 caractères"),
  description: z.string().min(1, "La description est requise"),
  statut: z.enum(["APlanifier", "EnAttente", "EnCours", "EnPause", "Terminee", "Annulee"]).default("APlanifier"),
  ordre: z.number().int().min(0).default(0),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

const UpdateSousProjetSchema = CreateSousProjetSchema.extend({
  id: z.string().min(1, "L'ID du sous-projet est requis"),
});

const AffecterSousProjetSchema = z.object({
  sousProjetId: z.string().min(1, "L'ID du sous-projet est requis"),
  adherentIds: z.array(z.string()).min(1, "Au moins un adhérent doit être sélectionné"),
  responsable: z.boolean().default(false),
});

const CreateCommentaireTacheSchema = z.object({
  sousProjetId: z.string().min(1, "L'ID du sous-projet est requis"),
  contenu: z.string().min(1, "Le commentaire est requis"),
  pourcentageAvancement: z.number().int().min(0).max(100).optional(),
});

/**
 * Crée un nouveau projet
 */
export async function createProjet(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
      statut: formData.get("statut") as string || "Planifie",
      dateDebut: formData.get("dateDebut") as string || undefined,
      dateFin: formData.get("dateFin") as string || undefined,
    };

    const validatedData = CreateProjetSchema.parse(rawData);

    const projet = await db.projet.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        statut: validatedData.statut as StatutProjet,
        dateDebut: validatedData.dateDebut ? new Date(validatedData.dateDebut) : null,
        dateFin: validatedData.dateFin ? new Date(validatedData.dateFin) : null,
        createdBy: session.user.id,
      },
    });

    // Logger l'activité
    try {
      await logCreation(
        `Création du projet "${validatedData.titre}"`,
        "Projet",
        projet.id,
        {
          statut: validatedData.statut,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    return {
      success: true,
      message: `Projet "${validatedData.titre}" créé avec succès`,
      id: projet.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la création du projet" };
  }
}

/**
 * Met à jour un projet
 */
export async function updateProjet(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      id: formData.get("id") as string,
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
      statut: formData.get("statut") as string,
      dateDebut: formData.get("dateDebut") as string || undefined,
      dateFin: formData.get("dateFin") as string || undefined,
    };

    const validatedData = UpdateProjetSchema.parse(rawData);

    // Vérifier que le projet existe
    const existing = await db.projet.findUnique({
      where: { id: validatedData.id },
    });

    if (!existing) {
      return { success: false, error: "Projet non trouvé" };
    }

    const updateData: any = {
      titre: validatedData.titre,
      description: validatedData.description,
      statut: validatedData.statut as StatutProjet,
      dateDebut: validatedData.dateDebut ? new Date(validatedData.dateDebut) : null,
      dateFin: validatedData.dateFin ? new Date(validatedData.dateFin) : null,
    };

    // Si le projet est terminé, enregistrer la date de fin réelle
    if (validatedData.statut === "Termine" && !existing.dateFinReelle) {
      updateData.dateFinReelle = new Date();
    }

    const projet = await db.projet.update({
      where: { id: validatedData.id },
      data: updateData,
    });

    // Logger l'activité
    try {
      await logModification(
        `Modification du projet "${validatedData.titre}"`,
        "Projet",
        validatedData.id,
        {
          statut: validatedData.statut,
          fieldsUpdated: Object.keys(updateData),
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${validatedData.id}`);
    return {
      success: true,
      message: `Projet "${validatedData.titre}" mis à jour avec succès`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la mise à jour du projet" };
  }
}

/**
 * Supprime un projet
 */
export async function deleteProjet(projetId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer le projet avant suppression pour le logging
    const projet = await db.projet.findUnique({
      where: { id: projetId },
      select: { titre: true },
    });

    if (!projet) {
      return { success: false, error: "Projet non trouvé" };
    }

    await db.projet.delete({
      where: { id: projetId },
    });

    // Logger l'activité
    try {
      await logDeletion(
        `Suppression du projet "${projet.titre}"`,
        "Projet",
        projetId
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    return {
      success: true,
      message: `Projet "${projet.titre}" supprimé avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la suppression du projet" };
  }
}

/**
 * Récupère tous les projets
 */
export async function getAllProjets() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const projets = await db.projet.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        SousProjets: {
          include: {
            Affectations: {
              include: {
                Adherent: {
                  select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                  },
                },
              },
            },
            _count: {
              select: {
                Commentaires: true,
              },
            },
          },
          orderBy: {
            ordre: "asc",
          },
        },
        _count: {
          select: {
            SousProjets: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: projets };
  } catch (error) {
    console.error("Erreur lors de la récupération des projets:", error);
    return { success: false, error: "Erreur lors de la récupération des projets" };
  }
}

/**
 * Récupère un projet par son ID
 */
export async function getProjetById(projetId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const projet = await db.projet.findUnique({
      where: { id: projetId },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        SousProjets: {
          include: {
            Affectations: {
              include: {
                Adherent: {
                  select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    civility: true,
                  },
                },
              },
            },
            Commentaires: {
              include: {
                Adherent: {
                  select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    civility: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            ordre: "asc",
          },
        },
      },
    });

    if (!projet) {
      return { success: false, error: "Projet non trouvé" };
    }

    return { success: true, data: projet };
  } catch (error) {
    console.error("Erreur lors de la récupération du projet:", error);
    return { success: false, error: "Erreur lors de la récupération du projet" };
  }
}

/**
 * Crée un sous-projet/tâche
 */
export async function createSousProjet(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      projetId: formData.get("projetId") as string,
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
      statut: formData.get("statut") as string || "APlanifier",
      ordre: formData.get("ordre") ? parseInt(formData.get("ordre") as string) : 0,
      dateDebut: formData.get("dateDebut") as string || undefined,
      dateFin: formData.get("dateFin") as string || undefined,
    };

    const validatedData = CreateSousProjetSchema.parse(rawData);

    // Vérifier que le projet existe
    const projet = await db.projet.findUnique({
      where: { id: validatedData.projetId },
    });

    if (!projet) {
      return { success: false, error: "Projet non trouvé" };
    }

    const sousProjet = await db.sousProjet.create({
      data: {
        projetId: validatedData.projetId,
        titre: validatedData.titre,
        description: validatedData.description,
        statut: validatedData.statut as StatutSousProjet,
        ordre: validatedData.ordre,
        dateDebut: validatedData.dateDebut ? new Date(validatedData.dateDebut) : null,
        dateFin: validatedData.dateFin ? new Date(validatedData.dateFin) : null,
      },
    });

    // Logger l'activité
    try {
      await logCreation(
        `Création de la tâche "${validatedData.titre}" pour le projet "${projet.titre}"`,
        "SousProjet",
        sousProjet.id,
        {
          projetId: validatedData.projetId,
          statut: validatedData.statut,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${validatedData.projetId}`);
    return {
      success: true,
      message: `Tâche "${validatedData.titre}" créée avec succès`,
      id: sousProjet.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du sous-projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la création de la tâche" };
  }
}

/**
 * Met à jour un sous-projet/tâche
 */
export async function updateSousProjet(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      id: formData.get("id") as string,
      projetId: formData.get("projetId") as string,
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
      statut: formData.get("statut") as string,
      ordre: formData.get("ordre") ? parseInt(formData.get("ordre") as string) : 0,
      dateDebut: formData.get("dateDebut") as string || undefined,
      dateFin: formData.get("dateFin") as string || undefined,
    };

    const validatedData = UpdateSousProjetSchema.parse(rawData);

    // Vérifier que le sous-projet existe
    const existing = await db.sousProjet.findUnique({
      where: { id: validatedData.id },
    });

    if (!existing) {
      return { success: false, error: "Tâche non trouvée" };
    }

    const updateData: any = {
      titre: validatedData.titre,
      description: validatedData.description,
      statut: validatedData.statut as StatutSousProjet,
      ordre: validatedData.ordre,
      dateDebut: validatedData.dateDebut ? new Date(validatedData.dateDebut) : null,
      dateFin: validatedData.dateFin ? new Date(validatedData.dateFin) : null,
    };

    // Si la tâche est terminée, enregistrer la date de fin réelle
    if (validatedData.statut === "Terminee" && !existing.dateFinReelle) {
      updateData.dateFinReelle = new Date();
    }

    const sousProjet = await db.sousProjet.update({
      where: { id: validatedData.id },
      data: updateData,
    });

    // Logger l'activité
    try {
      await logModification(
        `Modification de la tâche "${validatedData.titre}"`,
        "SousProjet",
        validatedData.id,
        {
          statut: validatedData.statut,
          fieldsUpdated: Object.keys(updateData),
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${validatedData.projetId}`);
    return {
      success: true,
      message: `Tâche "${validatedData.titre}" mise à jour avec succès`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du sous-projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la mise à jour de la tâche" };
  }
}

/**
 * Supprime un sous-projet/tâche
 */
export async function deleteSousProjet(sousProjetId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer le sous-projet avant suppression pour le logging
    const sousProjet = await db.sousProjet.findUnique({
      where: { id: sousProjetId },
      select: { titre: true, projetId: true },
    });

    if (!sousProjet) {
      return { success: false, error: "Tâche non trouvée" };
    }

    await db.sousProjet.delete({
      where: { id: sousProjetId },
    });

    // Logger l'activité
    try {
      await logDeletion(
        `Suppression de la tâche "${sousProjet.titre}"`,
        "SousProjet",
        sousProjetId
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${sousProjet.projetId}`);
    return {
      success: true,
      message: `Tâche "${sousProjet.titre}" supprimée avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du sous-projet:", error);
    return { success: false, error: "Une erreur s'est produite lors de la suppression de la tâche" };
  }
}

/**
 * Affecte un ou plusieurs adhérents à un sous-projet/tâche
 */
export async function affecterSousProjet(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const sousProjetId = formData.get("sousProjetId") as string;
    const adherentIdsStr = formData.get("adherentIds") as string;
    const responsable = formData.get("responsable") === "true";

    if (!adherentIdsStr) {
      return { success: false, error: "Aucun adhérent sélectionné" };
    }

    const adherentIds = JSON.parse(adherentIdsStr) as string[];

    const validatedData = AffecterSousProjetSchema.parse({
      sousProjetId,
      adherentIds,
      responsable,
    });

    // Vérifier que le sous-projet existe
    const sousProjet = await db.sousProjet.findUnique({
      where: { id: validatedData.sousProjetId },
      include: {
        Projet: {
          select: {
            titre: true,
          },
        },
      },
    });

    if (!sousProjet) {
      return { success: false, error: "Tâche non trouvée" };
    }

    // Supprimer les affectations existantes pour cette tâche
    await db.affectationSousProjet.deleteMany({
      where: { sousProjetId: validatedData.sousProjetId },
    });

    // Créer les nouvelles affectations
    const affectations = await Promise.all(
      validatedData.adherentIds.map((adherentId) =>
        db.affectationSousProjet.create({
          data: {
            sousProjetId: validatedData.sousProjetId,
            adherentId,
            responsable: validatedData.responsable && adherentId === validatedData.adherentIds[0], // Le premier est responsable si flag activé
          },
        })
      )
    );

    // Logger l'activité
    try {
      await logModification(
        `Affectation de ${affectations.length} adhérent(s) à la tâche "${sousProjet.titre}"`,
        "SousProjet",
        validatedData.sousProjetId,
        {
          adherentIds: validatedData.adherentIds,
          nombreAffectations: affectations.length,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${sousProjet.Projet.id}`);
    return {
      success: true,
      message: `${affectations.length} adhérent(s) affecté(s) à la tâche avec succès`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de l'affectation:", error);
    return { success: false, error: "Une erreur s'est produite lors de l'affectation" };
  }
}

/**
 * Retire un adhérent d'un sous-projet/tâche
 */
export async function retirerAffectation(affectationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'affectation avant suppression
    const affectation = await db.affectationSousProjet.findUnique({
      where: { id: affectationId },
      include: {
        SousProjet: {
          select: {
            titre: true,
            projetId: true,
          },
        },
        Adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    if (!affectation) {
      return { success: false, error: "Affectation non trouvée" };
    }

    await db.affectationSousProjet.delete({
      where: { id: affectationId },
    });

    // Logger l'activité
    try {
      await logModification(
        `Retrait de l'adhérent ${affectation.Adherent.firstname} ${affectation.Adherent.lastname} de la tâche "${affectation.SousProjet.titre}"`,
        "SousProjet",
        affectation.sousProjetId,
        {
          adherentId: affectation.adherentId,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/admin/projets");
    revalidatePath(`/admin/projets/${affectation.SousProjet.projetId}`);
    return {
      success: true,
      message: `Adhérent retiré de la tâche avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors du retrait de l'affectation:", error);
    return { success: false, error: "Une erreur s'est produite lors du retrait de l'affectation" };
  }
}

/**
 * Crée un commentaire sur une tâche
 */
export async function createCommentaireTache(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        adherent: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user?.adherent) {
      return { success: false, error: "Vous devez être un adhérent pour commenter une tâche" };
    }

    const rawData = {
      sousProjetId: formData.get("sousProjetId") as string,
      contenu: formData.get("contenu") as string,
      pourcentageAvancement: formData.get("pourcentageAvancement")
        ? parseInt(formData.get("pourcentageAvancement") as string)
        : undefined,
    };

    const validatedData = CreateCommentaireTacheSchema.parse(rawData);

    // Vérifier que le sous-projet existe et que l'adhérent y est affecté
    const sousProjet = await db.sousProjet.findUnique({
      where: { id: validatedData.sousProjetId },
      include: {
        Affectations: {
          where: {
            adherentId: user.adherent.id,
          },
        },
      },
    });

    if (!sousProjet) {
      return { success: false, error: "Tâche non trouvée" };
    }

    if (sousProjet.Affectations.length === 0) {
      return { success: false, error: "Vous n'êtes pas affecté à cette tâche" };
    }

    const commentaire = await db.commentaireTache.create({
      data: {
        sousProjetId: validatedData.sousProjetId,
        adherentId: user.adherent.id,
        contenu: validatedData.contenu,
        pourcentageAvancement: validatedData.pourcentageAvancement || null,
      },
    });

    // Logger l'activité
    try {
      await logCreation(
        `Commentaire ajouté sur la tâche "${sousProjet.titre}"`,
        "CommentaireTache",
        commentaire.id,
        {
          sousProjetId: validatedData.sousProjetId,
          pourcentageAvancement: validatedData.pourcentageAvancement,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    revalidatePath("/user/taches");
    revalidatePath(`/admin/projets/${sousProjet.projetId}`);
    return {
      success: true,
      message: "Commentaire ajouté avec succès",
      id: commentaire.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du commentaire:", error);
    return { success: false, error: "Une erreur s'est produite lors de l'ajout du commentaire" };
  }
}

/**
 * Récupère les tâches d'un adhérent
 */
export async function getTachesAdherent() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        adherent: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user?.adherent) {
      return { success: false, error: "Vous devez être un adhérent" };
    }

    // Récupérer les affectations de l'adhérent
    const affectations = await db.affectationSousProjet.findMany({
      where: {
        adherentId: user.adherent.id,
        dateFinAffectation: null, // Seulement les affectations actives
      },
      include: {
        SousProjet: {
          include: {
            Projet: {
              select: {
                id: true,
                titre: true,
                description: true,
                statut: true,
              },
            },
            Commentaires: {
              include: {
                Adherent: {
                  select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    civility: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            _count: {
              select: {
                Affectations: true,
                Commentaires: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: affectations };
  } catch (error) {
    console.error("Erreur lors de la récupération des tâches:", error);
    return { success: false, error: "Erreur lors de la récupération des tâches" };
  }
}
