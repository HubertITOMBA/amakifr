import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyReunions,
  updateMyReunionParticipation,
} from "@/api/reunions";
import {
  formatReunionDateTime,
  mapParticipationStatut,
  mapReunionStatut,
  participationErrorMessage,
  reunionsErrorMessage,
  splitReunionsByTime,
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
  type MyReunionDto,
  type UpdateMyReunionParticipationInput,
} from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ScreenMode = "loading" | "data" | "empty" | "error";

const PARTICIPATION_CHOICES: Array<{
  statut: UpdateMyReunionParticipationInput["statut"];
  label: string;
}> = [
  { statut: "Present", label: "Présent" },
  { statut: "Absent", label: "Absent" },
  { statut: "Excuse", label: "Excusé" },
];

/**
 * Écran Les réunions — calendrier collectif + participation self-service.
 */
export default function ReunionsScreen() {
  const [reunions, setReunions] = useState<MyReunionDto[]>([]);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasDataRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) setRefreshing(true);
    else setMode("loading");
    setError(null);

    try {
      const data = await getMyReunions();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setReunions(data);
      hasDataRef.current = data.length > 0;
      setMode(data.length > 0 ? "data" : "empty");
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      const message =
        e instanceof ApiClientError
          ? reunionsErrorMessage(e)
          : "Impossible de charger les réunions";
      setError(message);
      if (!hasDataRef.current) {
        setMode("error");
      }
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleParticipationUpdate = useCallback(
    (reunionId: string, statut: UpdateMyReunionParticipationInput["statut"]) => {
      setReunions((prev) =>
        prev.map((r) =>
          r.id === reunionId ? { ...r, participationStatus: statut } : r
        )
      );
    },
    []
  );

  const { upcoming, past } = useMemo(
    () => splitReunionsByTime(reunions),
    [reunions]
  );

  if (mode === "loading") return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
      >
        <Text style={styles.screenTitle}>Les réunions</Text>
        <Text style={styles.screenSubtitle}>
          Calendrier collectif des réunions mensuelles de l&apos;association.
        </Text>

        {error ? <ErrorBanner message={error} /> : null}

        {mode === "empty" ? (
          <Card muted>
            <Text style={styles.emptyText}>Aucune réunion à afficher.</Text>
          </Card>
        ) : null}

        {mode === "error" && reunions.length === 0 ? (
          <Card muted>
            <Text style={styles.emptyText}>
              Impossible d&apos;afficher les réunions pour le moment.
            </Text>
          </Card>
        ) : null}

        {mode === "data" || reunions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>À venir</Text>
            {upcoming.length === 0 ? (
              <Card muted style={styles.sectionCard}>
                <Text style={styles.emptyText}>Aucune réunion à venir.</Text>
              </Card>
            ) : (
              upcoming.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  expanded={expandedId === r.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === r.id ? null : r.id))
                  }
                  onParticipationSuccess={handleParticipationUpdate}
                  onReload={() => void load(true)}
                />
              ))
            )}

            <Text style={styles.sectionTitle}>Historique</Text>
            {past.length === 0 ? (
              <Card muted style={styles.sectionCard}>
                <Text style={styles.emptyText}>Aucun historique.</Text>
              </Card>
            ) : (
              past.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  expanded={expandedId === r.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === r.id ? null : r.id))
                  }
                  onParticipationSuccess={handleParticipationUpdate}
                  onReload={() => void load(true)}
                />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type ReunionCardProps = {
  reunion: MyReunionDto;
  expanded: boolean;
  onToggle: () => void;
  onParticipationSuccess: (
    reunionId: string,
    statut: UpdateMyReunionParticipationInput["statut"]
  ) => void;
  onReload: () => void;
};

