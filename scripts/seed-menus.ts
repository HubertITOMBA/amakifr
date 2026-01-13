import { PrismaClient } from "@prisma/client";

// Créer le client Prisma avec gestion d'erreur
let prisma: PrismaClient;

try {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} catch (error) {
  console.error("❌ Erreur lors de l'initialisation du client Prisma:", error);
  process.exit(1);
}

/**
 * Script pour peupler la table menus avec les menus actuels de l'application
 */
async function seedMenus() {
  console.log("🌱 Démarrage du seed des menus...");

  try {
    // Tester la connexion à la base de données
    console.log("🔌 Test de connexion à la base de données...");
    await prisma.$connect();
    console.log("✅ Connexion à la base de données réussie");

    // Vérifier si des menus existent déjà
    console.log("🔍 Vérification des menus existants...");
    const existingMenusCount = await prisma.menu.count();
    
    if (existingMenusCount > 0) {
      console.log(`⚠️  ${existingMenusCount} menu(s) déjà présent(s) dans la base.`);
      const response = await new Promise<string>((resolve) => {
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
        console.log("Voulez-vous supprimer tous les menus existants et recommencer ? (oui/non)");
      });

      if (response.toLowerCase() === "oui") {
        await prisma.menu.deleteMany();
        console.log("✅ Menus existants supprimés");
      } else {
        console.log("❌ Opération annulée");
        return;
      }
    }

    // Menus pour la NAVBAR (public)
    const navbarMenus = [
      {
        libelle: "L'amicale",
        description: "Présentation de l'association AMAKI",
        lien: "/amicale",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Building2",
        statut: true,
        ordre: 1,
        electoral: false,
      },
      {
        libelle: "Election",
        description: "Informations sur les élections",
        lien: "/extrat",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Vote",
        statut: true,
        ordre: 2,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Evénements",
        description: "Calendrier des événements",
        lien: "/evenements",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Calendar",
        statut: true,
        ordre: 3,
        electoral: false,
      },
      {
        libelle: "Galerie",
        description: "Galerie photos de l'association",
        lien: "/galerie",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Camera",
        statut: true,
        ordre: 4,
        electoral: false,
      },
      {
        libelle: "Contact",
        description: "Contactez-nous",
        lien: "/contact",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Mail",
        statut: true,
        ordre: 5,
        electoral: false,
      },
      {
        libelle: "Résultats",
        description: "Résultats des élections",
        lien: "/resultats",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Award",
        statut: true,
        ordre: 6,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Messages",
        description: "Messagerie interne",
        lien: "/chat",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"],
        icone: "MessageSquare",
        statut: true,
        ordre: 7,
        electoral: false,
      },
      {
        libelle: "Admin",
        description: "Panneau d'administration",
        lien: "/admin",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN"], // Réservé aux admins
        icone: "Shield",
        statut: true,
        ordre: 8,
        electoral: false,
      },
    ];

    // Menus pour la SIDEBAR (admin)
    const sidebarMenus = [
      {
        libelle: "Tableau de bord",
        description: "Vue d'ensemble des statistiques",
        lien: "/admin",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "BarChart3",
        statut: true,
        ordre: 1,
        electoral: false,
      },
      {
        libelle: "Analytics",
        description: "Dashboard analytique avancé",
        lien: "/admin/analytics",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "TrendingUp",
        statut: true,
        ordre: 2,
        electoral: false,
      },
      {
        libelle: "Adhérents",
        description: "Gestion des membres",
        lien: "/admin/users",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Users",
        statut: true,
        ordre: 3,
        electoral: false,
      },
      {
        libelle: "Cotisations",
        description: "Gestion des cotisations",
        lien: "/admin/cotisations",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 4,
        electoral: false,
      },
      {
        libelle: "Gestion des Cotisations",
        description: "Gestion détaillée des cotisations",
        lien: "/admin/cotisations/gestion",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 5,
        electoral: false,
      },
      {
        libelle: "Cotisations du Mois",
        description: "Planification des cotisations par mois",
        lien: "/admin/cotisations-du-mois",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 6,
        electoral: false,
      },
      {
        libelle: "Depenses",
        description: "Gestion des dépenses",
        lien: "/admin/depenses",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 7,
        electoral: false,
      },
      {
        libelle: "Événements",
        description: "Gestion des événements",
        lien: "/admin/evenements",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 8,
        electoral: false,
      },
      {
        libelle: "Bureau",
        description: "Gestion du bureau et organigramme",
        lien: "/admin/bureau",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Building2",
        statut: true,
        ordre: 9,
        electoral: false,
      },
      {
        libelle: "Postes",
        description: "Gestion des postes et rôles",
        lien: "/admin/postes",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 10,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Réservations",
        description: "Gestion des réservations de ressources",
        lien: "/admin/reservations",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 11,
        electoral: false,
      },
      {
        libelle: "Boîte à idées",
        description: "Gestion des idées soumises",
        lien: "/admin/idees",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Lightbulb",
        statut: true,
        ordre: 12,
        electoral: false,
      },
      {
        libelle: "Notifications",
        description: "Créer et gérer les notifications",
        lien: "/admin/notifications",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Mail",
        statut: true,
        ordre: 13,
        electoral: false,
      },
      {
        libelle: "Emails",
        description: "Envoyer des emails et consulter l'historique",
        lien: "/admin/emails",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Mail",
        statut: true,
        ordre: 14,
        electoral: false,
      },
      {
        libelle: "Rappels Automatiques",
        description: "Gérer les rappels automatiques",
        lien: "/admin/notifications/rappel",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Bell",
        statut: true,
        ordre: 15,
        electoral: false,
      },
      {
        libelle: "Documents",
        description: "Gérer tous les documents des utilisateurs",
        lien: "/admin/documents",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 16,
        electoral: false,
      },
      {
        libelle: "Rapports de Réunion",
        description: "Gérer les rapports de réunions mensuelles",
        lien: "/admin/rapports-reunion",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 17,
        electoral: false,
      },
      {
        libelle: "Exports",
        description: "Exporter les données en Excel/CSV",
        lien: "/admin/exports",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 18,
        electoral: false,
      },
      {
        libelle: "Galerie",
        description: "Gérer la galerie photos",
        lien: "/admin/galerie",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Camera",
        statut: true,
        ordre: 19,
        electoral: false,
      },
      {
        libelle: "Élections",
        description: "Gestion des élections",
        lien: "/admin/elections",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Vote",
        statut: true,
        ordre: 20,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Votes",
        description: "Consultation des votes",
        lien: "/admin/votes",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 21,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Candidatures",
        description: "Gestion des candidatures",
        lien: "/admin/candidatures",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Users",
        statut: true,
        ordre: 22,
        electoral: true, // Menu électoral
      },
      {
        libelle: "Badges",
        description: "Gestion des badges",
        lien: "/admin/badges",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 23,
        electoral: false,
      },
      {
        libelle: "Chat",
        description: "Messagerie interne",
        lien: "/chat",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"],
        icone: "MessageSquare",
        statut: true,
        ordre: 24,
        electoral: false,
      },
      {
        libelle: "Gestion des Menus",
        description: "Gérer les menus dynamiques",
        lien: "/admin/menus",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Menu",
        statut: true,
        ordre: 25,
        electoral: false,
      },
      {
        libelle: "Paramètres",
        description: "Configuration de l'application",
        lien: "/admin/settings",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Settings",
        statut: true,
        ordre: 26,
        electoral: false,
      },
    ];

    // Créer tous les menus
    const allMenus = [...navbarMenus, ...sidebarMenus];
    
    console.log(`\n📝 Création de ${allMenus.length} menus...`);
    
    for (const menu of allMenus) {
      await prisma.menu.create({
        data: {
          ...menu,
          createdBy: null, // Pas de créateur pour les menus par défaut
        },
      });
      console.log(`✅ Menu créé: ${menu.libelle} (${menu.niveau})`);
    }

    console.log(`\n🎉 ${allMenus.length} menus créés avec succès!`);
    
    // Afficher un résumé
    const navbarCount = await prisma.menu.count({ where: { niveau: "NAVBAR" } });
    const sidebarCount = await prisma.menu.count({ where: { niveau: "SIDEBAR" } });
    const electoralCount = await prisma.menu.count({ where: { electoral: true } });
    
    console.log("\n📊 Résumé:");
    console.log(`- Menus NAVBAR: ${navbarCount}`);
    console.log(`- Menus SIDEBAR: ${sidebarCount}`);
    console.log(`- Menus électoraux: ${electoralCount}`);
    
  } catch (error) {
    console.error("❌ Erreur lors du seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
seedMenus()
  .then(() => {
    console.log("\n✨ Script terminé avec succès!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erreur fatale:", error);
    process.exit(1);
  });
