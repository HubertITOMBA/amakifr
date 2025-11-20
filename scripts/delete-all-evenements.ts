import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { existsSync, unlinkSync, readdirSync, statSync } from "fs";
import { promisify } from "util";
import { readdir, unlink, stat } from "fs/promises";

const prisma = new PrismaClient();

/**
 * Script pour supprimer tous les événements et leurs données liées
 * - Supprime les inscriptions aux événements
 * - Supprime les conversations liées aux événements
 * - Supprime les fichiers images associés
 * - Supprime les événements
 */
async function deleteAllEvenements() {
  try {
    console.log("🗑️  Début de la suppression de tous les événements...\n");

    // 1. Récupérer tous les événements avec leurs images
    const evenements = await prisma.evenement.findMany({
      select: {
        id: true,
        titre: true,
        imagePrincipale: true,
        images: true,
      },
    });

    console.log(`📊 ${evenements.length} événement(s) trouvé(s)\n`);

    if (evenements.length === 0) {
      console.log("✅ Aucun événement à supprimer");
      return;
    }

    // 2. Collecter toutes les URLs d'images
    const imageUrls: string[] = [];
    
    for (const evenement of evenements) {
      // Image principale
      if (evenement.imagePrincipale) {
        imageUrls.push(evenement.imagePrincipale);
      }

      // Images supplémentaires
      if (evenement.images) {
        try {
          const imagesArray = JSON.parse(evenement.images) as string[];
          if (Array.isArray(imagesArray)) {
            imageUrls.push(...imagesArray);
          }
        } catch (error) {
          console.warn(`⚠️  Erreur lors du parsing des images pour l'événement ${evenement.id}:`, error);
        }
      }
    }

    console.log(`🖼️  ${imageUrls.length} image(s) à supprimer\n`);

    // 3. Supprimer TOUS les fichiers images du dossier evenements
    const imagesDir = join(process.cwd(), "public", "ressources", "evenements");
    let deletedFiles = 0;
    let failedFiles = 0;

    if (existsSync(imagesDir)) {
      try {
        const files = await readdir(imagesDir);
        console.log(`📁 ${files.length} fichier(s) trouvé(s) dans le dossier evenements\n`);
        
        // Supprimer tous les fichiers du dossier
        for (const file of files) {
          const filePath = join(imagesDir, file);
          try {
            const fileStat = await stat(filePath);
            if (fileStat.isFile()) {
              await unlink(filePath);
              deletedFiles++;
              console.log(`  ✓ Supprimé: ${file}`);
            }
          } catch (error) {
            console.error(`  ✗ Erreur lors de la suppression de ${file}:`, error);
            failedFiles++;
          }
        }
      } catch (error) {
        console.error("⚠️  Erreur lors de la lecture du dossier evenements:", error);
      }
    } else {
      console.log("⚠️  Le dossier evenements n'existe pas\n");
    }

    console.log(`\n📁 Fichiers supprimés: ${deletedFiles}, Échecs: ${failedFiles}\n`);

    // 4. Supprimer les conversations liées aux événements
    const conversations = await prisma.conversation.findMany({
      where: {
        evenementId: { not: null },
      },
      select: {
        id: true,
      },
    });

    console.log(`💬 ${conversations.length} conversation(s) liée(s) aux événements\n`);

    if (conversations.length > 0) {
      // Supprimer les participants et messages des conversations
      for (const conversation of conversations) {
        // Supprimer les messages (cascade automatique)
        await prisma.message.deleteMany({
          where: { conversationId: conversation.id },
        });

        // Supprimer les participants
        await prisma.conversationParticipant.deleteMany({
          where: { conversationId: conversation.id },
        });
      }

      // Supprimer les conversations
      await prisma.conversation.deleteMany({
        where: {
          evenementId: { not: null },
        },
      });

      console.log(`  ✓ ${conversations.length} conversation(s) supprimée(s)\n`);
    }

    // 5. Supprimer les inscriptions (sera fait automatiquement avec cascade, mais on le fait explicitement pour les logs)
    const inscriptionsCount = await prisma.inscriptionEvenement.count();
    console.log(`📝 ${inscriptionsCount} inscription(s) à supprimer\n`);

    // 6. Supprimer tous les événements (les inscriptions seront supprimées automatiquement avec cascade)
    const deleteResult = await prisma.evenement.deleteMany({});

    console.log(`✅ ${deleteResult.count} événement(s) supprimé(s) avec succès\n`);

    // 7. Vérification finale
    const remainingEvenements = await prisma.evenement.count();
    const remainingInscriptions = await prisma.inscriptionEvenement.count();
    const remainingConversations = await prisma.conversation.count({
      where: {
        evenementId: { not: null },
      },
    });

    console.log("📊 Vérification finale:");
    console.log(`  - Événements restants: ${remainingEvenements}`);
    console.log(`  - Inscriptions restantes: ${remainingInscriptions}`);
    console.log(`  - Conversations liées restantes: ${remainingConversations}`);
    console.log(`  - Fichiers images supprimés: ${deletedFiles}`);

    if (remainingEvenements === 0 && remainingInscriptions === 0 && remainingConversations === 0) {
      console.log("\n✅ Tous les événements et données liées ont été supprimés avec succès !");
    } else {
      console.log("\n⚠️  Certaines données n'ont pas été supprimées. Vérifiez les erreurs ci-dessus.");
    }

  } catch (error) {
    console.error("❌ Erreur lors de la suppression des événements:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
deleteAllEvenements()
  .then(() => {
    console.log("\n✨ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });

