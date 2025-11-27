"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// Schémas de validation
const MediaGalerieSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre ne peut pas dépasser 255 caractères"),
  description: z.string().optional(),
  type: z.enum(["image", "video"], {
    errorMap: () => ({ message: "Le type doit être 'image' ou 'video'" })
  }),
  categorie: z.string().min(1, "La catégorie est requise").max(100),
  couleur: z.enum(["blue", "green", "purple", "orange"]).default("blue"),
  date: z.string().min(1, "La date est requise"),
  lieu: z.string().max(200, "Le lieu ne peut pas dépasser 200 caractères").optional(),
  ordre: z.number().int().default(0),
  actif: z.boolean().default(true),
});

const UpdateMediaGalerieSchema = MediaGalerieSchema.partial().extend({
  id: z.string().min(1, "L'ID est requis"),
});

/**
 * Upload un média (photo ou vidéo) pour la galerie
 * 
 * @param formData - Les données du formulaire contenant le fichier et les métadonnées
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et media (object) avec les détails
 */
export async function uploadMediaGalerie(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent ajouter des médias à la galerie." };
    }

    const file: File | null = formData.get("file") as unknown as File;
    const titre = formData.get("titre") as string;
    const description = formData.get("description") as string | null;
    const type = formData.get("type") as string;
    const categorie = formData.get("categorie") as string;
    const couleur = formData.get("couleur") as string;
    const date = formData.get("date") as string;
    const lieu = formData.get("lieu") as string | null;
    const ordre = formData.get("ordre") as string | null;
    const actif = formData.get("actif") === "true" || formData.get("actif") === null;

    if (!file) {
      return { success: false, error: "Aucun fichier fourni" };
    }

    // Validation du type de fichier
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      return {
        success: false,
        error: "Le fichier doit être une image ou une vidéo",
      };
    }

    // Vérifier la cohérence entre le type déclaré et le type réel
    if ((type === "image" && !isImage) || (type === "video" && !isVideo)) {
      return {
        success: false,
        error: `Le type déclaré (${type}) ne correspond pas au type de fichier (${isImage ? "image" : "video"})`,
      };
    }

    // Validation de la taille (max 5GB pour les vidéos, 10MB pour les images)
    // La limite de 5GB correspond à la configuration nginx (client_max_body_size 5G)
    const maxSizeImage = 10 * 1024 * 1024; // 10MB
    const maxSizeVideo = 5 * 1024 * 1024 * 1024; // 5GB (limite nginx)
    const maxSize = isImage ? maxSizeImage : maxSizeVideo;

    if (file.size > maxSize) {
      return {
        success: false,
        error: `Fichier trop volumineux (max ${maxSize / (1024 * 1024)}MB pour les ${isImage ? "images" : "vidéos"})`,
      };
    }

    // Valider les données avec Zod
    const rawData = {
      titre,
      description: description || undefined,
      type,
      categorie,
      couleur: couleur || "blue",
      date,
      lieu: lieu || undefined,
      ordre: ordre ? parseInt(ordre, 10) : 0,
      actif,
    };

    const validatedData = MediaGalerieSchema.parse(rawData);

    // Créer le dossier de destination
    const baseDir = join(process.cwd(), "public", "ressources", "galeries");
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "";
    const nomFichier = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const chemin = join(baseDir, nomFichier);

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Validation de sécurité : vérifier le contenu réel du fichier (magic bytes)
    const { validateFileContent, validateFileSize } = await import('@/lib/file-validation');
    const fileValidation = await validateFileContent(buffer, file.type, file.name);
    
    if (!fileValidation.valid) {
      return {
        success: false,
        error: fileValidation.error || 'Le fichier est invalide ou potentiellement malveillant',
      };
    }
    
    // Validation de la taille
    const sizeValidation = validateFileSize(
      file.size,
      isImage ? maxSizeImage : maxSizeVideo,
      isImage ? 'image' : 'video'
    );
    
    if (!sizeValidation.valid) {
      return {
        success: false,
        error: sizeValidation.error || 'Fichier trop volumineux',
      };
    }
    
    await writeFile(chemin, buffer);

    // Construire le chemin relatif pour l'URL publique
    const cheminRelatif = `/ressources/galeries/${nomFichier}`;

    // Créer l'enregistrement dans la base de données
    const media = await db.mediaGalerie.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description || null,
        type: validatedData.type,
        chemin: cheminRelatif,
        nomFichier: file.name,
        mimeType: file.type,
        taille: file.size,
        categorie: validatedData.categorie,
        couleur: validatedData.couleur,
        date: new Date(validatedData.date),
        lieu: validatedData.lieu || null,
        ordre: validatedData.ordre,
        actif: validatedData.actif,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/galerie");
    revalidatePath("/admin/galerie");

    return {
      success: true,
      message: "Média ajouté à la galerie avec succès",
      media: {
        id: media.id,
        titre: media.titre,
        description: media.description,
        type: media.type,
        chemin: media.chemin,
        nomFichier: media.nomFichier,
        mimeType: media.mimeType,
        taille: media.taille,
        categorie: media.categorie,
        couleur: media.couleur,
        date: media.date,
        lieu: media.lieu,
        ordre: media.ordre,
        actif: media.actif,
        createdAt: media.createdAt,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de l'upload du média:", error);
    return {
      success: false,
      error: `Erreur lors de l'upload: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Récupère tous les médias de la galerie
 * 
 * @param actifOnly - Si true, ne retourne que les médias actifs
 * @returns Un objet avec success (boolean) et data (array) ou error (string)
 */
export async function getAllMediaGalerie(actifOnly: boolean = false) {
  try {
    const where = actifOnly ? { actif: true } : {};
    
    const medias = await db.mediaGalerie.findMany({
      where,
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { categorie: "asc" },
        { ordre: "asc" },
        { date: "desc" },
      ],
    });

    return {
      success: true,
      data: medias,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des médias:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des médias",
    };
  }
}

/**
 * Récupère un média par son ID
 * 
 * @param id - L'ID du média
 * @returns Un objet avec success (boolean) et data (object) ou error (string)
 */
export async function getMediaGalerieById(id: string) {
  try {
    const media = await db.mediaGalerie.findUnique({
      where: { id },
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

    if (!media) {
      return {
        success: false,
        error: "Média non trouvé",
      };
    }

    return {
      success: true,
      data: media,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du média:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération du média",
    };
  }
}

/**
 * Met à jour un média de la galerie
 * 
 * @param formData - Les données du formulaire contenant les champs à mettre à jour
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateMediaGalerie(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier les médias." };
    }

    const id = formData.get("id") as string;
    const titre = formData.get("titre") as string | null;
    const description = formData.get("description") as string | null;
    const categorie = formData.get("categorie") as string | null;
    const couleur = formData.get("couleur") as string | null;
    const date = formData.get("date") as string | null;
    const lieu = formData.get("lieu") as string | null;
    const ordre = formData.get("ordre") as string | null;
    const actif = formData.get("actif") as string | null;

    // Construire l'objet de données à mettre à jour
    const updateData: any = {};
    if (titre !== null) updateData.titre = titre;
    if (description !== null) updateData.description = description || null;
    if (categorie !== null) updateData.categorie = categorie;
    if (couleur !== null) updateData.couleur = couleur;
    if (date !== null) updateData.date = new Date(date);
    if (lieu !== null) updateData.lieu = lieu || null;
    if (ordre !== null) updateData.ordre = parseInt(ordre, 10);
    if (actif !== null) updateData.actif = actif === "true";

    // Valider avec Zod si des données sont fournies
    if (Object.keys(updateData).length > 0) {
      const rawData = {
        id,
        ...updateData,
      };
      UpdateMediaGalerieSchema.parse(rawData);
    }

    // Vérifier que le média existe
    const existingMedia = await db.mediaGalerie.findUnique({
      where: { id },
    });

    if (!existingMedia) {
      return { success: false, error: "Média non trouvé" };
    }

    // Mettre à jour le média
    const updatedMedia = await db.mediaGalerie.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/galerie");
    revalidatePath("/admin/galerie");

    return {
      success: true,
      message: "Média mis à jour avec succès",
      media: updatedMedia,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du média:", error);
    return {
      success: false,
      error: `Erreur lors de la mise à jour: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Supprime un média de la galerie
 * 
 * @param id - L'ID du média à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function deleteMediaGalerie(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer les médias." };
    }

    // Vérifier que le média existe
    const existingMedia = await db.mediaGalerie.findUnique({
      where: { id },
    });

    if (!existingMedia) {
      return { success: false, error: "Média non trouvé" };
    }

    // Supprimer le fichier physique (optionnel, on peut le garder pour l'historique)
    // const filePath = join(process.cwd(), "public", existingMedia.chemin);
    // if (existsSync(filePath)) {
    //   await unlink(filePath);
    // }

    // Supprimer l'enregistrement de la base de données
    await db.mediaGalerie.delete({
      where: { id },
    });

    revalidatePath("/galerie");
    revalidatePath("/admin/galerie");

    return {
      success: true,
      message: "Média supprimé avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du média:", error);
    return {
      success: false,
      error: `Erreur lors de la suppression: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Récupère les médias groupés par catégorie
 * 
 * @param actifOnly - Si true, ne retourne que les médias actifs
 * @returns Un objet avec success (boolean) et data (object) ou error (string)
 */
export async function getMediaGalerieByCategory(actifOnly: boolean = true) {
  try {
    const where = actifOnly ? { actif: true } : {};
    
    const medias = await db.mediaGalerie.findMany({
      where,
      orderBy: [
        { categorie: "asc" },
        { ordre: "asc" },
        { date: "desc" },
      ],
    });

    // Grouper par catégorie
    const grouped: Record<string, typeof medias> = {};
    medias.forEach((media) => {
      if (!grouped[media.categorie]) {
        grouped[media.categorie] = [];
      }
      grouped[media.categorie].push(media);
    });

    return {
      success: true,
      data: grouped,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des médias par catégorie:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des médias",
    };
  }
}

