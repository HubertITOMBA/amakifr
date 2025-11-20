"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TypeDocument } from "@prisma/client";
import { z } from "zod";
import { writeFile, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";

const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlinkSync);

const UploadDocumentSchema = z.object({
  nomOriginal: z.string().min(1, "Nom de fichier requis"),
  type: z.nativeEnum(TypeDocument),
  categorie: z.string().max(100, "Catégorie trop longue").optional(),
  taille: z.number().min(1, "Taille invalide"),
  mimeType: z.string().min(1, "Type MIME requis"),
  description: z.string().optional(),
  estPublic: z.boolean().default(false),
  adherentId: z.string().optional(),
});

/**
 * Détermine le type de document à partir du MIME type
 */
function getDocumentTypeFromMimeType(mimeType: string): TypeDocument {
  if (mimeType === "application/pdf") return TypeDocument.PDF;
  if (mimeType.startsWith("image/")) return TypeDocument.Image;
  if (mimeType.startsWith("video/")) return TypeDocument.Video;
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return TypeDocument.Excel;
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return TypeDocument.Word;
  return TypeDocument.Autre;
}

/**
 * Upload un document pour l'utilisateur connecté
 * 
 * @param formData - Les données du formulaire contenant le fichier et les métadonnées
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et document (object) avec les détails
 */
export async function uploadDocument(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const file: File | null = formData.get("file") as unknown as File;
    const categorie = formData.get("categorie") as string | null;
    const description = formData.get("description") as string | null;
    const estPublic = formData.get("estPublic") === "true";
    const adherentId = formData.get("adherentId") as string | null;

    if (!file) {
      return { success: false, error: "Aucun fichier fourni" };
    }

    // Validation du type de fichier
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: `Type de fichier non autorisé: ${file.type}`,
      };
    }

    // Validation de la taille (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "Fichier trop volumineux (max 50MB)",
      };
    }

    // Déterminer le type de document
    const type = getDocumentTypeFromMimeType(file.type);

    // Créer le dossier de destination
    const baseDir = join(process.cwd(), "public", "ressources", "documents");
    const uploadDir = categorie ? join(baseDir, categorie) : baseDir;

    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "";
    const nom = `${timestamp}.${extension}`;
    const chemin = join(uploadDir, nom);

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFileAsync(chemin, buffer);

    // Construire le chemin relatif pour l'URL publique
    const cheminRelatif = categorie
      ? `/ressources/documents/${categorie}/${nom}`
      : `/ressources/documents/${nom}`;

    // Créer l'enregistrement dans la base de données
    const document = await db.document.create({
      data: {
        userId: session.user.id,
        adherentId: adherentId || null,
        nom,
        nomOriginal: file.name,
        type,
        categorie: categorie || null,
        chemin: cheminRelatif,
        taille: file.size,
        mimeType: file.type,
        description: description || null,
        estPublic,
      },
    });

    revalidatePath("/user/documents");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: "Document uploadé avec succès",
      document: {
        id: document.id,
        nom: document.nom,
        nomOriginal: document.nomOriginal,
        type: document.type,
        categorie: document.categorie,
        chemin: document.chemin,
        taille: document.taille,
        mimeType: document.mimeType,
        description: document.description,
        estPublic: document.estPublic,
        createdAt: document.createdAt,
      },
    };
  } catch (error) {
    console.error("Erreur lors de l'upload du document:", error);
    return {
      success: false,
      error: `Erreur lors de l'upload du document: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Récupère les documents de l'utilisateur connecté
 * 
 * @param options - Options de filtrage
 * @returns Un objet avec success (boolean), documents (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getDocuments(options?: {
  type?: TypeDocument;
  categorie?: string;
  adherentId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const where: any = {
      userId: session.user.id,
    };

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.categorie) {
      where.categorie = options.categorie;
    }

    if (options?.adherentId) {
      where.adherentId = options.adherentId;
    }

    const documents = await db.document.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return {
      success: true,
      documents,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des documents:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des documents",
    };
  }
}

/**
 * Supprime un document
 * 
 * @param documentId - L'ID du document à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function deleteDocument(documentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que le document appartient à l'utilisateur
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return { success: false, error: "Document non trouvé" };
    }

    if (document.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Supprimer le fichier physique
    const filePath = join(process.cwd(), "public", document.chemin);
    if (existsSync(filePath)) {
      try {
        await unlinkAsync(filePath);
      } catch (fileError) {
        console.error("Erreur lors de la suppression du fichier:", fileError);
        // Continuer même si la suppression du fichier échoue
      }
    }

    // Supprimer l'enregistrement de la base de données
    await db.document.delete({
      where: { id: documentId },
    });

    revalidatePath("/user/documents");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: "Document supprimé avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du document:", error);
    return {
      success: false,
      error: "Erreur lors de la suppression du document",
    };
  }
}

/**
 * Met à jour les métadonnées d'un document
 * 
 * @param documentId - L'ID du document à mettre à jour
 * @param data - Les nouvelles données
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateDocument(
  documentId: string,
  data: {
    categorie?: string;
    description?: string;
    estPublic?: boolean;
  }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que le document appartient à l'utilisateur
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return { success: false, error: "Document non trouvé" };
    }

    if (document.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    await db.document.update({
      where: { id: documentId },
      data: {
        categorie: data.categorie !== undefined ? data.categorie : document.categorie,
        description: data.description !== undefined ? data.description : document.description,
        estPublic: data.estPublic !== undefined ? data.estPublic : document.estPublic,
      },
    });

    revalidatePath("/user/documents");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: "Document mis à jour avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du document:", error);
    return {
      success: false,
      error: "Erreur lors de la mise à jour du document",
    };
  }
}

/**
 * Récupère tous les documents pour les administrateurs
 * 
 * @param options - Options de filtrage
 * @returns Un objet avec success (boolean), documents (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getAllDocuments(options?: {
  type?: TypeDocument;
  categorie?: string;
  userId?: string;
  searchTerm?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "Admin") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const where: any = {};

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.categorie) {
      where.categorie = options.categorie;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.searchTerm) {
      where.OR = [
        { nomOriginal: { contains: options.searchTerm, mode: "insensitive" } },
        { description: { contains: options.searchTerm, mode: "insensitive" } },
        { categorie: { contains: options.searchTerm, mode: "insensitive" } },
      ];
    }

    const documents = await db.document.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return {
      success: true,
      documents,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des documents:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des documents",
    };
  }
}

/**
 * Supprime un document (pour les administrateurs)
 * 
 * @param documentId - L'ID du document à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function adminDeleteDocument(documentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "Admin") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    // Récupérer le document
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return { success: false, error: "Document non trouvé" };
    }

    // Supprimer le fichier physique
    const filePath = join(process.cwd(), "public", document.chemin);
    if (existsSync(filePath)) {
      try {
        await unlinkAsync(filePath);
      } catch (fileError) {
        console.error("Erreur lors de la suppression du fichier:", fileError);
        // Continuer même si la suppression du fichier échoue
      }
    }

    // Supprimer l'enregistrement de la base de données
    await db.document.delete({
      where: { id: documentId },
    });

    revalidatePath("/admin/documents");
    revalidatePath("/user/documents");
    revalidatePath("/user/profile");

    return {
      success: true,
      message: "Document supprimé avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du document:", error);
    return {
      success: false,
      error: "Erreur lors de la suppression du document",
    };
  }
}

