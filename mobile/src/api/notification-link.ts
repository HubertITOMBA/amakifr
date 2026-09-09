/**
 * Mappe un lien Notification DB / payload push (Web) vers une route mobile Expo Router.
 * Centralisé — ne pas dupliquer dans les écrans.
 *
 * @param link - lien relatif Web (ex. /chat/abc, /paiement)
 * @returns route mobile ou null si non mappable
 */
export function notificationLinkToMobileRoute(
  link: string | null | undefined
): string | null {
  if (!link || typeof link !== "string") return null;
  const raw = link.trim();
  if (!raw) return null;

  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      path = new URL(raw).pathname;
    }
  } catch {
    return null;
  }

  path = path.split("?")[0]?.split("#")[0] ?? path;
  if (!path.startsWith("/")) path = `/${path}`;

  const chat = path.match(/^\/chat\/([^/]+)\/?$/);
  if (chat?.[1]) return `/messages/${chat[1]}`;

  if (path === "/paiement" || path === "/paiement/") {
    return "/cotisations";
  }

  const event = path.match(/^\/evenements\/([^/]+)\/?$/);
  if (event?.[1]) return `/evenements/${event[1]}`;

  if (path === "/evenements" || path === "/evenements/") {
    return "/evenements";
  }

  if (path === "/notifications" || path === "/notifications/") {
    return "/notifications";
  }

  if (path === "/cotisations" || path === "/cotisations/") {
    return "/cotisations";
  }

  // Fallback sûr : centre notifications
  return "/notifications";
}
