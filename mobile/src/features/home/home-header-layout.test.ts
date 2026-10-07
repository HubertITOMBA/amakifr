import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HEADER_VISUAL_BODY_HOME } from "@/features/layout/gradient-header-model";
import {
  HOME_HEADER_ROW_PAD_BOTTOM,
  HOME_WELCOME_CONTROLS_GAP_MIN,
  HOME_WELCOME_OVERLAP,
  homeHeaderControlsBottom,
  homeHeaderTotalHeight,
  homeWelcomeCardTop,
  homeWelcomeControlsGap,
  homeWelcomeMarginTop,
} from "@/features/home/home-header-layout";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("home-header-layout — WelcomeCard vs commandes", () => {
  it("tokens gap / overlap / pad rangée", () => {
    expect(HOME_WELCOME_CONTROLS_GAP_MIN).toBe(12);
    expect(HOME_WELCOME_OVERLAP).toBe(24);
    expect(HOME_HEADER_ROW_PAD_BOTTOM).toBe(8);
    expect(HEADER_VISUAL_BODY_HOME).toBe(108);
  });

  it("inset ~30 dp : welcomeCardTop >= controlsBottom + 12", () => {
    const inset = 30;
    const margin = homeWelcomeMarginTop(inset);
    const controlsBottom = homeHeaderControlsBottom(inset);
    const cardTop = homeWelcomeCardTop(inset, HEADER_VISUAL_BODY_HOME, margin);
    const gap = homeWelcomeControlsGap(inset, HEADER_VISUAL_BODY_HOME, margin);

    expect(cardTop).toBeGreaterThanOrEqual(
      controlsBottom + HOME_WELCOME_CONTROLS_GAP_MIN
    );
    expect(gap).toBeGreaterThanOrEqual(HOME_WELCOME_CONTROLS_GAP_MIN);
    /** Chevauchement conservé (margin négatif). */
    expect(margin).toBeLessThan(0);
    expect(homeHeaderTotalHeight(inset)).toBe(HEADER_VISUAL_BODY_HOME + inset);
  });

  it("petit écran (inset plancher 28) et grand inset (48)", () => {
    for (const inset of [0, 28, 30, 48]) {
      const margin = homeWelcomeMarginTop(inset);
      const gap = homeWelcomeControlsGap(inset);
      expect(gap).toBeGreaterThanOrEqual(HOME_WELCOME_CONTROLS_GAP_MIN);
      expect(
        homeWelcomeCardTop(inset, HEADER_VISUAL_BODY_HOME, margin)
      ).toBeGreaterThanOrEqual(
        homeHeaderControlsBottom(inset) + HOME_WELCOME_CONTROLS_GAP_MIN
      );
    }
  });

  it("plafond : overlap trop fort est réduit pour respecter le gap", () => {
    const inset = 30;
    const aggressive = homeWelcomeMarginTop(inset, HEADER_VISUAL_BODY_HOME, 80);
    expect(homeWelcomeControlsGap(inset, HEADER_VISUAL_BODY_HOME, aggressive)).toBe(
      HOME_WELCOME_CONTROLS_GAP_MIN
    );
  });

  it("Accueil branche marginTop dynamique ; header utilise pad rangée", () => {
    const indexSrc = readFileSync(
      join(srcDir, "../../app/(app)/index.tsx"),
      "utf8"
    );
    expect(indexSrc).toMatch(/homeWelcomeMarginTop/);
    expect(indexSrc).toMatch(/marginTop:\s*welcomeMarginTop/);
    expect(indexSrc).not.toMatch(/marginTop:\s*-\(AmakiSpacing\.xl/);

    const headerSrc = readFileSync(
      join(srcDir, "../../components/home/mobile-home-header.tsx"),
      "utf8"
    );
    expect(headerSrc).toMatch(/HOME_HEADER_ROW_PAD_BOTTOM/);
    expect(headerSrc).toMatch(/HEADER_VISUAL_BODY_HOME/);
  });
});
