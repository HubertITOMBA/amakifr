"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdirSync, existsSync } from "fs";
import { writeFile as writeFilePromise } from "fs/promises";
import { join } from "path";
import { sendVisiteurInscriptionEmail, sendAdherentInscriptionConfirmationEmail, sendVisiteurInscriptionConfirmationEmail } from "@/lib/mail";

// Schémas de validation
const EvenementSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(200, "Le titre ne peut pas dépasser 200 caractères"),
  description: z.string().min(1, "La description est requise"),
  contenu: z.string().optional(),
  dateDebut: z.string().min(1, "La date de début est requise"),
  dateFin: z.string().optional(),
  dateAffichage: z.string().min(1, "La date d'affichage est requise"),
  dateFinAffichage: z.string().min(1, "La date de fin d'affichage est requise"),
  lieu: z.string().optional(),
  adresse: z.string().optional(),
  categorie: z.enum(["General", "Formation", "Social", "Sportif", "Culturel"]).default("General"),
  statut: z.enum(["Brouillon", "Publie", "Archive"]).default("Brouillon"),
  imagePrincipale: z.string().optional(),
  images: z.string().optional(), // JSON string
  prix: z.string().optional(),
  placesDisponibles: z.string().optional(),
  inscriptionRequis: z.boolean().default(false),
  dateLimiteInscription: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactTelephone: z.string().optional(),
  tags: z.string().optional(), // JSON string
});

const InscriptionEvenementSchema = z.object({
  evenementId: z.string().min(1, "L'ID de l'événement est requis"),
  nombrePersonnes: z.number().min(1, "Au moins une personne doit être inscrite"),
  commentaires: z.string().optional(),
});

const InscriptionVisiteurSchema = z.object({
  evenementId: z.string().min(1, "L'ID de l'événement est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  telephone: z.string().min(1, "Le téléphone est requis"),
  adresse: z.string().min(1, "L'adresse est requise"),
  nombrePersonnes: z.number().min(1, "Au moins une personne doit être inscrite"),
  commentaires: z.string().optional(),
});

// Types TypeScript
export interface EvenementData {
  id: string;
  titre: string;
  description: string;
  contenu?: string;
  dateDebut: Date;
  dateFin?: Date;
  dateAffichage: Date;
  dateFinAffichage: Date;
  lieu?: string;
  adresse?: string;
  categorie: string;
  statut: string;
  imagePrincipale?: string;
  images?: string[];
  prix?: number;
  placesDisponibles?: number;
  placesReservees: number;
  inscriptionRequis: boolean;
  dateLimiteInscription?: Date;
  contactEmail?: string;
  contactTelephone?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InscriptionEvenementData {
  id: string;
  evenementId: string;
  adherentId: string;
  statut: string;
  dateInscription: Date;
  commentaires?: string;
  nombrePersonnes: number;
  createdAt: Date;
  updatedAt: Date;
}

// Server Actions pour les événements

/**
 * Créer un nouvel événement
 */
export async function createEvenement(data: z.infer<typeof EvenementSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des événements" };
    }

    // Validation des données
    const validatedData = EvenementSchema.parse(data);

    // Conversion des dates
    const dateDebut = new Date(validatedData.dateDebut);
    const dateFin = validatedData.dateFin ? new Date(validatedData.dateFin) : null;
    const dateAffichage = new Date(validatedData.dateAffichage);
    const dateFinAffichage = new Date(validatedData.dateFinAffichage);
    const dateLimiteInscription = validatedData.dateLimiteInscription ? new Date(validatedData.dateLimiteInscription) : null;

    // Conversion du prix
    const prix = validatedData.prix ? parseFloat(validatedData.prix) : null;

    // Conversion des places disponibles
    const placesDisponibles = validatedData.placesDisponibles ? parseInt(validatedData.placesDisponibles) : null;

    // Parsing des données JSON
    let images = null;
    if (validatedData.images && validatedData.images.trim()) {
      try {
        images = JSON.parse(validatedData.images);
      } catch {
        images = null;
      }
    }
    
    let tags = null;
    if (validatedData.tags && validatedData.tags.trim()) {
      try {
        tags = JSON.parse(validatedData.tags);
      } catch {
        tags = null;
      }
    }

    // Création de l'événement
    const evenement = await prisma.evenement.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        contenu: validatedData.contenu,
        dateDebut,
        dateFin,
        dateAffichage,
        dateFinAffichage,
        lieu: validatedData.lieu,
        adresse: validatedData.adresse,
        categorie: validatedData.categorie,
        statut: validatedData.statut,
        imagePrincipale: validatedData.imagePrincipale,
        images: images ? JSON.stringify(images) : null,
        prix,
        placesDisponibles,
        inscriptionRequis: validatedData.inscriptionRequis,
        dateLimiteInscription,
        contactEmail: validatedData.contactEmail || null,
        contactTelephone: validatedData.contactTelephone,
        tags: tags ? JSON.stringify(tags) : null,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/admin/evenements");
    revalidatePath("/evenements");

    // Conversion des Decimal vers Number pour le client
    const evenementFormatted = {
      ...evenement,
      prix: evenement.prix ? Number(evenement.prix) : null,
    };

    return { success: true, data: evenementFormatted };
  } catch (error) {
    console.error("Erreur lors de la création de l'événement:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la création de l'événement" };
  }
}

