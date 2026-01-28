/**
 * Template pour ajouter une nouvelle Server Action au système de permissions
 * 
 * INSTRUCTIONS:
 * 1. Copier ce fichier et le renommer selon votre besoin
 * 2. Remplacer les placeholders [ACTION_NAME], [LABEL], etc.
 * 3. Ajouter la configuration dans lib/server-actions-config.ts
 * 4. Ajouter les vérifications dans votre Server Action
 * 5. Créer les permissions via l'interface /admin/settings → Permissions
 */

// ============================================
// ÉTAPE 1: Configuration dans server-actions-config.ts
// ============================================
// Ajouter dans lib/server-actions-config.ts :

export const SERVER_ACTIONS_CONFIG: ServerActionConfig[] = [
  // ... actions existantes ...
  
  // ========== [CATÉGORIE] ==========
  {
    action: "[ACTION_NAME]",                    // Nom exact de la fonction Server Action
    label: "[LABEL]",                            // Libellé affiché dans l'interface
    description: "[DESCRIPTION]",                // Description de l'action
    resource: "[RESOURCE]",                      // Ressource concernée (ex: "nouveaux-items")
    defaultType: "READ",                         // "READ" | "WRITE" | "DELETE" | "MANAGE"
    route: "/admin/[ROUTE]",                     // Route associée (optionnel)
    category: "[CATÉGORIE]",                    // Catégorie pour regrouper
  },
];

// ============================================
// ÉTAPE 2: Vérification dans la Server Action
// ============================================
// Dans votre fichier Server Action (ex: actions/[module]/index.ts) :

"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
// ... autres imports ...

/**
 * [DESCRIPTION DE L'ACTION]
 */
export async function [ACTION_NAME]([PARAMÈTRES]) {
  try {
    // 1. Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // 2. Vérifier la permission dynamique
    // Pour READ:
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "[ACTION_NAME]");
    
    // Pour WRITE:
    // const { canWrite } = await import("@/lib/dynamic-permissions");
    // const hasAccess = await canWrite(session.user.id, "[ACTION_NAME]");
    
    // Pour DELETE:
    // const { canDelete } = await import("@/lib/dynamic-permissions");
    // const hasAccess = await canDelete(session.user.id, "[ACTION_NAME]");
    
    // Pour MANAGE:
    // const { canManage } = await import("@/lib/dynamic-permissions");
    // const hasAccess = await canManage(session.user.id, "[ACTION_NAME]");
    
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    // 3. Votre logique métier ici
    // const result = await db.[MODEL].findMany();
    // ...

    return { success: true, data: result };
  } catch (error) {
    console.error("Erreur lors de [ACTION]:", error);
    return { success: false, error: "Erreur lors de [ACTION]" };
  }
}

// ============================================
// ÉTAPE 3: Création des permissions
// ============================================
// Option A: Via l'interface (recommandé)
// 1. Aller sur /admin/settings → onglet "Permissions"
// 2. Trouver votre action dans la catégorie
// 3. Cocher les rôles autorisés
// 4. Cliquer sur "Sauvegarder"

// Option B: Via migration SQL (pour permissions par défaut)
// Créer: prisma/migrations/[TIMESTAMP]_add_[module]_permissions/migration.sql

/*
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_[module]_[action]', '[ACTION_NAME]', '[RESOURCE]', '[TYPE]', 
     ARRAY['ADMIN', 'PRESID'], 
     '[DESCRIPTION]', 
     '/admin/[ROUTE]', 
     true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;
*/

// ============================================
// EXEMPLE COMPLET
// ============================================

// Configuration (lib/server-actions-config.ts):
/*
{
  action: "getAllReservations",
  label: "Lister les réservations",
  description: "Afficher toutes les réservations",
  resource: "reservations",
  defaultType: "READ",
  route: "/admin/reservations",
  category: "Réservations",
}
*/

// Server Action (actions/reservations/index.ts):
/*
export async function getAllReservations() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non autorisé" };
  }

  const { canRead } = await import("@/lib/dynamic-permissions");
  if (!(await canRead(session.user.id, "getAllReservations"))) {
    return { success: false, error: "Non autorisé" };
  }

  const reservations = await db.reservation.findMany();
  return { success: true, data: reservations };
}
*/
