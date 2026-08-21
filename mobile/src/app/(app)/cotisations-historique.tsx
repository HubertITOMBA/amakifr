import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyPayments } from "@/api/cotisations";
import { paymentStatusLabel } from "@/api/payment-account-state";
import {
  cotisationErrorMessage,
  formatPaymentDateTimeFr,
  mapFinanceStatutDisplay,
  mapMoyenPaiement,
} from "@/api/cotisations-state";
import { ApiClientError, type MyPaymentDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyDecimalString } from "@/utils/money";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

const PAGE_SIZE = 20;

/**
 * Historique des paiements — chargé à la demande (lazy), paginé.
 * Retour Android / header → Mes cotisations.
 */
export default function CotisationsHistoriqueScreen() {
  const params = useLocalSearchParams<{ annee?: string }>();
  const anneeParam =
    params.annee && Number.isInteger(Number(params.annee))
      ? Number(params.annee)
      : undefined;

  const [items, setItems] = useState<MyPaymentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [filterYear, setFilterYear] = useState<number | undefined>(anneeParam);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (mode: "replace" | "append" | "refresh") => {
      if (loadingRef.current && mode === "append") return;
      loadingRef.current = true;

      if (mode === "refresh") setRefreshing(true);
      else if (mode === "append") setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const nextOffset = mode === "append" ? offsetRef.current : 0;

      try {
        const page = await getMyPayments({
          annee: filterYear,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setItems((prev) =>
          mode === "append" ? [...prev, ...page.items] : page.items
        );
        setTotal(page.total);
        offsetRef.current = nextOffset + page.items.length;
      } catch (e) {
        setError(
          e instanceof ApiClientError
            ? cotisationErrorMessage(e)
            : "Impossible de charger l'historique"
        );
      } finally {
        loadingRef.current = false;
        setRefreshing(false);
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterYear]
  );

  useEffect(() => {
    offsetRef.current = 0;
    void fetchPage("replace");
  }, [fetchPage]);

  if (loading && items.length === 0) return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchPage("refresh")}
            tintColor={AmakiColors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Historique des paiements</Text>
            <Text style={styles.subtitle}>
              {filterYear
                ? `Année ${filterYear}`
                : "Toutes les années (paginé)"}
            </Text>
            <View style={styles.filterRow}>
              {anneeParam ? (
                <SecondaryButton
                  label={`Année ${anneeParam}`}
                  onPress={() => setFilterYear(anneeParam)}
                  style={styles.filterBtn}
                />
              ) : null}
              <SecondaryButton
                label="Toutes"
                onPress={() => setFilterYear(undefined)}
                style={styles.filterBtn}
              />
            </View>
            {error ? <ErrorBanner message={error} /> : null}
          </View>
        }
        renderItem={({ item }) => <PaymentHistoryCard payment={item} />}
        ListEmptyComponent={
          <Card muted>
            <Text style={styles.empty}>Aucun paiement</Text>
          </Card>
        }
        ListFooterComponent={
          items.length < total ? (
            <SecondaryButton
              label={loadingMore ? "Chargement…" : "Voir plus"}
              onPress={() => void fetchPage("append")}
              disabled={loadingMore}
              style={styles.moreBtn}
            />
          ) : items.length > 0 ? (
            <Text style={styles.footerCount}>
              {items.length} / {total}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function PaymentHistoryCard({ payment }: { payment: MyPaymentDto }) {
  const statut = mapFinanceStatutDisplay(payment.statut);
  const statusLabel =
    payment.statut === "EnAttente" ||
    payment.statut === "Annule" ||
    payment.statut === "Valide"
      ? paymentStatusLabel(payment.statut)
      : statut.label;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{payment.destinationLabel}</Text>
      <Text style={styles.amount}>
        {formatMoneyDecimalString(payment.montant)}
      </Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{mapMoyenPaiement(payment.moyenPaiement)}</Text>
        <StatusBadge label={statusLabel} tone={statut.tone} />
      </View>
      <Text style={styles.meta}>
        {formatPaymentDateTimeFr(payment.datePaiement)}
      </Text>
      {payment.reference ? (
        <Text style={styles.meta}>Réf. {payment.reference}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AmakiColors.background },
  container: {
    padding: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  headerBlock: { marginBottom: AmakiSpacing.md },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  subtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.sm,
  },
  filterBtn: { flex: 1 },
  card: {
    marginBottom: AmakiSpacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: AmakiColors.textSecondary,
  },
  cardTitle: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
  },
  amount: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    gap: AmakiSpacing.sm,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 2,
  },
  empty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  moreBtn: { marginTop: AmakiSpacing.md, alignSelf: "stretch" },
  footerCount: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.md,
  },
});