/**
 * Mettre à jour un événement
 */
export async function updateEvenement(id: string, data: z.infer<typeof EvenementSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier des événements" };
    }

    const validatedData = EvenementSchema.parse(data);

    // Conversion des dates
    const dateDebut = new Date(validatedData.dateDebut);
    const dateFin = validatedData.dateFin ? new Date(validatedData.dateFin) : null;
    const dateAffichage = new Date(validatedData.dateAffichage);
    const dateFinAffichage = new Date(validatedData.dateFinAffichage);
    const dateLimiteInscription = validatedData.dateLimiteInscription ? new Date(validatedData.dateLimiteInscription) : null;

    // Conversion du prix
    const prix = validatedData.prix ? parseFloat(validatedData.prix) : null;

    // Conversion des places disponibles
    const placesDisponibles = validatedData.placesDisponibles ? parseInt(validatedData.placesDisponibles) : null;

    // Parsing des données JSON
    let images = null;
    if (validatedData.images && validatedData.images.trim()) {
      try {
        images = JSON.parse(validatedData.images);
      } catch {
        images = null;
      }
    }
    
    let tags = null;
    if (validatedData.tags && validatedData.tags.trim()) {
      try {
        tags = JSON.parse(validatedData.tags);
      } catch {
        tags = null;
      }
    }

    const evenement = await prisma.evenement.update({
      where: { id },
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        contenu: validatedData.contenu,
        dateDebut,
        dateFin,
        dateAffichage,
        dateFinAffichage,
        lieu: validatedData.lieu,
        adresse: validatedData.adresse,
        categorie: validatedData.categorie,
        statut: validatedData.statut,
        imagePrincipale: validatedData.imagePrincipale,
        images: images ? JSON.stringify(images) : null,
        prix,
        placesDisponibles,
        inscriptionRequis: validatedData.inscriptionRequis,
        dateLimiteInscription,
        contactEmail: validatedData.contactEmail || null,
        contactTelephone: validatedData.contactTelephone,
        tags: tags ? JSON.stringify(tags) : null,
      },
    });

    revalidatePath("/admin/evenements");
    revalidatePath("/evenements");

    // Conversion des Decimal vers Number pour le client
    const evenementFormatted = {
      ...evenement,
      prix: evenement.prix ? Number(evenement.prix) : null,
    };

    return { success: true, data: evenementFormatted };
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'événement:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la mise à jour de l'événement" };
  }
}

/**
 * Supprimer un événement
 */
export async function deleteEvenement(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer des événements" };
    }

    await prisma.evenement.delete({
      where: { id },
    });

    revalidatePath("/admin/evenements");
    revalidatePath("/evenements");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression de l'événement:", error);
    return { success: false, error: "Erreur lors de la suppression de l'événement" };
  }
}

/**
 * Récupérer tous les événements (pour l'admin)
 */
export async function getAllEvenements() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent voir tous les événements" };
    }

    const evenements = await prisma.evenement.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Inscriptions: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Conversion des données pour le client
    const evenementsFormatted = evenements.map(evenement => ({
      ...evenement,
      prix: evenement.prix ? Number(evenement.prix) : null,
      images: evenement.images ? JSON.parse(evenement.images) : null,
      tags: evenement.tags ? JSON.parse(evenement.tags) : null,
    }));

    return { success: true, data: evenementsFormatted };
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    return { success: false, error: "Erreur lors de la récupération des événements" };
  }
}

