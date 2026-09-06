/**
 * Helpers purs pour le compteur non lu (jamais négatif) + badge / AppState.
 */

export function nextUnreadAfterMarkRead(
  unreadCount: number,
  wasUnread: boolean
): number {
  if (!wasUnread) return Math.max(0, unreadCount);
  return Math.max(0, unreadCount - 1);
}

export function nextUnreadAfterDelete(
  unreadCount: number,
  wasUnread: boolean
): number {
  if (!wasUnread) return Math.max(0, unreadCount);
  return Math.max(0, unreadCount - 1);
}

export function nextUnreadAfterMarkAll(): number {
  return 0;
}

/**
 * Badge tab : absent si 0, plafonné à 99+.
 */
export function formatTabUnreadBadge(
  unreadCount: number
): number | string | undefined {
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) return undefined;
  if (unreadCount > 99) return "99+";
  return unreadCount;
}

/**
 * Refresh unread uniquement au passage background/inactive → active.
 */
export function shouldRefreshUnreadOnAppState(
  previous: string | null,
  next: string
): boolean {
  if (next !== "active") return false;
  if (previous === null) return false;
  return previous === "background" || previous === "inactive";
}

/**
 * Formate une date ISO pour l'UI (fr-FR). Ne crash pas sur date invalide.
 */
export function formatNotificationDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * Message utilisateur depuis ApiClientError.
 */
export function notificationErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable. Vérifiez le réseau.";
  }
  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Trop de requêtes. Réessayez plus tard.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Notification introuvable.";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Accès refusé.";
  }
  if (error.status >= 500) {
    return "Erreur serveur. Réessayez plus tard.";
  }
  return error.message || "Une erreur est survenue.";
}
