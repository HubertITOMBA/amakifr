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
import { getMyEvents } from "@/api/evenements";
import {
  evenementErrorMessage,
  formatEventPeriod,
  placesLabel,
  eventStatusTone,
} from "@/api/evenements-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MyEventListItemDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { badgeDisplayLabel } from "@/components/ui/status-badge-label";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Scope = "upcoming" | "past";

/**
 * Liste événements adhérent — À venir / Passés.
 */
export default function EvenementsListScreen() {
  const [scope, setScope] = useState<Scope>("upcoming");
  const [items, setItems] = useState<MyEventListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const limit = 20;

  const loadPage = useCallback(
    async (opts: {
      refresh?: boolean;
      append?: boolean;
      currentLength: number;
    }) => {
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;
      const offset = opts.append ? opts.currentLength : 0;

      if (opts.refresh) setRefreshing(true);
      else if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const page = await getMyEvents({ scope, limit, offset });
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setTotal(page.total);
        setItems((prev) =>
          opts.append ? [...prev, ...page.items] : page.items
        );
      } catch (e) {
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setError(
          e instanceof ApiClientError
            ? evenementErrorMessage(e)
            : "Impossible de charger les événements"
        );
      } finally {
        const ended = endLoad(guardRef.current);
        guardRef.current = ended.guard;
        if (ended.clearSpinners) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [scope]
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage({ currentLength: 0 });
    }, [loadPage])
  );

  function changeScope(next: Scope) {
    if (next === scope) return;
    setScope(next);
    setItems([]);
    setTotal(0);
  }

  if (loading && items.length === 0) return <LoadingState />;

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, scope === "upcoming" && styles.tabActive]}
          onPress={() => changeScope("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              scope === "upcoming" && styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            {badgeDisplayLabel("À venir")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, scope === "past" && styles.tabActive]}
          onPress={() => changeScope("past")}
        >
          <Text
            style={[styles.tabText, scope === "past" && styles.tabTextActive]}
            numberOfLines={1}
          >
            {badgeDisplayLabel("Passés")}
          </Text>
        </Pressable>
      </View>

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
            onRefresh={() => void loadPage({ refresh: true, currentLength: 0 })}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={
              scope === "upcoming"
                ? "Aucun événement à venir."
                : "Aucun événement passé."
            }
          />
        }
        ListFooterComponent={
          items.length < total ? (
            <SecondaryButton
              label={loadingMore ? "Chargement…" : "Voir plus"}
              onPress={() =>
                void loadPage({ append: true, currentLength: items.length })
              }
              disabled={loadingMore}
              style={styles.more}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/evenements/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={item.titre}
          >
            <Card style={styles.card}>
              <Text style={styles.title} numberOfLines={2}>
                {item.titre}
              </Text>
              <View style={styles.badgeRow}>
                <StatusBadge
                  label={item.statutLabel}
                  tone={eventStatusTone(item.statutLabel)}
                />
                {item.obligatoireParticipation ? (
                  <StatusBadge
                    label="Participation obligatoire"
                    tone="warning"
                  />
                ) : null}
              </View>
              <Text style={styles.meta}>
                {formatEventPeriod(item.dateDebut, item.dateFin)}
              </Text>
              {item.lieu ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {item.lieu}
                </Text>
              ) : null}
              <View style={styles.footer}>
                {item.estInscrit ? (
                  <Text style={styles.inscrit}>Inscrit</Text>
                ) : item.canRegister ? (
                  <Text style={styles.cta}>Inscription ouverte</Text>
                ) : null}
                {placesLabel(item.placesRestantes, item.placesDisponibles) ? (
                  <Text style={styles.places}>
                    {placesLabel(item.placesRestantes, item.placesDisponibles)}
                  </Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  tabs: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    padding: AmakiSpacing.md,
    backgroundColor: AmakiColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AmakiColors.border,
  },
  tab: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: AmakiSpacing.sm,
    paddingHorizontal: AmakiSpacing.sm,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: AmakiColors.primarySoft },
  tabText: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
  tabTextActive: { color: AmakiColors.primaryStrong },
  list: { padding: AmakiSpacing.md, paddingBottom: AmakiSpacing["2xl"] },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  card: {
    marginBottom: AmakiSpacing.sm,
    backgroundColor: "#eef6ff",
    borderColor: AmakiColors.primaryBorder,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  badgeRow: {
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.xs,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: AmakiSpacing.sm,
  },
  inscrit: {
    ...AmakiTypography.caption,
    color: AmakiColors.success,
    fontWeight: "700",
  },
  cta: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "700",
  },
  places: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  more: { marginVertical: AmakiSpacing.md, alignSelf: "center" },
});
