"use server"

import { signOut } from "@/auth"
import { auth } from "@/auth"
import { logUserActivity } from "@/lib/activity-logger"
import { TypeActivite } from "@prisma/client"

/**
 * Enregistre l'activité de déconnexion (pour /admin/activities).
 * À appeler côté client avant signOut() pour que la session soit encore disponible.
 */
export async function logDeconnexionActivity() {
  try {
    const session = await auth();
    if (!session?.user?.id) return;
    await logUserActivity(
      TypeActivite.Deconnexion,
      `Déconnexion de l'utilisateur ${session.user.email || session.user.name || session.user.id}`,
      "User",
      session.user.id,
      { email: session.user.email, role: session.user.role }
    );
  } catch (e) {
    console.warn("Erreur lors du logging de la déconnexion:", e);
  }
}

export const logOut = async () => {
    await logDeconnexionActivity();
    await signOut();
}