function ReunionCard({
  reunion,
  expanded,
  onToggle,
  onParticipationSuccess,
  onReload,
}: ReunionCardProps) {
  const statut = mapReunionStatut(reunion.statut);
  const participation = mapParticipationStatut(reunion.participationStatus);
  const [submitting, setSubmitting] = useState<
    UpdateMyReunionParticipationInput["statut"] | null
  >(null);
  const [participationError, setParticipationError] = useState<string | null>(
    null
  );

  const handleParticipation = async (
    statutChoice: UpdateMyReunionParticipationInput["statut"]
  ) => {
    if (!reunion.canUpdateParticipation || submitting) return;
    setParticipationError(null);
    setSubmitting(statutChoice);
    try {
      await updateMyReunionParticipation(reunion.id, { statut: statutChoice });
      onParticipationSuccess(reunion.id, statutChoice);
      onReload();
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? participationErrorMessage(e)
          : "Impossible d'enregistrer votre participation";
      setParticipationError(message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${reunion.titre}, ${statut.label}, ${formatReunionDateTime(reunion.dateReunion)}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{reunion.titre}</Text>
          <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
        </View>
        <Text style={styles.cardDate}>
          {formatReunionDateTime(reunion.dateReunion)}
        </Text>
        {reunion.lieuLabel ? (
          <Text style={styles.cardLieu}>{reunion.lieuLabel}</Text>
        ) : null}
        <View style={styles.badgeRow}>
          <StatusBadge label={statut.label} tone={statut.tone} />
          {reunion.isHost ? (
            <StatusBadge label="Hôte" tone="primary" />
          ) : null}
          {participation ? (
            <StatusBadge
              label={participation.label}
              tone={participation.tone}
            />
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          {reunion.lieuAdresse ? (
            <DetailRow label="Adresse" value={reunion.lieuAdresse} />
          ) : reunion.statut === "EnAttente" ||
            reunion.statut === "MoisValide" ? (
            <DetailRow label="Adresse" value="Lieu à confirmer" />
          ) : null}
          {reunion.hostName ? (
            <DetailRow label="Hôte" value={reunion.hostName} />
          ) : null}
          {reunion.hostTelephones && reunion.hostTelephones.length > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Téléphone hôte</Text>
              {reunion.hostTelephones.map((tel) => (
                <Pressable
                  key={`${tel.numero}-${tel.type}`}
                  onPress={() => void Linking.openURL(`tel:${tel.numero}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`Appeler ${tel.numero}`}
                >
                  <Text style={styles.phoneValue}>
                    {tel.numero}
                    {tel.type ? ` (${tel.type})` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {reunion.isHost ? (
            <DetailRow label="Rôle" value="Vous êtes l'hôte" />
          ) : null}
          {reunion.commentaires ? (
            <DetailRow label="Commentaires" value={reunion.commentaires} />
          ) : null}

          <View style={styles.participationBlock}>
            <Text style={styles.participationTitle}>Ma participation</Text>
            {participation ? (
              <Text style={styles.participationCurrent}>
                {participation.label}
              </Text>
            ) : reunion.canUpdateParticipation ? (
              <Text style={styles.participationCurrent}>Non répondu</Text>
            ) : null}

            {reunion.canUpdateParticipation ? (
              <>
                <View style={styles.participationButtons}>
                  {PARTICIPATION_CHOICES.map(({ statut: choice, label }) => {
                    const isSelected = reunion.participationStatus === choice;
                    const isLoading = submitting === choice;
                    return (
                      <SecondaryButton
                        key={choice}
                        label={label}
                        loading={isLoading}
                        disabled={submitting !== null}
                        style={[
                          styles.participationBtn,
                          isSelected && styles.participationBtnSelected,
                        ]}
                        onPress={() => void handleParticipation(choice)}
                      />
                    );
                  })}
                </View>
                {submitting ? (
                  <View style={styles.submittingRow}>
                    <ActivityIndicator
                      size="small"
                      color={AmakiColors.primary}
                    />
                    <Text style={styles.submittingText}>Enregistrement…</Text>
                  </View>
                ) : null}
                {participationError ? (
                  <Text style={styles.participationError}>
                    {participationError}
                  </Text>
                ) : null}
              </>
            ) : participation ? (
              <Text style={styles.readOnlyHint}>Participation clôturée</Text>
            ) : null}
          </View>

          {!reunion.lieuAdresse &&
          !reunion.hostName &&
          !reunion.commentaires &&
          !reunion.isHost &&
          !reunion.canUpdateParticipation &&
          !participation ? (
            <Text style={styles.mutedDetail}>Aucun détail supplémentaire.</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  sectionTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.sm,
  },
  sectionCard: {
    marginBottom: AmakiSpacing.sm,
  },
  emptyText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    paddingVertical: AmakiSpacing.sm,
  },
  card: {
    marginBottom: AmakiSpacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
  },
  cardTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    flex: 1,
  },
  chevron: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
  },
  cardDate: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: AmakiSpacing.xs,
  },
  cardLieu: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 2,
    marginBottom: AmakiSpacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.sm,
  },
  details: {
    marginTop: AmakiSpacing.md,
    paddingTop: AmakiSpacing.md,
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    gap: AmakiSpacing.sm,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
  },
  detailValue: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
  },
  phoneValue: {
    ...AmakiTypography.body,
    color: AmakiColors.primary,
    textDecorationLine: "underline",
  },
  mutedDetail: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  participationBlock: {
    marginTop: AmakiSpacing.sm,
    gap: AmakiSpacing.sm,
  },
  participationTitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  participationCurrent: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "600",
  },
  participationButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.sm,
  },
  participationBtn: {
    flexGrow: 1,
    minWidth: 90,
  },
  participationBtnSelected: {
    backgroundColor: AmakiColors.primarySoft,
    borderColor: AmakiColors.primary,
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
  },
  submittingText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  participationError: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
  },
  readOnlyHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontStyle: "italic",
  },
});
