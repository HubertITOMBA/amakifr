"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole, StatutIdee } from "@prisma/client";
import { 
  sendIdeeValidationEmail, 
  sendIdeeRejetEmail, 
  sendCommentaireSupprimeEmail 
} from "@/lib/mail";

/**
 * Vérifie si un adhérent a complété ses informations personnelles
 * Un adhérent est considéré comme complet s'il a au moins une adresse OU un téléphone
 * 
 * @param adherentId - L'ID de l'adhérent à vérifier
 * @returns true si l'adhérent a complété ses informations, false sinon
 */
async function isAdherentComplete(adherentId: string): Promise<boolean> {
  const adherent = await prisma.adherent.findUnique({
    where: { id: adherentId },
    include: {
      Adresse: true,
      Telephones: true
    }
  });

  if (!adherent) {
    return false;
  }

  // Vérifier si l'adhérent a au moins une adresse avec des informations complètes
  const hasAddress = adherent.Adresse && adherent.Adresse.length > 0 && 
    adherent.Adresse.some(addr => 
      addr.street1 && addr.city && addr.codepost
    );

  // Vérifier si l'adhérent a au moins un téléphone
  const hasPhone = adherent.Telephones && adherent.Telephones.length > 0 &&
    adherent.Telephones.some(tel => tel.numero && tel.numero.trim() !== "");

  // L'adhérent est complet s'il a au moins une adresse OU un téléphone
  return hasAddress || hasPhone;
}

// Schémas de validation
const CreateIdeeSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre ne peut pas dépasser 255 caractères"),
  description: z.string().min(1, "La description est requise"),
});

const UpdateIdeeSchema = z.object({
  id: z.string().min(1, "ID requis"),
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre ne peut pas dépasser 255 caractères").optional(),
  description: z.string().min(1, "La description est requise").optional(),
});

const ValiderIdeeSchema = z.object({
  id: z.string().min(1, "ID requis"),
});

const RejeterIdeeSchema = z.object({
  id: z.string().min(1, "ID requis"),
  raisonRejet: z.string().min(1, "La raison du rejet est requise"),
});

const BloquerIdeeSchema = z.object({
  id: z.string().min(1, "ID requis"),
  raisonRejet: z.string().min(1, "La raison du blocage est requise"),
});

const CreateCommentaireSchema = z.object({
  ideeId: z.string().min(1, "ID de l'idée requis"),
  contenu: z.string().min(1, "Le contenu du commentaire est requis"),
});

const SupprimerCommentaireSchema = z.object({
  id: z.string().min(1, "ID requis"),
  raisonSuppression: z.string().min(1, "La raison de la suppression est requise"),
});

/**
 * Crée une nouvelle idée dans la boîte à idées
 * 
 * @param formData - Les données du formulaire contenant le titre et la description
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et id (string) de l'idée créée
 */
export async function createIdee(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent associé à l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { adherent: true }
    });

    if (!user?.adherent) {
      return { success: false, error: "Vous devez être un adhérent pour soumettre une idée. Veuillez compléter vos informations d'adhérent dans votre profil." };
    }

    // Vérifier que l'adhérent a complété ses informations (adresse ou téléphone)
    const adherentComplete = await isAdherentComplete(user.adherent.id);
    if (!adherentComplete) {
      return { 
        success: false, 
        error: "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir soumettre une idée." 
      };
    }

    const rawData = {
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
    };

    const validatedData = CreateIdeeSchema.parse(rawData);

    // Créer l'idée
    const nouvelleIdee = await prisma.idee.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        adherentId: user.adherent.id,
        statut: StatutIdee.EnAttente,
      },
    });

    return { 
      success: true, 
      message: `Votre idée "${validatedData.titre}" a été soumise avec succès. Elle sera examinée par l'administration.`,
      id: nouvelleIdee.id 
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de l'idée:", error);
    return { success: false, error: "Erreur lors de la création de l'idée" };
  } finally {
    revalidatePath("/user/profile");
    revalidatePath("/idees");
  }
}

