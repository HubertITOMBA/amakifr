import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import { Image } from "expo-image";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError, type MeDto } from "@/api/types";
import {
  getMyDataDeletionRequest,
  submitMyDataDeletionRequest,
} from "@/api/rgpd";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getApiBaseUrl } from "@/config/api";
import { getInitials, formatAddress, formatDateFr } from "@/utils/profile-helpers";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Écran Profil — fiche adhérent enrichie (GET /api/v1/me) + déconnexion.
 */
export default function ProfilScreen() {
  const { user, refreshMe, signOut } = useAuth();
  const [loading, setLoading] = useState(!user);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<{
    id: string;
    statut: string;
  } | null>(null);
  const [deletionLoading, setDeletionLoading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    setError(null);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      await refreshMe();
      try {
        const req = await getMyDataDeletionRequest();
        setDeletionStatus(req);
      } catch {
        // RGPD optionnel — ne bloque pas le profil
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Impossible de charger le profil");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshMe]);

  useEffect(() => {
    void load(false);
  }, [load]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  async function openConfidentialite() {
    const url = `${getApiBaseUrl().replace(/\/$/, "")}/confidentialite`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      await Linking.openURL(url);
    }
  }

  function onRequestAccountDeletion() {
    Alert.alert(
      "Suppression de compte",
      "Vous allez demander la suppression de vos données personnelles (RGPD). Cette action concerne le compte entier, pas un document isolé.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletionLoading(true);
              try {
                const res = await submitMyDataDeletionRequest();
                setDeletionStatus({ id: res.id, statut: res.statut });
                Alert.alert(
                  "Demande enregistrée",
                  "Votre demande de suppression a été transmise à l'administration."
                );
              } catch (e) {
                Alert.alert(
                  "Demande impossible",
                  e instanceof ApiClientError
                    ? e.message
                    : "Erreur lors de la demande"
                );
              } finally {
                setDeletionLoading(false);
              }
            })();
          },
        },
      ]
    );
  }

  if (loading && !user) {
    return <LoadingState />;
  }

  const me = user as MeDto | null;
  const initials = getInitials(me?.name, me?.email);
  const adherent = me?.adherent;
  const addresses = adherent?.addresses ?? [];
  const hasImage = !!me?.image;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
      >
        <Text style={styles.screenTitle}>Profil</Text>
        <Text style={styles.screenSubtitle}>Mes informations personnelles</Text>

        {error ? <ErrorBanner message={error} /> : null}

        {/* === IDENTITÉ === */}
        <Card style={styles.identityCard}>
          {hasImage ? (
            <Image
              source={{ uri: me!.image! }}
              style={styles.avatarImage}
              accessibilityLabel={`Photo de ${me?.name ?? "profil"}`}
              alt={`Photo de ${me?.name ?? "profil"}`}
            />
          ) : (
            <View style={styles.avatar} accessibilityLabel={`Initiales ${initials}`}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{me?.name ?? "—"}</Text>
          <Text style={styles.email}>{me?.email ?? "—"}</Text>
          <View style={styles.badgeRow}>
            {me?.role ? <StatusBadge label={me.role} tone="primary" /> : null}
            {me?.status ? <StatusBadge label={me.status} tone="neutral" /> : null}
          </View>
        </Card>

        {/* === INFORMATIONS ADHÉRENT === */}
        {adherent ? (
          <>
            <Text style={styles.sectionTitle}>Informations adhérent</Text>
            <Card>
              {adherent.civility ? (
                <InfoRow label="Civilité" value={adherent.civility} />
              ) : null}
              {adherent.firstname ? (
                <InfoRow label="Prénom" value={adherent.firstname} />
              ) : null}
              {adherent.lastname ? (
                <InfoRow label="Nom" value={adherent.lastname} last />
              ) : null}
            </Card>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Informations adhérent</Text>
            <Card muted>
              <Text style={styles.noDataText}>
                Informations adhérent non disponibles
              </Text>
            </Card>
          </>
        )}

        {/* === COORDONNÉES === */}
        {addresses.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Mes coordonnées</Text>
            {addresses.map((addr) => {
              const lines = formatAddress(addr);
              if (lines.length === 0) return null;
              return (
                <Card key={addr.id} style={styles.addressCard}>
                  {lines.map((line, i) => (
                    <Text key={i} style={styles.addressLine}>{line}</Text>
                  ))}
                </Card>
              );
            })}
          </>
        ) : null}

        {/* === COMPTE === */}
        <Text style={styles.sectionTitle}>Mon compte</Text>
        <Card>
          {me?.role ? <InfoRow label="Rôle" value={me.role} /> : null}
          {me?.status ? <InfoRow label="Statut" value={me.status} /> : null}
          {me?.lastLogin ? (
            <InfoRow
              label="Dernière connexion"
              value={formatDateFr(me.lastLogin)}
              last
            />
          ) : null}
        </Card>

        {/* === CONFIDENTIALITÉ / RGPD === */}
        <Text style={styles.sectionTitle}>Confidentialité / RGPD</Text>
        <Card>
          <Text style={styles.rgpdHint}>
            Accès aux droits déjà supportés sur le portail Web AMAKI.
          </Text>
          <SecondaryButton
            label="Politique de confidentialité"
            onPress={() => void openConfidentialite()}
            style={styles.rgpdBtn}
          />
          <SecondaryButton
            label={
              deletionStatus
                ? `Demande en cours (${deletionStatus.statut})`
                : "Demander la suppression de mon compte"
            }
            onPress={() => void onRequestAccountDeletion()}
            disabled={Boolean(deletionStatus) || deletionLoading}
            loading={deletionLoading}
            variant="danger"
            style={styles.rgpdBtn}
          />
          <Text style={styles.rgpdNote}>
            Ceci concerne la suppression de votre compte (RGPD). Pour un
            document validé et public, utilisez « Demander la suppression »
            dans Mes documents — ce sont deux workflows distincts.
          </Text>
        </Card>

        {/* === DÉCONNEXION === */}
        <View style={styles.logoutSection}>
          <SecondaryButton
            label="Se déconnecter"
            variant="danger"
            loading={signingOut}
            onPress={onSignOut}
            style={styles.logoutBtn}
            accessibilityLabel="Se déconnecter de l'application"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  last?: boolean;
};

function InfoRow({ label, value, last }: InfoRowProps) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
    paddingVertical: AmakiSpacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.primarySoft,
    borderWidth: 2,
    borderColor: AmakiColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: AmakiSpacing.md,
  },
  avatarImage: {
    width: 72,
    height: 72,
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
    ...AmakiTypography.title,
    color: AmakiColors.text,
    textAlign: "center",
  },
  email: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.sm,
  },
  sectionTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.sm,
  },
  noDataText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    paddingVertical: AmakiSpacing.sm,
  },
  addressCard: {
    marginBottom: AmakiSpacing.sm,
  },
  addressLine: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    lineHeight: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: AmakiSpacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmakiColors.border,
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
    flexShrink: 1,
    textAlign: "right",
  },
  logoutSection: {
    marginTop: AmakiSpacing["2xl"],
    alignItems: "center",
  },
  logoutBtn: {
    minWidth: 200,
  },
  rgpdHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.sm,
  },
  rgpdBtn: {
    alignSelf: "stretch",
    marginBottom: AmakiSpacing.sm,
  },
  rgpdNote: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
  },
});
