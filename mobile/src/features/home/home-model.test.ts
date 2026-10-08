import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HOME_QUICK_ACTIONS,
  HOME_HIGHLIGHT_TAB_GAP,
  HOME_SCROLL_SECTION_ORDER,
  HOME_TAB_BAR_IS_ABSOLUTE,
  buildHomeHighlightSlides,
  buildHomeMenuItems,
  buildHomeQuickActions,
  formatHomeGreeting,
  homeActionsContainFraisAvances,
  homeHighlightDotCount,
  homeScrollBottomPadding,
  isHighlightAbsoluteOverlay,
  resolveHomeActionBadge,
  resolveHomeMenuBadge,
} from "@/features/home/home-model";
import { shouldRenderHomeHighlightBanner } from "@/features/home/home-highlight-sources";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("formatHomeGreeting", () => {
  it("avec nom → Bonjour, Nom", () => {
    expect(formatHomeGreeting("Marie Dupont")).toBe("Bonjour, Marie Dupont");
  });

  it("sans nom → Bonjour", () => {
    expect(formatHomeGreeting(undefined)).toBe("Bonjour");
    expect(formatHomeGreeting(null)).toBe("Bonjour");
    expect(formatHomeGreeting("")).toBe("Bonjour");
    expect(formatHomeGreeting("   ")).toBe("Bonjour");
  });
});

describe("HOME_QUICK_ACTIONS visibles", () => {
  it("expose uniquement Documents et Réunions", () => {
    expect(HOME_QUICK_ACTIONS.map((a) => a.id)).toEqual([
      "documents",
      "reunions",
    ]);
    expect(
      Object.fromEntries(HOME_QUICK_ACTIONS.map((a) => [a.id, a.href]))
    ).toEqual({
      documents: "/documents",
      reunions: "/reunions",
    });
  });

  it("n’expose ni Cotisations ni Notifications dans le contenu", () => {
    const ids = HOME_QUICK_ACTIONS.map((a) => a.id);
    const labels = HOME_QUICK_ACTIONS.map((a) => a.label);
    expect(ids).not.toContain("cotisations");
    expect(ids).not.toContain("notifications");
    expect(labels).not.toContain("Cotisations");
    expect(labels).not.toContain("Notifications");
  });

  it("libellés complets Documents et Réunions", () => {
    expect(HOME_QUICK_ACTIONS.map((a) => a.label)).toEqual([
      "Documents",
      "Réunions",
    ]);
  });

  it("aucune route frais-avances", () => {
    expect(homeActionsContainFraisAvances(HOME_QUICK_ACTIONS)).toBe(false);
  });
});

describe("QuickActionCard — pas de troncature libellé", () => {
  it("affiche {label} sans numberOfLines ni ellipsizeMode (colonne)", () => {
    const source = readFileSync(
      join(srcDir, "../../components/home/quick-action-card.tsx"),
      "utf8"
    );
    expect(source).toMatch(/\{label\}/);
    expect(source).not.toMatch(/numberOfLines\s*=\s*\{\s*1\s*\}/);
    expect(source).not.toMatch(/ellipsizeMode/);
    expect(source).toMatch(/flexDirection:\s*"column"/);
  });
});

describe("badges cartes contenu", () => {
  it("aucun badge sur Documents / Réunions (Notifications = header + tab)", () => {
    expect(resolveHomeActionBadge("documents", 11)).toBeUndefined();
    expect(resolveHomeActionBadge("reunions", 11)).toBeUndefined();
    expect(buildHomeQuickActions(11, 3).every((a) => a.badge === undefined)).toBe(
      true
    );
  });
});

describe("menu hamburger", () => {
  it("ordre complet avec Cotisations et Notifications", () => {
    const items = buildHomeMenuItems(0);
    expect(items.map((s) => s.id)).toEqual([
      "documents",
      "reunions",
      "evenements",
      "cotisations",
      "notifications",
      "messages",
      "passeport",
      "taches",
      "elections",
      "profil",
    ]);
    expect(
      Object.fromEntries(items.map((i) => [i.id, i.href]))
    ).toMatchObject({
      cotisations: "/cotisations",
      notifications: "/notifications",
      documents: "/documents",
      reunions: "/reunions",
    });
  });

  it("badges réels Notifications / Messages uniquement", () => {
    expect(resolveHomeMenuBadge("notifications", 0, 5)).toBeUndefined();
    expect(resolveHomeMenuBadge("notifications", 7, 5)).toBe(7);
    expect(resolveHomeMenuBadge("messages", 7, 0)).toBeUndefined();
    expect(resolveHomeMenuBadge("messages", 7, 3)).toBe(3);
    expect(resolveHomeMenuBadge("cotisations", 9, 9)).toBeUndefined();
    expect(resolveHomeMenuBadge("documents", 9, 9)).toBeUndefined();
  });

  it("ajoute sondages si summary > 0 (avant Profil)", () => {
    const ids = buildHomeMenuItems(2).map((s) => s.id);
    expect(ids).toContain("sondages");
    expect(ids.indexOf("sondages")).toBeLessThan(ids.indexOf("profil"));
    expect(buildHomeMenuItems(0).map((s) => s.id)).not.toContain("sondages");
  });

  it("aucune route frais-avances", () => {
    expect(homeActionsContainFraisAvances(buildHomeMenuItems(4))).toBe(false);
  });
});

