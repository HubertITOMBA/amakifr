import prisma from "../lib/prisma";

/**
 * Script pour créer des fixtures de postes à pourvoir pour les tests
 * Ce script peut être exécuté plusieurs fois : il met à jour les postes existants ou crée de nouveaux postes
 */
async function createTestPostes() {
  console.log("🌱 Création/Mise à jour des fixtures de postes à pourvoir...");

  try {
    // Récupérer un admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: { role: "Admin" },
    });

    if (!admin) {
      console.error("❌ Aucun administrateur trouvé. Impossible de créer les postes.");
      return;
    }

    // Postes supplémentaires pour les tests
    const postesToCreate = [
      {
        code: "MEMBRE",
        libelle: "Membre de l'association",
        description: "Poste pour les membres de l'association sans responsabilité particulière.",
        ordre: 1,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: null, // Pas de durée de mandat pour les membres simples
        actif: true,
      },
      {
        code: "COMFOR",
        libelle: "Responsable Formation",
        description: "Organise et coordonne les formations pour les membres de l'association. Gère le programme de formation continue et les partenariats avec les centres de formation.",
        ordre: 10,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "COMMUN",
        libelle: "Responsable Communication",
        description: "Gère la communication interne et externe de l'association. S'occupe des réseaux sociaux, du site web et des relations presse.",
        ordre: 11,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "EVENEM",
        libelle: "Responsable Événements",
        description: "Organise et coordonne les événements de l'association (conférences, ateliers, manifestations culturelles).",
        ordre: 12,
        nombreMandatsDefaut: 2,
        dureeMandatDefaut: 12,
        actif: true,
      },
      {
        code: "PARTEN",
        libelle: "Responsable Partenariats",
        description: "Développe et maintient les partenariats avec d'autres associations, entreprises et institutions.",
        ordre: 13,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 36,
        actif: true,
      },
      {
        code: "JURIDI",
        libelle: "Conseiller Juridique",
        description: "Fournit des conseils juridiques et veille au respect de la réglementation pour l'association.",
        ordre: 14,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "CULTUR",
        libelle: "Responsable Culturel",
        description: "Promouvoit les activités culturelles et organise des événements pour valoriser le patrimoine culturel.",
        ordre: 15,
        nombreMandatsDefaut: 2,
        dureeMandatDefaut: 12,
        actif: true,
      },
      {
        code: "SOCIAL",
        libelle: "Responsable Social",
        description: "Coordonne les actions sociales et d'entraide de l'association. Gère les programmes d'aide aux membres.",
        ordre: 16,
        nombreMandatsDefaut: 2,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "SPORTI",
        libelle: "Responsable Sportif",
        description: "Organise les activités sportives et les compétitions pour les membres de l'association.",
        ordre: 17,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 12,
        actif: true,
      },
      {
        code: "JEUNES",
        libelle: "Responsable Jeunesse",
        description: "Développe et anime les activités destinées aux jeunes membres de l'association.",
        ordre: 18,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "FEMMES",
        libelle: "Responsable Commission Femmes",
        description: "Coordonne les activités spécifiques pour les femmes membres de l'association.",
        ordre: 19,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
      {
        code: "PROJET",
        libelle: "Responsable Projets",
        description: "Gère et supervise les projets de l'association, du lancement à la clôture.",
        ordre: 20,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 36,
        actif: true,
      },
      {
        code: "INTERN",
        libelle: "Responsable Relations Internationales",
        description: "Développe les relations avec les associations et partenaires internationaux.",
        ordre: 21,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: false, // Poste inactif pour tester
      },
      {
        code: "ARCHIV",
        libelle: "Archiviste",
        description: "Gère les archives et la documentation de l'association.",
        ordre: 22,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: false, // Poste inactif pour tester
      },
      {
        code: "ADHESI",
        libelle: "Responsable Adhésions",
        description: "Gère le processus d'adhésion et l'accueil des nouveaux membres.",
        ordre: 23,
        nombreMandatsDefaut: 2,
        dureeMandatDefaut: 12,
        actif: true,
      },
      {
        code: "BENEVO",
        libelle: "Coordinateur Bénévoles",
        description: "Recrute, forme et coordonne les bénévoles de l'association.",
        ordre: 24,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
        actif: true,
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Créer ou mettre à jour les postes un par un
    for (const poste of postesToCreate) {
      try {
        // Vérifier si le poste existe déjà
        const existing = await prisma.posteTemplate.findUnique({
          where: { code: poste.code },
        });

        if (existing) {
          // Mettre à jour le poste existant
          const updated = await prisma.posteTemplate.update({
            where: { code: poste.code },
            data: {
              libelle: poste.libelle,
              description: poste.description,
              ordre: poste.ordre,
              nombreMandatsDefaut: poste.nombreMandatsDefaut,
              dureeMandatDefaut: poste.dureeMandatDefaut,
              actif: poste.actif,
              // Ne pas mettre à jour createdBy si le poste existe déjà
            },
          });
          console.log(`🔄 ${updated.libelle} (${updated.code}) mis à jour`);
          updatedCount++;
        } else {
          // Créer un nouveau poste
          const created = await prisma.posteTemplate.create({
            data: {
              ...poste,
              createdBy: admin.id,
            },
          });
          console.log(`✅ ${created.libelle} (${created.code}) créé`);
          createdCount++;
        }
      } catch (error: any) {
        const errorMsg = `Erreur pour ${poste.libelle}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log("\n📊 Résumé :");
    console.log(`   ✅ ${createdCount} poste(s) créé(s)`);
    console.log(`   🔄 ${updatedCount} poste(s) mis à jour`);
    if (errors.length > 0) {
      console.log(`   ❌ ${errors.length} erreur(s)`);
      errors.forEach((err) => console.log(`      - ${err}`));
    }

    // Afficher tous les postes actifs
    const allActivePostes = await prisma.posteTemplate.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
    });

    console.log(`\n📋 Total des postes actifs : ${allActivePostes.length}`);
    console.log("Liste des postes actifs :");
    allActivePostes.forEach((poste) => {
      const mandats = poste.nombreMandatsDefaut > 1 ? ` (${poste.nombreMandatsDefaut} mandats)` : "";
      const duree = poste.dureeMandatDefaut ? ` - Durée: ${poste.dureeMandatDefaut} mois` : "";
      console.log(`   ${poste.ordre}. ${poste.libelle}${mandats}${duree}`);
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création des postes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  createTestPostes()
    .then(() => {
      console.log("\n✨ Fixtures créées avec succès !");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error);
      process.exit(1);
    });
}

export default createTestPostes;

