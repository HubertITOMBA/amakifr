import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

export type ProfileSection =
  | "summary"
  | "account"
  | "identity"
  | "coordonnees"
  | "contact";

export type MeProfileSummaryDto = {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: string;
  hasIdentity: boolean;
  hasCoordonnees: boolean;
  hasContact: boolean;
};

export type MeProfileAccountDto = {
  email: string | null;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
};

export type MeProfileIdentityDto = {
  civility: string | null;
  firstname: string | null;
  lastname: string | null;
  dateNaissance: string | null;
  numeroPasseport: string | null;
};

export type MeProfileAddressDto = {
  id: string;
  streetnum: string | null;
  street1: string | null;
  street2: string | null;
  codepost: string | null;
  city: string | null;
  country: string | null;
};

export type MeProfileCoordonneesDto = {
  addresses: MeProfileAddressDto[];
};

export type MeProfilePhoneDto = {
  id: string;
  numero: string;
  type: string;
  estPrincipal: boolean;
  description: string | null;
};

export type MeProfileContactDto = {
  telephones: MeProfilePhoneDto[];
};

export type MeProfileSectionDto =
  | MeProfileSummaryDto
  | MeProfileAccountDto
  | MeProfileIdentityDto
  | MeProfileCoordonneesDto
  | MeProfileContactDto;

const SECTIONS = new Set<ProfileSection>([
  "summary",
  "account",
  "identity",
  "coordonnees",
  "contact",
]);

/**
 * Valide le nom de section profil.
 *
 * @param value - Valeur brute query
 * @returns Section typée
 */
export function parseProfileSection(value: string | null): ProfileSection {
  if (!value || !SECTIONS.has(value as ProfileSection)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Section profil invalide (summary|account|identity|coordonnees|contact)"
    );
  }
  return value as ProfileSection;
}

/**
 * Charge une section du profil adhérent (lazy).
 * Sans cotisations / documents / RGPD.
 *
 * @param actor - Identité authentifiée
 * @param section - Section demandée
 */
export async function getMyProfileSection(
  actor: AuthContext,
  section: ProfileSection
): Promise<MeProfileSectionDto> {
  if (!actor?.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Identité manquante");
  }

  try {
    switch (section) {
      case "summary":
        return await loadSummary(actor.userId);
      case "account":
        return await loadAccount(actor.userId);
      case "identity":
        return await loadIdentity(actor.userId);
      case "coordonnees":
        return await loadCoordonnees(actor.userId);
      case "contact":
        return await loadContact(actor.userId);
      default:
        throw new ServiceError("VALIDATION_ERROR", "Section invalide");
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyProfileSection] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération du profil"
    );
  }
}

async function loadSummary(userId: string): Promise<MeProfileSummaryDto> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      adherent: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          Adresse: { select: { id: true }, take: 1 },
          Telephones: { select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");

  const adherent = user.adherent;
  return {
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
    hasIdentity: Boolean(
      adherent && (adherent.firstname || adherent.lastname)
    ),
    hasCoordonnees: Boolean(adherent?.Adresse?.length),
    hasContact: Boolean(adherent?.Telephones?.length),
  };
}

async function loadAccount(userId: string): Promise<MeProfileAccountDto> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
    },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");
  return {
    email: user.email,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function loadIdentity(userId: string): Promise<MeProfileIdentityDto> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      adherent: {
        select: {
          civility: true,
          firstname: true,
          lastname: true,
          dateNaissance: true,
          numeroPasseport: true,
        },
      },
    },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");
  const a = user.adherent;
  if (!a) {
    return {
      civility: null,
      firstname: null,
      lastname: null,
      dateNaissance: null,
      numeroPasseport: null,
    };
  }
  return {
    civility: a.civility ?? null,
    firstname: a.firstname,
    lastname: a.lastname,
    dateNaissance: a.dateNaissance?.toISOString() ?? null,
    numeroPasseport: a.numeroPasseport,
  };
}

async function loadCoordonnees(
  userId: string
): Promise<MeProfileCoordonneesDto> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      adherent: {
        select: {
          Adresse: {
            select: {
              id: true,
              streetnum: true,
              street1: true,
              street2: true,
              codepost: true,
              city: true,
              country: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");
  return {
    addresses: (user.adherent?.Adresse ?? []).map((address) => ({
      id: address.id,
      streetnum: address.streetnum,
      street1: address.street1,
      street2: address.street2,
      codepost: address.codepost,
      city: address.city,
      country: address.country,
    })),
  };
}

async function loadContact(userId: string): Promise<MeProfileContactDto> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      adherent: {
        select: {
          Telephones: {
            select: {
              id: true,
              numero: true,
              type: true,
              estPrincipal: true,
              description: true,
            },
            orderBy: [{ estPrincipal: "desc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");
  return {
    telephones: (user.adherent?.Telephones ?? []).map((phone) => ({
      id: phone.id,
      numero: phone.numero,
      type: String(phone.type),
      estPrincipal: phone.estPrincipal,
      description: phone.description,
    })),
  };
}