describe("layout accueil", () => {
  it("ordre logique welcome → actions → highlight", () => {
    expect([...HOME_SCROLL_SECTION_ORDER]).toEqual([
      "welcome",
      "actions",
      "highlight",
    ]);
  });

  it("exactement deux actions visibles", () => {
    expect(HOME_QUICK_ACTIONS).toHaveLength(2);
  });

  it("détecte un overlay absolu interdit pour À la une", () => {
    expect(
      isHighlightAbsoluteOverlay({
        position: "absolute",
        bottom: 16,
        left: 16,
        right: 16,
      })
    ).toBe(true);
    expect(isHighlightAbsoluteOverlay({})).toBe(false);
  });

  it("tab bar non absolute → padding bas = gap carte→tab seul (16 px)", () => {
    expect(HOME_TAB_BAR_IS_ABSOLUTE).toBe(false);
    expect(HOME_HIGHLIGHT_TAB_GAP).toBe(16);
    expect(homeScrollBottomPadding(0)).toBe(16);
    expect(homeScrollBottomPadding(34)).toBe(16);
    expect(homeScrollBottomPadding(34)).toBeLessThan(64);
  });

  it("si tab bar absolute → réserve tab + inset + gap", () => {
    expect(homeScrollBottomPadding(0, true, 64)).toBe(64 + 8 + 16);
    expect(homeScrollBottomPadding(34, true, 64)).toBe(64 + 34 + 16);
  });

  it("écran accueil : gap bas via paddingBottom uniquement (pas de marginBottom highlight)", () => {
    const indexSrc = readFileSync(
      join(srcDir, "../../app/(app)/index.tsx"),
      "utf8"
    );
    expect(indexSrc).toMatch(/homeScrollBottomPadding/);
    expect(indexSrc).toMatch(/highlightInFlow:[\s\S]*marginBottom:\s*0/);
    expect(indexSrc).not.toMatch(/position:\s*["']absolute["']/);
  });

  it("tab bar layout (_layout) sans position absolute", () => {
    const layout = readFileSync(
      join(srcDir, "../../app/(app)/_layout.tsx"),
      "utf8"
    );
    expect(layout).toMatch(/tabBarStyle:\s*\{/);
    expect(layout).not.toMatch(/tabBarStyle:\s*\{[^}]*position:\s*["']absolute["']/);
    expect(layout).toMatch(/title:\s*"Mes cotisations"/);
    expect(layout).toMatch(/tabBarLabel:\s*"Cotisations"/);
    expect(layout).toMatch(/title:\s*"Notifications"/);
  });
});

describe("À la une — slides conditionnelles sans fallback", () => {
  const empty = {
    electionsCount: 0,
    surveyCount: 0,
    eventsCount: 0,
    nextEventTitle: null as string | null,
    nextEventWhen: null as string | null,
  };

  it("0 actualité → slides vides → bannière non rendue", () => {
    const slides = buildHomeHighlightSlides(empty);
    expect(slides).toEqual([]);
    expect(homeHighlightDotCount(slides)).toBe(0);
    expect(shouldRenderHomeHighlightBanner(slides.length)).toBe(false);
  });

  it("eventsCount = 0 → aucune actualité Événement", () => {
    const slides = buildHomeHighlightSlides({
      ...empty,
      eventsCount: 0,
      nextEventTitle: "Ancien titre résiduel",
      nextEventWhen: "hier",
    });
    expect(slides.find((s) => s.id === "evenements")).toBeUndefined();
  });

  it("1 actualité → 0 point de pagination", () => {
    const slides = buildHomeHighlightSlides({
      ...empty,
      eventsCount: 1,
      nextEventTitle: "AG annuelle",
      nextEventWhen: "12/10/2026",
    });
    expect(slides).toHaveLength(1);
    expect(homeHighlightDotCount(slides)).toBe(0);
  });

  it("2+ actualités → points = éléments réellement visibles", () => {
    const slides = buildHomeHighlightSlides({
      electionsCount: 1,
      surveyCount: 2,
      eventsCount: 3,
      nextEventTitle: "Forum",
      nextEventWhen: null,
    });
    expect(slides.map((s) => s.id)).toEqual([
      "elections",
      "sondages",
      "evenements",
    ]);
    expect(homeHighlightDotCount(slides)).toBe(3);
  });

  it("retour à 0 après rafraîchissement → Événement retiré", () => {
    const after = buildHomeHighlightSlides({
      ...empty,
      eventsCount: 0,
      nextEventTitle: null,
      nextEventWhen: null,
    });
    expect(after.find((s) => s.id === "evenements")).toBeUndefined();
  });
});
