import { authenticatedFetch } from "@/auth/session";

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

/**
 * GET /api/v1/me/profile?section=…
 */
export async function getMyProfileSection<T>(
  section: ProfileSection
): Promise<T> {
  return authenticatedFetch<T>(
    `/api/v1/me/profile?section=${encodeURIComponent(section)}`
  );
}