/**
 * Met à jour une idée existante
 * 
 * @param formData - Les données du formulaire contenant l'ID, le titre et la description
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateIdee(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      id: formData.get("id") as string,
      titre: formData.get("titre") as string,
      description: formData.get("description") as string,
    };

    const validatedData = UpdateIdeeSchema.parse(rawData);

    // Récupérer l'idée et vérifier que l'utilisateur en est l'auteur
    const idee = await prisma.idee.findUnique({
      where: { id: validatedData.id },
      include: { Adherent: { include: { User: true } } }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    if (idee.Adherent.User.id !== session.user.id) {
      return { success: false, error: "Vous n'êtes pas autorisé à modifier cette idée" };
    }

    // Vérifier que l'idée n'est pas déjà lue (pas de commentaires ou approbations)
    if (idee.estLue) {
      return { success: false, error: "Cette idée ne peut plus être modifiée car elle a déjà été lue par d'autres adhérents. Veuillez contacter l'administration pour la modifier." };
    }

    // Vérifier que l'idée n'est pas validée, rejetée ou bloquée
    if (idee.statut !== StatutIdee.EnAttente) {
      return { success: false, error: "Cette idée ne peut plus être modifiée car elle a déjà été traitée par l'administration." };
    }

    // Mettre à jour l'idée
    await prisma.idee.update({
      where: { id: validatedData.id },
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
      },
    });

    return { 
      success: true, 
      message: `Votre idée a été mise à jour avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour de l'idée:", error);
    return { success: false, error: "Erreur lors de la mise à jour de l'idée" };
  } finally {
    revalidatePath("/user/profile");
    revalidatePath("/idees");
  }
}

/**
 * Supprime une idée (seulement si elle n'a pas été lue)
 * 
 * @param id - L'identifiant de l'idée à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function deleteIdee(id: string) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'idée et vérifier que l'utilisateur en est l'auteur
    const idee = await prisma.idee.findUnique({
      where: { id },
      include: { Adherent: { include: { User: true } } }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    if (idee.Adherent.User.id !== session.user.id) {
      return { success: false, error: "Vous n'êtes pas autorisé à supprimer cette idée" };
    }

    // Si l'idée est déjà lue, l'utilisateur doit demander à l'admin
    if (idee.estLue) {
      return { success: false, error: "Cette idée ne peut plus être supprimée car elle a déjà été lue par d'autres adhérents. Veuillez contacter l'administration pour la supprimer." };
    }

    // Supprimer l'idée
    await prisma.idee.delete({
      where: { id },
    });

    return { 
      success: true, 
      message: `Votre idée a été supprimée avec succès.`
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de l'idée:", error);
    return { success: false, error: "Erreur lors de la suppression de l'idée" };
  } finally {
    revalidatePath("/user/profile");
    revalidatePath("/idees");
  }
}

/**
 * Valide une idée (action admin)
 * 
 * @param formData - Les données du formulaire contenant l'ID de l'idée
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function validerIdee(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== UserRole.Admin) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      id: formData.get("id") as string,
    };

    const validatedData = ValiderIdeeSchema.parse(rawData);

    // Récupérer l'idée avec l'adhérent et son email
    const idee = await prisma.idee.findUnique({
      where: { id: validatedData.id },
      include: { 
        Adherent: { 
          include: { 
            User: true 
          } 
        } 
      }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    if (idee.statut !== StatutIdee.EnAttente) {
      return { success: false, error: "Cette idée a déjà été traitée" };
    }

    // Valider l'idée
    await prisma.idee.update({
      where: { id: validatedData.id },
      data: {
        statut: StatutIdee.Validee,
        dateValidation: new Date(),
        valideePar: session.user.id,
      },
    });

    // Envoyer un email de notification à l'adhérent
    if (idee.Adherent.User.email) {
      try {
        await sendIdeeValidationEmail(
          idee.Adherent.User.email,
          idee.Adherent.firstname + " " + idee.Adherent.lastname,
          idee.titre
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer l'opération si l'email échoue
      }
    }

    return { 
      success: true, 
      message: `L'idée "${idee.titre}" a été validée avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la validation de l'idée:", error);
    return { success: false, error: "Erreur lors de la validation de l'idée" };
  } finally {
    revalidatePath("/admin/idees");
    revalidatePath("/idees");
  }
}

/**
 * Rejette une idée (action admin)
 * 
 * @param formData - Les données du formulaire contenant l'ID de l'idée et la raison du rejet
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function rejeterIdee(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== UserRole.Admin) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      id: formData.get("id") as string,
      raisonRejet: formData.get("raisonRejet") as string,
    };

    const validatedData = RejeterIdeeSchema.parse(rawData);

    // Récupérer l'idée avec l'adhérent et son email
    const idee = await prisma.idee.findUnique({
      where: { id: validatedData.id },
      include: { 
        Adherent: { 
          include: { 
            User: true 
          } 
        } 
      }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    if (idee.statut !== StatutIdee.EnAttente && idee.statut !== StatutIdee.Validee) {
      return { success: false, error: "Cette idée ne peut plus être rejetée" };
    }

    // Rejeter l'idée
    await prisma.idee.update({
      where: { id: validatedData.id },
      data: {
        statut: StatutIdee.Rejetee,
        dateRejet: new Date(),
        rejeteePar: session.user.id,
        raisonRejet: validatedData.raisonRejet,
      },
    });

    // Envoyer un email de notification à l'adhérent
    if (idee.Adherent.User.email) {
      try {
        await sendIdeeRejetEmail(
          idee.Adherent.User.email,
          idee.Adherent.firstname + " " + idee.Adherent.lastname,
          idee.titre,
          validatedData.raisonRejet
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer l'opération si l'email échoue
      }
    }

    return { 
      success: true, 
      message: `L'idée "${idee.titre}" a été rejetée avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors du rejet de l'idée:", error);
    return { success: false, error: "Erreur lors du rejet de l'idée" };
  } finally {
    revalidatePath("/admin/idees");
    revalidatePath("/idees");
  }
}

/**
 * Bloque une idée (action admin)
 * 
 * @param formData - Les données du formulaire contenant l'ID de l'idée et la raison du blocage
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function bloquerIdee(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== UserRole.Admin) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      id: formData.get("id") as string,
      raisonRejet: formData.get("raisonRejet") as string,
    };

    const validatedData = BloquerIdeeSchema.parse(rawData);

    // Récupérer l'idée avec l'adhérent et son email
    const idee = await prisma.idee.findUnique({
      where: { id: validatedData.id },
      include: { 
        Adherent: { 
          include: { 
            User: true 
          } 
        } 
      }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    // Bloquer l'idée
    await prisma.idee.update({
      where: { id: validatedData.id },
      data: {
        statut: StatutIdee.Bloquee,
        dateBlocage: new Date(),
        bloqueePar: session.user.id,
        raisonRejet: validatedData.raisonRejet,
      },
    });

    // Envoyer un email de notification à l'adhérent
    if (idee.Adherent.User.email) {
      try {
        await sendIdeeRejetEmail(
          idee.Adherent.User.email,
          idee.Adherent.firstname + " " + idee.Adherent.lastname,
          idee.titre,
          validatedData.raisonRejet
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer l'opération si l'email échoue
      }
    }

    return { 
      success: true, 
      message: `L'idée "${idee.titre}" a été bloquée avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors du blocage de l'idée:", error);
    return { success: false, error: "Erreur lors du blocage de l'idée" };
  } finally {
    revalidatePath("/admin/idees");
    revalidatePath("/idees");
  }
}

/**
 * Crée un commentaire sur une idée
 * 
 * @param formData - Les données du formulaire contenant l'ID de l'idée et le contenu
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function createCommentaire(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent associé à l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { adherent: true }
    });

    if (!user?.adherent) {
      return { success: false, error: "Vous devez être un adhérent pour commenter une idée. Veuillez compléter vos informations d'adhérent dans votre profil." };
    }

    // Vérifier que l'adhérent a complété ses informations (adresse ou téléphone)
    const adherentComplete = await isAdherentComplete(user.adherent.id);
    if (!adherentComplete) {
      return { 
        success: false, 
        error: "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir commenter une idée." 
      };
    }

    const rawData = {
      ideeId: formData.get("ideeId") as string,
      contenu: formData.get("contenu") as string,
    };

    const validatedData = CreateCommentaireSchema.parse(rawData);

    // Vérifier que l'idée existe et est valide
    const idee = await prisma.idee.findUnique({
      where: { id: validatedData.ideeId }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    // On ne peut commenter que les idées validées
    if (idee.statut !== StatutIdee.Validee) {
      return { success: false, error: "Vous ne pouvez commenter que les idées validées par l'administration" };
    }

    // Créer le commentaire
    await prisma.commentaireIdee.create({
      data: {
        ideeId: validatedData.ideeId,
        adherentId: user.adherent.id,
        contenu: validatedData.contenu,
      },
    });

    // Mettre à jour le compteur de commentaires et marquer l'idée comme lue
    await prisma.idee.update({
      where: { id: validatedData.ideeId },
      data: {
        nombreCommentaires: {
          increment: 1
        },
        estLue: true,
      },
    });

    return { 
      success: true, 
      message: `Votre commentaire a été ajouté avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du commentaire:", error);
    return { success: false, error: "Erreur lors de la création du commentaire" };
  } finally {
    revalidatePath("/idees");
  }
}

/**
 * Supprime un commentaire (action admin)
 * 
 * @param formData - Les données du formulaire contenant l'ID du commentaire et la raison
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function supprimerCommentaire(formData: FormData) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== UserRole.Admin) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      id: formData.get("id") as string,
      raisonSuppression: formData.get("raisonSuppression") as string,
    };

    const validatedData = SupprimerCommentaireSchema.parse(rawData);

    // Récupérer le commentaire avec l'idée et l'adhérent
    const commentaire = await prisma.commentaireIdee.findUnique({
      where: { id: validatedData.id },
      include: { 
        Idee: true,
        Adherent: { 
          include: { 
            User: true 
          } 
        } 
      }
    });

    if (!commentaire) {
      return { success: false, error: "Commentaire non trouvé" };
    }

    if (commentaire.supprime) {
      return { success: false, error: "Ce commentaire a déjà été supprimé" };
    }

    // Marquer le commentaire comme supprimé
    await prisma.commentaireIdee.update({
      where: { id: validatedData.id },
      data: {
        supprime: true,
        raisonSuppression: validatedData.raisonSuppression,
      },
    });

    // Décrémenter le compteur de commentaires
    await prisma.idee.update({
      where: { id: commentaire.ideeId },
      data: {
        nombreCommentaires: {
          decrement: 1
        },
      },
    });

    // Envoyer un email de notification à l'adhérent
    if (commentaire.Adherent.User.email) {
      try {
        await sendCommentaireSupprimeEmail(
          commentaire.Adherent.User.email,
          commentaire.Adherent.firstname + " " + commentaire.Adherent.lastname,
          commentaire.Idee.titre,
          validatedData.raisonSuppression
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer l'opération si l'email échoue
      }
    }

    return { 
      success: true, 
      message: `Le commentaire a été supprimé avec succès.`
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la suppression du commentaire:", error);
    return { success: false, error: "Erreur lors de la suppression du commentaire" };
  } finally {
    revalidatePath("/admin/idees");
    revalidatePath("/idees");
  }
}

/**
 * Ajoute ou retire une approbation (like) sur une idée
 * 
 * @param ideeId - L'identifiant de l'idée
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et hasApprobation (boolean) indiquant si l'adhérent a approuvé
 */
