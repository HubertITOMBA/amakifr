import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

export type MyPasseportRecord = {
  adherentId: string;
  civility: string | null;
  firstname: string | null;
  lastname: string | null;
  dateNaissance: Date | null;
  profession: string | null;
  numeroPasseport: string | null;
  dateGenerationPasseport: Date | null;
  userStatus: string;
  userEmail: string | null;
  userCreatedAt: Date | null;
  adresse: {
    streetnum: string | null;
    street1: string | null;
    street2: string | null;
    codepost: string | null;
    city: string | null;
    country: string | null;
  } | null;
};

/**
 * Charge le dossier adhérent lié à l'acteur authentifié.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN
 */
export async function loadMyPasseportRecord(
  actor: AuthContext
): Promise<MyPasseportRecord> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: {
      id: true,
      civility: true,
      firstname: true,
      lastname: true,
      dateNaissance: true,
      profession: true,
      numeroPasseport: true,
      dateGenerationPasseport: true,
      User: {
        select: {
          status: true,
          email: true,
          createdAt: true,
        },
      },
      Adresse: {
        take: 1,
        select: {
          streetnum: true,
          street1: true,
          street2: true,
          codepost: true,
          city: true,
          country: true,
        },
      },
    },
  });

  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
  }

  if (adherent.User.status !== "Actif") {
    throw new ServiceError(
      "FORBIDDEN",
      "Votre compte doit être actif pour accéder au passeport"
    );
  }

  return {
    adherentId: adherent.id,
    civility: adherent.civility,
    firstname: adherent.firstname,
    lastname: adherent.lastname,
    dateNaissance: adherent.dateNaissance,
    profession: adherent.profession,
    numeroPasseport: adherent.numeroPasseport,
    dateGenerationPasseport: adherent.dateGenerationPasseport,
    userStatus: adherent.User.status,
    userEmail: adherent.User.email,
    userCreatedAt: adherent.User.createdAt,
    adresse: adherent.Adresse[0] ?? null,
  };
}
