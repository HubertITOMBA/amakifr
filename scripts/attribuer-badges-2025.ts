#!/usr/bin/env tsx

/**
 * Script pour créer et attribuer des badges d'excellence et de bonne conduite
 * pour les membres distingués en 2025
 * 
 * Usage: npx tsx scripts/attribuer-badges-2025.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// ⚠️ CONFIGURATION : Modifiez ces emails pour correspondre aux 2 adhérents
const ADHERENTS_EMAILS = [
  "email1@example.com", // Remplacez par l'email réel du 1er adhérent
  "email2@example.com", // Remplacez par l'email réel du 2e adhérent
];

// Configuration des badges à créer et attribuer
const BADGES_CONFIG = [
  {
    nom: "Excellence 2025",
    description: "Décerné aux membres distingués pour leur excellence en 2025",
    icone: "Trophy",
    couleur: "gold",
    type: "Manuel" as const,
    actif: true,
    ordre: 100,
    raison: "Membre distingué en 2025 pour ses contributions exceptionnelles à l'association",
  },
  {
    nom: "Bonne Conduite 2025",
    description: "Décerné aux membres exemplaires pour leur bonne conduite en 2025",
    icone: "Shield",
    couleur: "blue",
    type: "Manuel" as const,
    actif: true,
    ordre: 101,
    raison: "Membre exemplaire en 2025 pour son comportement irréprochable et son esprit d'équipe",
  },
];

async function main() {
  console.log("🎖️  Attribution des badges d'honneur 2025");
  console.log("==========================================\n");

  try {
    // Vérifier la connexion
    console.log("🔌 Connexion à la base de données...");
    await prisma.$connect();
    console.log("✅ Connexion réussie\n");

    // Vérifier que les emails sont configurés
    if (ADHERENTS_EMAILS.some(email => email.includes("example.com"))) {
      console.error("❌ ERREUR : Vous devez modifier les emails dans le script !");
      console.error("   Éditez ADHERENTS_EMAILS dans scripts/attribuer-badges-2025.ts");
      console.error("");
      console.log("💡 Pour trouver les emails des adhérents :");
      console.log("   psql -d amakifr_db -c \"SELECT email, name FROM users WHERE role = 'Membre' LIMIT 10;\"");
      process.exit(1);
    }

    // Récupérer les utilisateurs
    console.log("👥 Récupération des utilisateurs...");
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ADHERENTS_EMAILS,
        },
      },
      include: {
        adherent: true,
      },
    });

    if (users.length === 0) {
      console.error("❌ Aucun utilisateur trouvé avec ces emails :");
      ADHERENTS_EMAILS.forEach(email => console.error(`   - ${email}`));
      console.error("");
      console.log("💡 Vérifiez les emails dans la base de données :");
      console.log("   psql -d amakifr_db -c \"SELECT email, name FROM users;\"");
      process.exit(1);
    }

    if (users.length < ADHERENTS_EMAILS.length) {
      console.warn(`⚠️  Attention : Seulement ${users.length}/${ADHERENTS_EMAILS.length} utilisateur(s) trouvé(s)`);
      console.warn("   Emails trouvés :");
      users.forEach(u => console.warn(`   ✓ ${u.email} - ${u.adherent?.firstname} ${u.adherent?.lastname}`));
      console.warn("   Emails manquants :");
      ADHERENTS_EMAILS.filter(email => !users.find(u => u.email === email))
        .forEach(email => console.warn(`   ✗ ${email}`));
      console.warn("");
      
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const response = await new Promise<string>((resolve) => {
        readline.question("Voulez-vous continuer quand même ? (oui/non) ", resolve);
      });
      readline.close();
      
      if (response.toLowerCase() !== "oui") {
        console.log("❌ Opération annulée");
        process.exit(0);
      }
    }

    console.log(`✅ ${users.length} utilisateur(s) trouvé(s) :`);
    users.forEach(u => {
      const name = u.adherent 
        ? `${u.adherent.firstname} ${u.adherent.lastname}`
        : u.name || "Nom inconnu";
      console.log(`   - ${name} (${u.email})`);
    });
    console.log("");

    // Créer et attribuer chaque badge
    for (const badgeConfig of BADGES_CONFIG) {
      console.log(`\n📛 Traitement du badge "${badgeConfig.nom}"`);
      console.log("-".repeat(50));

      // Vérifier si le badge existe déjà
      let badge = await prisma.badge.findFirst({
        where: { nom: badgeConfig.nom },
      });

      if (badge) {
        console.log(`⏭️  Badge "${badgeConfig.nom}" existe déjà (ID: ${badge.id})`);
      } else {
        // Créer le badge
        const { raison, ...badgeData } = badgeConfig;
        badge = await prisma.badge.create({
          data: badgeData,
        });
        console.log(`✅ Badge "${badgeConfig.nom}" créé (ID: ${badge.id})`);
      }

      // Attribuer le badge à chaque utilisateur
      for (const user of users) {
        const name = user.adherent 
          ? `${user.adherent.firstname} ${user.adherent.lastname}`
          : user.name || "Nom inconnu";

        // Vérifier si l'attribution existe déjà
        const existingAttribution = await prisma.badgeAttribution.findUnique({
          where: {
            badgeId_userId: {
              badgeId: badge.id,
              userId: user.id,
            },
          },
        });

        if (existingAttribution) {
          console.log(`   ⏭️  Badge déjà attribué à ${name}`);
          continue;
        }

        // Créer l'attribution
        await prisma.badgeAttribution.create({
          data: {
            badgeId: badge.id,
            userId: user.id,
            attribuePar: null, // Attribué par script, pas par un admin spécifique
            raison: badgeConfig.raison,
          },
        });

        console.log(`   ✅ Badge attribué à ${name}`);
      }
    }

    // Résumé final
    console.log("\n");
    console.log("=" .repeat(50));
    console.log("✨ ATTRIBUTION TERMINÉE AVEC SUCCÈS !");
    console.log("=".repeat(50));
    console.log("");
    console.log("📊 Résumé :");
    console.log(`   - ${BADGES_CONFIG.length} badge(s) traité(s)`);
    console.log(`   - ${users.length} adhérent(s) récompensé(s)`);
    console.log("");
    console.log("🎉 Félicitations aux membres distingués !");
    console.log("");
    console.log("💡 Les badges sont maintenant visibles :");
    console.log("   - Sur le profil de chaque adhérent");
    console.log("   - Dans la page /admin/badges");
    console.log("");

  } catch (error) {
    console.error("\n❌ Erreur lors de l'attribution :", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erreur fatale :", error);
    process.exit(1);
  });
