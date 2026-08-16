import { auth } from "@/auth";
import type { AuthContext } from "@/lib/auth-context";

type SessionUserWithExtras = {
  id?: string | null;
  role?: string | null;
  status?: string | null;
  email?: string | null;
  name?: string | null;
  sessionId?: string | null;
};

/**
 * Construit un AuthContext à partir de la session NextAuth Web.
 *
 * AUTHENTIFICATION API TEMPORAIRE (développement / Web uniquement).
 * Le futur client React Native utilisera Bearer — NE PAS transporter
 * les cookies NextAuth vers le mobile.
 *
 * Sources réelles (callbacks auth.ts) :
 * - userId ← session.user.id ← token.sub
 * - role ← session.user.role ← token.role ← User.role (normalisé uppercase)
 * - status ← session.user.status ← token.status ← User.status
 * - sessionId ← session.user.sessionId ← token.jti
 * - email / name ← session.user
 *
 * Non résolus par ce resolver temporaire (PAS des faits métier) :
 * - adminRoles : [] = non résolu (≠ « aucun rôle admin »)
 * - adherentId : null = non résolu (≠ « pas d'Adherent »)
 *
 * Fail closed : pas de fallback role "MEMBRE" ni status "Actif".
 *
 * @returns AuthContext ou null si identité incomplète / absente
 */
export async function resolveApiActorFromWebSession(): Promise<AuthContext | null> {
  const session = await auth();
  const user = session?.user as SessionUserWithExtras | undefined;

  if (!user) {
    return null;
  }

  const userId = typeof user.id === "string" ? user.id.trim() : "";
  if (!userId) {
    return null;
  }

  const rawRole = user.role;
  if (rawRole == null || String(rawRole).trim() === "") {
    return null;
  }
  const role = String(rawRole).trim().toUpperCase();

  const rawStatus = user.status;
  if (rawStatus == null || String(rawStatus).trim() === "") {
    return null;
  }
  const status = String(rawStatus).trim();

  const sessionId =
    typeof user.sessionId === "string" && user.sessionId.trim() !== ""
      ? user.sessionId
      : null;

  return {
    userId,
    role,
    status,
    email: user.email ?? null,
    name: user.name ?? null,
    sessionId,
    // Non résolus — voir JSDoc ci-dessus
    adminRoles: [],
    adherentId: null,
    channel: "web",
  };
}
