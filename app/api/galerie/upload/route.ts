import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import formidable from 'formidable';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';

// Schéma de validation
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

/**
 * Convertit un NextRequest en IncomingMessage pour formidable
 * Formidable nécessite un IncomingMessage avec le stream attaché
 * 
 * Note: Next.js limite le body à 10MB par défaut côté client.
 * Pour contourner cela, on doit utiliser request.body directement
 * sans parsing automatique, mais Next.js le limite toujours.
 * 
 * Solution: Utiliser request.arrayBuffer() pour lire le body complet,
 * puis créer un stream à partir du buffer.
 */
async function createIncomingMessage(request: NextRequest): Promise<IncomingMessage> {
  // Lire le body comme ArrayBuffer pour éviter le parsing automatique
  // ATTENTION: Cela charge tout en mémoire, mais c'est nécessaire
  // car Next.js limite le body à 10MB avant qu'il n'arrive ici
  const bodyBuffer = await request.arrayBuffer();
  const bodyStream = Readable.from(Buffer.from(bodyBuffer));
  
  // Créer un IncomingMessage en héritant du stream
  const req = Object.setPrototypeOf(bodyStream, IncomingMessage.prototype) as IncomingMessage;
  
  // Ajouter les propriétés nécessaires
  req.headers = Object.fromEntries(request.headers.entries());
  req.url = request.url;
  req.method = request.method;
  
  return req;
}

/**
 * Route API pour l'upload de médias (photos et vidéos) pour la galerie
 * Utilise formidable pour parser le multipart/form-data en streaming
 * Permet d'uploader des fichiers jusqu'à 5GB (limite configurée dans nginx)
 */
export async function POST(request: NextRequest) {
  try {
    console.log("=== Début de l'upload avec formidable ===");
    
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Non autorisé. Vous devez être connecté." },
        { status: 401 }
      );
    }

    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Seuls les administrateurs peuvent ajouter des médias à la galerie." },
        { status: 403 }
      );
    }

    // Créer le dossier de destination pour formidable
    const baseDir = join(process.cwd(), "public", "ressources", "galeries");
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    // Créer un IncomingMessage mock pour formidable
    const req = await createIncomingMessage(request);
    
    // Configurer formidable
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB (limite nginx)
      maxTotalFileSize: 5 * 1024 * 1024 * 1024,
      keepExtensions: true,
      uploadDir: baseDir,
      multiples: false,
    });

    // Parser le formulaire
    const [fields, files] = await form.parse(req);

    // Récupérer le fichier uploadé
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    
    if (!uploadedFile) {
      return NextResponse.json(
        { success: false, error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    console.log("Fichier reçu:", {
      originalFilename: uploadedFile.originalFilename,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      filepath: uploadedFile.filepath,
    });

    // Validation du type de fichier
    const isImage = uploadedFile.mimetype?.startsWith("image/") || false;
    const isVideo = uploadedFile.mimetype?.startsWith("video/") || false;

    if (!isImage && !isVideo) {
      // Supprimer le fichier uploadé si invalide
      if (uploadedFile.filepath) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(uploadedFile.filepath);
        } catch (e) {
          console.error("Erreur lors de la suppression du fichier invalide:", e);
        }
      }
      return NextResponse.json(
        { success: false, error: "Le fichier doit être une image ou une vidéo" },
        { status: 400 }
      );
    }

    // Récupérer les champs du formulaire
    const type = Array.isArray(fields.type) ? fields.type[0] : fields.type;
    if ((type === "image" && !isImage) || (type === "video" && !isVideo)) {
      // Supprimer le fichier uploadé si invalide
      if (uploadedFile.filepath) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(uploadedFile.filepath);
        } catch (e) {
          console.error("Erreur lors de la suppression du fichier invalide:", e);
        }
      }
      return NextResponse.json(
        { success: false, error: `Le type déclaré (${type}) ne correspond pas au type de fichier (${isImage ? "image" : "video"})` },
        { status: 400 }
      );
    }

    // Validation de la taille
    const maxSizeImage = 10 * 1024 * 1024; // 10MB
    const maxSizeVideo = 5 * 1024 * 1024 * 1024; // 5GB (limite nginx)
    const maxSize = isImage ? maxSizeImage : maxSizeVideo;

    if (uploadedFile.size > maxSize) {
      // Supprimer le fichier uploadé si trop volumineux
      if (uploadedFile.filepath) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(uploadedFile.filepath);
        } catch (e) {
          console.error("Erreur lors de la suppression du fichier trop volumineux:", e);
        }
      }
      return NextResponse.json(
        { success: false, error: `Fichier trop volumineux (max ${maxSize / (1024 * 1024)}MB pour les ${isImage ? "images" : "vidéos"})` },
        { status: 400 }
      );
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const originalName = uploadedFile.originalFilename || "file";
    const extension = originalName.split(".").pop() || "";
    const nomFichier = `${timestamp}_${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const nouveauChemin = join(baseDir, nomFichier);

    // Renommer le fichier uploadé par formidable
    if (uploadedFile.filepath) {
      const fs = await import('fs/promises');
      await fs.rename(uploadedFile.filepath, nouveauChemin);
    }

    // Construire le chemin relatif pour l'URL publique
    const cheminRelatif = `/ressources/galeries/${nomFichier}`;

    // Valider les données avec Zod
    const rawData = {
      titre: Array.isArray(fields.titre) ? fields.titre[0] : fields.titre,
      description: Array.isArray(fields.description) ? fields.description[0] : fields.description,
      type: type,
      categorie: Array.isArray(fields.categorie) ? fields.categorie[0] : fields.categorie,
      couleur: (Array.isArray(fields.couleur) ? fields.couleur[0] : fields.couleur) || "blue",
      date: Array.isArray(fields.date) ? fields.date[0] : fields.date,
      lieu: Array.isArray(fields.lieu) ? fields.lieu[0] : fields.lieu,
      ordre: Array.isArray(fields.ordre) ? parseInt(fields.ordre[0] as string, 10) : (fields.ordre ? parseInt(fields.ordre as string, 10) : 0),
      actif: (Array.isArray(fields.actif) ? fields.actif[0] : fields.actif) === "true" || !fields.actif,
    };

    const validatedData = MediaGalerieSchema.parse(rawData);

    // Créer l'enregistrement dans la base de données
    const media = await db.mediaGalerie.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description || null,
        type: validatedData.type,
        chemin: cheminRelatif,
        nomFichier: originalName,
        mimeType: uploadedFile.mimetype || "application/octet-stream",
        taille: uploadedFile.size,
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Erreur lors de l'upload du média:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Une erreur est survenue lors de l'upload du média." },
      { status: 500 }
    );
  }
}

// Configuration pour permettre les gros fichiers
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes pour les gros fichiers

