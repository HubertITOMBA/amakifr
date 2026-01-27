#!/usr/bin/env tsx
/**
 * Script de vérification avant déploiement en production
 * Vérifie l'état du schéma Prisma, des migrations et de la configuration
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  status: "success" | "warning" | "error";
  message: string;
}

const results: CheckResult[] = [];

function addResult(name: string, status: "success" | "warning" | "error", message: string) {
  results.push({ name, status, message });
  const icon = status === "success" ? "✅" : status === "warning" ? "⚠️" : "❌";
  console.log(`${icon} ${name}: ${message}`);
}

async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    addResult("Connexion à la base de données", "success", "Connexion réussie");
    return true;
  } catch (error: any) {
    addResult("Connexion à la base de données", "error", `Erreur: ${error.message}`);
    return false;
  }
}

async function checkMigrations() {
  try {
    const output = execSync("npx prisma migrate status", { encoding: "utf-8" });
    if (output.includes("Database schema is up to date")) {
      addResult("État des migrations", "success", "Toutes les migrations sont appliquées");
    } else if (output.includes("migrations have not yet been applied")) {
      addResult("État des migrations", "warning", "Des migrations sont en attente");
      console.log("   Détails:", output);
    } else {
      addResult("État des migrations", "error", "État des migrations inconnu");
      console.log("   Sortie:", output);
    }
  } catch (error: any) {
    addResult("État des migrations", "error", `Erreur: ${error.message}`);
  }
}

async function checkUserRoles() {
  try {
    const users = await prisma.user.findMany({
      select: {
        role: true,
        email: true,
      },
    });

    const validRoles = ["ADMIN", "MEMBRE", "INVITE", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "TRESOR", "VTRESO"];
    const invalidUsers = users.filter((u) => !validRoles.includes(u.role));

    if (invalidUsers.length === 0) {
      addResult("Rôles utilisateurs", "success", `Tous les ${users.length} utilisateurs ont des rôles valides`);
    } else {
      addResult(
        "Rôles utilisateurs",
        "error",
        `${invalidUsers.length} utilisateur(s) avec des rôles invalides: ${invalidUsers.map((u) => `${u.email} (${u.role})`).join(", ")}`
      );
    }

    // Vérifier la distribution des rôles
    const roleDistribution: Record<string, number> = {};
    users.forEach((u) => {
      roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1;
    });
    console.log("   Distribution des rôles:", roleDistribution);
  } catch (error: any) {
    addResult("Rôles utilisateurs", "error", `Erreur: ${error.message}`);
  }
}

async function checkMenus() {
  try {
    const menus = await prisma.menu.findMany({
      select: {
        niveau: true,
        statut: true,
      },
    });

    const activeMenus = menus.filter((m) => m.statut);
    const navbarMenus = activeMenus.filter((m) => m.niveau === "NAVBAR");
    const sidebarMenus = activeMenus.filter((m) => m.niveau === "SIDEBAR");

    if (activeMenus.length === 0) {
      addResult("Menus dynamiques", "warning", "Aucun menu actif trouvé. Exécutez: tsx scripts/seed-menus.ts");
    } else {
      addResult(
        "Menus dynamiques",
        "success",
        `${activeMenus.length} menu(s) actif(s) (${navbarMenus.length} NAVBAR, ${sidebarMenus.length} SIDEBAR)`
      );
    }
  } catch (error: any) {
    addResult("Menus dynamiques", "error", `Erreur: ${error.message}`);
  }
}

async function checkAdminRoles() {
  try {
    const usersWithAdminRoles = await prisma.user.findMany({
      where: {
        adminRoles: {
          some: {},
        },
      },
      include: {
        adminRoles: {
          select: {
            role: true,
          },
        },
      },
    });

    addResult(
      "Rôles d'administration",
      "success",
      `${usersWithAdminRoles.length} utilisateur(s) avec des AdminRole`
    );

    // Vérifier que les utilisateurs avec AdminRole ont des UserRole appropriés
    const usersWithMismatch = usersWithAdminRoles.filter((u) => {
      const adminRoleValues = u.adminRoles.map((ar) => ar.role);
      const validUserRoles = ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "TRESOR", "VTRESO"];
      return !validUserRoles.includes(u.role) && !adminRoleValues.includes(u.role);
    });

    if (usersWithMismatch.length > 0) {
      addResult(
        "Cohérence UserRole/AdminRole",
        "warning",
        `${usersWithMismatch.length} utilisateur(s) avec des AdminRole mais UserRole non admin`
      );
    }
  } catch (error: any) {
    addResult("Rôles d'administration", "error", `Erreur: ${error.message}`);
  }
}

async function checkEnvironmentVariables() {
  const requiredVars = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ];

  const optionalVars = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "STRIPE_SECRET_KEY",
  ];

  const missing: string[] = [];
  const present: string[] = [];

  requiredVars.forEach((varName) => {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  });

  const optionalPresent: string[] = [];
  optionalVars.forEach((varName) => {
    if (process.env[varName]) {
      optionalPresent.push(varName);
    }
  });

  if (missing.length === 0) {
    addResult("Variables d'environnement requises", "success", `Toutes les variables requises sont présentes`);
  } else {
    addResult(
      "Variables d'environnement requises",
      "error",
      `Variables manquantes: ${missing.join(", ")}`
    );
  }

  if (optionalPresent.length > 0) {
    console.log(`   Variables optionnelles présentes: ${optionalPresent.join(", ")}`);
  }
}

async function checkPrismaClient() {
  try {
    // Vérifier que le client Prisma est généré
    const clientPath = path.join(process.cwd(), "node_modules", ".prisma", "client");
    if (fs.existsSync(clientPath)) {
      addResult("Client Prisma", "success", "Client Prisma généré");
    } else {
      addResult("Client Prisma", "warning", "Client Prisma non généré. Exécutez: npx prisma generate");
    }
  } catch (error: any) {
    addResult("Client Prisma", "error", `Erreur: ${error.message}`);
  }
}

async function checkSchemaFile() {
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    if (fs.existsSync(schemaPath)) {
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");
      
      // Vérifier que les nouveaux rôles sont présents
      const hasTRESOR = schemaContent.includes("TRESOR");
      const hasVTRESO = schemaContent.includes("VTRESO");
      
      if (hasTRESOR && hasVTRESO) {
        addResult("Schéma Prisma", "success", "Schéma contient TRESOR et VTRESO");
      } else {
        addResult("Schéma Prisma", "warning", "Le schéma pourrait être obsolète");
      }
    } else {
      addResult("Schéma Prisma", "error", "Fichier schema.prisma introuvable");
    }
  } catch (error: any) {
    addResult("Schéma Prisma", "error", `Erreur: ${error.message}`);
  }
}

async function main() {
  console.log("🔍 Vérification de l'état de préparation pour la production\n");
  console.log("=" .repeat(60));

  // Vérifications préliminaires
  await checkPrismaClient();
  await checkSchemaFile();
  await checkEnvironmentVariables();

  console.log("\n" + "=".repeat(60));
  console.log("Vérifications de la base de données\n");

  // Vérifications de la base de données
  const dbConnected = await checkDatabaseConnection();
  
  if (dbConnected) {
    await checkMigrations();
    await checkUserRoles();
    await checkAdminRoles();
    await checkMenus();
  }

  console.log("\n" + "=".repeat(60));
  console.log("Résumé\n");

  const successCount = results.filter((r) => r.status === "success").length;
  const warningCount = results.filter((r) => r.status === "warning").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  console.log(`✅ Succès: ${successCount}`);
  console.log(`⚠️  Avertissements: ${warningCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);

  if (errorCount > 0) {
    console.log("\n❌ Des erreurs critiques ont été détectées. Corrigez-les avant le déploiement.");
    process.exit(1);
  } else if (warningCount > 0) {
    console.log("\n⚠️  Des avertissements ont été détectés. Vérifiez-les avant le déploiement.");
    process.exit(0);
  } else {
    console.log("\n✅ Toutes les vérifications sont passées. Prêt pour le déploiement !");
    process.exit(0);
  }
}

main()
  .catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