/**
 * Récupérer les événements publics (visibles par les visiteurs)
 */
export async function getPublicEvenements() {
  try {
    const now = new Date();
    
    const evenements = await prisma.evenement.findMany({
      where: {
        statut: "Publie",
        dateAffichage: {
          lte: now,
        },
        dateFinAffichage: {
          gte: now,
        },
      },
      include: {
        CreatedBy: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            Inscriptions: true,
          },
        },
      },
      orderBy: {
        dateDebut: "asc",
      },
    });

    // Conversion des données pour le client
    const evenementsFormatted = evenements.map(evenement => ({
      ...evenement,
      prix: evenement.prix ? Number(evenement.prix) : null,
      images: evenement.images ? JSON.parse(evenement.images) : null,
      tags: evenement.tags ? JSON.parse(evenement.tags) : null,
    }));

    return { success: true, data: evenementsFormatted };
  } catch (error) {
    console.error("Erreur lors de la récupération des événements publics:", error);
    return { success: false, error: "Erreur lors de la récupération des événements publics" };
  }
}

/**
 * Récupérer un événement par son ID (publique)
 * Pour les visiteurs non authentifiés, retourne uniquement les événements publiés
 * Pour les admins authentifiés, retourne tous les événements
 */
export async function getEvenementById(id: string) {
  try {
    const session = await auth();
    const isAdmin = session?.user?.role === "Admin";
    
    const evenement = await prisma.evenement.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Inscriptions: isAdmin ? {
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
        } : false,
      },
    });

    if (!evenement) {
      return { success: false, error: "Événement non trouvé" };
    }

    // Vérifier que l'événement est accessible publiquement si l'utilisateur n'est pas admin
    if (!isAdmin) {
      const now = new Date();
      if (
        evenement.statut !== "Publie" ||
        evenement.dateAffichage > now ||
        evenement.dateFinAffichage < now
      ) {
        return { success: false, error: "Événement non trouvé" };
      }
    }

    // Conversion des données pour le client
    const evenementFormatted = {
      ...evenement,
      prix: evenement.prix ? Number(evenement.prix) : null,
      images: evenement.images ? JSON.parse(evenement.images) : null,
      tags: evenement.tags ? JSON.parse(evenement.tags) : null,
    };

    return { success: true, data: evenementFormatted };
  } catch (error) {
    console.error("Erreur lors de la récupération de l'événement:", error);
    return { success: false, error: "Erreur lors de la récupération de l'événement" };
  }
}

// Server Actions pour les inscriptions

/**
 * S'inscrire à un événement (public, pour adhérents connectés)
 */
export async function inscrireEvenement(data: z.infer<typeof InscriptionEvenementSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Vous devez être connecté pour vous inscrire en tant qu'adhérent" };
    }

    // Récupérer l'adhérent
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        User: {
          select: {
            email: true,
          }
        }
      }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    const validatedData = InscriptionEvenementSchema.parse(data);

    // Vérifier que l'événement existe et est ouvert aux inscriptions
    const evenement = await prisma.evenement.findUnique({
      where: { id: validatedData.evenementId },
    });

    if (!evenement) {
      return { success: false, error: "Événement non trouvé" };
    }

    if (!evenement.inscriptionRequis) {
      return { success: false, error: "Cet événement ne nécessite pas d'inscription" };
    }

    if (evenement.dateLimiteInscription && evenement.dateLimiteInscription < new Date()) {
      return { success: false, error: "La date limite d'inscription est dépassée" };
    }

    if (evenement.placesDisponibles && evenement.placesReservees + validatedData.nombrePersonnes > evenement.placesDisponibles) {
      return { success: false, error: "Pas assez de places disponibles" };
    }

    // Vérifier si l'adhérent n'est pas déjà inscrit
    const inscriptionExistante = await prisma.inscriptionEvenement.findFirst({
      where: {
        evenementId: validatedData.evenementId,
        adherentId: adherent.id,
      },
    });

    if (inscriptionExistante) {
      return { success: false, error: "Vous êtes déjà inscrit à cet événement" };
    }

    // Créer l'inscription
    const inscription = await prisma.inscriptionEvenement.create({
      data: {
        evenementId: validatedData.evenementId,
        adherentId: adherent.id,
        nombrePersonnes: validatedData.nombrePersonnes,
        commentaires: validatedData.commentaires,
      },
    });

    // Mettre à jour le nombre de places réservées
    await prisma.evenement.update({
      where: { id: validatedData.evenementId },
      data: {
        placesReservees: {
          increment: validatedData.nombrePersonnes,
        },
      },
    });

    // Envoyer un email de confirmation à l'adhérent
    try {
      await sendAdherentInscriptionConfirmationEmail(
        adherent.User.email,
        `${adherent.civility || ''} ${adherent.firstname} ${adherent.lastname}`.trim(),
        evenement.titre,
        evenement.dateDebut,
        evenement.lieu,
        validatedData.nombrePersonnes
      );
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de confirmation:", emailError);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    revalidatePath("/evenements");
    revalidatePath("/user/profile");

    return { success: true, data: inscription };
  } catch (error) {
    console.error("Erreur lors de l'inscription à l'événement:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de l'inscription à l'événement" };
  }
}

