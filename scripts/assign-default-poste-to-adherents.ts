import prisma from "../lib/prisma";

/**
 * Script pour assigner le poste par défaut "Membre de l'association" à tous les adhérents qui n'ont pas de poste
 * Ce script peut être exécuté plusieurs fois sans problème
 */
async function assignDefaultPosteToAdherents() {
  console.log("🌱 Attribution du poste par défaut aux adhérents...");

  try {
    // Récupérer le poste "Membre de l'association"
    const posteMembre = await prisma.posteTemplate.findUnique({
      where: { code: "MEMBRE" },
    });

    if (!posteMembre) {
      console.error("❌ Le poste 'Membre de l'association' (code: MEMBRE) n'existe pas.");
      console.log("💡 Veuillez d'abord exécuter le script create-test-postes.ts pour créer les postes.");
      return;
    }

    console.log(`✅ Poste trouvé: ${posteMembre.libelle} (${posteMembre.code})`);

    // Compter les adhérents sans poste
    const adherentsSansPoste = await prisma.adherent.count({
      where: {
        posteTemplateId: null,
      },
    });

    console.log(`📊 ${adherentsSansPoste} adhérent(s) sans poste trouvé(s)`);

    if (adherentsSansPoste === 0) {
      console.log("✨ Tous les adhérents ont déjà un poste assigné.");
      return;
    }

    // Mettre à jour tous les adhérents sans poste
    const result = await prisma.adherent.updateMany({
      where: {
        posteTemplateId: null,
      },
      data: {
        posteTemplateId: posteMembre.id,
      },
    });

    console.log(`✅ ${result.count} adhérent(s) mis à jour avec le poste "${posteMembre.libelle}"`);

    // Afficher un résumé
    const totalAdherents = await prisma.adherent.count();
    const adherentsAvecPoste = await prisma.adherent.count({
      where: {
        posteTemplateId: { not: null },
      },
    });

    console.log("\n📊 Résumé :");
    console.log(`   Total adhérents: ${totalAdherents}`);
    console.log(`   Adhérents avec poste: ${adherentsAvecPoste}`);
    console.log(`   Adhérents sans poste: ${totalAdherents - adherentsAvecPoste}`);
  } catch (error) {
    console.error("❌ Erreur lors de l'attribution des postes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  assignDefaultPosteToAdherents()
    .then(() => {
      console.log("\n✨ Attribution des postes terminée avec succès !");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error);
      process.exit(1);
    });
}

export default assignDefaultPosteToAdherents;

