import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  getMyElection,
  getMyElectionResults,
  submitMyCandidacy,
  submitMyVote,
  withdrawMyCandidacy,
} from "@/api/elections";
import {
  buildBallotSummary,
  buildVotePayload,
  candidacyBadgeTone,
  createEmptyBallot,
  electionErrorMessage,
  hasPositionChoice,
  isBallotComplete,
  selectBallotChoice,
  shouldShowApplyCta,
  shouldShowWithdrawCta,
  type LocalBallot,
} from "@/api/elections-state";
import {
  ApiClientError,
  type MyElectionDetailDto,
  type MyElectionPositionDto,
  type MyElectionResultsDto,
} from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Détail scrutin : candidatures (période) + bulletin vote (fenêtre vote) + résultats.
 */
export default function ElectionDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);

  const [detail, setDetail] = useState<MyElectionDetailDto | null>(null);
  const [results, setResults] = useState<MyElectionResultsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Aucune sélection par défaut — miroir Web `votes = {}` (pas de vote blanc implicite). */
  const [selections, setSelections] = useState<LocalBallot>(createEmptyBallot);
  const [applyForPositionId, setApplyForPositionId] = useState<string | null>(
    null
  );
  const [motivation, setMotivation] = useState("");
  const [programme, setProgramme] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const d = await getMyElection(id);
        setDetail(d);
        if (d.resultsAvailable) {
          try {
            setResults(await getMyElectionResults(id));
          } catch {
            setResults(null);
          }
        } else {
          setResults(null);
        }
      } catch (e) {
        setDetail(null);
        setError(
          e instanceof ApiClientError
            ? electionErrorMessage(e)
            : "Impossible de charger le scrutin"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pendingPositions = useMemo(() => {
    if (!detail) return [];
    return detail.positions.filter((p) => !p.alreadyVoted);
  }, [detail]);

  const ballotComplete = useMemo(
    () => isBallotComplete(
      pendingPositions.map((p) => p.id),
      selections
    ),
    [pendingPositions, selections]
  );

  const selectChoice = (positionId: string, value: string | "blanc") => {
    setSelections((prev) => selectBallotChoice(prev, positionId, value));
  };

  const confirmAndSubmit = () => {
    if (!detail || !id) return;
    const pendingIds = pendingPositions.map((p) => p.id);
    if (!isBallotComplete(pendingIds, selections)) {
      Alert.alert(
        "Bulletin incomplet",
        "Veuillez faire un choix pour chaque poste."
      );
      return;
    }
    const votes = buildVotePayload(
      selections,
      detail.positions.filter((p) => p.alreadyVoted).map((p) => p.id)
    );
    const summary = buildBallotSummary(pendingPositions, selections);
    const irrevocable = detail.voteIrrevocable
      ? "\n\nVotre vote est définitif et ne pourra pas être modifié."
      : "";
    Alert.alert(
      "Confirmer votre vote ?",
      `${summary}${irrevocable}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          style: "destructive",
          onPress: () => void doSubmit(votes),
        },
      ]
    );
  };

  const doSubmit = async (
    votes: Array<{ positionId: string; candidacyId: string | null }>
  ) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submitMyVote(id, votes);
      Alert.alert("Vote enregistré", r.message);
      setSelections(createEmptyBallot());
      await load(true);
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? electionErrorMessage(e)
          : "Échec de l'enregistrement du vote";
      setError(msg);
      Alert.alert("Vote refusé", msg);
    } finally {
      setBusy(false);
    }
  };

  const startApply = (positionId: string) => {
    setApplyForPositionId(positionId);
    setMotivation("");
    setProgramme("");
  };

  const cancelApply = () => {
    setApplyForPositionId(null);
    setMotivation("");
    setProgramme("");
  };

  const confirmApply = (pos: MyElectionPositionDto) => {
    if (!id) return;
    if (!motivation.trim() || !programme.trim()) {
      Alert.alert(
        "Formulaire incomplet",
        "Motivation et programme sont obligatoires."
      );
      return;
    }
    Alert.alert(
      "Confirmer votre candidature ?",
      `Poste : ${pos.titre}\nVotre candidature sera soumise pour validation.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: () => void doApply(pos.id),
        },
      ]
    );
  };

  const doApply = async (positionId: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submitMyCandidacy(id, positionId, {
        motivation: motivation.trim(),
        programme: programme.trim(),
      });
      Alert.alert("Candidature enregistrée", r.message);
      cancelApply();
      await load(true);
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? electionErrorMessage(e)
          : "Échec de la candidature";
      setError(msg);
      Alert.alert("Candidature refusée", msg);
    } finally {
      setBusy(false);
    }
  };

  const confirmWithdraw = (pos: MyElectionPositionDto) => {
    if (!id) return;
    Alert.alert(
      "Retirer ma candidature ?",
      `Poste : ${pos.titre}\nCette action est définitive.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => void doWithdraw(pos.id),
        },
      ]
    );
  };

  const doWithdraw = async (positionId: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await withdrawMyCandidacy(id, positionId);
      Alert.alert("Candidature retirée", r.message);
      await load(true);
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? electionErrorMessage(e)
          : "Échec du retrait";
      setError(msg);
      Alert.alert("Retrait refusé", msg);
      // Écran stale (scrutin commencé / votes) → resync DTO canWithdraw
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !detail) {
    return <LoadingState />;
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <ErrorBanner message={error || "Scrutin introuvable"} />
      </View>
    );
  }

  const statusTone =
    detail.status === "Ouverte"
      ? "success"
      : detail.status === "Preparation"
        ? "warning"
        : "neutral";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={AmakiColors.primary}
        />
      }
    >
      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{detail.titre}</Text>
          <StatusBadge label={detail.statusLabel} tone={statusTone} />
        </View>
        {detail.description ? (
          <Text style={styles.body}>{detail.description}</Text>
        ) : null}
        <Text style={styles.meta}>
          Scrutin : {new Date(detail.dateScrutin).toLocaleDateString("fr-FR")}
        </Text>
        <Text style={styles.meta}>
          Candidatures jusqu&apos;au{" "}
          {new Date(detail.dateClotureCandidature).toLocaleDateString("fr-FR")}
        </Text>
        <Text style={styles.meta}>État : {detail.personalLabel}</Text>
        {detail.candidaciesOpen ? (
          <Text style={styles.info}>Candidatures ouvertes</Text>
        ) : null}
        {!detail.eligibleCandidate && detail.eligibilityCandidateReason ? (
          <Text style={styles.warn}>{detail.eligibilityCandidateReason}</Text>
        ) : null}
        {!detail.eligible && detail.eligibilityReason ? (
          <Text style={styles.warn}>{detail.eligibilityReason}</Text>
        ) : null}
        {detail.voteIrrevocable && detail.canVote ? (
          <Text style={styles.warn}>
            Attention : le vote est irrévocable une fois confirmé.
          </Text>
        ) : null}
      </Card>

      {detail.positions.map((pos) => (
        <Card key={pos.id} style={styles.card}>
          <Text style={styles.posTitle}>{pos.titre}</Text>
          {pos.description ? (
            <Text style={styles.body}>{pos.description}</Text>
          ) : null}

          {pos.myCandidacyStatusLabel ? (
            <View style={styles.badgeRow}>
              <StatusBadge
                label={pos.myCandidacyStatusLabel}
                tone={candidacyBadgeTone(pos.myCandidacyStatus)}
              />
            </View>
          ) : null}

          {shouldShowApplyCta(pos) && applyForPositionId !== pos.id ? (
            <PrimaryButton
              label="Se porter candidat"
              onPress={() => startApply(pos.id)}
              style={styles.candidacyBtn}
            />
          ) : null}

          {applyForPositionId === pos.id ? (
            <View style={styles.applyForm}>
              <Text style={styles.fieldLabel}>Motivation</Text>
              <TextInput
                style={styles.input}
                multiline
                value={motivation}
                onChangeText={setMotivation}
                placeholder="Pourquoi ce poste ?"
                placeholderTextColor={AmakiColors.textMuted}
              />
              <Text style={styles.fieldLabel}>Programme</Text>
              <TextInput
                style={styles.input}
                multiline
                value={programme}
                onChangeText={setProgramme}
                placeholder="Votre programme / profession de foi"
                placeholderTextColor={AmakiColors.textMuted}
              />
              <View style={styles.applyActions}>
                <Pressable onPress={cancelApply} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Annuler</Text>
                </Pressable>
                <PrimaryButton
                  label="Soumettre"
                  loading={busy}
                  onPress={() => confirmApply(pos)}
                />
              </View>
            </View>
          ) : null}

          {shouldShowWithdrawCta(pos) ? (
            <Pressable
              onPress={() => confirmWithdraw(pos)}
              style={styles.withdrawBtn}
              disabled={busy}
            >
              <Text style={styles.withdrawText}>Retirer ma candidature</Text>
            </Pressable>
          ) : null}

          {pos.alreadyVoted ? (
            <Text style={styles.voted}>
              Vote enregistré
              {pos.myVote?.isBlanc ? " (blanc)" : ""}
              {pos.myVote
                ? ` — ${new Date(pos.myVote.dateVote).toLocaleString("fr-FR")}`
                : ""}
            </Text>
          ) : detail.canVote ? (
            <View style={styles.choices} accessibilityRole="radiogroup">
              <Text style={styles.ballotHint}>
                {hasPositionChoice(selections, pos.id)
                  ? "1 choix (candidat ou blanc)"
                  : "Aucun choix — sélectionnez un candidat ou vote blanc"}
              </Text>
              {/* Ordre Web : Vote blanc puis candidats ; radio exclusif (1 / poste). */}
              <Pressable
                style={[
                  styles.choice,
                  selections[pos.id] === "blanc" && styles.choiceOn,
                ]}
                onPress={() => selectChoice(pos.id, "blanc")}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selections[pos.id] === "blanc",
                }}
                hitSlop={8}
              >
                <Text style={styles.radioMark} accessibilityElementsHidden>
                  {selections[pos.id] === "blanc" ? "●" : "○"}
                </Text>
                <View style={styles.choiceTextCol}>
                  <Text style={styles.choiceTitle}>Vote blanc</Text>
                  <Text style={styles.choiceBody}>
                    Je ne souhaite pas voter pour ce poste
                  </Text>
                </View>
              </Pressable>
              {pos.candidates.map((c) => {
                const selected = selections[pos.id] === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.choice, selected && styles.choiceOn]}
                    onPress={() => selectChoice(pos.id, c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    hitSlop={8}
                  >
                    <Text style={styles.radioMark} accessibilityElementsHidden>
                      {selected ? "●" : "○"}
                    </Text>
                    <View style={styles.choiceTextCol}>
                      <Text style={styles.choiceTitle}>{c.displayName}</Text>
                      {c.motivation ? (
                        <Text style={styles.choiceBody} numberOfLines={3}>
                          {c.motivation}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {pos.candidates.length === 0 ? (
                <Text style={styles.meta}>
                  Aucun candidat validé pour ce poste (vote blanc possible).
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.choices}>
              {pos.candidates.map((c) => (
                <View key={c.id} style={styles.choice}>
                  <Text style={styles.choiceTitle}>{c.displayName}</Text>
                  {c.programme ? (
                    <Text style={styles.choiceBody} numberOfLines={4}>
                      {c.programme}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}

      {detail.canVote && pendingPositions.length > 0 ? (
        <PrimaryButton
          label="Confirmer mon vote"
          loading={busy}
          disabled={!ballotComplete}
          onPress={confirmAndSubmit}
          style={styles.submit}
        />
      ) : null}

      {results ? (
        <Card style={styles.card}>
          <Text style={styles.posTitle}>Résultats</Text>
          {results.positions.map((p) => (
            <View key={p.positionId} style={styles.resultBlock}>
              <Text style={styles.choiceTitle}>{p.titre}</Text>
              <Text style={styles.meta}>
                {p.totalVotes} suffrage(s) · {p.blankVotes} blanc(s)
              </Text>
              {p.candidacies.map((c) => (
                <Text key={c.candidacyId} style={styles.body}>
                  {c.displayName} — {c.votesCount} (
                  {c.percentage.toFixed(1)} %)
                </Text>
              ))}
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  content: { padding: AmakiSpacing.md, paddingBottom: AmakiSpacing.xl },
  card: { marginBottom: AmakiSpacing.md },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    flex: 1,
    fontWeight: "700",
  },
  body: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
    marginTop: 6,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 4,
  },
  info: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    marginTop: 8,
    fontWeight: "600",
  },
  warn: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    marginTop: 8,
    fontWeight: "600",
  },
  posTitle: {
    ...AmakiTypography.body,
    fontWeight: "700",
    color: AmakiColors.text,
  },
  badgeRow: { marginTop: AmakiSpacing.sm },
  candidacyBtn: { marginTop: AmakiSpacing.sm },
  applyForm: { marginTop: AmakiSpacing.sm, gap: AmakiSpacing.xs },
  fieldLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    fontWeight: "600",
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    minHeight: 72,
    textAlignVertical: "top",
    color: AmakiColors.text,
    backgroundColor: AmakiColors.surface,
  },
  applyActions: {
    marginTop: AmakiSpacing.sm,
    gap: AmakiSpacing.sm,
  },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  withdrawBtn: {
    marginTop: AmakiSpacing.sm,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  withdrawText: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "600",
  },
  voted: {
    ...AmakiTypography.caption,
    color: AmakiColors.success,
    marginTop: 8,
    fontWeight: "600",
  },
  choices: { marginTop: AmakiSpacing.sm, gap: AmakiSpacing.sm },
  ballotHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: 2,
  },
  choice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AmakiSpacing.sm,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    backgroundColor: AmakiColors.surface,
    minHeight: 52,
  },
  choiceOn: {
    borderColor: AmakiColors.primary,
    backgroundColor: "#eff6ff",
  },
  radioMark: {
    fontSize: 22,
    lineHeight: 28,
    color: AmakiColors.primary,
    width: 28,
    textAlign: "center",
  },
  choiceTextCol: { flex: 1, minWidth: 0 },
  choiceTitle: {
    ...AmakiTypography.body,
    fontWeight: "600",
    color: AmakiColors.text,
  },
  choiceBody: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 4,
  },
  submit: { marginBottom: AmakiSpacing.lg },
  resultBlock: { marginTop: AmakiSpacing.sm },
});