/**
 * Annuler une inscription à un événement
 */
export async function annulerInscriptionEvenement(inscriptionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer l'inscription
    const inscription = await prisma.inscriptionEvenement.findUnique({
      where: { id: inscriptionId },
      include: {
        Evenement: true,
      },
    });

    if (!inscription) {
      return { success: false, error: "Inscription non trouvée" };
    }

    if (inscription.adherentId !== adherent.id) {
      return { success: false, error: "Vous ne pouvez pas annuler cette inscription" };
    }

    // Supprimer l'inscription
    await prisma.inscriptionEvenement.delete({
      where: { id: inscriptionId },
    });

    // Mettre à jour le nombre de places réservées
    await prisma.evenement.update({
      where: { id: inscription.evenementId },
      data: {
        placesReservees: {
          decrement: inscription.nombrePersonnes,
        },
      },
    });

    revalidatePath("/evenements");
    revalidatePath("/user/profile");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'inscription:", error);
    return { success: false, error: "Erreur lors de l'annulation de l'inscription" };
  }
}

/**
 * Récupérer les inscriptions d'un adhérent
 */
export async function getInscriptionsAdherent() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    const inscriptions = await prisma.inscriptionEvenement.findMany({
      where: { adherentId: adherent.id },
      include: {
        Evenement: {
          select: {
            id: true,
            titre: true,
            description: true,
            dateDebut: true,
            dateFin: true,
            lieu: true,
            categorie: true,
            statut: true,
            imagePrincipale: true,
            prix: true,
          },
        },
      },
      orderBy: {
        dateInscription: "desc",
      },
    });

    // Conversion des données pour le client
    const inscriptionsFormatted = inscriptions.map(inscription => ({
      ...inscription,
      Evenement: {
        ...inscription.Evenement,
        prix: inscription.Evenement.prix ? Number(inscription.Evenement.prix) : null,
      },
    }));

    return { success: true, data: inscriptionsFormatted };
  } catch (error) {
    console.error("Erreur lors de la récupération des inscriptions:", error);
    return { success: false, error: "Erreur lors de la récupération des inscriptions" };
  }
}

/**
 * Récupérer la liste des adhérents pour ajouter des participants (Admin)
 */
export async function getAdherentsForEvent() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent accéder à cette fonctionnalité" };
    }

    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
      },
      orderBy: [
        { lastname: "asc" },
        { firstname: "asc" },
      ],
    });

    return { success: true, data: adherents };
  } catch (error) {
    console.error("Erreur lors de la récupération des adhérents:", error);
    return { success: false, error: "Erreur lors de la récupération des adhérents" };
  }
}

/**
 * Ajouter un participant à un événement (Admin)
 */
