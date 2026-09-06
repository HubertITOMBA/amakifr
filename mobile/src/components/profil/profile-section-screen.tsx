import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiClientError } from "@/api/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props<T> = {
  load: () => Promise<T>;
  children: (data: T) => ReactNode;
  emptyMessage?: string;
};

/**
 * Chargeur commun des sous-écrans profil (lazy + retry soft).
 */
export function ProfileSectionScreen<T>({
  load,
  children,
  emptyMessage,
}: Props<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const next = await load();
        setData(next);
      } catch (e) {
        setError(
          e instanceof ApiClientError
            ? e.message
            : "Impossible de charger cette rubrique"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  if (loading && !data) return <LoadingState />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void run(true)}
          tintColor={AmakiColors.primary}
        />
      }
    >
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        children(data)
      ) : (
        <Text style={styles.empty}>{emptyMessage ?? "Aucune donnée"}</Text>
      )}
    </ScrollView>
  );
}

/**
 * Ligne label / valeur pour les sections profil.
 */
export function ProfileInfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  empty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    paddingVertical: AmakiSpacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: AmakiSpacing.sm,
    gap: AmakiSpacing.md,
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
});
