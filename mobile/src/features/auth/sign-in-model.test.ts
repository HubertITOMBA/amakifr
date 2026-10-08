import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AMAKI_BRAND_LOGO_SIZE,
  INITIAL_PASSWORD_VISIBLE,
  LOGIN_HEADER_CONTENT_GAP,
  LOGIN_HEADER_STATUS_INSET_FLOOR,
  LOGIN_HEADER_VISUAL_BODY,
  LOGIN_LOGO_ELEVATION,
  LOGIN_LOGO_FRAME_PADDING,
  LOGIN_LOGO_FRAME_RADIUS,
  LOGIN_LOGO_SHADOW,
  LOGIN_LOGO_WRAP_MARGIN_TOP,
  MOBILE_FORGOT_PASSWORD_ROUTE,
  loginHeaderContentPaddingTop,
  loginHeaderMinHeight,
  nextPasswordVisible,
  passwordVisibilityToggleLabel,
  resolveLoginStatusInset,
  shouldShowForgotPasswordLink,
} from "@/features/auth/sign-in-model";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("visibilité mot de passe", () => {
  it("masqué par défaut", () => {
    expect(INITIAL_PASSWORD_VISIBLE).toBe(false);
  });

  it("œil affiche puis remasque", () => {
    expect(nextPasswordVisible(false)).toBe(true);
    expect(nextPasswordVisible(true)).toBe(false);
  });

  it("ne modifie pas une valeur de mot de passe (bascule indépendante)", () => {
    const password = "secret-test-value";
    let visible = INITIAL_PASSWORD_VISIBLE;
    visible = nextPasswordVisible(visible);
    expect(password).toBe("secret-test-value");
    visible = nextPasswordVisible(visible);
    expect(password).toBe("secret-test-value");
    expect(visible).toBe(false);
  });

  it("labels accessibles", () => {
    expect(passwordVisibilityToggleLabel(false)).toBe(
      "Afficher le mot de passe"
    );
    expect(passwordVisibilityToggleLabel(true)).toBe(
      "Masquer le mot de passe"
    );
  });
});

describe("mot de passe oublié — audit mobile", () => {
  it("route mobile déclarée → lien affiché", () => {
    expect(MOBILE_FORGOT_PASSWORD_ROUTE).toBe("/forgot-password");
    expect(shouldShowForgotPasswordLink()).toBe(true);
    expect(shouldShowForgotPasswordLink(null)).toBe(false);
  });

  it("écran Expo forgot-password présent", () => {
    const appDir = join(srcDir, "../../app");
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else out.push(p);
      }
      return out;
    };
    const files = walk(appDir).map((f) => f.toLowerCase());
    expect(files.some((f) => f.endsWith("forgot-password.tsx"))).toBe(true);
  });
});

describe("logo marque 168×168 partagé", () => {
  it("constante commune = 168", () => {
    expect(AMAKI_BRAND_LOGO_SIZE).toBe(168);
  });

  it("cadre login : padding / rayon / ombre / marge", () => {
    expect(LOGIN_LOGO_FRAME_PADDING).toBe(10);
    expect(LOGIN_LOGO_FRAME_RADIUS).toBe(16);
    expect(LOGIN_LOGO_WRAP_MARGIN_TOP).toBe(-48);
    expect(LOGIN_LOGO_ELEVATION).toBe(8);
    expect(LOGIN_LOGO_SHADOW).toEqual({
      shadowColor: "#0f172a",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    });
  });

  it("sign-in : cadre + glyph 168 contain ; WelcomeCard partage la taille", () => {
    const signIn = readFileSync(join(srcDir, "../../app/sign-in.tsx"), "utf8");
    const welcome = readFileSync(
      join(srcDir, "../../components/home/welcome-card.tsx"),
      "utf8"
    );
    expect(signIn).toMatch(/amaki-logo-full\.png/);
    expect(welcome).toMatch(/amaki-logo-full\.png/);
    expect(signIn).toMatch(/AMAKI_BRAND_LOGO_SIZE/);
    expect(welcome).toMatch(/AMAKI_BRAND_LOGO_SIZE/);
    expect(signIn).toMatch(/contentFit="contain"/);
    expect(signIn).toMatch(/logoFrame/);
    expect(signIn).toMatch(/LOGIN_LOGO_FRAME_PADDING/);
    expect(signIn).toMatch(/LOGIN_LOGO_ELEVATION/);
    expect(signIn).toMatch(
      /logo:\s*\{[^}]*width:\s*AMAKI_BRAND_LOGO_SIZE,\s*height:\s*AMAKI_BRAND_LOGO_SIZE/
    );
  });
});

