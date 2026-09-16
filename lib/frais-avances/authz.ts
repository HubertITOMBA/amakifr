import { AdminRole, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getUserAdminRolesFromDb } from "@/lib/user-roles";
import { NOTES_FRAIS_ARCHIVE_READ_ROLES } from "@/lib/frais-avances/recipients";
import { canRead, resolveActionPermissionConfig } from "@/lib/dynamic-permissions";
import { isAdminRole } from "@/lib/utils";

const SUBMITTED_READER_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.PRESID,
  UserRole.SECRET,
  UserRole.TRESOR,
  AdminRole.ADMIN,
  AdminRole.PRESID,
  AdminRole.SECRET,
  AdminRole.TRESOR,
]);

/** Décideurs exclusifs : TRESOR + ADMIN (≠ destinataires notif soumission). */
const DECIDER_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.TRESOR,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
]);

const ARCHIVE_READER_ROLES = new Set<string>([
  ...NOTES_FRAIS_ARCHIVE_READ_ROLES,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
  AdminRole.COMCPT,
]);

/**
 * Lecteur responsable des notes soumises/décidées live : permission dynamique ou
 * rôle ADMIN|PRESID|SECRET|TRESOR (principal / additionnel) + Actif.
 */
export async function canUserReadSubmittedNotesFrais(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
  } = db
): Promise<boolean> {
  if (!userId) return false;
  if (await canRead(userId, "readNoteFrais")) return true;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;
  if (SUBMITTED_READER_ROLES.has(user.role)) return true;
  const extras = await getUserAdminRolesFromDb(userId);
  return extras.some((r) => SUBMITTED_READER_ROLES.has(r));
}

/**
 * Décision sur une note SOUMISE.
 *
 * Règle exacte :
 * 1. Compte **Actif** obligatoire.
 * 2. Rôle principal **ou** additionnel **TRESOR|ADMIN** obligatoire
 *    (une permission dynamique ne peut pas élargir ce filtre).
 * 3. Rôle principal **ADMIN** : autorisé (bypass existant de `hasPermission`).
 * 4. Sinon, config dynamique `decideNoteFrais` WRITE :
 *    - **absente** (non configurée) → le rôle métier suffit → autorisé ;
 *    - **disabled** (`enabled=false`) → refus explicite → refusé ;
 *    - **configured** → autorisé seulement si l’un des rôles user (principal
 *      admin ou additionnel) figure dans `permission.roles`
 *      (rôle absent de la liste = refus explicite).
 *
 * PRESID/SECRET/COMCPT : non.
 */
export async function canUserDecideNoteFrais(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  if (!userId) return false;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;

  const primaryRole = user.role?.toString().trim().toUpperCase() || "";

  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: { in: [AdminRole.ADMIN, AdminRole.TRESOR] },
    },
    select: { role: true },
  });

  const hasDeciderRole =
    DECIDER_ROLES.has(user.role) || extras.length > 0;

  // Filtre métier dur : sans TRESOR/ADMIN, refuser même si une permission WRITE existe.
  if (!hasDeciderRole) return false;

  // Bypass ADMIN principal — aligné sur hasPermission (L38–42).
  if (primaryRole === "ADMIN") return true;

  const config = await resolveActionPermissionConfig("decideNoteFrais");

  // Permission non configurée : le rôle Actif TRESOR/ADMIN suffit.
  if (config.status === "absent") return true;

  // Refus explicite global (permission désactivée).
  if (config.status === "disabled") return false;

  // Refus explicite ou accord selon la liste de rôles (comme hasPermission L94–102).
  const userRoles: string[] = [];
  if (isAdminRole(primaryRole)) userRoles.push(primaryRole);
  for (const extra of extras) {
    const r = extra.role.toString().trim().toUpperCase();
    if (!userRoles.includes(r)) userRoles.push(r);
  }

  return userRoles.some((role) => config.roles.includes(role));
}

/**
 * Exécution d'une compensation de note VALIDEE (lot 4.1).
 * Même filtre dur TRESOR|ADMIN + dynamique restrictive que decideNoteFrais.
 * Action distincte : `executeNoteFraisCompensation`.
 *
 * @param userId - Identifiant du compte à autoriser
 * @param client - Client Prisma (ou TX)
 * @returns true si autorisé
 */
