import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError } from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Écran Profil — GET /api/v1/me + déconnexion.
 */
export default function ProfilScreen() {
  const { user, refreshMe, signOut } = useAuth();
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await refreshMe();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Impossible de charger le profil");
      }
    } finally {
      setLoading(false);
    }
  }, [refreshMe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading && !user) {
    return <LoadingState />;
  }

  const initials = initialsFromName(user?.name);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <ErrorBanner message={error} /> : null}

        <Card style={styles.identity}>
          <View style={styles.avatar} accessibilityLabel={`Avatar ${initials}`}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.name ?? "—"}</Text>
          <Text style={styles.email}>{user?.email ?? "—"}</Text>
          {user?.status ? (
            <StatusBadge label={user.status} tone="primary" />
          ) : null}
        </Card>

        <Text style={styles.sectionTitle}>Compte</Text>
        <Card>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Rôle</Text>
            <Text style={styles.rowValue}>{user?.role ?? "—"}</Text>
          </View>
        </Card>

        <PrimaryButton
          label="Déconnexion"
          variant="danger"
          loading={signingOut}
          onPress={onSignOut}
          style={styles.logout}
        />
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
    flexGrow: 1,
  },
  identity: {
    alignItems: "center",
    marginBottom: AmakiSpacing.lg,
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
  avatarText: {
    ...AmakiTypography.title,
    color: AmakiColors.primaryStrong,
  },
  name: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    textAlign: "center",
  },
  email: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.md,
  },
  sectionTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
  },
  rowValue: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "600",
  },
  logout: {
    marginTop: AmakiSpacing.xl,
  },
});
