/**
 * Géométrie Accueil — rangée de commandes vs WelcomeCard.
 * Testable hors RN ; pas de zIndex : séparation spatiale uniquement.
 */

import {
  HEADER_ICON_HIT_SIZE,
  HEADER_VISUAL_BODY_HOME,
  headerContentPaddingTop,
  headerMinHeight,
} from "@/features/layout/gradient-header-model";

/** Padding bas de la rangée hamburger / actions (dp). */
export const HOME_HEADER_ROW_PAD_BOTTOM = 8;

/** Espace minimal visible entre bas des cercles et haut de la carte (dp). */
export const HOME_WELCOME_CONTROLS_GAP_MIN = 12;

/**
 * Chevauchement souhaité carte / bas du dégradé (dp, positif).
 * Convertis en marginTop négatif, plafonné pour respecter le gap min.
 */
export const HOME_WELCOME_OVERLAP = 24;

/**
 * Bas de la rangée des commandes (depuis le haut du header) :
 * statusInset + gap contenu + hauteur cercles + padding bas rangée.
 */
export function homeHeaderControlsBottom(statusInset: number): number {
  return (
    headerContentPaddingTop(statusInset) +
    HEADER_ICON_HIT_SIZE +
    HOME_HEADER_ROW_PAD_BOTTOM
  );
}

/**
 * Hauteur totale mini du header accueil (corps + inset).
 */
export function homeHeaderTotalHeight(
  statusInset: number,
  visualBody: number = HEADER_VISUAL_BODY_HOME
): number {
  return headerMinHeight(statusInset, visualBody);
}

/**
 * marginTop de la WelcomeCard (négatif = chevauchement).
 * Garantit welcomeCardTop >= controlsBottom + gapMin.
 */
export function homeWelcomeMarginTop(
  statusInset: number,
  visualBody: number = HEADER_VISUAL_BODY_HOME,
  overlap: number = HOME_WELCOME_OVERLAP,
  gapMin: number = HOME_WELCOME_CONTROLS_GAP_MIN
): number {
  const controlsBottom = homeHeaderControlsBottom(statusInset);
  const headerH = homeHeaderTotalHeight(statusInset, visualBody);
  /** Plancher : carte ne peut pas remonter au-delà de ce marginTop. */
  const minAllowedMargin = controlsBottom + gapMin - headerH;
  const desired = -Math.abs(overlap);
  return Math.max(desired, minAllowedMargin);
}

/**
 * Position Y du bord supérieur de la WelcomeCard (depuis le haut du header).
 */
export function homeWelcomeCardTop(
  statusInset: number,
  visualBody: number = HEADER_VISUAL_BODY_HOME,
  welcomeMarginTop: number = homeWelcomeMarginTop(statusInset, visualBody)
): number {
  return homeHeaderTotalHeight(statusInset, visualBody) + welcomeMarginTop;
}

/**
 * Espace vertical entre bas des commandes et haut de la carte.
 */
export function homeWelcomeControlsGap(
  statusInset: number,
  visualBody: number = HEADER_VISUAL_BODY_HOME,
  welcomeMarginTop: number = homeWelcomeMarginTop(statusInset, visualBody)
): number {
  return (
    homeWelcomeCardTop(statusInset, visualBody, welcomeMarginTop) -
    homeHeaderControlsBottom(statusInset)
  );
}