export async function canUserExecuteNoteFraisCompensation(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  if (!userId) return false;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;

  const primaryRole = user.role?.toString().trim().toUpperCase() || "";

  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: { in: [AdminRole.ADMIN, AdminRole.TRESOR] },
    },
    select: { role: true },
  });

  const hasExecutorRole =
    DECIDER_ROLES.has(user.role) || extras.length > 0;

  if (!hasExecutorRole) return false;
  if (primaryRole === "ADMIN") return true;

  const config = await resolveActionPermissionConfig(
    "executeNoteFraisCompensation"
  );
  if (config.status === "absent") return true;
  if (config.status === "disabled") return false;

  const userRoles: string[] = [];
  if (isAdminRole(primaryRole)) userRoles.push(primaryRole);
  for (const extra of extras) {
    const r = extra.role.toString().trim().toUpperCase();
    if (!userRoles.includes(r)) userRoles.push(r);
  }

  return userRoles.some((role) => config.roles.includes(role));
}

/**
 * Exécution d'un remboursement de note VALIDEE (lot 4.2).
 * Même filtre dur TRESOR|ADMIN + dynamique restrictive que decide/compensation.
 * Action distincte : `executeNoteFraisRemboursement`.
 *
 * @param userId - Identifiant du compte à autoriser
 * @param client - Client Prisma (ou TX)
 * @returns true si autorisé
 */
export async function canUserExecuteNoteFraisRemboursement(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  if (!userId) return false;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;

  const primaryRole = user.role?.toString().trim().toUpperCase() || "";

  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: { in: [AdminRole.ADMIN, AdminRole.TRESOR] },
    },
    select: { role: true },
  });

  const hasExecutorRole =
    DECIDER_ROLES.has(user.role) || extras.length > 0;

  if (!hasExecutorRole) return false;
  if (primaryRole === "ADMIN") return true;

  const config = await resolveActionPermissionConfig(
    "executeNoteFraisRemboursement"
  );
  if (config.status === "absent") return true;
  if (config.status === "disabled") return false;

  const userRoles: string[] = [];
  if (isAdminRole(primaryRole)) userRoles.push(primaryRole);
  for (const extra of extras) {
    const r = extra.role.toString().trim().toUpperCase();
    if (!userRoles.includes(r)) userRoles.push(r);
  }

  return userRoles.some((role) => config.roles.includes(role));
}

/**
 * Lecture de la référence de remboursement (traçabilité).
 * Actif ADMIN|TRESOR|COMCPT (principal ou additionnel) uniquement.
 *
 * @param userId - Lecteur
 * @param client - Prisma
 */
export async function canUserReadNoteFraisRemboursementReference(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  if (!userId) return false;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;

  const REF_READER = new Set<string>([
    UserRole.ADMIN,
    UserRole.TRESOR,
    UserRole.COMCPT,
    AdminRole.ADMIN,
    AdminRole.TRESOR,
    AdminRole.COMCPT,
  ]);
  if (REF_READER.has(user.role)) return true;

  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: {
        in: [AdminRole.ADMIN, AdminRole.TRESOR, AdminRole.COMCPT],
      },
    },
    select: { role: true },
  });
  return extras.length > 0;
}

/**
 * Lecture vue financière dédiée (règlements + référence).
 * Même filtre que la référence : Actif ADMIN|TRESOR|COMCPT.
 * Ne donne **pas** accès au détail live complet (`canUserReadSubmittedNotesFrais`).
 *
 * @param userId - Lecteur
 * @param client - Prisma
 */
export async function canUserReadNoteFraisFinancialView(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  return canUserReadNoteFraisRemboursementReference(userId, client);
}

/**
 * Lecture archive privée : Actif ADMIN|TRESOR|COMCPT (principal ou additionnel).
 * Droits distincts des notes live (COMCPT inclus ; PRESID/SECRET exclus).
 */
export async function canUserReadNotesFraisArchive(
  userId: string,
  client: {
    user: { findUnique: typeof db.user.findUnique };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<boolean> {
  if (!userId) return false;

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;
  if (ARCHIVE_READER_ROLES.has(user.role)) return true;

  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: {
        in: [AdminRole.ADMIN, AdminRole.TRESOR, AdminRole.COMCPT],
      },
    },
    select: { role: true },
  });
  return extras.length > 0;
}
