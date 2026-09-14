import { describe, expect, it } from "vitest";
import {
  resolveBuildProfile,
  resolveNativeIdentity,
  resolveUsesCleartextTraffic,
} from "../../app.config";

describe("cleartext traffic by build profile", () => {
  it("development / preview → cleartext true", () => {
    expect(resolveUsesCleartextTraffic("development")).toBe(true);
    expect(resolveUsesCleartextTraffic("preview")).toBe(true);
  });

  it("production → cleartext false", () => {
    expect(resolveUsesCleartextTraffic("production")).toBe(false);
  });

  it("profil inconnu → cleartext false (défaut sûr)", () => {
    expect(resolveUsesCleartextTraffic("staging")).toBe(false);
    expect(resolveUsesCleartextTraffic("")).toBe(false);
  });

  it("resolveBuildProfile lit EAS_BUILD_PROFILE puis APP_ENV", () => {
    const prevEas = process.env.EAS_BUILD_PROFILE;
    const prevApp = process.env.APP_ENV;
    try {
      delete process.env.EAS_BUILD_PROFILE;
      delete process.env.APP_ENV;
      expect(resolveBuildProfile()).toBe("development");

      process.env.APP_ENV = "preview";
      expect(resolveBuildProfile()).toBe("preview");

      process.env.EAS_BUILD_PROFILE = "production";
      expect(resolveBuildProfile()).toBe("production");
    } finally {
      if (prevEas === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = prevEas;
      if (prevApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = prevApp;
    }
  });
});

describe("native identity by build profile", () => {
  it("development → fr.amaki.mobile, AMAKI Dev, amaki-dev", () => {
    expect(resolveNativeIdentity("development")).toEqual({
      name: "AMAKI Dev",
      scheme: "amaki-dev",
      androidPackage: "fr.amaki.mobile",
      iosBundleIdentifier: "fr.amaki.mobile",
    });
  });

  it("production → fr.amaki.app, AMAKI, amaki (inchangé)", () => {
    expect(resolveNativeIdentity("production")).toEqual({
      name: "AMAKI",
      scheme: "amaki",
      androidPackage: "fr.amaki.app",
      iosBundleIdentifier: "fr.amaki.app",
    });
  });

  it("preview → identité production (pas de variante .mobile)", () => {
    expect(resolveNativeIdentity("preview")).toEqual({
      name: "AMAKI",
      scheme: "amaki",
      androidPackage: "fr.amaki.app",
      iosBundleIdentifier: "fr.amaki.app",
    });
  });
});
