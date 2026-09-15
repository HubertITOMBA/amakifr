import { AdminRole, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getUserAdminRolesFromDb } from "@/lib/user-roles";
import { NOTES_FRAIS_ARCHIVE_READ_ROLES } from "@/lib/frais-avances/recipients";
import { canRead } from "@/lib/dynamic-permissions";

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

const ARCHIVE_READER_ROLES = new Set<string>([
  ...NOTES_FRAIS_ARCHIVE_READ_ROLES,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
  AdminRole.COMCPT,
]);

/**
 * Lecteur responsable des notes soumises live : permission dynamique ou
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
