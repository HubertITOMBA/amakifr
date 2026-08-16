/**
 * DTO minimal « utilisateur courant » (getMe).
 * Sérialisable JSON — pas de Date natives, pas de secrets.
 */

export type MeAddressDto = {
  id: string;
  streetnum: string | null;
  street1: string | null;
  street2: string | null;
  codepost: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeAdherentDto = {
  id: string;
  civility: string;
  firstname: string | null;
  lastname: string | null;
  departement_id: string | null;
  sous_departement_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  addresses: MeAddressDto[];
};

/** Comptes OAuth liés — sans providerAccountId (identifiant sensible) */
export type MeAccountDto = {
  id: string;
  type: string;
  provider: string;
};

export type MeDto = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  /** Raccourci pour ownership / APIs futures */
  adherentId: string | null;
  adherent: MeAdherentDto | null;
  accounts: MeAccountDto[];
};
