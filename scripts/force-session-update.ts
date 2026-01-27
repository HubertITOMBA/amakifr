import { db } from "@/lib/db";

/**
 * Script pour forcer la mise à jour des sessions
 * Ce script peut être utilisé pour invalider toutes les sessions et forcer les utilisateurs à se reconnecter
 * Utile après une migration de rôles
 */
async function forceSessionUpdate() {
  console.log("🔄 Forçage de la mise à jour des sessions...\n");

  // Note: NextAuth stocke les sessions dans des cookies JWT
  // Pour forcer une mise à jour, on peut :
  // 1. Modifier un champ dans la base de données qui force la régénération du token
  // 2. Ou simplement informer l'utilisateur de se reconnecter

  // Vérifier les utilisateurs admin
  const adminUsers = await db.user.findMany({
    where: {
      role: "ADMIN",
    },
    select: {
      id: true,
      email: true,
      role: true,
      lastLogin: true,
    },
  });

  console.log(`📊 ${adminUsers.length} utilisateur(s) admin trouvé(s):`);
  adminUsers.forEach((user) => {
    console.log(`   - ${user.email}: ${user.role} (dernière connexion: ${user.lastLogin?.toISOString() || "jamais"})`);
  });

  console.log("\n💡 Pour forcer la mise à jour des sessions:");
  console.log("   1. Les utilisateurs doivent se déconnecter et se reconnecter");
  console.log("   2. Ou redémarrer le serveur de développement");
  console.log("   3. Ou vider les cookies du navigateur");
  
  console.log("\n✅ Script terminé");
}

// Exécuter le script
forceSessionUpdate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