export async function toggleApprobation(ideeId: string) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent associé à l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { adherent: true }
    });

    if (!user?.adherent) {
      return { success: false, error: "Vous devez être un adhérent pour approuver une idée. Veuillez compléter vos informations d'adhérent dans votre profil." };
    }

    // Vérifier que l'adhérent a complété ses informations (adresse ou téléphone)
    const adherentComplete = await isAdherentComplete(user.adherent.id);
    if (!adherentComplete) {
      return { 
        success: false, 
        error: "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir approuver une idée." 
      };
    }

    // Vérifier que l'idée existe et est valide
    const idee = await prisma.idee.findUnique({
      where: { id: ideeId }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    // On ne peut approuver que les idées validées
    if (idee.statut !== StatutIdee.Validee) {
      return { success: false, error: "Vous ne pouvez approuver que les idées validées par l'administration" };
    }

    // Vérifier si l'adhérent a déjà approuvé cette idée
    const approbationExistante = await prisma.approbationIdee.findUnique({
      where: {
        ideeId_adherentId: {
          ideeId: ideeId,
          adherentId: user.adherent.id,
        }
      }
    });

    if (approbationExistante) {
      // Retirer l'approbation
      await prisma.approbationIdee.delete({
        where: {
          ideeId_adherentId: {
            ideeId: ideeId,
            adherentId: user.adherent.id,
          }
        }
      });

      // Décrémenter le compteur
      await prisma.idee.update({
        where: { id: ideeId },
        data: {
          nombreApprobations: {
            decrement: 1
          },
          estLue: true, // Marquer comme lue même si on retire l'approbation
        },
      });

      return { 
        success: true, 
        message: `Votre approbation a été retirée.`,
        hasApprobation: false
      };
    } else {
      // Ajouter l'approbation
      await prisma.approbationIdee.create({
        data: {
          ideeId: ideeId,
          adherentId: user.adherent.id,
        }
      });

      // Incrémenter le compteur
      await prisma.idee.update({
        where: { id: ideeId },
        data: {
          nombreApprobations: {
            increment: 1
          },
          estLue: true,
        },
      });

      return { 
        success: true, 
        message: `Votre approbation a été enregistrée.`,
        hasApprobation: true
      };
    }
  } catch (error) {
    console.error("Erreur lors de la gestion de l'approbation:", error);
    return { success: false, error: "Erreur lors de la gestion de l'approbation" };
  } finally {
    revalidatePath("/idees");
  }
}

