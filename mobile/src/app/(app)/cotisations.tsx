import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyCotisationYear } from "@/api/cotisations";
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
  mapMoyenPaiement,
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
  type MyCotisationYearDto,
  type MyCotisationYearItemDto,
  type MyDebtDto,
  type MyPaymentDto,
} from "@/api/types";
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

type SectionAccent = "summary" | "debt" | "cotisation" | "assistance" | "payment";

/**
 * Écran Mes cotisations — vue financière annuelle lecture seule (Phase A).
 */
export default function CotisationsScreen() {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [moisFilter, setMoisFilter] = useState(MOIS_FILTER_ALL);
  const [yearData, setYearData] = useState<MyCotisationYearDto | null>(null);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasDataRef = useRef(false);

  const load = useCallback(async (year: number, isRefresh = false) => {
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

  useEffect(() => {
    void load(annee, false);
  }, [annee, load]);

  const filteredCotisations = useMemo(
    () => filterCotisationsByMonth(yearData?.cotisations ?? [], moisFilter),
    [yearData?.cotisations, moisFilter]
  );

  const filteredAssistances = useMemo(
    () => filterAssistancesByMonth(yearData?.assistances ?? [], moisFilter),
    [yearData?.assistances, moisFilter]
  );

  if (mode === "loading" && !yearData) return <LoadingState />;

  const summary = yearData?.summary;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(annee, true)}
            tintColor={AmakiColors.primary}
          />
        }
      >
        <Text style={styles.screenTitle}>Mes cotisations</Text>
        <Text style={styles.screenSubtitle}>
          Consultation de votre situation financière. Lecture seule.
        </Text>

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

        {error ? <ErrorBanner message={error} /> : null}

        {/* 1. Synthèse */}
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
              label={`Payé en ${annee}`}
              value={formatMoneyDecimalString(summary.totalPayeAnnee)}
            />
          </Card>
        ) : null}

        {/* 2. Dettes antérieures */}
        <SectionHeader title={COTISATION_SECTION_TITLES.dettes} accent="debt" />
        {(yearData?.dettes.length ?? 0) === 0 ? (
          <Card muted style={accentStyle("debt")}>
            <Text style={styles.emptyText}>Aucune dette antérieure</Text>
          </Card>
        ) : (
          yearData!.dettes.map((d) => <DebtCard key={d.id} debt={d} />)
        )}

        {/* 3. Cotisation mensuelle forfaitaire */}
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
            label="Tous"
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
            <CotisationYearCard
              key={c.id}
              item={c}
              expanded={expandedId === c.id}
              onToggle={() =>
                setExpandedId((id) => (id === c.id ? null : c.id))
              }
            />
          ))
        )}

        {/* 4. Assistances */}
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
            <AssistanceCard key={`${a.source}-${a.id}`} item={a} />
          ))
        )}

        {/* 5. Historique des paiements */}
        <SectionHeader
          title={COTISATION_SECTION_TITLES.historique}
          accent="payment"
        />
        {(yearData?.paiements.length ?? 0) === 0 ? (
          <Card muted style={accentStyle("payment")}>
            <Text style={styles.emptyText}>Aucun paiement en {annee}</Text>
          </Card>
        ) : (
          yearData!.paiements.map((p) => <PaymentCard key={p.id} payment={p} />)
        )}
      </ScrollView>
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
        style={[styles.sectionAccentBar, { backgroundColor: ACCENT_COLORS[accent] }]}
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

function CotisationYearCard({
  item,
  expanded,
  onToggle,
}: {
  item: MyCotisationYearItemDto;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statut = mapCotisationStatut(item.statut);
  const restantNonNul = !isZeroDecimalString(item.montantRestant);
  const hasPayments = (item.paiements?.length ?? 0) > 0;

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
        <Amount label="Reste" value={item.montantRestant} highlight={restantNonNul} />
      </View>
      {hasPayments ? (
        <Pressable onPress={onToggle} accessibilityRole="button">
          <Text style={styles.link}>
            {expanded
              ? "Masquer les versements"
              : `Versements (${item.paiements.length})`}
          </Text>
        </Pressable>
      ) : null}
      {expanded
        ? item.paiements.map((p) => (
            <Text key={p.id} style={styles.paymentLine}>
              {formatIsoDate(p.datePaiement)} —{" "}
              {formatMoneyDecimalString(p.montant)} —{" "}
              {mapMoyenPaiement(p.moyenPaiement)}
            </Text>
          ))
        : null}
    </Card>
  );
}

function DebtCard({ debt }: { debt: MyDebtDto }) {
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
        <Amount label="Reste" value={debt.montantRestant} highlight={restantNonNul} />
      </View>
    </Card>
  );
}

function AssistanceCard({ item }: { item: MyAssistanceDto }) {
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
        <Amount label="Reste" value={item.montantRestant} highlight={restantNonNul} />
      </View>
    </Card>
  );
}

function PaymentCard({ payment }: { payment: MyPaymentDto }) {
  const statut = mapFinanceStatutDisplay(payment.statut);
  return (
    <Card style={[styles.card, accentStyle("payment")]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{payment.destinationLabel}</Text>
        <StatusBadge label={statut.label} tone={statut.tone} />
      </View>
      <Text style={styles.meta}>
        {formatIsoDate(payment.datePaiement)} ·{" "}
        {mapMoyenPaiement(payment.moyenPaiement)}
      </Text>
      <Text style={styles.paymentAmount}>
        {formatMoneyDecimalString(payment.montant)}
      </Text>
      {payment.reference ? (
        <Text style={styles.meta}>Réf. {payment.reference}</Text>
      ) : null}
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
  link: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    marginTop: AmakiSpacing.sm,
    fontWeight: "600",
  },
  paymentLine: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 4,
  },
  paymentAmount: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
});
