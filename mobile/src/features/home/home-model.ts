import type { Href } from "expo-router";
import { formatTabUnreadBadge } from "@/api/notifications-state";
import { shouldShowHomeSurveyCta } from "@/api/sondages-state";
import { shouldShowHomeEventsBanner } from "@/api/evenements-state";
import { shouldShowHomeElectionsBanner } from "@/api/elections-state";

/** Icônes SymbolView pour l’accueil. */
export type HomeIconName =
  | "documents"
  | "cotisations"
  | "reunions"
  | "evenements"
  | "notifications"
  | "messages"
  | "passeport"
  | "taches"
  | "elections"
  | "sondages"
  | "profil"
  | "menu";

export type HomeQuickActionId = "documents" | "reunions";

/** Tab bar React Navigation : position normale (pas absolute). */
export const HOME_TAB_BAR_IS_ABSOLUTE = false;

export type HomeMenuItemId =
  | "documents"
  | "reunions"
  | "evenements"
  | "cotisations"
  | "notifications"
  | "messages"
  | "passeport"
  | "taches"
  | "elections"
  | "sondages"
  | "profil";

export type HomeQuickActionDef = {
  id: HomeQuickActionId;
  label: string;
  href: Href;
  icon: HomeIconName;
  iconColor: string;
  iconBg: string;
};

export type HomeMenuItemDef = {
  id: HomeMenuItemId;
  label: string;
  href: Href;
  icon: HomeIconName;
};

export type HomeQuickActionView = HomeQuickActionDef & {
  badge?: number | string;
};

/** Actions visibles sur l’accueil : Documents + Réunions (pas tab bar). */
export const HOME_QUICK_ACTIONS: readonly HomeQuickActionDef[] = [
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: "documents",
    iconColor: "#0369a1",
    iconBg: "#e0f2fe",
  },
  {
    id: "reunions",
    label: "Réunions",
    href: "/reunions",
    icon: "reunions",
    iconColor: "#0f766e",
    iconBg: "#ccfbf1",
  },
];

/** Menu complet — tab bar reste l’accès rapide Cotisations/Notifications. */
const MENU_ALWAYS: readonly HomeMenuItemDef[] = [
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: "documents",
  },
  { id: "reunions", label: "Réunions", href: "/reunions", icon: "reunions" },
  {
    id: "evenements",
    label: "Événements",
    href: "/evenements",
    icon: "evenements",
  },
  {
    id: "cotisations",
    label: "Cotisations",
    href: "/cotisations",
    icon: "cotisations",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "notifications",
  },
  {
    id: "messages",
    label: "Messages",
    href: "/messages" as Href,
    icon: "messages",
  },
  {
    id: "passeport",
    label: "Passeport",
    href: "/passeport",
    icon: "passeport",
  },
  { id: "taches", label: "Tâches", href: "/taches", icon: "taches" },
  {
    id: "elections",
    label: "Élections",
    href: "/elections" as Href,
    icon: "elections",
  },
  { id: "profil", label: "Profil", href: "/profil", icon: "profil" },
];

const MENU_SONDAGES: HomeMenuItemDef = {
  id: "sondages",
  label: "Sondages",
  href: "/sondages" as Href,
  icon: "sondages",
};

/**
 * Salutation : « Bonjour, Nom » ou fallback neutre.
 */
export function formatHomeGreeting(name: string | null | undefined): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return "Bonjour";
  return `Bonjour, ${trimmed}`;
}

/**
 * Badge action rapide — aucun badge sur Documents/Réunions
 * (Notifications = header + tab bar uniquement).
 */
export function resolveHomeActionBadge(
  id: HomeQuickActionId,
  unreadCount: number
): number | string | undefined {
  void id;
  void unreadCount;
  return undefined;
}

/**
 * Construit les 2 actions du contenu (Documents + Réunions).
 * `unreadCount` / `chatUnread` : badges hors cartes (header/tab/menu).
 */
export function buildHomeQuickActions(
  unreadCount: number,
  chatUnread = 0
): HomeQuickActionView[] {
  void unreadCount;
  void chatUnread;
  return HOME_QUICK_ACTIONS.map((action) => ({ ...action }));
}

/**
 * Entrées du menu hamburger ; sondages si summary > 0.
 * Badges Notifications / Messages exposés côté UI (compteurs réels).
 */
export function buildHomeMenuItems(surveyCount: number): HomeMenuItemDef[] {
  const list: HomeMenuItemDef[] = [...MENU_ALWAYS];
  if (shouldShowHomeSurveyCta(surveyCount)) {
    const profilIdx = list.findIndex((i) => i.id === "profil");
    list.splice(profilIdx >= 0 ? profilIdx : list.length, 0, MENU_SONDAGES);
  }
  return list;
}

/**
 * Badge menu — Notifications ou Messages uniquement, compteurs réels.
 */
