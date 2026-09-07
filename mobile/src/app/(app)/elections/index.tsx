import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyElections } from "@/api/elections";
import { electionErrorMessage } from "@/api/elections-state";
import {
  beginLoad,
  createLoadGuard,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MyElectionListItemDto } from "@/api/types";
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

function formatPeriod(item: MyElectionListItemDto): string {
  const a = new Date(item.dateScrutin).toLocaleDateString("fr-FR");
  const b = new Date(item.dateCloture).toLocaleDateString("fr-FR");
  return `${a} → ${b}`;
}

/**
 * Liste élections : À voter / À venir / Terminées.
 */
export default function ElectionsListScreen() {
  const [items, setItems] = useState<MyElectionListItemDto[]>([]);
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
      const page = await getMyElections();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(page.items);
      hasLoadedRef.current = true;
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setError(
        e instanceof ApiClientError
          ? electionErrorMessage(e)
          : "Impossible de charger les élections"
      );
    } finally {
      if (shouldApplyLoadResult(gen, guardRef.current.dataGen)) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const sections = useMemo(() => {
    const open = items.filter((i) => i.scope === "open");
    const upcoming = items.filter((i) => i.scope === "upcoming");
    const closed = items.filter((i) => i.scope === "closed");
    return [
      { key: "open", title: "À voter", data: open },
      { key: "upcoming", title: "À venir", data: upcoming },
      { key: "closed", title: "Terminées", data: closed },
    ].filter((s) => s.data.length > 0);
  }, [items]);

  if (loading && !hasLoadedRef.current) {
    return <LoadingState />;
  }

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune élection"
            message="Aucun scrutin n'est disponible pour le moment."
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((election) => (
              <Pressable
                key={election.id}
                onPress={() =>
                  router.push(`/(app)/elections/${election.id}` as never)
                }
              >
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.title} numberOfLines={2}>
                      {election.titre}
                    </Text>
                    <StatusBadge
                      label={election.statusLabel}
                      tone={
                        election.scope === "open"
                          ? "success"
                          : election.scope === "upcoming"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </View>
                  <Text style={styles.meta}>{formatPeriod(election)}</Text>
                  <Text style={styles.personal}>{election.personalLabel}</Text>
                  {election.candidaciesOpen ? (
                    <Text style={styles.candidacyHint}>Candidatures ouvertes</Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  list: { padding: AmakiSpacing.md, paddingBottom: AmakiSpacing.xl },
  section: { marginBottom: AmakiSpacing.lg },
  sectionTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  card: { marginBottom: AmakiSpacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
    alignItems: "flex-start",
  },
  title: {
    ...AmakiTypography.body,
    fontWeight: "700",
    color: AmakiColors.text,
    flex: 1,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 4,
  },
  personal: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "600",
    marginTop: 6,
  },
  candidacyHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.warning,
    fontWeight: "600",
    marginTop: 4,
  },
});
