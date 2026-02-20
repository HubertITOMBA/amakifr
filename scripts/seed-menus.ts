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
        libelle: "Amaki",
        description: "Présentation de l'association AMAKI",
        lien: "/amicale",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Building2",
        statut: true,
        ordre: 1,
        electoral: false,
        parent: null,
      },
      // Menu parent "Scrutin" pour regrouper les menus électoraux
      {
        libelle: "Scrutin",
        description: "Élections et résultats",
        lien: "#", // Pas de lien direct, c'est un menu dropdown
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Vote",
        statut: true,
        ordre: 2,
        electoral: true, // Menu électoral (avec ses enfants)
        parent: null,
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
        parent: null,
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
        parent: null,
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
        parent: null,
      },
      {
        libelle: "Messages",
        description: "Messagerie interne",
        lien: "/chat",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"],
        icone: "MessageSquare",
        statut: true,
        ordre: 6,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Réunions mensuelles",
        description: "Calendrier des réunions mensuelles (lien navbar pour admin uniquement)",
        lien: "/reunions-mensuelles",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 7,
        electoral: false,
        parent: null,
      },
      {
        libelle: "ADMIN",
        description: "Panneau d'administration",
        lien: "/admin",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN"], // Réservé aux admins
        icone: "Shield",
        statut: true,
        ordre: 8,
        electoral: false,
        parent: null,
      },
    ];

    // Sous-menus électoraux (NAVBAR) - seront créés après le menu parent
    const navbarElectoralSubmenus = [
      {
        libelle: "Informations",
        description: "Informations sur les élections",
        lien: "/extrat",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Info",
        statut: true,
        ordre: 1,
        electoral: true,
        parentLibelle: "Scrutin", // Référence au parent
      },
      {
        libelle: "Résultats",
        description: "Résultats des élections",
        lien: "/resultats",
        niveau: "NAVBAR" as const,
        roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
        icone: "Award",
        statut: true,
        ordre: 2,
        electoral: true,
        parentLibelle: "Scrutin", // Référence au parent
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
        parent: null,
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
        parent: null,
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
        parent: null,
      },
      {
        libelle: "Gestion des Finances",
        description: "Gestion financière complète (cotisations, paiements, dettes, assistances)",
        lien: "/admin/finances",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 4,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Cotisations",
        description: "Gestion des cotisations",
        lien: "/admin/cotisations",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 5,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Gestion des Cotisations",
        description: "Gestion détaillée des cotisations",
        lien: "/admin/cotisations/gestion",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 6,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Cotisations du Mois",
        description: "Planification des cotisations par mois",
        lien: "/admin/cotisations-du-mois",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 7,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Depenses",
        description: "Gestion des dépenses",
        lien: "/admin/depenses",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Euro",
        statut: true,
        ordre: 8,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Événements",
        description: "Gestion des événements",
        lien: "/admin/evenements",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 9,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Bureau",
        description: "Gestion du bureau et organigramme",
        lien: "/admin/bureau",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Building2",
        statut: true,
        ordre: 10,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Postes",
        description: "Gestion des postes et rôles",
        lien: "/admin/postes",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 11,
        electoral: true, // Menu électoral
        parent: null,
      },
      {
        libelle: "Réservations",
        description: "Gestion des réservations de ressources",
        lien: "/admin/reservations",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 12,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Boîte à idées",
        description: "Gestion des idées soumises",
        lien: "/admin/idees",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Lightbulb",
        statut: true,
        ordre: 13,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Notifications",
        description: "Créer et gérer les notifications",
        lien: "/admin/notifications",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Mail",
        statut: true,
        ordre: 14,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Emails",
        description: "Envoyer des emails et consulter l'historique",
        lien: "/admin/emails",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Mail",
        statut: true,
        ordre: 15,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Rappels Automatiques",
        description: "Gérer les rappels automatiques",
        lien: "/admin/notifications/rappel",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Bell",
        statut: true,
        ordre: 16,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Documents",
        description: "Gérer tous les documents des utilisateurs",
        lien: "/admin/documents",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 17,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Rapports de Réunion",
        description: "Gérer les rapports de réunions mensuelles",
        lien: "/admin/rapports-reunion",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 18,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Réunions Mensuelles",
        description: "Gérer les réunions mensuelles (validation, hôte, dates)",
        lien: "/admin/reunions-mensuelles",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: 19,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Réunions mensuelles",
        description: "Calendrier des réunions mensuelles (adhérent)",
        lien: "/reunions-mensuelles",
        niveau: "SIDEBAR" as const,
        roles: ["MEMBRE"],
        icone: "Calendar",
        statut: true,
        ordre: 24,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Exports",
        description: "Exporter les données en Excel/CSV",
        lien: "/admin/exports",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FileText",
        statut: true,
        ordre: 20,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Galerie",
        description: "Gérer la galerie photos",
        lien: "/admin/galerie",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Camera",
        statut: true,
        ordre: 21,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Élections",
        description: "Gestion des élections",
        lien: "/admin/elections",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Vote",
        statut: true,
        ordre: 21,
        electoral: true, // Menu électoral
        parent: null,
      },
      {
        libelle: "Votes",
        description: "Consultation des votes",
        lien: "/admin/votes",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 22,
        electoral: true, // Menu électoral
        parent: null,
      },
      {
        libelle: "Candidatures",
        description: "Gestion des candidatures",
        lien: "/admin/candidatures",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Users",
        statut: true,
        ordre: 23,
        electoral: true, // Menu électoral
        parent: null,
      },
      {
        libelle: "Badges",
        description: "Gestion des badges",
        lien: "/admin/badges",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Award",
        statut: true,
        ordre: 24,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Chat",
        description: "Messagerie interne",
        lien: "/chat",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"],
        icone: "MessageSquare",
        statut: true,
        ordre: 25,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Demandes RGPD",
        description: "Gérer les demandes de suppression de données",
        lien: "/admin/rgpd/demandes",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Shield",
        statut: true,
        ordre: 26,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Gestion des Menus",
        description: "Gérer les menus dynamiques",
        lien: "/admin/menus",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Menu",
        statut: true,
        ordre: 27,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Paramètres",
        description: "Configuration de l'application",
        lien: "/admin/settings",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Settings",
        statut: true,
        ordre: 28,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Activités utilisateurs",
        description: "Consulter les activités et actions des utilisateurs",
        lien: "/admin/activities",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "Activity",
        statut: true,
        ordre: 29,
        electoral: false,
        parent: null,
      },
      {
        libelle: "Projets",
        description: "Gestion des projets et tâches",
        lien: "/admin/projets",
        niveau: "SIDEBAR" as const,
        roles: ["ADMIN"],
        icone: "FolderKanban",
        statut: true,
        ordre: 30,
        electoral: false,
        parent: null,
      },
    ];

    // Créer d'abord les menus parents (navbar et sidebar)
    const allParentMenus = [...navbarMenus, ...sidebarMenus];
    
    console.log(`\n📝 Création de ${allParentMenus.length} menus parents...`);
    
    const createdMenus: Record<string, string> = {}; // Map libelle -> id
    
    for (const menu of allParentMenus) {
      const created = await prisma.menu.create({
        data: {
          ...menu,
          createdBy: null, // Pas de créateur pour les menus par défaut
        },
      });
      createdMenus[menu.libelle] = created.id;
      console.log(`✅ Menu créé: ${menu.libelle} (${menu.niveau})`);
    }

    // Créer les sous-menus électoraux (NAVBAR) en les liant à leur parent
    console.log(`\n📝 Création de ${navbarElectoralSubmenus.length} sous-menus électoraux (NAVBAR)...`);
    
    for (const submenu of navbarElectoralSubmenus) {
      const { parentLibelle, ...submenuData } = submenu;
      const parentId = createdMenus[parentLibelle];
      
      if (!parentId) {
        console.error(`❌ Parent "${parentLibelle}" introuvable pour le sous-menu "${submenu.libelle}"`);
        continue;
      }

      await prisma.menu.create({
        data: {
          ...submenuData,
          parent: parentId,
          createdBy: null,
        },
      });
      console.log(`✅ Sous-menu créé: ${submenu.libelle} (parent: ${parentLibelle})`);
    }

    const totalMenus = allParentMenus.length + navbarElectoralSubmenus.length;
    console.log(`\n🎉 ${totalMenus} menus créés avec succès!`);
    
    // Afficher un résumé
    const navbarCount = await prisma.menu.count({ where: { niveau: "NAVBAR" } });
    const sidebarCount = await prisma.menu.count({ where: { niveau: "SIDEBAR" } });
    const electoralCount = await prisma.menu.count({ where: { electoral: true } });
    const submenuCount = await prisma.menu.count({ where: { parent: { not: null } } });
    
    console.log("\n📊 Résumé:");
    console.log(`- Menus NAVBAR: ${navbarCount}`);
    console.log(`- Menus SIDEBAR: ${sidebarCount}`);
    console.log(`- Menus électoraux: ${electoralCount}`);
    console.log(`- Sous-menus: ${submenuCount}`);
    
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
