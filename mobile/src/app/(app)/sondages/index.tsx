import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyClosedSurveys, getMyOpenSurveys } from "@/api/sondages";
import {
  formatSurveyPeriod,
  formatSurveyProgress,
  sondageErrorMessage,
} from "@/api/sondages-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MyActiveSurveyDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type SurveySection = {
  key: "open" | "closed";
  title: string;
  data: MyActiveSurveyDto[];
};

/**
 * Rubrique permanente « Sondages et Quiz » — En cours + Terminés.
 * Réutilise le parcours `/sondages/[id]` existant.
 */
export default function SondagesScreen() {
  const [openItems, setOpenItems] = useState<MyActiveSurveyDto[]>([]);
  const [closedItems, setClosedItems] = useState<MyActiveSurveyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;
    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const [openPage, closedPage] = await Promise.all([
        getMyOpenSurveys(),
        getMyClosedSurveys(),
      ]);
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setOpenItems(openPage.items);
      setClosedItems(closedPage.items);
      hasLoadedRef.current = true;
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setError(
        e instanceof ApiClientError
          ? sondageErrorMessage(e)
          : "Impossible de charger les sondages"
      );
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const sections: SurveySection[] = [
    { key: "open", title: "En cours", data: openItems },
    { key: "closed", title: "Terminés", data: closedItems },
  ];

  const totalCount = openItems.length + closedItems.length;

  if (loading && !hasLoadedRef.current) return <LoadingState />;

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={
          totalCount === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          error ? null : (
            <EmptyState title="Aucun sondage pour le moment" />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 && totalCount > 0 ? (
            <Text style={styles.sectionEmpty}>
              {section.key === "open"
                ? "Aucun sondage en cours"
                : "Aucun sondage terminé"}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/sondages/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le sondage ${item.sujet}`}
          >
            <Card style={styles.card}>
              <Text style={styles.title} numberOfLines={2}>
                {item.sujet}
              </Text>
              {item.introduction ? (
                <Text style={styles.intro} numberOfLines={2}>
                  {item.introduction}
                </Text>
              ) : null}
              <View style={styles.badgeRow}>
                <StatusBadge
                  label={item.kindLabel ?? item.kind ?? "Sondage"}
                  tone={item.kind === "Quiz" ? "success" : "neutral"}
                />
                {item.modeEnDirect ? (
                  <StatusBadge label="En direct" tone="success" />
                ) : null}
                <StatusBadge
                  label={item.statusLabel}
                  tone={item.modifiable ? "warning" : "neutral"}
                />
              </View>
              <Text style={styles.meta}>
                {formatSurveyPeriod(item.dateDebut, item.dateFin)}
              </Text>
              {item.modifiable ? (
                <Text style={styles.progress}>
                  {formatSurveyProgress(
                    item.requiredAnswered,
                    item.requiredTotal
                  )}
                </Text>
              ) : (
                <Text style={styles.readonlyHint}>Lecture seule</Text>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  list: {
    paddingHorizontal: AmakiSpacing.lg,
    paddingTop: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
    padding: AmakiSpacing.lg,
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: AmakiSpacing.sm,
    marginTop: AmakiSpacing.md,
    paddingTop: AmakiSpacing.sm,
    paddingBottom: AmakiSpacing.xs,
  },
  sectionTitle: {
    ...AmakiTypography.heading,
    fontSize: 18,
    lineHeight: 28,
    color: AmakiColors.text,
    flexShrink: 1,
  },
  sectionCount: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
  },
  sectionEmpty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.md,
  },
  card: { marginBottom: AmakiSpacing.md },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.xs,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  intro: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.sm,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.sm,
  },
  progress: {
    ...AmakiTypography.caption,
    color: AmakiColors.primaryStrong,
    fontWeight: "600",
    marginTop: AmakiSpacing.xs,
  },
  readonlyHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
  },
});