export async function addParticipantToEvent(
  evenementId: string,
  adherentId: string,
  nombrePersonnes: number = 1,
  commentaires?: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent ajouter des participants" };
    }

    // Vérifier que l'événement existe
    const evenement = await prisma.evenement.findUnique({
      where: { id: evenementId },
    });

    if (!evenement) {
      return { success: false, error: "Événement non trouvé" };
    }

    if (!evenement.inscriptionRequis) {
      return { success: false, error: "Cet événement ne nécessite pas d'inscription" };
    }

    // Vérifier les places disponibles
    if (evenement.placesDisponibles && evenement.placesReservees + nombrePersonnes > evenement.placesDisponibles) {
      return { success: false, error: "Pas assez de places disponibles" };
    }

    // Vérifier si l'adhérent n'est pas déjà inscrit
    const inscriptionExistante = await prisma.inscriptionEvenement.findFirst({
      where: {
        evenementId,
        adherentId,
      },
    });

    if (inscriptionExistante) {
      return { success: false, error: "Cet adhérent est déjà inscrit à cet événement" };
    }

    // Créer l'inscription
    const inscription = await prisma.inscriptionEvenement.create({
      data: {
        evenementId,
        adherentId,
        nombrePersonnes,
        commentaires: commentaires || null,
        statut: "Confirme", // Inscription confirmée par admin
      },
    });

    // Mettre à jour le nombre de places réservées
    await prisma.evenement.update({
      where: { id: evenementId },
      data: {
        placesReservees: {
          increment: nombrePersonnes,
        },
      },
    });

    revalidatePath(`/evenements/${evenementId}`);
    revalidatePath("/evenements");
    revalidatePath("/admin/evenements");

    return { success: true, data: inscription };
  } catch (error) {
    console.error("Erreur lors de l'ajout du participant:", error);
    return { success: false, error: "Erreur lors de l'ajout du participant" };
  }
}

/**
 * Inscription d'un visiteur (non connecté) à un événement
 * Crée une inscription en attente et envoie un email à l'administrateur
 */
export async function inscrireVisiteurEvenement(data: z.infer<typeof InscriptionVisiteurSchema>) {
  try {
    const validatedData = InscriptionVisiteurSchema.parse(data);

    // Vérifier que l'événement existe et est ouvert aux inscriptions
    const evenement = await prisma.evenement.findUnique({
      where: { id: validatedData.evenementId },
    });

    if (!evenement) {
      return { success: false, error: "Événement non trouvé" };
    }

    if (!evenement.inscriptionRequis) {
      return { success: false, error: "Cet événement ne nécessite pas d'inscription" };
    }

    if (evenement.dateLimiteInscription && evenement.dateLimiteInscription < new Date()) {
      return { success: false, error: "La date limite d'inscription est dépassée" };
    }

    // Vérifier les places disponibles
    if (evenement.placesDisponibles && evenement.placesReservees + validatedData.nombrePersonnes > evenement.placesDisponibles) {
      return { success: false, error: "Pas assez de places disponibles" };
    }

    // Vérifier si le visiteur n'est pas déjà inscrit avec cet email
    const inscriptionExistante = await prisma.inscriptionEvenement.findFirst({
      where: {
        evenementId: validatedData.evenementId,
        visiteurEmail: validatedData.email,
        adherentId: null, // S'assurer que c'est bien un visiteur
      },
    });

    if (inscriptionExistante) {
      return { success: false, error: "Vous êtes déjà inscrit à cet événement avec cet email" };
    }

    // Créer l'inscription avec les informations du visiteur
    const inscription = await prisma.inscriptionEvenement.create({
      data: {
        evenementId: validatedData.evenementId,
        adherentId: null, // Pas d'adhérent pour les visiteurs
        visiteurNom: validatedData.nom,
        visiteurEmail: validatedData.email,
        visiteurTelephone: validatedData.telephone,
        visiteurAdresse: validatedData.adresse,
        nombrePersonnes: validatedData.nombrePersonnes,
        commentaires: validatedData.commentaires,
        statut: "EnAttente", // En attente de confirmation par l'admin
      },
    });

    // Mettre à jour le nombre de places réservées (temporairement réservées)
    await prisma.evenement.update({
      where: { id: validatedData.evenementId },
      data: {
        placesReservees: {
          increment: validatedData.nombrePersonnes,
        },
      },
    });

    // Envoyer un email à l'administrateur
    try {
      await sendVisiteurInscriptionEmail(
        evenement.titre,
        validatedData.nom,
        validatedData.email,
        validatedData.telephone,
        validatedData.adresse,
        validatedData.nombrePersonnes,
        validatedData.commentaires
      );
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email à l'admin:", emailError);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    // Envoyer un email de confirmation au visiteur
    try {
      await sendVisiteurInscriptionConfirmationEmail(
        validatedData.email,
        validatedData.nom,
        evenement.titre,
        evenement.dateDebut,
        evenement.lieu,
        validatedData.nombrePersonnes
      );
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de confirmation:", emailError);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    revalidatePath(`/evenements/${validatedData.evenementId}`);
    revalidatePath("/evenements");

    return { 
      success: true, 
      message: "Votre inscription a été enregistrée avec succès. Un email de confirmation vous a été envoyé." 
    };
  } catch (error) {
    console.error("Erreur lors de l'inscription du visiteur:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    // Gérer les erreurs de contrainte unique
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { success: false, error: "Vous êtes déjà inscrit à cet événement avec cet email" };
    }
    return { success: false, error: "Erreur lors de l'inscription. Veuillez réessayer." };
  }
}

/**
 * Supprimer un participant d'un événement (Admin)
 */
export async function removeParticipantFromEvent(inscriptionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer des participants" };
    }

    // Récupérer l'inscription
    const inscription = await prisma.inscriptionEvenement.findUnique({
      where: { id: inscriptionId },
    });

    if (!inscription) {
      return { success: false, error: "Inscription non trouvée" };
    }

    // Supprimer l'inscription
    await prisma.inscriptionEvenement.delete({
      where: { id: inscriptionId },
    });

    // Mettre à jour le nombre de places réservées
    await prisma.evenement.update({
      where: { id: inscription.evenementId },
      data: {
        placesReservees: {
          decrement: inscription.nombrePersonnes,
        },
      },
    });

    revalidatePath(`/evenements/${inscription.evenementId}`);
    revalidatePath("/evenements");
    revalidatePath("/admin/evenements");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression du participant:", error);
    return { success: false, error: "Erreur lors de la suppression du participant" };
  }
}

