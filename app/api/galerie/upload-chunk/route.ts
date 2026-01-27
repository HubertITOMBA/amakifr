import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { validateFileContent, validateFileSize } from '@/lib/file-validation';

// Stockage temporaire des chunks en mémoire (en production, utiliser Redis ou une base de données)
const chunkStorage = new Map<string, {
  totalChunks: number;
  receivedChunks: Set<number>;
  filePath: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  metadata: any;
}>();

/**
 * Route API pour recevoir les chunks d'upload
 * Les chunks sont assemblés côté serveur et le fichier final est créé une fois tous les chunks reçus
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Non autorisé. Vous devez être connecté." },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Seuls les administrateurs peuvent ajouter des médias à la galerie." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    
    const chunk = formData.get("chunk") as File;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string, 10);
    const totalChunks = parseInt(formData.get("totalChunks") as string, 10);
    const uploadId = formData.get("uploadId") as string;
    const fileName = formData.get("fileName") as string;
    const mimeType = formData.get("mimeType") as string;
    const totalSize = parseInt(formData.get("totalSize") as string, 10);
    const isLastChunk = formData.get("isLastChunk") === "true";
    
    // Métadonnées du média (envoyées avec le dernier chunk)
    let metadata: any = null;
    if (isLastChunk) {
      metadata = {
        titre: formData.get("titre") as string,
        description: formData.get("description") as string | null,
        type: formData.get("type") as string,
        categorie: formData.get("categorie") as string,
        couleur: formData.get("couleur") as string || "blue",
        date: formData.get("date") as string,
        lieu: formData.get("lieu") as string | null,
        ordre: parseInt(formData.get("ordre") as string, 10) || 0,
        actif: formData.get("actif") === "true" || formData.get("actif") === null,
      };
    }

    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
      return NextResponse.json(
        { success: false, error: "Données de chunk invalides" },
        { status: 400 }
      );
    }

    // Créer le dossier temporaire pour les chunks
    const tempDir = join(process.cwd(), "public", "ressources", "galeries", "temp");
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Sauvegarder chaque chunk dans un fichier séparé
    const chunkPath = join(tempDir, `${uploadId}_chunk_${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(chunkPath, chunkBuffer);

    // Mettre à jour le stockage des chunks
    if (!chunkStorage.has(uploadId)) {
      chunkStorage.set(uploadId, {
        totalChunks,
        receivedChunks: new Set([chunkIndex]),
        filePath: "", // Non utilisé, chaque chunk a son propre fichier
        fileName,
        mimeType,
        totalSize,
        metadata: metadata || null, // Stocker les métadonnées même si c'est le premier chunk
      });
    } else {
      const storage = chunkStorage.get(uploadId)!;
      storage.receivedChunks.add(chunkIndex);
      if (metadata) {
        storage.metadata = metadata;
      }
    }

    const storage = chunkStorage.get(uploadId)!;

    // Log pour débogage
    if (process.env.NODE_ENV === 'development') {
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} reçu pour uploadId ${uploadId}:`, {
        receivedChunks: storage.receivedChunks.size,
        totalChunks,
        hasMetadata: !!storage.metadata,
        isLastChunk,
        fileName,
        mimeType,
      });
    }

    // Vérifier si tous les chunks sont reçus
    // Pour les fichiers en un seul chunk (images souvent < 5MB), vérifier que les métadonnées sont présentes
    const allChunksReceived = storage.receivedChunks.size === totalChunks;
    const hasMetadata = storage.metadata !== null;
    
    // Log pour débogage
    if (process.env.NODE_ENV === 'development') {
      console.log(`Vérification assemblage:`, {
        allChunksReceived,
        hasMetadata,
        readyToAssemble: allChunksReceived && hasMetadata,
      });
    }
    
    if (allChunksReceived && hasMetadata) {
      // Tous les chunks sont reçus, assembler le fichier final
      const finalDir = join(process.cwd(), "public", "ressources", "galeries");
      if (!existsSync(finalDir)) {
        mkdirSync(finalDir, { recursive: true });
      }

      const timestamp = Date.now();
      const finalFileName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const finalPath = join(finalDir, finalFileName);

      // Lire tous les chunks et les assembler dans l'ordre
      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkFilePath = join(tempDir, `${uploadId}_chunk_${i}`);
        try {
          if (!existsSync(chunkFilePath)) {
            throw new Error(`Fichier chunk ${i} introuvable: ${chunkFilePath}`);
          }
          const chunkData = await readFile(chunkFilePath);
          chunks.push(chunkData);
          // Supprimer le chunk temporaire
          await unlink(chunkFilePath);
        } catch (error) {
          console.error(`Erreur lors de la lecture du chunk ${i}:`, error);
          // Nettoyer les chunks déjà lus
          for (let j = 0; j < i; j++) {
            try {
              const chunkToDelete = join(tempDir, `${uploadId}_chunk_${j}`);
              if (existsSync(chunkToDelete)) {
                await unlink(chunkToDelete);
              }
            } catch (e) {
              // Ignorer les erreurs de suppression
            }
          }
          // Nettoyer le stockage
          chunkStorage.delete(uploadId);
          throw new Error(`Chunk ${i} manquant ou corrompu: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Écrire le fichier final
      const finalBuffer = Buffer.concat(chunks);
      
      // Vérifier que la taille correspond
      if (finalBuffer.length !== storage.totalSize) {
        console.error(`Taille du fichier final incorrecte: attendu ${storage.totalSize}, obtenu ${finalBuffer.length}`);
        // Nettoyer le stockage
        chunkStorage.delete(uploadId);
        return NextResponse.json(
          { success: false, error: "Taille du fichier final incorrecte" },
          { status: 500 }
        );
      }
      
      // Validation de sécurité : vérifier le contenu réel du fichier (magic bytes)
      const fileValidation = await validateFileContent(
        finalBuffer,
        storage.mimeType,
        storage.fileName
      );
      
      if (!fileValidation.valid) {
        console.error('Validation du fichier échouée:', fileValidation.error);
        // Nettoyer le stockage
        chunkStorage.delete(uploadId);
        return NextResponse.json(
          { 
            success: false, 
            error: fileValidation.error || 'Le fichier est invalide ou potentiellement malveillant' 
          },
          { status: 400 }
        );
      }
      
      // Validation de la taille
      const sizeValidation = validateFileSize(
        finalBuffer.length,
        storage.mimeType.startsWith('image/') ? 10 * 1024 * 1024 : 5 * 1024 * 1024 * 1024,
        storage.mimeType.startsWith('image/') ? 'image' : 'video'
      );
      
      if (!sizeValidation.valid) {
        console.error('Validation de la taille échouée:', sizeValidation.error);
        chunkStorage.delete(uploadId);
        return NextResponse.json(
          { success: false, error: sizeValidation.error },
          { status: 400 }
        );
      }
      
      await writeFile(finalPath, finalBuffer);
      
      // Vérifier que le fichier a bien été écrit
      if (!existsSync(finalPath)) {
        console.error(`Le fichier final n'a pas été créé: ${finalPath}`);
        chunkStorage.delete(uploadId);
        return NextResponse.json(
          { success: false, error: "Erreur lors de l'écriture du fichier final" },
          { status: 500 }
        );
      }

      // Nettoyer le stockage
      chunkStorage.delete(uploadId);

      // Importer les dépendances nécessaires pour créer l'enregistrement
      const { db } = await import('@/lib/db');
      const { revalidatePath } = await import('next/cache');
      const { z } = await import('zod');

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

      const validatedData = MediaGalerieSchema.parse(storage.metadata);

      // Construire le chemin relatif pour l'URL publique
      const cheminRelatif = `/ressources/galeries/${finalFileName}`;

      // Créer l'enregistrement dans la base de données
      const media = await db.mediaGalerie.create({
        data: {
          titre: validatedData.titre,
          description: validatedData.description || null,
          type: validatedData.type,
          chemin: cheminRelatif,
          nomFichier: fileName,
          mimeType: storage.mimeType,
          taille: storage.totalSize,
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
    }

    // Chunk reçu, mais pas encore tous les chunks ou métadonnées manquantes
    // Pour les fichiers en un seul chunk, on doit attendre que les métadonnées soient reçues
    if (allChunksReceived && !hasMetadata) {
      return NextResponse.json({
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} reçu, en attente des métadonnées...`,
        progress: Math.round((storage.receivedChunks.size / totalChunks) * 100),
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} reçu`,
      progress: Math.round((storage.receivedChunks.size / totalChunks) * 100),
    });
  } catch (error) {
    console.error("Erreur lors de l'upload du chunk:", error);
    return NextResponse.json(
      { success: false, error: "Une erreur est survenue lors de l'upload du chunk." },
      { status: 500 }
    );
  }
}

// Configuration pour permettre les gros fichiers
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes pour les gros fichiers

