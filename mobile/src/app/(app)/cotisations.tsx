import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyCotisationLines,
  getMyCotisationYear,
} from "@/api/cotisations";
import { getActivePaymentAccount } from "@/api/payment-account";
import type { ActivePaymentAccountDto } from "@/api/payment-account-state";
import {
  canShowPayButton,
  getPaymentCardActions,
  isWeroAvailable,
  NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE,
} from "@/api/payment-account-state";
import { mapCotisationStatut } from "@/api/cotisation-display";
import {
  COTISATION_SECTION_TITLES,
  cotisationErrorMessage,
  filterAssistancesByMonth,
  filterCotisationsByMonth,
  formatAssistanceMonthLabel,
  formatAssistanceTitle,
  formatIsoDate,
  mapFinanceStatutDisplay,
  MOIS_FILTER_ALL,
  MOIS_LABELS_SHORT,
  shouldShowAvoir,
} from "@/api/cotisations-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import {
  ApiClientError,
  type MyAssistanceDto,
  type MyCotisationLineDto,
  type MyCotisationYearDto,
  type MyCotisationYearItemDto,
  type MyCotisationYearSummaryDto,
  type MyDebtDto,
} from "@/api/types";
import {
  DeclarePaymentModal,
  type PaymentMethodChoice,
  type PaymentTarget,
} from "@/components/cotisations/DeclarePaymentModal";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyDecimalString } from "@/utils/money";
import { isZeroDecimalString } from "@/utils/decimal-string";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ScreenMode = "loading" | "data" | "error";
type YearMode = "year" | "all";
type SectionAccent = "summary" | "debt" | "cotisation" | "assistance" | "payment";

const LINES_PAGE_SIZE = 20;

/**
 * Écran Mes cotisations — synthèse + lignes + Payer à la demande.
 */
