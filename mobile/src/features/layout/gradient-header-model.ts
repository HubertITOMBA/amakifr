/**
 * Tokens header dégradé AMAKI — partagés (accueil, login, écrans métier).
 * Testable hors React Native.
 */

/** Espace sous la status bar avant le contenu (12–16 px). */
export const HEADER_CONTENT_GAP = 16;

/**
 * Corps visuel standard (rangée titre + actions + padding bas),
 * hors inset status bar.
 */
export const HEADER_VISUAL_BODY = 56;

/**
 * Corps visuel accueil (hors inset) — marge sous les commandes
 * pour chevauchement WelcomeCard sans collision (voir home-header-layout).
 */
export const HEADER_VISUAL_BODY_HOME = 108;

/** Corps visuel login (titre + sous-titre centrés). */
export const HEADER_VISUAL_BODY_LOGIN = 96;

/**
 * Plancher inset status bar (dp) — edge-to-edge Android.
 */
export const HEADER_STATUS_INSET_FLOOR = 28;

/** Rayon coins bas uniquement. */
export const HEADER_BOTTOM_RADIUS = 28;

/** Zone tactile minimale (accessibilité). */
export const HEADER_ICON_HIT_SIZE = 44;

/**
 * Inset supérieur fiable : max(safe-area, StatusBar.currentHeight, plancher).
 */
export function resolveHeaderStatusInset(
  safeAreaTop: number,
  statusBarHeight: number | null | undefined
): number {
  const safe = Math.max(0, safeAreaTop);
  const bar =
    typeof statusBarHeight === "number" && Number.isFinite(statusBarHeight)
      ? Math.max(0, statusBarHeight)
      : 0;
  return Math.max(safe, bar, HEADER_STATUS_INSET_FLOOR);
}

/**
 * Padding supérieur interne du contenu (jamais sur le fond dégradé).
 */
export function headerContentPaddingTop(statusInset: number): number {
  return Math.max(0, statusInset) + HEADER_CONTENT_GAP;
}

/**
 * Hauteur mini du header = corps visuel + inset.
 */
export function headerMinHeight(
  statusInset: number,
  visualBody: number = HEADER_VISUAL_BODY
): number {
  return visualBody + Math.max(0, statusInset);
}

/**
 * Tabs qui affichent AmakiStackHeader sans être un stack enfant.
 * Pas de retour sur ces onglets (même si l’historique global peutGoBack).
 * Note : les stacks enfants ont souvent `route.name === "index"` — ne pas
 * les traiter comme tabs racines (sinon Messages/Événements sans retour).
 */
export const HEADER_TAB_ROOT_ROUTES = [
  "cotisations",
  "notifications",
] as const;

/**
 * Affiche le retour :
 * - si React Navigation fournit `back` (stack enfant) ;
 * - ou si canGoBack et la route n’est pas un tab racine listé.
 */
export function shouldShowHeaderBack(
  routeName: string,
  canGoBack: boolean,
  hasStackBack: boolean = false,
  tabRoots: readonly string[] = HEADER_TAB_ROOT_ROUTES
): boolean {
  if (hasStackBack) return true;
  if (!canGoBack) return false;
  return !tabRoots.includes(routeName);
}
