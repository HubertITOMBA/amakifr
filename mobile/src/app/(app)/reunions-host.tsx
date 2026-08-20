import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyReunionYear,
  proposeMyselfAsReunionHost,
  withdrawMyReunionHostProposal,
} from "@/api/reunions";
import {
  formatYearMonthDate,
  formatYearMonthHost,
  HOST_WITHDRAW_BLOCKED_BY_28_DAYS_MESSAGE,
  hostProposalErrorMessage,
  hostWithdrawErrorMessage,
  mapYearMonthStatusLabel,
  reunionsErrorMessage,
  shouldShowHostWithdrawBlockedBy28DaysMessage,
} from "@/api/reunions-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import {
  ApiClientError,
  type MyReunionYearDto,
  type MyReunionYearMonthDto,
} from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ScreenMode = "loading" | "data" | "error";

/**
 * Écran Accueillir une réunion — calendrier annuel + proposition d'hôte.
 */
export default function ReunionsHostScreen() {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [yearData, setYearData] = useState<MyReunionYearDto | null>(null);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingMonth, setSubmittingMonth] = useState<number | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (year: number, isRefresh = false) => {
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;

      if (isRefresh) setRefreshing(true);
      else setMode("loading");
      setError(null);

      try {
        const data = await getMyReunionYear(year);
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setYearData(data);
        hasDataRef.current = true;
        setMode("data");
      } catch (e) {
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        const message =
          e instanceof ApiClientError
            ? reunionsErrorMessage(e)
            : "Impossible de charger le calendrier";
        setError(message);
        if (!hasDataRef.current) setMode("error");
      } finally {
        const ended = endLoad(guardRef.current);
        guardRef.current = ended.guard;
        if (ended.clearSpinners) setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(annee, false);
  }, [annee, load]);

  const confirmPropose = (month: MyReunionYearMonthDto) => {
    Alert.alert(
      "Se proposer comme hôte",
      `Vous souhaitez accueillir la réunion de ${month.monthLabel.toLowerCase()} ${month.annee} ?\n\nUne proposition est soumise à validation de l'administrateur.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: () => void handlePropose(month),
        },
      ]
    );
  };

  const handlePropose = async (month: MyReunionYearMonthDto) => {
    if (submittingMonth !== null) return;
    setSubmittingMonth(month.mois);
    setError(null);
    try {
      await proposeMyselfAsReunionHost({
        annee: month.annee,
        mois: month.mois,
      });
      Alert.alert(
        "Proposition enregistrée",
        "Votre proposition a été enregistrée et sera soumise à validation."
      );
      await load(annee, true);
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? hostProposalErrorMessage(e)
          : "Impossible d'enregistrer votre proposition";
      setError(message);
    } finally {
      setSubmittingMonth(null);
    }
  };

  const confirmWithdraw = (month: MyReunionYearMonthDto) => {
    Alert.alert(
      "Se désister",
      "Vous ne serez plus l'hôte de cette réunion. Le mois pourra être proposé à un autre adhérent.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: () => void handleWithdraw(month),
        },
      ]
    );
  };

  const handleWithdraw = async (month: MyReunionYearMonthDto) => {
    if (submittingMonth !== null || !month.reunionId) return;
    setSubmittingMonth(month.mois);
    setError(null);
    try {
      await withdrawMyReunionHostProposal(month.reunionId);
      Alert.alert(
        "Désistement enregistré",
        "Vous n'êtes plus l'hôte de cette réunion. Le mois est à nouveau disponible."
      );
      await load(annee, true);
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? hostWithdrawErrorMessage(e)
          : "Impossible d'enregistrer votre désistement";
      setError(message);
    } finally {
      setSubmittingMonth(null);
    }
  };

  if (mode === "loading" && !yearData) return <LoadingState />;

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
        <Text style={styles.screenTitle}>Accueillir une réunion</Text>
        <Text style={styles.screenSubtitle}>
          Choisissez un mois disponible. Une proposition est soumise à
          validation administrative. Un seul accueil par année en
          self-service.
        </Text>

        <View style={styles.yearRow}>
          <SecondaryButton
            label="‹"
            onPress={() => setAnnee((y) => y - 1)}
            disabled={annee <= currentYear - 1 || submittingMonth !== null}
            style={styles.yearBtn}
            accessibilityLabel="Année précédente"
          />
          <Text style={styles.yearLabel} accessibilityRole="header">
            Année {annee}
          </Text>
          <SecondaryButton
            label="›"
            onPress={() => setAnnee((y) => y + 1)}
            disabled={annee >= currentYear + 1 || submittingMonth !== null}
            style={styles.yearBtn}
            accessibilityLabel="Année suivante"
          />
        </View>

        {yearData?.alreadyHostThisYear ? (
          <Card muted style={styles.infoCard}>
            <Text style={styles.infoText}>
              Vous êtes déjà hôte d&apos;une réunion en {annee}.
            </Text>
          </Card>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        {mode === "error" && !yearData ? (
          <Card muted>
            <Text style={styles.emptyText}>
              Impossible d&apos;afficher le calendrier pour le moment.
            </Text>
          </Card>
        ) : null}

        {yearData?.months.map((month) => (
          <MonthCard
            key={`${month.annee}-${month.mois}`}
            month={month}
            submitting={submittingMonth === month.mois}
            disabled={submittingMonth !== null}
            onPropose={() => confirmPropose(month)}
            onWithdraw={() => confirmWithdraw(month)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

type MonthCardProps = {
  month: MyReunionYearMonthDto;
  submitting: boolean;
  disabled: boolean;
  onPropose: () => void;
  onWithdraw: () => void;
};

function MonthCard({
  month,
  submitting,
  disabled,
  onPropose,
  onWithdraw,
}: MonthCardProps) {
  const status = mapYearMonthStatusLabel(month.statusLabel);
  const dateLabel = formatYearMonthDate(month);
  const hostLabel = formatYearMonthHost(month);

  return (
    <Card style={styles.card}>
      <View
        accessible
        accessibilityLabel={`${month.monthLabel}, date ${dateLabel}, hôte ${hostLabel}, statut ${status.label}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.monthTitle}>{month.monthLabel}</Text>
          <StatusBadge label={status.label} tone={status.tone} />
        </View>
        <Text style={styles.meta}>Date : {dateLabel}</Text>
        <Text style={styles.meta}>Hôte : {hostLabel}</Text>
        {month.isCurrentUserHost ? (
          <View style={styles.badgeSelf}>
            <StatusBadge label="Vous êtes l'hôte" tone="primary" />
          </View>
        ) : null}
        {shouldShowHostWithdrawBlockedBy28DaysMessage(month) ? (
          <Text style={styles.withdrawBlockedHint}>
            {HOST_WITHDRAW_BLOCKED_BY_28_DAYS_MESSAGE}
          </Text>
        ) : null}
      </View>

      {month.canProposeAsHost ? (
        <PrimaryButton
          label="Se proposer"
          loading={submitting}
          disabled={disabled}
          onPress={onPropose}
          style={styles.proposeBtn}
          accessibilityLabel={`Se proposer comme hôte pour ${month.monthLabel}`}
        />
      ) : null}

      {month.isCurrentUserHost && month.canWithdrawAsHost ? (
        <SecondaryButton
          label="Se désister"
          variant="danger"
          loading={submitting}
          disabled={disabled}
          onPress={onWithdraw}
          style={styles.proposeBtn}
          accessibilityLabel={`Se désister comme hôte pour ${month.monthLabel}`}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AmakiColors.background,
  },
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
  yearBtn: {
    minWidth: 48,
    paddingHorizontal: AmakiSpacing.md,
  },
  yearLabel: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
  },
  infoCard: {
    marginBottom: AmakiSpacing.md,
  },
  infoText: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "600",
  },
  emptyText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
  card: {
    marginBottom: AmakiSpacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xs,
  },
  monthTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    flex: 1,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 2,
  },
  badgeSelf: {
    marginTop: AmakiSpacing.sm,
  },
  withdrawBlockedHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.sm,
  },
  proposeBtn: {
    marginTop: AmakiSpacing.md,
  },
});
