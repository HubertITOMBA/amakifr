import { describe, expect, it } from "vitest";
import {
  HEADER_CONTENT_GAP,
  HEADER_ICON_HIT_SIZE,
  HEADER_STATUS_INSET_FLOOR,
  HEADER_TAB_ROOT_ROUTES,
  HEADER_VISUAL_BODY,
  HEADER_VISUAL_BODY_HOME,
  HEADER_VISUAL_BODY_LOGIN,
  headerContentPaddingTop,
  headerMinHeight,
  resolveHeaderStatusInset,
  shouldShowHeaderBack,
} from "@/features/layout/gradient-header-model";

describe("gradient-header-model", () => {
  it("tokens inset / corps / hit", () => {
    expect(HEADER_CONTENT_GAP).toBe(16);
    expect(HEADER_STATUS_INSET_FLOOR).toBe(28);
    expect(HEADER_VISUAL_BODY).toBe(56);
    expect(HEADER_VISUAL_BODY_HOME).toBe(108);
    expect(HEADER_VISUAL_BODY_LOGIN).toBe(96);
    expect(HEADER_ICON_HIT_SIZE).toBe(44);
  });

  it("resolveHeaderStatusInset = max(safe, bar, floor)", () => {
    expect(resolveHeaderStatusInset(0, 36)).toBe(36);
    expect(resolveHeaderStatusInset(48, 24)).toBe(48);
    expect(resolveHeaderStatusInset(0, null)).toBe(28);
    expect(resolveHeaderStatusInset(-2, undefined)).toBe(28);
  });

  it("paddingTop = inset + gap ; minHeight = corps + inset", () => {
    expect(headerContentPaddingTop(28)).toBe(44);
    expect(headerContentPaddingTop(36)).toBe(52);
    expect(headerMinHeight(28)).toBe(84);
    expect(headerMinHeight(28, HEADER_VISUAL_BODY_LOGIN)).toBe(124);
  });

  it("retour masqué sur tabs racines ; stacks index gardent le retour", () => {
    expect(HEADER_TAB_ROOT_ROUTES).toContain("cotisations");
    expect(HEADER_TAB_ROOT_ROUTES).not.toContain("index");
    expect(shouldShowHeaderBack("cotisations", true)).toBe(false);
    expect(shouldShowHeaderBack("notifications", true)).toBe(false);
    /** Stack Messages/Événements : route.name=index mais pas un tab racine. */
    expect(shouldShowHeaderBack("index", true)).toBe(true);
    expect(shouldShowHeaderBack("index", false, true)).toBe(true);
    expect(shouldShowHeaderBack("documents", true)).toBe(true);
    expect(shouldShowHeaderBack("documents", false)).toBe(false);
  });
});
