import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import appIcon from "@/assets/images/icon.png";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { useUnreadCount } from "@/hooks/unread-count";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

const SERVICES: {
  id: string;
  label: string;
  hint?: string;
  href?: Href;
}[] = [
  { id: "documents", label: "Documents", hint: "Voir mes documents", href: "/documents" },
  { id: "passeport", label: "Passeport", hint: "Mon passeport", href: "/passeport" },
  { id: "taches", label: "Tâches", hint: "Mes tâches", href: "/taches" },
  { id: "reunions", label: "Réunions" },
];

/**
 * Accueil — hub compact (identité, raccourcis, services futurs).
 */
export default function AccueilScreen() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadCount();
  const displayName = user?.name?.trim() || "adhérent";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identity}>
          <Image
            source={appIcon}
            style={styles.logo}
            accessibilityLabel="AMAKI France"
            alt="AMAKI France"
          />
          <Text style={styles.hello}>Bonjour</Text>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{user?.role ?? "—"}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.meta}>{user?.status ?? "—"}</Text>
          </View>
          <Text style={styles.member}>Membre AMAKI France</Text>
        </View>

        <View style={styles.summaryRow}>
          <Pressable
            style={styles.summaryCard}
            onPress={() => router.push("/cotisations")}
            accessibilityRole="button"
            accessibilityLabel="Voir mes cotisations"
          >
            <Text style={styles.summaryTitle}>Cotisations</Text>
            <Text style={styles.summaryHint}>Voir mes cotisations</Text>
          </Pressable>
          <Pressable
            style={styles.summaryCard}
            onPress={() => router.push("/notifications")}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} non lues`
                : "Notifications, aucune non lue"
            }
          >
            <Text style={styles.summaryTitle}>Notifications</Text>
            <Text style={styles.summaryHint}>
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount !== 1 ? "s" : ""}`
                : "Aucune non lue"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Mes services</Text>
        <View style={styles.grid}>
          {SERVICES.map((service) =>
            service.href ? (
              <Pressable
                key={service.id}
                style={styles.tileActive}
                onPress={() => router.push(service.href!)}
                accessibilityRole="button"
                accessibilityLabel={service.label}
              >
                <Text style={styles.tileLabelActive}>{service.label}</Text>
                <Text style={styles.tileHint}>
                  {service.hint ?? "Voir mes documents"}
                </Text>
              </Pressable>
            ) : (
              <View
                key={service.id}
                style={styles.tile}
                accessibilityRole="text"
                accessibilityLabel={`${service.label}, bientôt`}
              >
                <Text style={styles.tileLabel}>{service.label}</Text>
                <Text style={styles.tileSoon}>Bientôt</Text>
              </View>
            )
          )}
        </View>
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
    paddingHorizontal: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing.xl,
  },
  identity: {
    backgroundColor: AmakiColors.primarySoft,
    borderRadius: AmakiRadius.lg,
    padding: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.lg,
    borderWidth: 1,
    borderColor: AmakiColors.border,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: AmakiRadius.sm,
    marginBottom: AmakiSpacing.sm,
  },
  hello: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  name: {
    ...AmakiTypography.display,
    color: AmakiColors.primaryStrong,
    marginTop: AmakiSpacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: AmakiSpacing.sm,
    gap: AmakiSpacing.xs,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    fontWeight: "600",
  },
  metaDot: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  member: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    padding: AmakiSpacing.md,
    minHeight: 88,
  },
  summaryTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  summaryHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
  },
  sectionTitle: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.sm,
  },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: AmakiColors.surfaceMuted,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    opacity: 0.7,
    minHeight: 72,
  },
  tileActive: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    minHeight: 72,
  },
  tileLabel: {
    ...AmakiTypography.heading,
    color: AmakiColors.textMuted,
  },
  tileLabelActive: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
  },
  tileSoon: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
  },
  tileHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    marginTop: AmakiSpacing.xs,
  },
});
