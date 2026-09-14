import type { ConfigContext, ExpoConfig } from "expo/config";
import appJson from "./app.json";

/**
 * Profil de build effectif.
 *
 * - Sur workers EAS : `EAS_BUILD_PROFILE` (development | preview | production).
 * - En local (simulation / expo config) : `APP_ENV` ou défaut `development`
 *   (Metro / APK LAN HTTP).
 *
 * Ne pas inventer d'URL API production ici.
 */
export function resolveBuildProfile(): string {
  const fromEas = process.env.EAS_BUILD_PROFILE?.trim();
  if (fromEas) return fromEas;
  const fromAppEnv = process.env.APP_ENV?.trim();
  if (fromAppEnv) return fromAppEnv;
  return "development";
}

/**
 * HTTP cleartext autorisé uniquement pour development et preview (API LAN).
 * Production / store : false (HTTPS obligatoire côté API).
 */
export function resolveUsesCleartextTraffic(profile: string): boolean {
  return profile === "development" || profile === "preview";
}

/**
 * Identité native distincte pour le client de développement uniquement.
 * Réutilise le package Firebase existant `fr.amaki.mobile`.
 * Preview et production conservent les valeurs de `app.json` (`fr.amaki.app`).
 */
export function resolveNativeIdentity(profile: string): {
  name: string;
  scheme: string;
  androidPackage: string;
  iosBundleIdentifier: string;
} {
  if (profile === "development") {
    return {
      name: "AMAKI Dev",
      scheme: "amaki-dev",
      androidPackage: "fr.amaki.mobile",
      iosBundleIdentifier: "fr.amaki.mobile",
    };
  }

  return {
    name: "AMAKI",
    scheme: "amaki",
    androidPackage: "fr.amaki.app",
    iosBundleIdentifier: "fr.amaki.app",
  };
}

function withBuildPropertiesPlugin(
  plugins: ExpoConfig["plugins"] | undefined,
  usesCleartextTraffic: boolean
): ExpoConfig["plugins"] {
  const next = [...(plugins ?? [])].filter((entry) => {
    if (typeof entry === "string") return entry !== "expo-build-properties";
    if (Array.isArray(entry)) return entry[0] !== "expo-build-properties";
    return true;
  });

  next.push([
    "expo-build-properties",
    {
      android: {
        usesCleartextTraffic,
      },
    },
  ]);

  return next;
}

/**
 * Config Expo dynamique — base = app.json, cleartext + identité selon profil.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;
  const profile = resolveBuildProfile();
  const usesCleartextTraffic = resolveUsesCleartextTraffic(profile);
  const identity = resolveNativeIdentity(profile);

  return {
    ...config,
    ...base,
    name: identity.name,
    scheme: identity.scheme,
    ios: {
      ...base.ios,
      bundleIdentifier: identity.iosBundleIdentifier,
    },
    android: {
      ...base.android,
      package: identity.androidPackage,
      // Champ supporté par Expo / prebuild ; typings ExpoConfig parfois incomplets.
      usesCleartextTraffic,
    } as ExpoConfig["android"],
    plugins: withBuildPropertiesPlugin(base.plugins, usesCleartextTraffic),
    extra: {
      ...base.extra,
      buildProfile: profile,
      usesCleartextTraffic,
    },
  };
};
