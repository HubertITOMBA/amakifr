import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import {
  getMySurvey,
  getMySurveyCollectiveResults,
  submitMySurveyAnswers,
} from "@/api/sondages";
import {
  formatSurveyPeriod,
  formatSurveyProgress,
  sondageErrorMessage,
} from "@/api/sondages-state";
import {
  ApiClientError,
  type MySurveyAnswerItem,
  type MySurveyCollectiveResultsDto,
  type MySurveyDetailDto,
  type MySurveyQuestionDto,
} from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ChoiceKind = "radio" | "checkbox";

/**
 * Ligne de choix alignée Web : radio (unique) ou checkbox (multiple).
 * Indicateur + texte (pas uniquement la couleur).
 */
function ChoiceRow({
  label,
  selected,
  kind,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  kind: ChoiceKind;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={kind === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      style={[styles.choiceRow, selected && styles.choiceRowSelected]}
      hitSlop={4}
    >
      <View
        style={[
          kind === "radio" ? styles.radioOuter : styles.checkOuter,
          selected && styles.controlSelected,
        ]}
      >
        {selected ? (
          kind === "radio" ? (
            <View style={styles.radioInner} />
          ) : (
            <Text style={styles.checkMark}>✓</Text>
          )
        ) : null}
      </View>
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * Questions + choix en lecture seule (consultation après clôture sans réponse).
 */
function ReadOnlyQuestions({ questions }: { questions: MySurveyQuestionDto[] }) {
  return (
    <>
      {questions.map((q) => (
        <Card key={q.id} style={styles.qCard}>
          <Text style={styles.qTitle}>
            {q.libelle}
            {q.obligatoire ? " *" : ""}
          </Text>
          {q.type === "TexteLibre" ? (
            <Text style={styles.metaMuted}>Champ texte libre</Text>
          ) : null}
          {q.type === "ChoixUnique" || q.type === "ChoixMultiple"
            ? q.options.map((o) => (
                <ChoiceRow
                  key={o.id}
                  kind={q.type === "ChoixUnique" ? "radio" : "checkbox"}
                  label={o.libelle}
                  selected={false}
                  disabled
                  onPress={() => {}}
                />
              ))
            : null}
          {q.type === "Matrice"
            ? q.lignesMatrice.map((line) => (
                <View key={line.id} style={styles.matrixRow}>
                  <Text style={styles.matrixLabel}>{line.libelle}</Text>
                  {q.options.map((o) => (
                    <ChoiceRow
                      key={o.id}
                      kind="radio"
                      label={o.libelle}
                      selected={false}
                      disabled
                      onPress={() => {}}
                    />
                  ))}
                </View>
              ))
            : null}
        </Card>
      ))}
    </>
  );
}

/** Accents bleu / turquoise pour les barres (alignés synthèse admin Web). */
const BAR_BLUE = AmakiColors.primary;
const BAR_TEAL = "#14b8a6";

/**
 * Ligne de résultat collectif : libellé, effectif, %, barre proportionnelle.
 * 0 % → piste vide (pas de remplissage).
 */
function CollectiveChoiceBar({
  libelle,
  count,
  percent,
  toneIndex,
}: {
  libelle: string;
  count: number;
  percent: number;
  toneIndex: number;
}) {
  const safePercent = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  const fillColor = toneIndex % 2 === 0 ? BAR_BLUE : BAR_TEAL;

  return (
    <View
      style={styles.resultRow}
      accessibilityLabel={`${libelle}, ${count}, ${safePercent} pour cent`}
    >
      <View style={styles.resultRowHeader}>
        <Text style={styles.resultLabel}>{libelle}</Text>
        <Text style={styles.resultMeta}>
          {count} — {safePercent} %
        </Text>
      </View>
      <View style={styles.resultTrack}>
        {safePercent > 0 ? (
          <View
            style={[
              styles.resultFill,
              {
                width: `${safePercent}%`,
                backgroundColor: fillColor,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Bloc résultats collectifs (uniquement si ADMIN a autorisé).
 * Présentation distincte de « Ma synthèse » (accent turquoise).
 */
function CollectiveResultsBlock({
  data,
}: {
  data: MySurveyCollectiveResultsDto;
}) {
  return (
    <View style={styles.collectiveBlock}>
      <View style={styles.collectiveHeader}>
        <Text style={styles.collectiveTitle}>Résultats collectifs</Text>
        <Text style={styles.collectiveSubtitle}>
          Agrégats publiés pour les adhérents
        </Text>
      </View>
      <View style={styles.participationSummary}>
        <Text style={styles.participationLabel}>Participation</Text>
        <Text style={styles.participationValue}>
          {data.totalReponses} réponse(s) / {data.totalAdherentsActifs}{" "}
          adhérent(s) actifs
        </Text>
        <Text style={styles.participationRate}>
          {data.tauxParticipation} %
        </Text>
      </View>
      {data.questions.map((q) => (
        <Card key={q.id} style={styles.collectiveCard}>
          <Text style={styles.qTitle}>{q.libelle}</Text>
          {q.choix?.map((c, idx) => (
            <CollectiveChoiceBar
              key={c.optionId}
              libelle={c.libelle}
              count={c.count}
              percent={c.percent}
              toneIndex={idx}
            />
          ))}
          {q.matrice?.map((line) => (
            <View key={line.ligneId} style={styles.matrixRow}>
              <Text style={styles.matrixLabel}>{line.libelle}</Text>
              {line.colonnes.map((c, idx) => (
                <CollectiveChoiceBar
                  key={c.optionId}
                  libelle={c.libelle}
                  count={c.count}
                  percent={c.percent}
                  toneIndex={idx}
                />
              ))}
            </View>
          ))}
          {typeof q.textesCount === "number" ? (
            <Text style={styles.metaMuted}>
              {q.textesCount} réponse(s) texte
            </Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

/**
 * En-tête de section « Ma synthèse » (réponses personnelles).
 */
function PersonalSyntheseHeader() {
  return (
    <View style={styles.personalHeader}>
      <Text style={styles.personalTitle}>Ma synthèse</Text>
      <Text style={styles.personalSubtitle}>Vos réponses — lecture seule</Text>
    </View>
  );
}

/**
 * Questionnaire mobile — types Web (choix, texte, matrice).
 */
export default function SondageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<MySurveyDetailDto | null>(null);
  const [collective, setCollective] =
    useState<MySurveyCollectiveResultsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MySurveyAnswerItem[]>([]);
  const liveSelectedRef = useRef<Record<string, string>>({});
  const [, setLiveTick] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMySurvey(id);
      setDetail(data);
      setItems(data.maReponse?.items ?? []);
      if (data.resultatsCollectifsPublies) {
        try {
          setCollective(await getMySurveyCollectiveResults(id));
        } catch {
          setCollective(null);
        }
      } else {
        setCollective(null);
      }
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? sondageErrorMessage(e)
          : "Impossible de charger le sondage"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const livePollRef = useRef({ modeEnDirect: false, modifiable: false });
  useEffect(() => {
    livePollRef.current = {
      modeEnDirect: Boolean(detail?.modeEnDirect),
      modifiable: Boolean(detail?.modifiable),
    };
  }, [detail?.modeEnDirect, detail?.modifiable]);

  // Actualisation auto du quiz En direct tant que l'écran est au premier plan.
  useFocusEffect(
    useCallback(() => {
      if (!id) return undefined;
      let alive = true;
      const tick = () => {
        if (!alive) return;
        if (AppState.currentState !== "active") return;
        if (!livePollRef.current.modeEnDirect || !livePollRef.current.modifiable) {
          return;
        }
        void getMySurvey(id)
          .then((data) => {
            if (!alive) return;
            setDetail(data);
          })
          .catch(() => {
            /* garde l'état courant */
          });
      };
      const interval = setInterval(tick, 2500);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") tick();
      });
      return () => {
        alive = false;
        clearInterval(interval);
        sub.remove();
      };
    }, [id])
  );

  const byQuestion = useMemo(() => {
    const map = new Map<string, MySurveyAnswerItem[]>();
    for (const item of items) {
      const list = map.get(item.questionId) ?? [];
      list.push(item);
      map.set(item.questionId, list);
    }
    return map;
  }, [items]);

  function setChoixUnique(questionId: string, optionId: string) {
    setItems((prev) => [
      ...prev.filter((i) => i.questionId !== questionId),
      { questionId, optionId },
    ]);
  }

  function toggleChoixMultiple(questionId: string, optionId: string) {
    setItems((prev) => {
      const others = prev.filter(
        (i) => !(i.questionId === questionId && i.optionId === optionId)
      );
      const exists = prev.some(
        (i) => i.questionId === questionId && i.optionId === optionId
      );
      if (exists) return others;
      return [...others, { questionId, optionId }];
    });
  }

  function setTexte(questionId: string, texteLibre: string) {
    setItems((prev) => [
      ...prev.filter((i) => i.questionId !== questionId),
      { questionId, texteLibre },
    ]);
  }

  function setMatrice(
    questionId: string,
    ligneMatriceId: string,
    optionId: string
  ) {
    setItems((prev) => [
      ...prev.filter(
        (i) =>
          !(i.questionId === questionId && i.ligneMatriceId === ligneMatriceId)
      ),
      { questionId, ligneMatriceId, optionId },
    ]);
  }

  async function save(mode: "partial" | "complete") {
    if (!id || !detail) return;
    if (!detail.modifiable) {
      Alert.alert("Sondage clôturé", "Ce sondage est maintenant clôturé.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await submitMySurveyAnswers(id, { items, mode });
      if (mode === "complete" || res.estComplet) {
        Alert.alert("Enregistré", "Merci pour vos réponses.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          "Brouillon enregistré",
          "Vous pourrez terminer plus tard."
        );
        await load();
      }
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? sondageErrorMessage(e)
          : "Enregistrement impossible"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !detail) return <LoadingState />;
  if (!detail) {
    return (
      <View style={styles.root}>
        <ErrorBanner message={error || "Sondage introuvable"} />
      </View>
    );
  }

  const vue = detail.vue ?? (detail.modifiable ? "formulaire" : "synthese");
  const synthese = detail.synthesePersonnelle;
  const live = detail.live;

  // Quiz En direct : une question à la fois (jamais le formulaire multi-questions).
  if (vue === "en_direct" || (detail.modeEnDirect && detail.modifiable)) {
    const q = live?.question ?? null;
    const ouverte = live?.phase === "question_ouverte";
    const selectedId = liveSelectedRef.current[q?.id ?? ""] ?? q?.monOptionId ?? null;

    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
      >
        {error ? <ErrorBanner message={error} /> : null}
        <Text style={styles.title}>{detail.sujet}</Text>
        <View style={styles.liveBadgeRow}>
          <Text style={styles.kindBadge}>
            {detail.kindLabel ?? detail.kind ?? "Quiz"}
          </Text>
          <Text style={styles.liveBadge}>En direct</Text>
        </View>
        <Text style={styles.period}>
          {formatSurveyPeriod(detail.dateDebut, detail.dateFin)}
        </Text>
        <Text style={styles.liveMessage}>
          {live?.message ?? "En attente de la prochaine question"}
        </Text>

        {!q ? (
          <Card style={styles.qCard}>
            <Text style={styles.waitingTitle}>En attente de la prochaine question</Text>
            <Text style={styles.metaMuted}>
              L&apos;écran se met à jour automatiquement.
            </Text>
          </Card>
        ) : (
          <Card style={styles.qCard}>
            <Text style={styles.qMeta}>Question {q.ordre + 1}</Text>
            <Text style={styles.qTitle}>{q.libelle}</Text>
            {q.options.map((o) => (
              <ChoiceRow
                key={o.id}
                kind="radio"
                label={o.libelle}
                selected={selectedId === o.id}
                disabled={!ouverte || saving}
                onPress={() => {
                  liveSelectedRef.current[q.id] = o.id;
                  setLiveTick((n) => n + 1);
                }}
              />
            ))}
            {ouverte ? (
              <PrimaryButton
                label={
                  saving
                    ? "Enregistrement…"
                    : q.monOptionId
                      ? "Modifier ma réponse"
                      : "Enregistrer"
                }
                disabled={saving || !selectedId}
                onPress={async () => {
                  if (!selectedId) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await submitMySurveyAnswers(id, {
                      items: [{ questionId: q.id, optionId: selectedId }],
                      mode: "partial",
                    });
                    Alert.alert(
                      "Réponse enregistrée",
                      "Vous pouvez encore modifier tant que la question est ouverte."
                    );
                    await load();
                  } catch (e) {
                    setError(
                      e instanceof ApiClientError
                        ? sondageErrorMessage(e)
                        : "Enregistrement impossible"
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            ) : null}
            {live?.phase === "corrige_question" ? (
              <View style={styles.corrigeBox}>
                {typeof q.estCorrecte === "boolean" ? (
                  <Text
                    style={q.estCorrecte ? styles.corrigeOk : styles.corrigeKo}
                  >
                    {q.estCorrecte ? "Bonne réponse" : "Réponse incorrecte"}
                  </Text>
                ) : null}
                {q.bonneReponse ? (
                  <Text style={styles.corrigeBonne}>
                    Corrigé : {q.bonneReponse}
                  </Text>
                ) : null}
                {q.explication ? (
                  <Text style={styles.corrigeExpl}>{q.explication}</Text>
                ) : null}
              </View>
            ) : null}
            {live?.phase === "question_fermee" ? (
              <Text style={styles.metaMuted}>
                Réponses fermées — en attente de la suite
              </Text>
            ) : null}
          </Card>
        )}
        {detail.conclusion ? (
          <Text style={styles.intro}>{detail.conclusion}</Text>
        ) : null}
      </ScrollView>
    );
  }

  // Après clôture sans réponse : consultation questions/choix + message
  if (vue === "non_repondu") {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
      >
        {error ? <ErrorBanner message={error} /> : null}
        <Text style={styles.title}>{detail.sujet}</Text>
        <Text style={styles.kindBadge}>
          {detail.kindLabel ?? detail.kind ?? "Sondage"}
        </Text>
        <Text style={styles.period}>
          {formatSurveyPeriod(detail.dateDebut, detail.dateFin)}
        </Text>
        <Text style={styles.closed}>Ce sondage est maintenant clôturé.</Text>
        <Card style={styles.qCard}>
          <Text style={styles.nonRepondu}>
            {synthese?.message ?? "Vous n’avez pas répondu"}
          </Text>
        </Card>
        {detail.introduction ? (
          <Text style={styles.intro}>{detail.introduction}</Text>
        ) : null}
        <ReadOnlyQuestions questions={detail.questions} />
        {detail.conclusion ? (
          <Text style={styles.intro}>{detail.conclusion}</Text>
        ) : null}
        {collective ? <CollectiveResultsBlock data={collective} /> : null}
      </ScrollView>
    );
  }

  // Après clôture avec réponses → synthèse personnelle lecture seule
  if (vue === "synthese" && synthese) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
      >
        {error ? <ErrorBanner message={error} /> : null}
        <Text style={styles.title}>{detail.sujet}</Text>
        <Text style={styles.kindBadge}>
          {detail.kindLabel ?? detail.kind ?? "Sondage"}
        </Text>
        <Text style={styles.period}>
          {formatSurveyPeriod(detail.dateDebut, detail.dateFin)}
        </Text>
        <Text style={styles.closed}>Ce sondage est maintenant clôturé.</Text>
        {detail.introduction ? (
          <Text style={styles.intro}>{detail.introduction}</Text>
        ) : null}
        {detail.conclusion ? (
          <Text style={styles.intro}>{detail.conclusion}</Text>
        ) : null}
        <View style={styles.personalBlock}>
          <PersonalSyntheseHeader />
          {synthese.corrigePublie && synthese.score ? (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={styles.scoreValue}>
                {synthese.score.correct} / {synthese.score.total}
              </Text>
            </View>
          ) : null}
          {synthese.questions.map((q) => (
            <Card key={q.questionId} style={styles.personalCard}>
              <Text style={styles.qTitle}>{q.libelle}</Text>
              {q.reponses.length === 0 ? (
                <Text style={styles.metaMuted}>Sans réponse</Text>
              ) : (
                q.reponses.map((r, idx) => (
                  <Text
                    key={`${q.questionId}-${idx}`}
                    style={styles.syntheseAnswer}
                  >
                    {r}
                  </Text>
                ))
              )}
              {synthese.corrigePublie ? (
                <View style={styles.corrigeBox}>
                  {typeof q.estCorrecte === "boolean" ? (
                    <Text
                      style={
                        q.estCorrecte
                          ? styles.corrigeOk
                          : styles.corrigeKo
                      }
                    >
                      {q.estCorrecte ? "Bonne réponse" : "Réponse incorrecte"}
                    </Text>
                  ) : null}
                  {q.bonneReponse ? (
                    <Text style={styles.corrigeBonne}>
                      Corrigé : {q.bonneReponse}
                    </Text>
                  ) : null}
                  {q.explication ? (
                    <Text style={styles.corrigeExpl}>{q.explication}</Text>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
        {collective ? <CollectiveResultsBlock data={collective} /> : null}
      </ScrollView>
    );
  }

  // Ouvert : formulaire (réponses préchargées pour modification)
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorBanner message={error} /> : null}
      <Text style={styles.title}>{detail.sujet}</Text>
      <Text style={styles.kindBadge}>
        {detail.kindLabel ?? detail.kind ?? "Sondage"}
      </Text>
      <Text style={styles.period}>
        {formatSurveyPeriod(detail.dateDebut, detail.dateFin)}
      </Text>
      <Text style={styles.progress}>
        {formatSurveyProgress(detail.requiredAnswered, detail.requiredTotal)}
      </Text>
      {detail.introduction ? (
        <Text style={styles.intro}>{detail.introduction}</Text>
      ) : null}

      {detail.questions.map((q) => {
        const answers = byQuestion.get(q.id) ?? [];
        return (
          <Card key={q.id} style={styles.qCard}>
            <Text style={styles.qTitle}>
              {q.libelle}
              {q.obligatoire ? " *" : ""}
            </Text>
            {q.type === "TexteLibre" ? (
              <TextInput
                style={styles.input}
                multiline
                editable={detail.modifiable}
                value={answers[0]?.texteLibre ?? ""}
                onChangeText={(t) => setTexte(q.id, t)}
                placeholder="Votre réponse"
                placeholderTextColor={AmakiColors.textMuted}
              />
            ) : null}
            {q.type === "ChoixUnique"
              ? q.options.map((o) => (
                  <ChoiceRow
                    key={o.id}
                    kind="radio"
                    label={o.libelle}
                    selected={answers.some((a) => a.optionId === o.id)}
                    disabled={!detail.modifiable}
                    onPress={() => setChoixUnique(q.id, o.id)}
                  />
                ))
              : null}
            {q.type === "ChoixMultiple"
              ? q.options.map((o) => (
                  <ChoiceRow
                    key={o.id}
                    kind="checkbox"
                    label={o.libelle}
                    selected={answers.some((a) => a.optionId === o.id)}
                    disabled={!detail.modifiable}
                    onPress={() => toggleChoixMultiple(q.id, o.id)}
                  />
                ))
              : null}
            {q.type === "Matrice"
              ? q.lignesMatrice.map((line) => (
                  <View key={line.id} style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>{line.libelle}</Text>
                    {q.options.map((o) => (
                      <ChoiceRow
                        key={o.id}
                        kind="radio"
                        label={o.libelle}
                        selected={answers.some(
                          (a) =>
                            a.ligneMatriceId === line.id && a.optionId === o.id
                        )}
                        disabled={!detail.modifiable}
                        onPress={() => setMatrice(q.id, line.id, o.id)}
                      />
                    ))}
                  </View>
                ))
              : null}
          </Card>
        );
      })}

      {detail.modifiable ? (
        <View style={styles.actions}>
          <SecondaryButton
            label={saving ? "…" : "Enregistrer et continuer plus tard"}
            onPress={() => void save("partial")}
            disabled={saving}
            style={styles.btn}
          />
          <PrimaryButton
            label={saving ? "…" : "Finaliser"}
            onPress={() => void save("complete")}
            disabled={saving}
            style={styles.btn}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  content: {
    paddingHorizontal: AmakiSpacing.lg,
    paddingTop: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  kindBadge: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.primaryStrong,
    marginBottom: AmakiSpacing.xs,
  },
  liveBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.xs,
  },
  liveBadge: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: "#0f766e",
  },
  liveMessage: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.md,
  },
  waitingTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  qMeta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.xs,
  },
  period: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  scoreBox: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
    alignItems: "center",
  },
  scoreLabel: {
    ...AmakiTypography.caption,
    color: "#0f766e",
    fontWeight: "700",
  },
  scoreValue: {
    ...AmakiTypography.title,
    color: "#0f766e",
  },
  corrigeBox: {
    marginTop: AmakiSpacing.sm,
    paddingTop: AmakiSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    gap: AmakiSpacing.xs,
  },
  corrigeOk: {
    ...AmakiTypography.caption,
    color: AmakiColors.success,
    fontWeight: "700",
  },
  corrigeKo: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "700",
  },
  corrigeBonne: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
  },
  corrigeExpl: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
  },
  nonRepondu: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    textAlign: "center",
    paddingVertical: AmakiSpacing.md,
  },
  syntheseAnswer: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.xs,
  },
  metaMuted: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
  },
  progress: {
    ...AmakiTypography.caption,
    color: AmakiColors.primaryStrong,
    fontWeight: "600",
    marginVertical: AmakiSpacing.sm,
  },
  intro: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.md,
  },
  closed: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "700",
    marginBottom: AmakiSpacing.md,
  },
  qCard: { marginBottom: AmakiSpacing.md },
  qTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    color: AmakiColors.text,
    backgroundColor: AmakiColors.surface,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.sm,
    paddingHorizontal: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xs,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    backgroundColor: AmakiColors.surface,
    minHeight: 44,
  },
  choiceRowSelected: {
    borderColor: AmakiColors.primaryBorder,
    backgroundColor: AmakiColors.primarySoft,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: AmakiColors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuter: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: AmakiColors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  controlSelected: {
    borderColor: AmakiColors.primary,
    backgroundColor: AmakiColors.surface,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AmakiColors.primary,
  },
  checkMark: {
    color: AmakiColors.primary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  choiceLabel: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    flex: 1,
  },
  matrixRow: { marginBottom: AmakiSpacing.md },
  matrixLabel: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  actions: { gap: AmakiSpacing.sm, marginTop: AmakiSpacing.md },
  btn: { alignSelf: "stretch" },
  personalBlock: {
    marginTop: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.md,
  },
  personalHeader: {
    backgroundColor: AmakiColors.primarySoft,
    borderWidth: 1,
    borderColor: AmakiColors.primaryBorder,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
  },
  personalTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.primaryStrong,
    marginBottom: AmakiSpacing.xs,
  },
  personalSubtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
  },
  personalCard: {
    marginBottom: AmakiSpacing.md,
    borderColor: AmakiColors.primaryBorder,
  },
  collectiveBlock: {
    marginTop: AmakiSpacing.lg,
    paddingTop: AmakiSpacing.md,
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
  },
  collectiveHeader: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
  },
  collectiveTitle: {
    ...AmakiTypography.heading,
    color: "#0f766e",
    marginBottom: AmakiSpacing.xs,
  },
  collectiveSubtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
  },
  participationSummary: {
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
  },
  participationLabel: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: "#0e7490",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: AmakiSpacing.xs,
  },
  participationValue: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
  },
  participationRate: {
    ...AmakiTypography.title,
    color: "#0f766e",
    marginTop: AmakiSpacing.xs,
  },
  collectiveCard: {
    marginBottom: AmakiSpacing.md,
    borderColor: "#99f6e4",
  },
  resultRow: {
    marginBottom: AmakiSpacing.sm,
  },
  resultRowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xs,
  },
  resultLabel: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    flex: 1,
    flexShrink: 1,
  },
  resultMeta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  resultTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: AmakiColors.surfaceMuted,
    overflow: "hidden",
  },
  resultFill: {
    height: "100%",
    borderRadius: 5,
  },
});
