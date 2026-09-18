import { AdminRole, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveActionPermissionConfig } from "@/lib/dynamic-permissions";
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

/** Décideurs / exécuteurs exclusifs : TRESOR + ADMIN. */
const DECIDER_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.TRESOR,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
]);

const FINANCIAL_READER_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.TRESOR,
  UserRole.COMCPT,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
  AdminRole.COMCPT,
]);

const ARCHIVE_READER_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.TRESOR,
  UserRole.COMCPT,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
  AdminRole.COMCPT,
]);

type AuthzClient = {
  user: { findUnique: typeof db.user.findUnique };
  userAdminRole: { findMany: typeof db.userAdminRole.findMany };
};

/**
 * Évalue une permission dynamique WRITE/READ de façon **restrictive**
 * (même pattern que decideNoteFrais) : absente → OK ; disabled → refus ;
 * configurée → intersection avec les rôles du compte.
 */
async function evaluateRestrictiveDynamicPermission(
  action: string,
  primaryRole: string,
  extras: Array<{ role: string }>
): Promise<boolean> {
  const config = await resolveActionPermissionConfig(action);
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

async function loadActifUserWithExtras(
  userId: string,
  client: AuthzClient,
  extraRoles: AdminRole[]
): Promise<{
  primaryRole: string;
  userRole: string;
  extras: Array<{ role: string }>;
} | null> {
  if (!userId) return null;
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return null;
  const primaryRole = user.role?.toString().trim().toUpperCase() || "";
  const extras = await client.userAdminRole.findMany({
    where: { userId, role: { in: extraRoles } },
    select: { role: true },
  });
  return { primaryRole, userRole: user.role, extras };
}

/**
 * Lecteur responsable des notes soumises/décidées live.
 *
 * 1. Compte **Actif** obligatoire.
 * 2. Rôle principal **ou** additionnel ADMIN|PRESID|SECRET|TRESOR obligatoire
 *    (une permission dynamique ne peut pas autoriser MEMBRE/COMCPT seul).
 * 3. Rôle principal **ADMIN** : bypass.
 * 4. Permission dynamique `readNoteFrais` **restrictive**.
 *
 * Le propriétaire accède à ses notes via le chemin owner (`getNoteFraisForUser`),
 * pas via cette fonction.
 */
export async function canUserReadSubmittedNotesFrais(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.PRESID,
    AdminRole.SECRET,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasHardRole =
    SUBMITTED_READER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasHardRole) return false;

  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "readNoteFrais",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Décision sur une note SOUMISE — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserDecideNoteFrais(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasDeciderRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasDeciderRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "decideNoteFrais",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Exécution compensation — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserExecuteNoteFraisCompensation(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasExecutorRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasExecutorRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "executeNoteFraisCompensation",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Exécution remboursement — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserExecuteNoteFraisRemboursement(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasExecutorRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasExecutorRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "executeNoteFraisRemboursement",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Exécution mixte — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserExecuteNoteFraisReglementMixte(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasExecutorRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasExecutorRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "executeNoteFraisReglementMixte",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Correction append-only d'un règlement — TRESOR|ADMIN + dynamique restrictive.
 * COMCPT : lecture uniquement (pas cette capacité).
 */
export async function canUserCorrectNoteFraisReglement(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasCorrectorRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasCorrectorRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "correctNoteFraisReglement",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Enregistrement d'une restitution réelle — TRESOR|ADMIN + dynamique restrictive.
 * COMCPT/PRESID/SECRET/MEMBRE refusés.
 */
export async function canUserRecordNoteFraisRestitution(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "recordNoteFraisRestitution",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Lecture de la référence d'une restitution — ADMIN|TRESOR uniquement (pas COMCPT).
 */
export async function canUserReadNoteFraisRestitutionReference(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;

  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "readNoteFraisRestitutionReference",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Demande d'annulation de règlement — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserRequestCancelNoteFraisReglement(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;
  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;
  return evaluateRestrictiveDynamicPermission(
    "requestCancelNoteFraisReglement",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Confirmation d'annulation — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserConfirmCancelNoteFraisReglement(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;
  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;
  return evaluateRestrictiveDynamicPermission(
    "confirmCancelNoteFraisReglement",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Refus d'annulation — TRESOR|ADMIN + dynamique restrictive.
 */
export async function canUserRefuseCancelNoteFraisReglement(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;
  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;
  return evaluateRestrictiveDynamicPermission(
    "refuseCancelNoteFraisReglement",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Lecture audit annulation (motif/preuve/acteurs) — ADMIN|TRESOR uniquement.
 */
export async function canUserReadNoteFraisAnnulationAudit(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
  ]);
  if (!loaded) return false;
  const hasRole =
    DECIDER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;
  return evaluateRestrictiveDynamicPermission(
    "readNoteFraisAnnulationAudit",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Lecture audit correction (motif / preuve) — mêmes rôles durs que la correction.
 */
export async function canUserReadNoteFraisCorrectionAudit(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  return canUserCorrectNoteFraisReglement(userId, client);
}

/**
 * Lecture de la référence de remboursement (traçabilité).
 * Alignée sur la vue financière (ADMIN|TRESOR|COMCPT + dynamique).
 */
export async function canUserReadNoteFraisRemboursementReference(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  return canUserReadNoteFraisFinancialView(userId, client);
}

/**
 * Lecture vue financière dédiée (règlements + référence).
 * Actif ADMIN|TRESOR|COMCPT ; permission `readNoteFraisFinancialView` restrictive.
 * Ne donne **pas** accès au détail live / justificatifs.
 */
export async function canUserReadNoteFraisFinancialView(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
    AdminRole.COMCPT,
  ]);
  if (!loaded) return false;

  const hasHardRole =
    FINANCIAL_READER_ROLES.has(loaded.userRole) || loaded.extras.length > 0;
  if (!hasHardRole) return false;
  if (loaded.primaryRole === "ADMIN") return true;

  return evaluateRestrictiveDynamicPermission(
    "readNoteFraisFinancialView",
    loaded.primaryRole,
    loaded.extras
  );
}

/**
 * Lecture archive privée : Actif ADMIN|TRESOR|COMCPT (principal ou additionnel).
 */
export async function canUserReadNotesFraisArchive(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
    AdminRole.TRESOR,
    AdminRole.COMCPT,
  ]);
  if (!loaded) return false;
  return (
    ARCHIVE_READER_ROLES.has(loaded.userRole) || loaded.extras.length > 0
  );
}

/**
 * Lecture des paramètres de conservation (lot 4.10).
 * ADMIN|TRESOR|COMCPT actifs — lecture seule pour TRESOR/COMCPT.
 */
export async function canUserReadNotesFraisRetentionPolicy(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  return canUserReadNotesFraisArchive(userId, client);
}

/**
 * Écriture / activation politique de conservation — ADMIN actif uniquement.
 * Jamais MEMBRE/PRESID/SECRET/TRESOR/COMCPT.
 */
export async function canUserWriteNotesFraisRetentionPolicy(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  const loaded = await loadActifUserWithExtras(userId, client, [
    AdminRole.ADMIN,
  ]);
  if (!loaded) return false;
  if (loaded.primaryRole === "ADMIN") return true;
  return (
    loaded.userRole === UserRole.ADMIN ||
    loaded.extras.some((e) => e.role === AdminRole.ADMIN || e.role === "ADMIN")
  );
}

/**
 * Pose / levée legal hold — ADMIN actif uniquement (écriture sensible).
 */
export async function canUserManageNotesFraisLegalHold(
  userId: string,
  client: AuthzClient = db
): Promise<boolean> {
  return canUserWriteNotesFraisRetentionPolicy(userId, client);
}
