import { PermissionType } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { hasPermission } from "@/lib/dynamic-permissions";
import { ServiceError } from "@/lib/service-error";

/**
 * Types d'opération alignés sur Prisma PermissionType.
 * TODO: migration future des Permission.action legacy (noms de Server Actions)
 * vers des clés stables de type resource:action (ex. cotisations:read).
 * Pour l'instant, permissionKey accepte les clés legacy existantes.
 */
export type AuthorizePermissionType = "READ" | "WRITE" | "DELETE" | "MANAGE";

export type AuthorizeInput = {
  /** Identité déjà authentifiée (Web cookie, futur Bearer, etc.) */
  actor: AuthContext;
  /**
   * Clé legacy Permission.action (ex. "getAllDettesInitiales").
   * TODO: migrer vers resource:action stables — ne pas renommer en DB maintenant.
   */
  permissionKey: string;
  type: AuthorizePermissionType;
};

function toPermissionType(type: AuthorizePermissionType): PermissionType {
  switch (type) {
    case "READ":
      return PermissionType.READ;
    case "WRITE":
      return PermissionType.WRITE;
    case "DELETE":
      return PermissionType.DELETE;
    case "MANAGE":
      return PermissionType.MANAGE;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Indique si l'acteur est ADMIN selon AuthContext (rôle principal normalisé).
 * Aligné sur le bypass historique de hasPermission (User.role === ADMIN).
 */
function isActorAdmin(actor: AuthContext): boolean {
  return actor.role?.toString().trim().toUpperCase() === "ADMIN";
}

/**
 * Façade d'autorisation commune Web / future API mobile.
 *
 * - Ne réalise PAS l'authentification (reçoit AuthContext).
 * - Ne dépend PAS de cookies, Request, Response, auth(), NextAuth.
 * - Réutilise hasPermission (permissions dynamiques legacy).
 * - Pas d'ownership générique : reste dans les services métier.
 * - Fail closed : en cas d'incertitude, accès refusé.
 *
 * @throws {ServiceError} UNAUTHENTICATED | FORBIDDEN | INTERNAL_ERROR
 */
export async function authorize(input: AuthorizeInput): Promise<void> {
  const { actor, permissionKey, type } = input;

  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Identité manquante");
  }

  // Bypass ADMIN (comportement historique) — sans appeler le moteur dynamique
  if (isActorAdmin(actor)) {
    return;
  }

  try {
    const allowed = await hasPermission(
      actor.userId,
      permissionKey,
      toPermissionType(type)
    );

    if (!allowed) {
      // permission absente, disabled, rôles insuffisants, user inconnu, etc.
      throw new ServiceError("FORBIDDEN", "Accès refusé");
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    // Erreur technique du moteur : refuser l'accès (fail closed).
    // INTERNAL_ERROR plutôt que FORBIDDEN pour distinguer refus métier vs panne,
    // sans jamais autoriser.
    console.error("[authorize] Erreur du moteur de permissions:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Impossible de vérifier les permissions"
    );
  }
}