/**
 * Récupère toutes les idées pour les adhérents
 * 
 * @returns Un objet avec success (boolean) et data (array d'idées) ou error (string)
 */
export async function getAllIdees() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const idees = await prisma.idee.findMany({
      where: {
        statut: StatutIdee.Validee
      },
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            }
          }
        },
        Commentaires: {
          where: {
            supprime: false
          },
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        Approbations: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        dateCreation: 'desc'
      }
    });

    return { success: true, data: idees };
  } catch (error) {
    console.error("Erreur lors de la récupération des idées:", error);
    return { success: false, error: "Erreur lors de la récupération des idées" };
  }
}

/**
 * Récupère les idées d'un adhérent spécifique
 * 
 * @param userId - L'identifiant de l'utilisateur
 * @returns Un objet avec success (boolean) et data (array d'idées) ou error (string)
 */
export async function getIdeesByUser(userId: string) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur demande ses propres idées ou est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (session.user.id !== userId && user?.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await prisma.adherent.findUnique({
      where: { userId }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    const idees = await prisma.idee.findMany({
      where: {
        adherentId: adherent.id
      },
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            }
          }
        },
        Commentaires: {
          where: {
            supprime: false
          },
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        Approbations: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        dateCreation: 'desc'
      }
    });

    return { success: true, data: idees };
  } catch (error) {
    console.error("Erreur lors de la récupération des idées:", error);
    return { success: false, error: "Erreur lors de la récupération des idées" };
  }
}

