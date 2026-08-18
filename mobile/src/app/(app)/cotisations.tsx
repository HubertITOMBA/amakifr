import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { getMyCotisationsMensuelles } from "@/api/cotisations";
import { cotisationErrorMessage } from "@/api/cotisations-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type CotisationMensuelleDto } from "@/api/types";
import { CotisationItem } from "@/components/cotisation-item";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { AmakiColors, AmakiSpacing } from "@/constants/theme";

/**
 * Écran Cotisations mensuelles — lecture seule self-service.
 */
export default function CotisationsScreen() {
  const [items, setItems] = useState<CotisationMensuelleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const list = await getMyCotisationsMensuelles();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(list);
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      if (e instanceof ApiClientError) {
        setError(cotisationErrorMessage(e));
      } else {
        setError("Impossible de charger les cotisations");
      }
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return <LoadingState />;
  }

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
            <EmptyState title="Aucune cotisation mensuelle" />
          )
        }
        renderItem={({ item }) => <CotisationItem cotisation={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmakiColors.background,
  },
  list: {
    padding: AmakiSpacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
});