describe("LoginPage — header edge-to-edge + texte sous safe area", () => {
  const source = readFileSync(join(srcDir, "../../app/sign-in.tsx"), "utf8");

  it("padding texte = statusInset + gap ; hauteur = corps + inset", () => {
    expect(LOGIN_HEADER_CONTENT_GAP).toBe(16);
    expect(LOGIN_HEADER_VISUAL_BODY).toBe(96);
    expect(LOGIN_HEADER_STATUS_INSET_FLOOR).toBe(28);
    expect(resolveLoginStatusInset(0, 36)).toBe(36);
    expect(resolveLoginStatusInset(48, 24)).toBe(48);
    expect(resolveLoginStatusInset(0, null)).toBe(28);
    expect(loginHeaderContentPaddingTop(28)).toBe(44);
    expect(loginHeaderContentPaddingTop(36)).toBe(52);
    expect(loginHeaderMinHeight(28)).toBe(124);
    expect(loginHeaderMinHeight(36)).toBe(132);
  });

  it("pas de SafeAreaView ; inset uniquement sur brandBlock ; dégradé à y=0", () => {
    expect(source).not.toMatch(/import\s*\{[^}]*SafeAreaView/);
    expect(source).not.toMatch(/<SafeAreaView\b/);
    /** Jamais de marge globale négative : le contenu part déjà de y=0. */
    expect(source).not.toMatch(/marginTop:\s*-statusInset/);
    expect(source).not.toMatch(/marginTop:\s*-\s*insets\.top/);
    expect(source).toMatch(/resolveLoginStatusInset/);
    expect(source).toMatch(/loginHeaderContentPaddingTop/);
    expect(source).toMatch(/AmakiGradientShell/);
    expect(source).toMatch(/LOGIN_HEADER_VISUAL_BODY/);
    expect(source).toMatch(/paddingTop:\s*headerPadTop/);
    const scrollBlock = source.match(/scroll:\s*\{[^}]+\}/)?.[0] ?? "";
    expect(scrollBlock).toMatch(/paddingTop:\s*0/);
  });

  it("StatusBar light + translucide Android (écran + Stack)", () => {
    expect(source).toMatch(/StatusBar style="light"/);
    expect(source).toMatch(/setTranslucent\(true\)/);
    expect(source).toMatch(/setBackgroundColor\("transparent"\)/);
    const rootLayout = readFileSync(
      join(srcDir, "../../app/_layout.tsx"),
      "utf8"
    );
    expect(rootLayout).toMatch(/name="sign-in"/);
    expect(rootLayout).toMatch(/statusBarTranslucent:\s*true/);
    expect(rootLayout).toMatch(/statusBarBackgroundColor:\s*"transparent"/);
    expect(rootLayout).toMatch(/statusBarStyle:\s*"light"/);
  });
});

describe("écran sign-in — garde-fous", () => {
  const source = readFileSync(join(srcDir, "../../app/sign-in.tsx"), "utf8");

  it("utilise secureTextEntry dynamiquement (masqué par défaut)", () => {
    expect(source).toMatch(/secureTextEntry=\{!passwordVisible\}/);
    expect(source).toMatch(/INITIAL_PASSWORD_VISIBLE/);
    expect(source).toMatch(/nextPasswordVisible/);
  });

  it("conserve signIn(email, password) — action inchangée", () => {
    expect(source).toMatch(/await signIn\(trimmed,\s*password\)/);
  });

  it("ne journalise pas le mot de passe", () => {
    expect(source).not.toMatch(/console\.(log|debug|info|warn|error)\([^)]*password/);
    expect(source).not.toMatch(/console\.(log|debug|info)\(\s*password\s*\)/);
  });

  it("lien mot de passe oublié vers la route déclarée", () => {
    expect(source).toMatch(/Mot de passe oublié \?/);
    expect(source).toMatch(/MOBILE_FORGOT_PASSWORD_ROUTE/);
    expect(shouldShowForgotPasswordLink()).toBe(true);
  });

  it("réutilise la coque dégradé partagée (PNG via AmakiGradientShell)", () => {
    expect(source).toMatch(/AmakiGradientShell/);
    const shell = readFileSync(
      join(srcDir, "../../components/layout/amaki-gradient-header.tsx"),
      "utf8"
    );
    expect(shell).toMatch(/home-header-gradient\.png/);
  });
});