export default function CotisationsScreen() {
  const currentYear = new Date().getFullYear();
  const [yearMode, setYearMode] = useState<YearMode>("year");
  const [annee, setAnnee] = useState(currentYear);
  const [moisFilter, setMoisFilter] = useState(MOIS_FILTER_ALL);
  const [yearData, setYearData] = useState<MyCotisationYearDto | null>(null);
  const [allLines, setAllLines] = useState<MyCotisationLineDto[]>([]);
  const [allSummary, setAllSummary] =
    useState<MyCotisationYearSummaryDto | null>(null);
  const [allTotal, setAllTotal] = useState(0);
  const [allOffset, setAllOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paymentAccount, setPaymentAccount] =
    useState<ActivePaymentAccountDto | null>(null);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethodChoice | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasDataRef = useRef(false);

  const loadYear = useCallback(async (year: number, isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) setRefreshing(true);
    else if (!hasDataRef.current) setMode("loading");
    setError(null);

    try {
      const data = await getMyCotisationYear(year);
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setYearData(data);
      setAllLines([]);
      setAllSummary(null);
      hasDataRef.current = true;
      setMode("data");
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      const message =
        e instanceof ApiClientError
          ? cotisationErrorMessage(e)
          : "Impossible de charger les cotisations";
      setError(message);
      if (!hasDataRef.current) setMode("error");
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) setRefreshing(false);
    }
  }, []);

  const loadAllYears = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) setRefreshing(true);
    else if (!hasDataRef.current) setMode("loading");
    setError(null);

    try {
      const page = await getMyCotisationLines({
        limit: LINES_PAGE_SIZE,
        offset: 0,
      });
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setAllLines(page.items);
      setAllSummary(page.summary);
      setAllTotal(page.total);
      setAllOffset(page.items.length);
      setYearData(null);
      hasDataRef.current = true;
      setMode("data");
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      const message =
        e instanceof ApiClientError
          ? cotisationErrorMessage(e)
          : "Impossible de charger les cotisations";
      setError(message);
      if (!hasDataRef.current) setMode("error");
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) setRefreshing(false);
    }
  }, []);

  const loadMoreAllYears = useCallback(async () => {
    if (loadingMore || allLines.length >= allTotal) return;
    setLoadingMore(true);
    try {
      const page = await getMyCotisationLines({
        limit: LINES_PAGE_SIZE,
        offset: allOffset,
      });
      setAllLines((prev) => [...prev, ...page.items]);
      setAllOffset((prev) => prev + page.items.length);
      setAllTotal(page.total);
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? cotisationErrorMessage(e)
          : "Impossible de charger la suite";
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  }, [allLines.length, allOffset, allTotal, loadingMore]);

  useEffect(() => {
    if (yearMode === "year") {
      void loadYear(annee, false);
    } else {
      void loadAllYears(false);
    }
  }, [annee, yearMode, loadYear, loadAllYears]);

  const filteredCotisations = useMemo(
    () => filterCotisationsByMonth(yearData?.cotisations ?? [], moisFilter),
    [yearData?.cotisations, moisFilter]
  );

  const filteredAssistances = useMemo(
    () => filterAssistancesByMonth(yearData?.assistances ?? [], moisFilter),
    [yearData?.assistances, moisFilter]
  );

  const summary =
    yearMode === "all" ? allSummary : yearData?.summary ?? null;

  const openPayment = (method: PaymentMethodChoice, target: PaymentTarget) => {
    setPayMethod(method);
    setPayTarget(target);
  };

  const closePayment = () => {
    setPayMethod(null);
    setPayTarget(null);
  };

  const refresh = () => {
    if (yearMode === "year") void loadYear(annee, true);
    else void loadAllYears(true);
  };

  /**
   * Charge le compte actif uniquement au clic Payer, puis propose Wero/Virement.
   */
  const handlePay = async (target: PaymentTarget) => {
    try {
      let account = paymentAccount;
      if (!account) {
        account = await getActivePaymentAccount().catch(() => null);
        setPaymentAccount(account);
      }
      if (!account) {
        Alert.alert("Paiement", NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE);
        return;
      }

      const actions = getPaymentCardActions(account);
      const buttons: {
        text: string;
        onPress?: () => void;
        style?: "cancel" | "default" | "destructive";
      }[] = [];

      if (actions.showWeroButton && isWeroAvailable(account)) {
        buttons.push({
          text: "Wero",
          onPress: () => openPayment("Wero", target),
        });
      }
      buttons.push({
        text: "Virement",
        onPress: () => openPayment("Virement", target),
      });
      buttons.push({ text: "Annuler", style: "cancel" });

      Alert.alert(
        "Payer",
        "Choisissez le moyen de paiement (hors AMAKI), puis déclarez avec justificatif.",
        buttons
      );
    } catch {
      Alert.alert("Paiement", NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE);
    }
  };

  if (mode === "loading" && !hasDataRef.current) return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={AmakiColors.primary}
          />
        }
      >
        <Text style={styles.screenTitle}>Mes cotisations</Text>
        <Text style={styles.screenSubtitle}>
          Situation financière. Les paiements Wero/virement sont vérifiés par
          l'association.
        </Text>

        <View style={styles.yearModeRow}>
          <Pressable
            onPress={() => setYearMode("year")}
            style={[
              styles.yearModeChip,
              yearMode === "year" && styles.yearModeChipSelected,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: yearMode === "year" }}
          >
            <Text
              style={[
                styles.yearModeText,
                yearMode === "year" && styles.yearModeTextSelected,
              ]}
            >
              Par année
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setYearMode("all")}
            style={[
              styles.yearModeChip,
              yearMode === "all" && styles.yearModeChipSelected,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: yearMode === "all" }}
          >
            <Text
              style={[
                styles.yearModeText,
                yearMode === "all" && styles.yearModeTextSelected,
              ]}
            >
              Toutes les années
            </Text>
          </Pressable>
        </View>

        {yearMode === "year" ? (
          <View style={styles.yearRow}>
            <SecondaryButton
              label="‹"
              onPress={() => setAnnee((y) => y - 1)}
              disabled={annee <= currentYear - 5}
              style={styles.yearBtn}
              accessibilityLabel="Année précédente"
            />
            <Text style={styles.yearLabel} accessibilityRole="header">
              {annee}
            </Text>
            <SecondaryButton
              label="›"
              onPress={() => setAnnee((y) => y + 1)}
              disabled={annee >= currentYear + 1}
              style={styles.yearBtn}
              accessibilityLabel="Année suivante"
            />
          </View>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}
        {successBanner ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successBanner}</Text>
            <Text style={styles.successSub}>En attente de validation</Text>
          </View>
        ) : null}

        {summary ? (
          <Card muted style={[styles.summaryCard, accentStyle("summary")]}>
            <Text style={styles.sectionTitleInCard}>
              {COTISATION_SECTION_TITLES.synthese}
            </Text>
            <SummaryRow
              label="Reste à payer (net)"
              value={formatMoneyDecimalString(summary.resteNet)}
              emphasize
            />
            <SummaryRow
              label="Dette brute"
              value={formatMoneyDecimalString(summary.detteBrute)}
            />
            {shouldShowAvoir(summary.avoirDisponible) ? (
              <SummaryRow
                label="Avoir disponible"
                value={formatMoneyDecimalString(summary.avoirDisponible)}
              />
            ) : null}
            <SummaryRow
              label={
                yearMode === "year" ? `Payé en ${annee}` : "Payé (total validé)"
              }
              value={formatMoneyDecimalString(summary.totalPayeAnnee)}
            />
          </Card>
        ) : null}

        {yearMode === "all" ? (
          <>
            <SectionHeader
              title="Toutes les cotisations"
              accent="cotisation"
            />
            {allLines.length === 0 ? (
              <Card muted style={accentStyle("cotisation")}>
                <Text style={styles.emptyText}>Aucune ligne</Text>
              </Card>
            ) : (
              allLines.map((line) => (
                <AllYearsLineCard
                  key={`${line.kind}-${line.id}`}
                  line={line}
                  onPay={handlePay}
                />
              ))
            )}
            {allLines.length < allTotal ? (
              <SecondaryButton
                label={loadingMore ? "Chargement…" : "Voir plus"}
                onPress={() => void loadMoreAllYears()}
                disabled={loadingMore}
                style={styles.loadMoreBtn}
              />
            ) : null}
          </>
        ) : (
          <>
            <SectionHeader
              title={COTISATION_SECTION_TITLES.dettes}
              accent="debt"
            />
            {(yearData?.dettes.length ?? 0) === 0 ? (
              <Card muted style={accentStyle("debt")}>
                <Text style={styles.emptyText}>Aucune dette antérieure</Text>
              </Card>
            ) : (
              yearData!.dettes.map((d) => (
                <DebtCard key={d.id} debt={d} onPay={handlePay} />
              ))
            )}

            <SectionHeader
              title={COTISATION_SECTION_TITLES.cotisations}
              accent="cotisation"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthFilters}
            >
              <MonthChip
                label="Tous les mois"
                selected={moisFilter === MOIS_FILTER_ALL}
                onPress={() => setMoisFilter(MOIS_FILTER_ALL)}
              />
              {MOIS_LABELS_SHORT.map((label, i) => (
                <MonthChip
                  key={label}
                  label={label}
                  selected={moisFilter === i + 1}
                  onPress={() => setMoisFilter(i + 1)}
                />
              ))}
            </ScrollView>

            {filteredCotisations.length === 0 ? (
              <Card muted style={accentStyle("cotisation")}>
                <Text style={styles.emptyText}>
                  Aucune cotisation pour cette période.
                </Text>
              </Card>
            ) : (
              filteredCotisations.map((c) => (
                <CotisationYearCard key={c.id} item={c} onPay={handlePay} />
              ))
            )}

            <SectionHeader
              title={COTISATION_SECTION_TITLES.assistances}
              accent="assistance"
            />
            {filteredAssistances.length === 0 ? (
              <Card muted style={accentStyle("assistance")}>
                <Text style={styles.emptyText}>Aucune assistance</Text>
              </Card>
            ) : (
              filteredAssistances.map((a) => (
                <AssistanceCard
                  key={`${a.source}-${a.id}`}
                  item={a}
                  onPay={handlePay}
                />
              ))
            )}
          </>
        )}

        <SectionHeader
          title={COTISATION_SECTION_TITLES.historique}
          accent="payment"
        />
        <Card muted style={[styles.card, accentStyle("payment")]}>
          <Text style={styles.meta}>
            Consultez vos versements (Wero, virement…) à la demande.
          </Text>
          <SecondaryButton
            label="Voir l'historique"
            onPress={() =>
              router.push({
                pathname: "/cotisations-historique",
                params:
                  yearMode === "year" ? { annee: String(annee) } : undefined,
              })
            }
            style={styles.historyBtn}
          />
        </Card>
      </ScrollView>

      {paymentAccount && payMethod && payTarget ? (
        <DeclarePaymentModal
          visible
          account={paymentAccount}
          method={payMethod}
          target={payTarget}
          payableTargets={[payTarget]}
          onClose={closePayment}
          onSuccess={(message) => {
            setSuccessBanner(message);
            refresh();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function accentStyle(accent: SectionAccent) {
  return {
    borderLeftWidth: 4,
    borderLeftColor: ACCENT_COLORS[accent],
  };
}

const ACCENT_COLORS: Record<SectionAccent, string> = {
  summary: AmakiColors.primaryStrong,
  debt: AmakiColors.danger,
  cotisation: AmakiColors.primary,
  assistance: AmakiColors.accent,
  payment: AmakiColors.textSecondary,
};

function SectionHeader({
  title,
  accent,
}: {
  title: string;
  accent: SectionAccent;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionAccentBar,
          { backgroundColor: ACCENT_COLORS[accent] },
        ]}
        accessibilityElementsHidden
      />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, emphasize && styles.summaryEmphasize]}>
        {value}
      </Text>
    </View>
  );
}

function MonthChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PayButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.payButton}
      accessibilityRole="button"
      accessibilityLabel="Payer"
    >
      <SymbolView
        name={{
          ios: "creditcard.fill",
          android: "payments",
          web: "payments",
        }}
        size={16}
        tintColor="#fff"
        weight="medium"
      />
      <Text style={styles.payButtonText}>Payer</Text>
    </Pressable>
  );
}

function PayRow({
  montantRestant,
  hasPendingPayment,
  onPay,
}: {
  montantRestant: string;
  hasPendingPayment: boolean;
  onPay: () => void;
}) {
  if (hasPendingPayment) {
    return (
      <Text style={styles.pendingHint}>Paiement en attente de validation</Text>
    );
  }
  if (!canShowPayButton(montantRestant, false)) return null;
  return <PayButton onPress={onPay} />;
}

function CotisationYearCard({
  item,
  onPay,
}: {
  item: MyCotisationYearItemDto;
  onPay: (t: PaymentTarget) => void;
}) {
  const statut = mapCotisationStatut(item.statut);
  const restantNonNul = !isZeroDecimalString(item.montantRestant);

  return (
    <Card style={[styles.card, accentStyle("cotisation")]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {MOIS_LABELS_SHORT[item.mois - 1] ?? item.periode} —{" "}
          {item.typeCotisation.nom}
        </Text>
        <StatusBadge label={statut.label} tone={statut.tone} />
      </View>
      <Text style={styles.meta}>
        Échéance : {formatIsoDate(item.dateEcheance)}
      </Text>
      <View style={styles.amounts}>
        <Amount label="Attendu" value={item.montantAttendu} />
        <Amount label="Payé" value={item.montantPaye} />
        <Amount
          label="Reste"
          value={item.montantRestant}
          highlight={restantNonNul}
        />
      </View>
      <PayRow
        montantRestant={item.montantRestant}
        hasPendingPayment={item.hasPendingPayment}
        onPay={() =>
          onPay({
            targetType: "cotisation-mensuelle",
            targetId: item.id,
            label: `${MOIS_LABELS_SHORT[item.mois - 1] ?? item.periode} — ${item.typeCotisation.nom}`,
            restant: item.montantRestant,
          })
        }
      />
    </Card>
  );
}

function DebtCard({
  debt,
  onPay,
}: {
  debt: MyDebtDto;
  onPay: (t: PaymentTarget) => void;
}) {
  const restantNonNul = !isZeroDecimalString(debt.montantRestant);
  return (
    <Card style={[styles.card, accentStyle("debt")]}>
      <Text style={styles.cardTitle}>Dette {debt.annee}</Text>
      {debt.description ? (
        <Text style={styles.meta}>{debt.description}</Text>
      ) : null}
      <View style={styles.amounts}>
        <Amount label="Initial" value={debt.montant} />
        <Amount label="Payé" value={debt.montantPaye} />
        <Amount
          label="Reste"
          value={debt.montantRestant}
          highlight={restantNonNul}
        />
      </View>
      <PayRow
        montantRestant={debt.montantRestant}
        hasPendingPayment={debt.hasPendingPayment}
        onPay={() =>
          onPay({
            targetType: "dette-initiale",
            targetId: debt.id,
            label: `Dette ${debt.annee}`,
            restant: debt.montantRestant,
          })
        }
      />
    </Card>
  );
}

function AssistanceCard({
  item,
  onPay,
}: {
  item: MyAssistanceDto;
  onPay: (t: PaymentTarget) => void;
}) {
  const restantNonNul = !isZeroDecimalString(item.montantRestant);
  const statut = mapFinanceStatutDisplay(item.statut);
  const title = formatAssistanceTitle(item);
  const monthLabel = formatAssistanceMonthLabel(item);

  return (
    <Card
      style={[styles.card, accentStyle("assistance")]}
      accessibilityLabel={`${monthLabel}. ${title}`}
    >
      <Text style={styles.metaStrong}>{monthLabel}</Text>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <StatusBadge label={statut.label} tone={statut.tone} />
      </View>
      <View style={styles.amounts}>
        <Amount label="Attendu" value={item.montantAttendu} />
        <Amount label="Payé" value={item.montantPaye} />
        <Amount
          label="Reste"
          value={item.montantRestant}
          highlight={restantNonNul}
        />
      </View>
      <PayRow
        montantRestant={item.montantRestant}
        hasPendingPayment={item.hasPendingPayment}
        onPay={() =>
          onPay({
            targetType: item.paymentTargetType,
            targetId: item.id,
            label: title,
            restant: item.montantRestant,
          })
        }
      />
    </Card>
  );
}

function AllYearsLineCard({
  line,
  onPay,
}: {
  line: MyCotisationLineDto;
  onPay: (t: PaymentTarget) => void;
}) {
  const restantNonNul = !isZeroDecimalString(line.montantRestant);
  const statut = mapFinanceStatutDisplay(line.statut);
  const period =
    line.mois != null
      ? `${MOIS_LABELS_SHORT[line.mois - 1] ?? line.mois} ${line.annee}`
      : String(line.annee);

  return (
    <Card style={[styles.card, accentStyle("cotisation")]}>
      <Text style={styles.metaStrong}>{period}</Text>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{line.label}</Text>
        <StatusBadge label={statut.label} tone={statut.tone} />
      </View>
      <View style={styles.amounts}>
        <Amount label="Attendu" value={line.montantAttendu} />
        <Amount label="Payé" value={line.montantPaye} />
        <Amount
          label="Reste"
          value={line.montantRestant}
          highlight={restantNonNul}
        />
      </View>
      <PayRow
        montantRestant={line.montantRestant}
        hasPendingPayment={line.hasPendingPayment}
        onPay={() =>
          onPay({
            targetType: line.paymentTargetType,
            targetId: line.paymentTargetId,
            label: line.label,
            restant: line.montantRestant,
          })
        }
      />
    </Card>
  );
}

function Amount({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.amountBlock}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, highlight && styles.restantValue]}>
        {formatMoneyDecimalString(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AmakiColors.background },
  container: {
    padding: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  screenTitle: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  screenSubtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.lg,
  },
  yearModeRow: {
    flexDirection: "row",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.md,
  },
  yearModeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    backgroundColor: AmakiColors.surface,
    alignItems: "center",
  },
  yearModeChipSelected: {
    backgroundColor: AmakiColors.primary,
    borderColor: AmakiColors.primary,
  },
  yearModeText: { ...AmakiTypography.caption, color: AmakiColors.text },
  yearModeTextSelected: { color: "#fff", fontWeight: "700" },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: AmakiSpacing.md,
    gap: AmakiSpacing.sm,
  },
  yearBtn: { minWidth: 48, paddingHorizontal: AmakiSpacing.md },
  yearLabel: { ...AmakiTypography.heading, color: AmakiColors.text },
  summaryCard: { marginBottom: AmakiSpacing.lg },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
    marginTop: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.sm,
  },
  sectionAccentBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    flex: 1,
  },
  sectionTitleInCard: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: AmakiSpacing.xs,
  },
  summaryLabel: { ...AmakiTypography.caption, color: AmakiColors.textSecondary },
  summaryValue: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "600",
  },
  summaryEmphasize: { color: AmakiColors.primaryStrong, fontWeight: "700" },
  monthFilters: { gap: AmakiSpacing.xs, paddingBottom: AmakiSpacing.sm },
  chip: {
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    marginRight: AmakiSpacing.xs,
    backgroundColor: AmakiColors.surface,
  },
  chipSelected: {
    backgroundColor: AmakiColors.primary,
    borderColor: AmakiColors.primary,
  },
  chipText: { ...AmakiTypography.caption, color: AmakiColors.text },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  card: {
    marginBottom: AmakiSpacing.sm,
    backgroundColor: AmakiColors.surface,
    borderColor: AmakiColors.primaryBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
    alignItems: "flex-start",
    marginBottom: 4,
  },
  cardTitle: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
    flex: 1,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 2,
  },
  pendingHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.warning,
    marginTop: 8,
    fontWeight: "600",
  },
  metaStrong: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontWeight: "700",
    marginBottom: 2,
  },
  amounts: {
    flexDirection: "row",
    marginTop: AmakiSpacing.sm,
    gap: AmakiSpacing.sm,
  },
  amountBlock: { flex: 1 },
  amountLabel: { ...AmakiTypography.caption, color: AmakiColors.textMuted },
  amountValue: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
  },
  restantValue: { color: AmakiColors.danger },
  payButton: {
    marginTop: AmakiSpacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AmakiColors.primary,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 40,
  },
  payButtonText: {
    ...AmakiTypography.caption,
    color: "#fff",
    fontWeight: "700",
  },
  historyBtn: { marginTop: AmakiSpacing.sm, alignSelf: "stretch" },
  loadMoreBtn: { marginVertical: AmakiSpacing.md, alignSelf: "stretch" },
  successBanner: {
    backgroundColor: AmakiColors.surface,
    borderColor: AmakiColors.primaryBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
  },
  successText: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    fontWeight: "700",
  },
  successSub: {
    ...AmakiTypography.caption,
    color: AmakiColors.primaryStrong,
    marginTop: 4,
    fontWeight: "600",
  },
  emptyText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
});
