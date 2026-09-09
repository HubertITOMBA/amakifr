import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/auth/auth-context";
import {
  getMyProfileSection,
  type MeProfileSummaryDto,
} from "@/api/profile";
import { PROFILE_MENU_ITEMS } from "@/api/profile-menu";
import { ApiClientError } from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { useUnreadCount } from "@/hooks/unread-count";
import { unregisterCurrentPushToken } from "@/api/push-notifications";
import {
  AMAKI_PRIVACY_LABEL,
  AMAKI_PRIVACY_URL,
} from "@/constants/amaki-links";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";
import { getInitials } from "@/utils/profile-helpers";

/**
 * Hub Profil — cards uniquement, pas de détails inline ni CTA RGPD.
 */
export default function ProfilHubScreen() {
  const { user, signOut } = useAuth();
  const { resetUnreadCount } = useUnreadCount();
  const [summary, setSummary] = useState<MeProfileSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadSummary = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyProfileSection<MeProfileSummaryDto>("summary");
      setSummary(data);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Impossible de charger le profil");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  async function openPrivacy() {
    try {
      await WebBrowser.openBrowserAsync(AMAKI_PRIVACY_URL);
    } catch {
      await Linking.openURL(AMAKI_PRIVACY_URL);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      // Détache token appareil avant reset local (cross-compte A → B)
      await unregisterCurrentPushToken();
      resetUnreadCount();
      setSummary(null);
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading && !summary && !user) {
    return <LoadingState />;
  }

  const displayName = summary?.name ?? user?.name ?? "—";
  const displayEmail = summary?.email ?? user?.email ?? "—";
  const initials = getInitials(displayName, displayEmail);
  const hasImage = Boolean(summary?.image);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Mon profil</Text>
        <Text style={styles.screenSubtitle}>Choisissez une rubrique</Text>

        {error ? <ErrorBanner message={error} /> : null}

        <Card style={styles.identityCard}>
          {hasImage ? (
            <Image
              source={{ uri: summary!.image! }}
              style={styles.avatarImage}
              accessibilityLabel={`Photo de ${displayName}`}
              alt={`Photo de ${displayName}`}
            />
          ) : (
            <View
              style={styles.avatar}
              accessibilityLabel={`Initiales ${initials}`}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
        </Card>

        {PROFILE_MENU_ITEMS.map((item) => (
          <Pressable
            key={item.id}
            style={styles.menuCard}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={item.hint}
          >
            <View style={styles.menuIconWrap}>
              <SymbolView
                name={item.symbol}
                size={22}
                tintColor={AmakiColors.primary}
                weight="medium"
              />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuHint}>{item.hint}</Text>
            </View>
            <Text style={styles.chevron} accessibilityElementsHidden>
              ›
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.privacyBlock}
          onPress={() => void openPrivacy()}
          accessibilityRole="link"
          accessibilityLabel={AMAKI_PRIVACY_LABEL}
        >
          <Text style={styles.privacyTitle}>{AMAKI_PRIVACY_LABEL}</Text>
          <Text style={styles.privacyBody}>
            Pour consulter vos droits et gérer vos données personnelles,
            rendez-vous sur www.amaki.fr, rubrique Protection des données
            personnelles.
          </Text>
        </Pressable>

        <Pressable
          style={styles.logoutRow}
          onPress={() => void onSignOut()}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter de l'application"
        >
          <SymbolView
            name={{ ios: "power", android: "power_settings_new", web: "power_settings_new" }}
            size={16}
            tintColor={AmakiColors.textMuted}
            weight="medium"
          />
          <Text style={styles.logoutLabel}>
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AmakiColors.background,
  },
  container: {
    padding: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  screenTitle: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  screenSubtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.lg,
  },
  identityCard: {
    alignItems: "center",
    marginBottom: AmakiSpacing.lg,
    paddingVertical: AmakiSpacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.primarySoft,
    borderWidth: 2,
    borderColor: AmakiColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: AmakiSpacing.md,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: AmakiRadius.pill,
    borderWidth: 2,
    borderColor: AmakiColors.primary,
    marginBottom: AmakiSpacing.md,
  },
  avatarText: {
    ...AmakiTypography.title,
    color: AmakiColors.primaryStrong,
  },
  name: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    textAlign: "center",
  },
  email: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.sm,
    minHeight: 64,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: AmakiSpacing.md,
  },
  menuText: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
  },
  menuHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: AmakiColors.textMuted,
    fontWeight: "600",
    paddingLeft: AmakiSpacing.sm,
  },
  privacyBlock: {
    marginTop: AmakiSpacing.xl,
    padding: AmakiSpacing.md,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.surfaceMuted,
  },
  privacyTitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontWeight: "700",
    marginBottom: AmakiSpacing.xs,
  },
  privacyBody: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    lineHeight: 18,
  },
  logoutRow: {
    marginTop: AmakiSpacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.sm,
    opacity: 0.85,
  },
  logoutLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
  },
});
