import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/**
 * Script pour créer l'événement "Anniversaire d'un Membre"
 * à partir de la carte de la page /extrat
 */
async function createAnniversaireEvenement() {
  try {
    console.log("🎂 Création de l'événement 'Anniversaire d'un Membre'...\n");

    // Récupérer le premier admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: {
        role: "Admin",
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!admin) {
      throw new Error("Aucun administrateur trouvé dans la base de données");
    }

    console.log(`👤 Admin trouvé: ${admin.name} (${admin.id})\n`);

    // Date: vendredi 21 Novembre - 19h00
    // On suppose l'année 2025 (ou ajuster selon vos besoins)
    const dateDebut = new Date("2025-11-21T19:00:00");
    const dateFin = new Date("2025-11-21T23:00:00"); // Fin estimée à 23h
    const dateAffichage = new Date(); // Aujourd'hui
    const dateFinAffichage = new Date("2025-11-21T23:59:59"); // Jusqu'à la fin de l'événement

    // Données de l'événement
    const evenementData = {
      titre: "Anniversaire d'un Membre",
      description: "Célébration conviviale avec cocktail, gâteau et remise de cadeaux. Tous les membres sont invités à partager ce moment de joie.",
      contenu: "Célébration conviviale avec cocktail, gâteau et remise de cadeaux. Tous les membres sont invités à partager ce moment de joie.",
      dateDebut,
      dateFin,
      dateAffichage,
      dateFinAffichage,
      lieu: null,
      adresse: null,
      categorie: "Social",
      statut: "Publie",
      imagePrincipale: "/evenements/Thete2111.png", // Image dans /public/evenements/
      images: null,
      prix: null,
      placesDisponibles: null,
      placesReservees: 0,
      inscriptionRequis: false,
      dateLimiteInscription: null,
      contactEmail: null,
      contactTelephone: null,
      tags: JSON.stringify(["Anniversaire", "Social", "Convivialité"]),
      createdBy: admin.id,
    };

    // Vérifier si l'événement existe déjà
    const existingEvenement = await prisma.evenement.findFirst({
      where: {
        titre: evenementData.titre,
        dateDebut: evenementData.dateDebut,
      },
    });

    if (existingEvenement) {
      console.log("⚠️  Un événement avec le même titre et la même date existe déjà.");
      console.log(`   ID: ${existingEvenement.id}`);
      console.log("   Suppression de l'ancien événement...\n");
      
      await prisma.evenement.delete({
        where: { id: existingEvenement.id },
      });
      
      console.log("   ✓ Ancien événement supprimé\n");
    }

    // Créer l'événement
    const evenement = await prisma.evenement.create({
      data: evenementData,
    });

    console.log("✅ Événement créé avec succès !\n");
    console.log("📋 Détails de l'événement :");
    console.log(`   ID: ${evenement.id}`);
    console.log(`   Titre: ${evenement.titre}`);
    console.log(`   Date: ${dateDebut.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} à ${dateDebut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
    console.log(`   Catégorie: ${evenement.categorie}`);
    console.log(`   Statut: ${evenement.statut}`);
    console.log(`   Image: ${evenement.imagePrincipale}`);
    console.log(`   Créé par: ${admin.name}\n`);

  } catch (error) {
    console.error("❌ Erreur lors de la création de l'événement:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createAnniversaireEvenement()
  .then(() => {
    console.log("✨ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });

