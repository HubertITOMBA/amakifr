import { AdminRole, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";

/** Destinataires notif soumission (validés) — sans COMCPT. */
export const NOTES_FRAIS_SUBMISSION_NOTIFY_ROLES = [
  UserRole.ADMIN,
  UserRole.PRESID,
  UserRole.SECRET,
  UserRole.TRESOR,
] as const;

const NOTIFY_ROLE_SET = new Set<string>(NOTES_FRAIS_SUBMISSION_NOTIFY_ROLES);

/**
 * Résout les userId actifs à notifier pour une soumission.
 * Exclut le demandeur ; déduplique.
 */
export async function resolveSubmissionRecipientUserIds(
  demandeurUserId: string,
  client: {
    user: { findMany: typeof db.user.findMany };
    userAdminRole: { findMany: typeof db.userAdminRole.findMany };
  } = db
): Promise<string[]> {
  const primary = await client.user.findMany({
    where: {
      status: UserStatus.Actif,
      role: { in: [...NOTES_FRAIS_SUBMISSION_NOTIFY_ROLES] },
    },
    select: { id: true },
  });

  const additional = await client.userAdminRole.findMany({
    where: {
      role: {
        in: [
          AdminRole.ADMIN,
          AdminRole.PRESID,
          AdminRole.SECRET,
          AdminRole.TRESOR,
        ],
      },
      user: { status: UserStatus.Actif },
    },
    select: { userId: true },
  });

  const ids = new Set<string>();
  for (const u of primary) ids.add(u.id);
  for (const r of additional) ids.add(r.userId);
  ids.delete(demandeurUserId);
  return [...ids];
}

export function isSubmissionNotifyRole(role: string): boolean {
  return NOTIFY_ROLE_SET.has(role);
}

/** Lecture archive (futur) — TRESOR, ADMIN, COMCPT actifs. */
export const NOTES_FRAIS_ARCHIVE_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.TRESOR,
  UserRole.COMCPT,
] as const;
