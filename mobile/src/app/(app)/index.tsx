import { useCallback, useState } from "react";
import { Image } from "expo-image";
import { router, type Href, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import amakiLogo from "@/assets/images/amaki-logo-full.png";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { getMySurveysSummary } from "@/api/sondages";
import { shouldShowHomeSurveyCta } from "@/api/sondages-state";
import { getMyEventsSummary } from "@/api/evenements";
import { shouldShowHomeEventsBanner } from "@/api/evenements-state";
import { formatDateTimeFr } from "@/utils/profile-helpers";
import { AmakiDarkBackground } from "@/components/ui/amaki-dark-background";
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
  { id: "reunions", label: "Réunions", hint: "Mes réunions", href: "/reunions" },
  { id: "evenements", label: "Événements", hint: "Agenda", href: "/evenements" },
];

/**
 * Accueil — hub compact, fond sombre cohérent login.
 */
export default function AccueilScreen() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadCount();
  const displayName = user?.name?.trim() || "adhérent";
  const [surveyCount, setSurveyCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [nextEventTitle, setNextEventTitle] = useState<string | null>(null);
  const [nextEventWhen, setNextEventWhen] = useState<string | null>(null);
  const showSurveyCta = shouldShowHomeSurveyCta(surveyCount);
  const showEventsBanner = shouldShowHomeEventsBanner(eventsCount);

  const loadSurveySummary = useCallback(async () => {
    try {
      const summary = await getMySurveysSummary();
      setSurveyCount(summary.aCompleterCount);
    } catch {
      setSurveyCount(0);
    }
  }, []);

  const loadEventsSummary = useCallback(async () => {
    try {
      const summary = await getMyEventsSummary();
      setEventsCount(summary.upcomingCount);
      if (summary.nextEvent) {
        setNextEventTitle(summary.nextEvent.titre);
        setNextEventWhen(formatDateTimeFr(summary.nextEvent.dateDebut));
      } else {
        setNextEventTitle(null);
        setNextEventWhen(null);
      }
    } catch {
      // conserver dernière valeur
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSurveySummary();
      void loadEventsSummary();
    }, [loadSurveySummary, loadEventsSummary])
  );

  const serviceTiles = showSurveyCta
    ? [
        ...SERVICES,
        {
          id: "sondages",
          label: "Sondages",
          hint: `${surveyCount} à compléter`,
          href: "/sondages" as Href,
        },
      ]
    : SERVICES;

  return (
    <AmakiDarkBackground>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.identity}>
            <Image
              source={amakiLogo}
              style={styles.logo}
              accessibilityLabel="AMAKI France"
              alt="AMAKI France"
              contentFit="contain"
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

          {showSurveyCta ? (
            <Pressable
              style={styles.surveyBanner}
              onPress={() => router.push("/sondages")}
              accessibilityRole="button"
              accessibilityLabel={`Sondages, ${surveyCount} à compléter`}
            >
              <Text style={styles.surveyTitle}>Sondages</Text>
              <Text style={styles.surveyHint}>
                Vous avez {surveyCount} sondage
                {surveyCount !== 1 ? "s" : ""} à compléter
              </Text>
            </Pressable>
          ) : null}

          {showEventsBanner ? (
            <Pressable
              style={styles.eventsBanner}
              onPress={() => router.push("/evenements")}
              accessibilityRole="button"
              accessibilityLabel={`Événements, ${eventsCount} à venir`}
            >
              <Text style={styles.surveyTitle}>Événements</Text>
              <Text style={styles.surveyHint}>
                {eventsCount} événement{eventsCount !== 1 ? "s" : ""} à venir
                {nextEventTitle
                  ? ` — prochain : ${nextEventTitle}${nextEventWhen ? ` (${nextEventWhen})` : ""}`
                  : ""}
              </Text>
            </Pressable>
          ) : null}

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
            {serviceTiles.map((service) =>
              service.href ? (
                <Pressable
                  key={service.id}
                  style={styles.tileActive}
                  onPress={() => router.push(service.href!)}
                  accessibilityRole="button"
                  accessibilityLabel={service.label}
                >
                  <Text style={styles.tileLabelActive}>{service.label}</Text>
                  <Text style={styles.tileHint}>{service.hint ?? "Voir"}</Text>
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
    </AmakiDarkBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    paddingHorizontal: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing.xl,
  },
  identity: {
    backgroundColor: AmakiColors.onDarkSoft,
    borderRadius: AmakiRadius.lg,
    padding: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: AmakiRadius.md,
    marginBottom: AmakiSpacing.sm,
    backgroundColor: AmakiColors.surface,
  },
  hello: {
    ...AmakiTypography.caption,
    color: AmakiColors.onDarkMuted,
  },
  name: {
    ...AmakiTypography.display,
    color: AmakiColors.onDark,
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
    color: AmakiColors.onDark,
    fontWeight: "600",
  },
  metaDot: {
    ...AmakiTypography.caption,
    color: AmakiColors.onDarkMuted,
  },
  member: {
    ...AmakiTypography.caption,
    color: AmakiColors.onDarkMuted,
    marginTop: AmakiSpacing.xs,
  },
  surveyBanner: {
    backgroundColor: AmakiColors.primarySoft,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.primaryBorder,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.lg,
  },
  eventsBanner: {
    backgroundColor: "#ecfdf5",
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.lg,
  },
  surveyTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.primaryStrong,
  },
  surveyHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: AmakiSpacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AmakiColors.cardOnDark,
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
    color: AmakiColors.onDark,
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    opacity: 0.85,
    minHeight: 72,
  },
  tileActive: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: AmakiColors.cardOnDark,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    minHeight: 72,
  },
  tileLabel: {
    ...AmakiTypography.heading,
    color: AmakiColors.onDarkMuted,
  },
  tileLabelActive: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
  },
  tileSoon: {
    ...AmakiTypography.caption,
    color: AmakiColors.onDarkMuted,
    marginTop: AmakiSpacing.xs,
  },
  tileHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    marginTop: AmakiSpacing.xs,
  },
});
