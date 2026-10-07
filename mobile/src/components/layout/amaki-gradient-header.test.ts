import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HEADER_BOTTOM_RADIUS,
  HEADER_ICON_HIT_SIZE,
  headerContentPaddingTop,
  headerMinHeight,
  resolveHeaderStatusInset,
} from "@/features/layout/gradient-header-model";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("AmakiGradientHeader — source", () => {
  const source = readFileSync(
    join(srcDir, "amaki-gradient-header.tsx"),
    "utf8"
  );
  const stackSource = readFileSync(
    join(srcDir, "amaki-stack-header.tsx"),
    "utf8"
  );

  it("utilise le PNG dégradé accueil et coins bas seulement", () => {
    expect(source).toMatch(/home-header-gradient\.png/);
    expect(source).toMatch(/HEADER_BOTTOM_RADIUS/);
    expect(HEADER_BOTTOM_RADIUS).toBe(28);
    expect(source).toMatch(/borderBottomLeftRadius/);
    expect(source).toMatch(/borderBottomRightRadius/);
    expect(source).not.toMatch(/borderTopLeftRadius/);
  });

  it("inset sur contenu interne, pas de marge négative status bar", () => {
    expect(source).toMatch(/headerContentPaddingTop/);
    expect(source).toMatch(/resolveHeaderStatusInset/);
    expect(source).toMatch(/paddingTop:\s*padTop/);
    expect(source).not.toMatch(/marginTop:\s*-/);
    expect(source).toMatch(/StatusBar style="light"/);
  });

  it("titre, retour, menu, action droite, hit 44", () => {
    expect(source).toMatch(/showBack/);
    expect(source).toMatch(/accessibilityLabel="Retour"/);
    expect(source).toMatch(/showMenu/);
    expect(source).toMatch(/accessibilityLabel="Ouvrir le menu"/);
    expect(source).toMatch(/rightSlot/);
    expect(source).toMatch(/AmakiHeaderIconButton/);
    expect(HEADER_ICON_HIT_SIZE).toBe(44);
    expect(source).toMatch(/HEADER_ICON_HIT_SIZE/);
  });

  it("hauteur mini via helpers", () => {
    const inset = resolveHeaderStatusInset(30, 24);
    expect(headerContentPaddingTop(inset)).toBe(inset + 16);
    expect(headerMinHeight(inset)).toBeGreaterThan(inset);
  });

  it("stack header résout titre et branche AmakiGradientHeader", () => {
    expect(stackSource).toMatch(/function resolveHeaderTitle/);
    expect(stackSource).toMatch(/AmakiGradientHeader/);
    expect(stackSource).toMatch(/shouldShowHeaderBack/);
    expect(stackSource).toMatch(/accessibilityLabel|showBack/);
  });
});

describe("layouts migrés — header partagé", () => {
  const appDir = join(srcDir, "../../app");

  it("tabs et stacks utilisent AmakiStackHeader", () => {
    const layouts = [
      "(app)/_layout.tsx",
      "(app)/messages/_layout.tsx",
      "(app)/elections/_layout.tsx",
      "(app)/evenements/_layout.tsx",
      "(app)/sondages/_layout.tsx",
      "(app)/profil/_layout.tsx",
    ];
    for (const rel of layouts) {
      const text = readFileSync(join(appDir, rel), "utf8");
      expect(text).toMatch(/AmakiStackHeader/);
      expect(text).not.toMatch(
        /headerStyle:\s*\{\s*backgroundColor:\s*AmakiColors\.primary/
      );
    }
  });

  it("accueil et login gardent headerShown false / coque partagée", () => {
    const tabs = readFileSync(join(appDir, "(app)/_layout.tsx"), "utf8");
    expect(tabs).toMatch(/name="index"[\s\S]*?headerShown:\s*false/);
    const signIn = readFileSync(join(appDir, "sign-in.tsx"), "utf8");
    expect(signIn).toMatch(/AmakiGradientShell/);
    const homeHeader = readFileSync(
      join(srcDir, "../home/mobile-home-header.tsx"),
      "utf8"
    );
    expect(homeHeader).toMatch(/AmakiGradientShell/);
  });
});
