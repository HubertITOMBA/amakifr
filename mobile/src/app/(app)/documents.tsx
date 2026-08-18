import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { getMyDocuments } from "@/api/documents";
import {
  buildDocumentOpenUrl,
  documentErrorMessage,
} from "@/api/documents-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type DocumentDto } from "@/api/types";
import { DocumentItem } from "@/components/document-item";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { getApiBaseUrl } from "@/config/api";
import { AmakiColors, AmakiSpacing } from "@/constants/theme";

/**
 * Écran Documents — lecture seule self-service.
 */
export default function DocumentsScreen() {
  const [items, setItems] = useState<DocumentDto[]>([]);
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
      const list = await getMyDocuments();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(list);
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      if (e instanceof ApiClientError) {
        setError(documentErrorMessage(e));
      } else {
        setError("Impossible de charger les documents");
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

  async function onOpen(document: DocumentDto) {
    let url: string | null = null;
    try {
      url = buildDocumentOpenUrl(getApiBaseUrl(), document.chemin);
    } catch {
      url = null;
    }
    if (!url) {
      Alert.alert(
        "Document indisponible",
        "Ce fichier ne peut pas être ouvert depuis l'application."
      );
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert(
        "Ouverture impossible",
        "Le document n'a pas pu être ouvert."
      );
    }
  }

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
          error ? null : <EmptyState title="Aucun document" />
        }
        renderItem={({ item }) => (
          <DocumentItem document={item} onOpen={onOpen} />
        )}
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