export function resolveHomeMenuBadge(
  id: HomeMenuItemId,
  unreadCount: number,
  chatUnread: number
): number | string | undefined {
  if (id === "notifications") {
    return formatTabUnreadBadge(unreadCount);
  }
  if (id === "messages") {
    return formatTabUnreadBadge(chatUnread);
  }
  return undefined;
}

/**
 * Détecte une fuite de route frais-avances.
 */
export function homeActionsContainFraisAvances(
  actions: readonly { href: Href | string }[]
): boolean {
  return actions.some((a) => String(a.href).includes("frais-avances"));
}

/** Ordre logique du ScrollView accueil (hors header sibling interne au hero). */
export const HOME_SCROLL_SECTION_ORDER = [
  "welcome",
  "actions",
  "highlight",
] as const;

export type HomeScrollSection = (typeof HOME_SCROLL_SECTION_ORDER)[number];

/**
 * Style interdit pour la carte « À la une » (ne doit plus être un overlay).
 */
export function isHighlightAbsoluteOverlay(style: {
  position?: string;
  bottom?: number | string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
}): boolean {
  if (style.position === "absolute") return true;
  if (style.bottom !== undefined || style.top !== undefined) return true;
  if (style.left !== undefined && style.right !== undefined) return true;
  return false;
}

/**
 * Espace sous « À la une » jusqu’à la tab bar (coins + ombre visibles).
 * Tab bar non absolute : ce gap seul — pas de double réservation hauteur tab.
 */
export const HOME_HIGHLIGHT_TAB_GAP = 16;

/**
 * Padding bas du ScrollView.
 * Tab bar non absolute → hauteur déjà réservée par le layout Tabs ;
 * ne pas re-soustraire tabBar + safe-area (cause du grand vide).
 * Tab bar absolute → réserver tabBar + inset + petite marge.
 */
export function homeScrollBottomPadding(
  safeAreaBottom: number,
  tabBarIsAbsolute: boolean = HOME_TAB_BAR_IS_ABSOLUTE,
  tabBarBaseHeight = 64
): number {
  const contentGap = HOME_HIGHLIGHT_TAB_GAP;
  if (!tabBarIsAbsolute) {
    return contentGap;
  }
  const inset = Math.max(0, safeAreaBottom);
  return tabBarBaseHeight + Math.max(inset, 8) + contentGap;
}

export type HomeHighlightKind = "elections" | "sondages" | "evenements";

export type HomeHighlightSlide = {
  id: HomeHighlightKind;
  title: string;
  subtitle: string;
  href: Href;
  a11y: string;
};

/** Carte neutre « À la une » — pas de route, pas de compteur inventé. */
export const HOME_HIGHLIGHT_NEUTRAL = {
  title: "Bienvenue dans votre espace AMAKI",
  subtitle: "Retrouvez ici les actualités de votre association.",
} as const;

export type HomeHighlightInput = {
  electionsCount: number;
  surveyCount: number;
  eventsCount: number;
  nextEventTitle: string | null;
  nextEventWhen: string | null;
};

/**
 * Slides « À la une » — uniquement des éléments réellement présents.
 * Événement : uniquement si eventsCount > 0 (+ helper métier).
 */
export function buildHomeHighlightSlides(
  input: HomeHighlightInput
): HomeHighlightSlide[] {
  const slides: HomeHighlightSlide[] = [];

  if (shouldShowHomeElectionsBanner(input.electionsCount)) {
    slides.push({
      id: "elections",
      title: "À la une — Élections",
      subtitle:
        input.electionsCount > 1
          ? `Vous avez un vote à effectuer (${input.electionsCount} scrutins)`
          : "Vous avez un vote à effectuer",
      href: "/elections" as Href,
      a11y: "À la une : vote à effectuer",
    });
  }

  if (shouldShowHomeSurveyCta(input.surveyCount)) {
    slides.push({
      id: "sondages",
      title: "À la une — Sondages",
      subtitle: `Vous avez ${input.surveyCount} sondage${input.surveyCount !== 1 ? "s" : ""} à compléter`,
      href: "/sondages" as Href,
      a11y: `À la une : ${input.surveyCount} sondages à compléter`,
    });
  }

  if (
    input.eventsCount > 0 &&
    shouldShowHomeEventsBanner(input.eventsCount)
  ) {
    slides.push({
      id: "evenements",
      title: "À la une — Événements",
      subtitle: input.nextEventTitle
        ? `Prochain : ${input.nextEventTitle}${input.nextEventWhen ? ` (${input.nextEventWhen})` : ""}`
        : `${input.eventsCount} événement${input.eventsCount !== 1 ? "s" : ""} à venir`,
      href: "/evenements" as Href,
      a11y: `À la une : ${input.eventsCount} événements`,
    });
  }

  return slides;
}

/**
 * Points de pagination : 0 si zéro ou une actualité ; sinon = nombre de slides.
 */
export function homeHighlightDotCount(slides: HomeHighlightSlide[]): number {
  return slides.length > 1 ? slides.length : 0;
}
