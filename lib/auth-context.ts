import type { AdminRole, UserRole, UserStatus } from "@prisma/client";

/**
 * Identité authentifiée normalisée pour les services métier.
 *
 * Indépendante du canal (cookie Web, futur Bearer mobile, jobs système).
 * Les règles métier ne doivent PAS brancher sur `channel`.
 */
export type AuthChannel = "web" | "mobile" | "system";

export type AuthContext = {
  /** Identifiant User PostgreSQL */
  userId: string;
  /** Rôle principal normalisé (uppercase) */
  role: UserRole | string;
  /** Statut compte */
  status: UserStatus | string;
  email?: string | null;
  name?: string | null;
  /** jti / sessionId Redis — audit / révocation, pas de règle métier */
  sessionId?: string | null;
  /** Rôles bureau additionnels (UserAdminRole, etc.) */
  adminRoles: AdminRole[] | string[];
  /** Adherent lié, si connu (évite une requête supplémentaire) */
  adherentId?: string | null;
  /** Origine technique — logs uniquement */
  channel: AuthChannel;
};
