#!/usr/bin/env tsx

/**
 * Script de diagnostic pour vérifier l'environnement Prisma
 * À exécuter avant seed-menus.ts en cas de problème
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

console.log("🔍 Diagnostic de l'environnement Prisma\n");
console.log("==========================================\n");

// 1. Vérifier les variables d'environnement
console.log("1️⃣ Variables d'environnement:");
console.log("-".repeat(40));
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  // Masquer le mot de passe dans l'affichage
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`✅ DATABASE_URL trouvée: ${maskedUrl}`);
} else {
  console.log("❌ DATABASE_URL non trouvée");
  console.log("   Vérifiez votre fichier .env");
}
console.log("");

// 2. Vérifier le fichier .env
console.log("2️⃣ Fichier .env:");
console.log("-".repeat(40));
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  console.log(`✅ Fichier .env trouvé: ${envPath}`);
} else {
  console.log(`❌ Fichier .env non trouvé: ${envPath}`);
}
console.log("");

// 3. Vérifier le schema Prisma
console.log("3️⃣ Schema Prisma:");
console.log("-".repeat(40));
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (fs.existsSync(schemaPath)) {
  console.log(`✅ Schema trouvé: ${schemaPath}`);
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  
  // Vérifier la présence du modèle Menu
  if (schemaContent.includes("model Menu")) {
    console.log("✅ Modèle 'Menu' trouvé dans le schema");
  } else {
    console.log("❌ Modèle 'Menu' non trouvé dans le schema");
  }
  
  // Vérifier les enums
  if (schemaContent.includes("enum MenuRole")) {
    console.log("✅ Enum 'MenuRole' trouvé dans le schema");
  } else {
    console.log("❌ Enum 'MenuRole' non trouvé dans le schema");
  }
  
  if (schemaContent.includes("enum MenuNiveau")) {
    console.log("✅ Enum 'MenuNiveau' trouvé dans le schema");
  } else {
    console.log("❌ Enum 'MenuNiveau' non trouvé dans le schema");
  }
} else {
  console.log(`❌ Schema non trouvé: ${schemaPath}`);
}
console.log("");

// 4. Vérifier le client Prisma généré
console.log("4️⃣ Client Prisma:");
console.log("-".repeat(40));
const clientPath = path.join(process.cwd(), "node_modules", ".prisma", "client");
if (fs.existsSync(clientPath)) {
  console.log(`✅ Client Prisma trouvé: ${clientPath}`);
  
  // Vérifier que le client contient le modèle Menu
  const indexPath = path.join(clientPath, "index.d.ts");
  if (fs.existsSync(indexPath)) {
    const clientContent = fs.readFileSync(indexPath, "utf-8");
    if (clientContent.includes("Menu")) {
      console.log("✅ Modèle 'Menu' trouvé dans le client généré");
    } else {
      console.log("❌ Modèle 'Menu' non trouvé dans le client généré");
      console.log("   Exécutez: npx prisma generate");
    }
  }
} else {
  console.log(`❌ Client Prisma non trouvé: ${clientPath}`);
  console.log("   Exécutez: npx prisma generate");
}
console.log("");

// 5. Tester la connexion à la base de données
console.log("5️⃣ Connexion à la base de données:");
console.log("-".repeat(40));
try {
  const prisma = new PrismaClient({
    log: ['error'],
  });
  
  console.log("🔌 Tentative de connexion...");
  await prisma.$connect();
  console.log("✅ Connexion réussie");
  
  // Vérifier si la table menus existe
  try {
    const count = await prisma.menu.count();
    console.log(`✅ Table 'menus' trouvée (${count} enregistrement(s))`);
  } catch (error: any) {
    if (error.code === "P2021" || error.message.includes("does not exist")) {
      console.log("❌ Table 'menus' non trouvée");
      console.log("   Exécutez: npx prisma migrate deploy");
    } else {
      console.log("❌ Erreur lors de l'accès à la table 'menus':", error.message);
    }
  }
  
  await prisma.$disconnect();
} catch (error: any) {
  console.log("❌ Échec de connexion:", error.message);
  if (error.code === "P1001") {
    console.log("   Le serveur de base de données n'est pas accessible");
  } else if (error.code === "P1003") {
    console.log("   La base de données n'existe pas");
  }
}
console.log("");

// 6. Résumé et recommandations
console.log("📋 Recommandations:");
console.log("=".repeat(40));

if (!databaseUrl) {
  console.log("1. Créez ou vérifiez votre fichier .env");
  console.log("   DATABASE_URL=postgresql://user:password@localhost:5432/dbname");
}

if (!fs.existsSync(clientPath)) {
  console.log("2. Générez le client Prisma:");
  console.log("   npx prisma generate");
}

console.log("3. Appliquez les migrations:");
console.log("   npx prisma migrate deploy");

console.log("4. Exécutez le seed:");
console.log("   npx tsx scripts/seed-menus.ts");

console.log("\n✨ Diagnostic terminé!\n");
