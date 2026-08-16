import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
            tintColor="#1d4ed8"
          />
        }
        ListEmptyComponent={
          error ? null : (
            <Text style={styles.empty}>Aucune cotisation mensuelle</Text>
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
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  list: {
    padding: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  empty: {
    color: "#64748b",
    fontSize: 16,
  },
  error: {
    color: "#b91c1c",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