/**
 * Uploader une image pour un événement
 * Sauvegarde dans /public/evenements
 */
export async function uploadEvenementImage(formData: FormData): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, message: "Seuls les administrateurs peuvent uploader des images" };
    }

    const file: File | null = formData.get("file") as unknown as File;

    if (!file) {
      return { success: false, message: "Aucun fichier fourni" };
    }

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      return { success: false, message: "Le fichier doit être une image" };
    }

    // Vérifier la taille du fichier (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { success: false, message: "L'image ne doit pas dépasser 10MB" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Créer le dossier de destination s'il n'existe pas
    const uploadDir = join(process.cwd(), "public", "ressources", "evenements");
    
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Générer un nom de fichier unique avec horodatage
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Nettoyer le nom
    const extension = originalName.split('.').pop();
    const fileName = `${timestamp}_${originalName}`;
    
    const path = join(uploadDir, fileName);
    
    await writeFilePromise(path, buffer);

    // Construire l'URL publique
    const publicUrl = `/ressources/evenements/${fileName}`;

    return { 
      success: true, 
      url: publicUrl,
      message: "Image uploadée avec succès"
    };

  } catch (error) {
    console.error("Erreur lors de l'upload de l'image:", error);
    return { 
      success: false, 
      message: `Erreur lors de l'upload: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    };
  }
}

/**
 * Obtenir les statistiques des événements
 */
export async function getEvenementsStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent voir les statistiques" };
    }

    const [
      totalEvenements,
      evenementsPublies,
      evenementsBrouillons,
      evenementsArchives,
      totalInscriptions,
      evenementsAvecInscriptions,
    ] = await Promise.all([
      prisma.evenement.count(),
      prisma.evenement.count({ where: { statut: "Publie" } }),
      prisma.evenement.count({ where: { statut: "Brouillon" } }),
      prisma.evenement.count({ where: { statut: "Archive" } }),
      prisma.inscriptionEvenement.count(),
      prisma.evenement.count({ where: { inscriptionRequis: true } }),
    ]);

    const stats = {
      totalEvenements,
      evenementsPublies,
      evenementsBrouillons,
      evenementsArchives,
      totalInscriptions,
      evenementsAvecInscriptions,
      tauxPublication: totalEvenements > 0 ? Math.round((evenementsPublies / totalEvenements) * 100) : 0,
      moyenneInscriptions: evenementsAvecInscriptions > 0 ? Math.round(totalInscriptions / evenementsAvecInscriptions) : 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}
