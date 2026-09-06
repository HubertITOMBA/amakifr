import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { getMySurvey, submitMySurveyAnswers } from "@/api/sondages";
import {
  formatSurveyPeriod,
  formatSurveyProgress,
  sondageErrorMessage,
} from "@/api/sondages-state";
import {
  ApiClientError,
  type MySurveyAnswerItem,
  type MySurveyDetailDto,
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
 * Questionnaire mobile — types Web (choix, texte, matrice).
 */
export default function SondageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<MySurveyDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MySurveyAnswerItem[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMySurvey(id);
      setDetail(data);
      setItems(data.maReponse?.items ?? []);
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorBanner message={error} /> : null}
      <Text style={styles.title}>{detail.sujet}</Text>
      <Text style={styles.period}>
        {formatSurveyPeriod(detail.dateDebut, detail.dateFin)}
      </Text>
      <Text style={styles.progress}>
        {formatSurveyProgress(detail.requiredAnswered, detail.requiredTotal)}
      </Text>
      {detail.introduction ? (
        <Text style={styles.intro}>{detail.introduction}</Text>
      ) : null}
      {!detail.modifiable ? (
        <Text style={styles.closed}>Ce sondage est maintenant clôturé.</Text>
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
  content: { padding: AmakiSpacing.lg, paddingBottom: AmakiSpacing["2xl"] },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  period: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
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
});
