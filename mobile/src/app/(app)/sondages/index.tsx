import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyActiveSurveys } from "@/api/sondages";
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

/**
 * Liste des sondages à compléter.
 */
export default function SondagesScreen() {
  const [items, setItems] = useState<MyActiveSurveyDto[]>([]);
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
      const page = await getMyActiveSurveys();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(page.items);
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

  if (loading && items.length === 0) return <LoadingState />;

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.list
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
            <EmptyState title="Aucun sondage à compléter" />
          )
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
              <StatusBadge label={item.statusLabel} tone="warning" />
              <Text style={styles.meta}>
                {formatSurveyPeriod(item.dateDebut, item.dateFin)}
              </Text>
              <Text style={styles.progress}>
                {formatSurveyProgress(
                  item.requiredAnswered,
                  item.requiredTotal
                )}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  list: { padding: AmakiSpacing.lg },
  emptyContainer: {
    flexGrow: 1,
    padding: AmakiSpacing.lg,
    justifyContent: "center",
  },
  card: { marginBottom: AmakiSpacing.md },
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
});
