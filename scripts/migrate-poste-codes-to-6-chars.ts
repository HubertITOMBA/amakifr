import prisma from "../lib/prisma";

/**
 * Script pour migrer les codes de postes existants à 6 caractères
 */
async function migratePosteCodes() {
  console.log("🔄 Démarrage de la migration des codes de postes...");

  try {
    // Récupérer tous les postes existants
    const postes = await prisma.posteTemplate.findMany({
      select: {
        id: true,
        code: true,
        libelle: true,
      },
    });

    console.log(`📋 ${postes.length} poste(s) trouvé(s)`);

    if (postes.length === 0) {
      console.log("✅ Aucun poste à migrer.");
      return;
    }

    // Fonction pour normaliser un code à 6 caractères
    function normalizeCodeTo6Chars(code: string, libelle: string): string {
      // Normaliser le libellé : enlever accents, mettre en majuscules
      const normalized = libelle
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "");

      // Prendre les premières lettres du libellé (max 6)
      let base = normalized.substring(0, 6);

      // Si le libellé est trop court, compléter avec les premiers caractères du code existant
      if (base.length < 6) {
        const codeChars = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const needed = 6 - base.length;
        base += codeChars.substring(0, needed);
      }

      // Compléter jusqu'à 6 caractères avec des caractères du code original si disponible
      if (base.length < 6) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        while (base.length < 6) {
          base += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }

      // S'assurer que c'est exactement 6 caractères
      return base.substring(0, 6).toUpperCase();
    }

    // Mapper les codes existants à leurs nouveaux codes de 6 caractères
    const codeMappings = new Map<string, string>();
    const conflicts: string[] = [];

    for (const poste of postes) {
      let newCode = normalizeCodeTo6Chars(poste.code, poste.libelle);

      // Vérifier les conflits
      let attempts = 0;
      while (codeMappings.has(newCode) || Array.from(codeMappings.values()).includes(newCode)) {
        if (attempts < 10) {
          // Ajouter un chiffre à la fin
          const num = attempts.toString().padStart(1, "0");
          newCode = newCode.substring(0, 5) + num;
        } else {
          // Code complètement aléatoire
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          newCode = "";
          for (let i = 0; i < 6; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        }
        attempts++;
      }

      codeMappings.set(poste.id, newCode);

      // Vérifier si le nouveau code existe déjà dans la base
      const existing = await prisma.posteTemplate.findFirst({
        where: {
          code: newCode,
          NOT: { id: poste.id },
        },
      });

      if (existing) {
        conflicts.push(`${poste.libelle} (${poste.code} -> ${newCode})`);
      }
    }

    if (conflicts.length > 0) {
      console.log("⚠️  Conflits potentiels détectés :");
      conflicts.forEach((conflict) => console.log(`   - ${conflict}`));
    }

    // Mettre à jour tous les codes
    let updated = 0;
    for (const [id, newCode] of codeMappings.entries()) {
      try {
        await prisma.posteTemplate.update({
          where: { id },
          data: { code: newCode },
        });
        updated++;
        const poste = postes.find((p) => p.id === id);
        console.log(`   ✅ ${poste?.libelle}: "${poste?.code}" -> "${newCode}"`);
      } catch (error: any) {
        console.error(`   ❌ Erreur pour ${postes.find((p) => p.id === id)?.libelle}:`, error.message);
      }
    }

    console.log(`\n✅ ${updated}/${postes.length} poste(s) mis à jour avec succès !`);
  } catch (error) {
    console.error("❌ Erreur lors de la migration des codes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  migratePosteCodes()
    .then(() => {
      console.log("\n✨ Migration terminée avec succès !");
      console.log("💡 Vous pouvez maintenant exécuter : npx prisma db push");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Erreur fatale:", error);
      process.exit(1);
    });
}

export default migratePosteCodes;