/**
 * Récupère toutes les idées pour l'admin (y compris les bloquées)
 * 
 * @returns Un objet avec success (boolean) et data (array d'idées) ou error (string)
 */
export async function getAllIdeesForAdmin() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== UserRole.Admin) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const idees = await prisma.idee.findMany({
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            }
          }
        },
        Commentaires: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        Approbations: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        dateCreation: 'desc'
      }
    });

    return { success: true, data: idees };
  } catch (error) {
    console.error("Erreur lors de la récupération des idées:", error);
    return { success: false, error: "Erreur lors de la récupération des idées" };
  }
}

/**
 * Récupère une idée par son ID
 * 
 * @param id - L'identifiant de l'idée
 * @returns Un objet avec success (boolean) et data (idée) ou error (string)
 */
export async function getIdeeById(id: string) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const idee = await prisma.idee.findUnique({
      where: { id },
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            }
          }
        },
        Commentaires: {
          where: {
            supprime: false
          },
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        Approbations: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: {
                    id: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!idee) {
      return { success: false, error: "Idée non trouvée" };
    }

    return { success: true, data: idee };
  } catch (error) {
    console.error("Erreur lors de la récupération de l'idée:", error);
    return { success: false, error: "Erreur lors de la récupération de l'idée" };
  }
}

// Exports avec des noms alternatifs pour compatibilité avec les composants existants
/**
 * Alias pour createCommentaire (compatibilité)
 * @deprecated Utilisez createCommentaire à la place
 */
export const commentIdee = createCommentaire;

/**
 * Alias pour toggleApprobation (compatibilité)
 * @deprecated Utilisez toggleApprobation à la place
 */
export const voteIdee = toggleApprobation;

/**
 * Alias pour supprimerCommentaire (compatibilité)
 * @deprecated Utilisez supprimerCommentaire à la place
 */
export const adminDeleteCommentaire = supprimerCommentaire;

