/**
 * Modèle UI connexion — sans secrets, testable hors RN.
 * Insets header : tokens mutualisés (`gradient-header-model`).
 */

import {
  HEADER_CONTENT_GAP,
  HEADER_STATUS_INSET_FLOOR,
  HEADER_VISUAL_BODY_LOGIN,
  headerContentPaddingTop,
  headerMinHeight,
  resolveHeaderStatusInset,
} from "@/features/layout/gradient-header-model";

/** Taille visuelle unique logo marque (login + WelcomeCard). */
export const AMAKI_BRAND_LOGO_SIZE = 168;

/** Cadre blanc login — padding autour du glyph 168 (ne réduit pas la taille). */
export const LOGIN_LOGO_FRAME_PADDING = 10;

/** Rayon du cadre logo login. */
export const LOGIN_LOGO_FRAME_RADIUS = 16;

/**
 * Chevauchement header → logo (négatif).
 * −48 : un peu plus bas que −64, vide bas réduit.
 */
export const LOGIN_LOGO_WRAP_MARGIN_TOP = -48;

/** Ombre cadre logo — iOS. */
export const LOGIN_LOGO_SHADOW = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.16,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

/** Ombre cadre logo — Android. */
export const LOGIN_LOGO_ELEVATION = 8;

/** @see HEADER_CONTENT_GAP */
export const LOGIN_HEADER_CONTENT_GAP = HEADER_CONTENT_GAP;

/** @see HEADER_VISUAL_BODY_LOGIN */
export const LOGIN_HEADER_VISUAL_BODY = HEADER_VISUAL_BODY_LOGIN;

/** @see HEADER_STATUS_INSET_FLOOR */
export const LOGIN_HEADER_STATUS_INSET_FLOOR = HEADER_STATUS_INSET_FLOOR;

/**
 * @see resolveHeaderStatusInset
 */
export function resolveLoginStatusInset(
  safeAreaTop: number,
  statusBarHeight: number | null | undefined
): number {
  return resolveHeaderStatusInset(safeAreaTop, statusBarHeight);
}

/**
 * @see headerContentPaddingTop
 */
export function loginHeaderContentPaddingTop(statusInset: number): number {
  return headerContentPaddingTop(statusInset);
}

/**
 * @see headerMinHeight
 */
export function loginHeaderMinHeight(statusInset: number): number {
  return headerMinHeight(statusInset, LOGIN_HEADER_VISUAL_BODY);
}

/** Mot de passe masqué au démarrage. */
export const INITIAL_PASSWORD_VISIBLE = false;

/**
 * Bascule affichage du mot de passe (ne touche pas à la valeur).
 */
export function nextPasswordVisible(currentlyVisible: boolean): boolean {
  return !currentlyVisible;
}

/**
 * Label accessibilité du bouton œil.
 */
export function passwordVisibilityToggleLabel(visible: boolean): string {
  return visible ? "Masquer le mot de passe" : "Afficher le mot de passe";
}

/**
 * Route mobile « mot de passe oublié ».
 * Audit 2026-10-07 : aucune route Expo (`forgot` / `reset-password` / etc.).
 * Ne pas inventer de lien tant qu’un écran + API mobile ne sont pas livrés.
 */
export const MOBILE_FORGOT_PASSWORD_ROUTE: string | null = null;

/**
 * Affiche le lien seulement si une route mobile réelle est déclarée.
 */
export function shouldShowForgotPasswordLink(
  route: string | null = MOBILE_FORGOT_PASSWORD_ROUTE
): boolean {
  return typeof route === "string" && route.trim().length > 0;
}
