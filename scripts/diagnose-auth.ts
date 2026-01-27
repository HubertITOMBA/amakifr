#!/usr/bin/env tsx
/**
 * Script de diagnostic pour les problèmes d'authentification
 */

import { db } from "../lib/db";
import { getUserByEmail } from "../actions/auth";
import { normalizeEmail } from "../lib/utils";

async function diagnoseAuth() {
  console.log("🔍 Diagnostic d'authentification...\n");

  // 1. Vérifier les variables d'environnement
  console.log("1. Variables d'environnement:");
  console.log("   AUTH_SECRET:", process.env.AUTH_SECRET ? "✅ Défini" : "❌ Manquant");
  console.log("   NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? "✅ Défini" : "❌ Manquant");
  console.log("   NODE_ENV:", process.env.NODE_ENV || "non défini");
  console.log("   NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL || "non défini");
  console.log("   AUTH_URL:", process.env.AUTH_URL || "non défini");
  console.log("");

  // 2. Vérifier la connexion à la base de données
  console.log("2. Connexion à la base de données:");
  try {
    await db.$connect();
    console.log("   ✅ Connexion réussie");
    
    // Vérifier si la table users existe
    const userCount = await db.user.count();
    console.log(`   ✅ Table users existe (${userCount} utilisateur(s))`);
  } catch (error: any) {
    console.error("   ❌ Erreur de connexion:", error.message);
    return;
  }
  console.log("");

  // 3. Vérifier un utilisateur de test (si fourni en argument)
  const testEmail = process.argv[2];
  if (testEmail) {
    console.log(`3. Vérification de l'utilisateur: ${testEmail}`);
    try {
      const normalizedEmail = normalizeEmail(testEmail);
      const user = await getUserByEmail(normalizedEmail);
      
      if (!user) {
        console.log("   ❌ Utilisateur non trouvé");
      } else {
        console.log("   ✅ Utilisateur trouvé:");
        console.log(`      - ID: ${user.id}`);
        console.log(`      - Email: ${user.email}`);
        console.log(`      - Email vérifié: ${user.emailVerified ? "✅ Oui" : "❌ Non"}`);
        console.log(`      - Mot de passe: ${user.password ? "✅ Défini" : "❌ Manquant"}`);
        console.log(`      - Statut: ${user.status || "non défini"}`);
        console.log(`      - Rôle: ${user.role || "non défini"}`);
        
        // Vérifier les problèmes potentiels
        if (!user.emailVerified) {
          console.log("\n   ⚠️  PROBLÈME: L'email n'est pas vérifié!");
          console.log("      → La connexion sera bloquée par le callback signIn dans auth.ts");
        }
        
        if (!user.password) {
          console.log("\n   ⚠️  PROBLÈME: Aucun mot de passe défini!");
          console.log("      → La connexion avec credentials ne fonctionnera pas");
        }
        
        if (user.status === 'Inactif') {
          console.log("\n   ⚠️  PROBLÈME: Le compte est inactif!");
          console.log("      → La connexion sera bloquée");
        }
      }
    } catch (error: any) {
      console.error("   ❌ Erreur lors de la vérification:", error.message);
    }
    console.log("");
  }

  // 4. Vérifier les utilisateurs sans email vérifié
  console.log("4. Utilisateurs sans email vérifié:");
  try {
    const usersWithoutVerification = await db.user.findMany({
      where: {
        emailVerified: null,
      },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
      },
      take: 10,
    });
    
    if (usersWithoutVerification.length === 0) {
      console.log("   ✅ Aucun utilisateur sans email vérifié");
    } else {
      console.log(`   ⚠️  ${usersWithoutVerification.length} utilisateur(s) sans email vérifié:`);
      usersWithoutVerification.forEach((user) => {
        console.log(`      - ${user.email} (${user.status || "statut inconnu"}, ${user.role || "rôle inconnu"})`);
      });
    }
  } catch (error: any) {
    console.error("   ❌ Erreur:", error.message);
  }
  console.log("");

  // 5. Vérifier les utilisateurs inactifs
  console.log("5. Utilisateurs inactifs:");
  try {
    const inactiveUsers = await db.user.findMany({
      where: {
        status: 'Inactif',
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
      take: 10,
    });
    
    if (inactiveUsers.length === 0) {
      console.log("   ✅ Aucun utilisateur inactif");
    } else {
      console.log(`   ⚠️  ${inactiveUsers.length} utilisateur(s) inactif(s):`);
      inactiveUsers.forEach((user) => {
        console.log(`      - ${user.email} (${user.role || "rôle inconnu"})`);
      });
    }
  } catch (error: any) {
    console.error("   ❌ Erreur:", error.message);
  }
  console.log("");

  // 6. Vérifier la configuration NextAuth
  console.log("6. Configuration NextAuth:");
  try {
    const { auth } = await import("../auth");
    console.log("   ✅ Module auth.ts chargé correctement");
  } catch (error: any) {
    console.error("   ❌ Erreur lors du chargement de auth.ts:", error.message);
  }
  console.log("");

  await db.$disconnect();
  console.log("✅ Diagnostic terminé");
}

diagnoseAuth().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});
