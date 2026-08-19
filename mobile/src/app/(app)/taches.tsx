import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getMyTaches, createMyTacheCommentaire } from "@/api/taches";
import { formatTacheDate, formatTacheDateTime, tachesErrorMessage } from "@/api/taches-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MyTacheDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ScreenMode = "loading" | "data" | "empty" | "error";

/**
 * Écran Mes tâches — lecture + commentaires self-service.
 */
export default function TachesScreen() {
  const [taches, setTaches] = useState<MyTacheDto[]>([]);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) setRefreshing(true);
    else setMode("loading");
    setError(null);

    try {
      const data = await getMyTaches();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setTaches(data);
      setMode(data.length > 0 ? "data" : "empty");
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setMode("error");
      setError(
        e instanceof ApiClientError
          ? tachesErrorMessage(e)
          : "Impossible de charger les tâches"
      );
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (mode === "loading") return <LoadingState />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
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

        {mode === "empty" ? (
          <Card muted>
            <Text style={styles.emptyText}>
              Aucune tâche ne vous est actuellement affectée.
            </Text>
          </Card>
        ) : null}

        {mode === "data" ? (
          <TachesGroupedByProjet
            taches={taches}
            expandedId={expandedId}
            onToggle={(id) =>
              setExpandedId((prev) => (prev === id ? null : id))
            }
            onCommentAdded={() => void load(true)}
          />
        ) : null}

        {mode === "error" && !error ? (
          <Card muted>
            <Text style={styles.emptyText}>
              Impossible de charger les tâches.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Groupement par projet ────────────────────────────── */

function TachesGroupedByProjet({
  taches,
  expandedId,
  onToggle,
  onCommentAdded,
}: {
  taches: MyTacheDto[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onCommentAdded: () => void;
}) {
  const groups = new Map<string, { titre: string; items: MyTacheDto[] }>();
  for (const t of taches) {
    const key = t.projet.id;
    if (!groups.has(key)) {
      groups.set(key, { titre: t.projet.titre, items: [] });
    }
    groups.get(key)!.items.push(t);
  }

  return (
    <>
      {[...groups.entries()].map(([projetId, group]) => (
        <View key={projetId} style={styles.projetSection}>
          <Text style={styles.projetTitle}>{group.titre}</Text>
          {group.items.map((tache) => (
            <TacheCard
              key={tache.id}
              tache={tache}
              expanded={expandedId === tache.id}
              onToggle={() => onToggle(tache.id)}
              onCommentAdded={onCommentAdded}
            />
          ))}
        </View>
      ))}
    </>
  );
}

/* ── Carte tâche ────────────────────────────────────────── */

function TacheCard({
  tache,
  expanded,
  onToggle,
  onCommentAdded,
}: {
  tache: MyTacheDto;
  expanded: boolean;
  onToggle: () => void;
  onCommentAdded: () => void;
}) {
  return (
    <Card>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <View style={styles.tacheHeader}>
          <View style={styles.tacheHeaderLeft}>
            <Text style={styles.tacheTitre}>{tache.titre}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{tache.statut}</Text>
              {tache.responsable ? (
                <Text style={styles.badgeResp}>Responsable</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.tacheBody}>
          {tache.description ? (
            <Text style={styles.description}>{tache.description}</Text>
          ) : null}

          <View style={styles.datesRow}>
            <Text style={styles.dateLabel}>Début :</Text>
            <Text style={styles.dateValue}>
              {formatTacheDate(tache.dateDebut)}
            </Text>
            <Text style={[styles.dateLabel, styles.dateGap]}>Fin :</Text>
            <Text style={styles.dateValue}>
              {formatTacheDate(tache.dateFin)}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            Commentaires ({tache.commentaires.length})
          </Text>

          {tache.commentaires.map((c) => (
            <View key={c.id} style={styles.commentaire}>
              <Text style={styles.commentAuteur}>
                {c.auteur.firstname ?? ""} {c.auteur.lastname ?? ""}
              </Text>
              <Text style={styles.commentDate}>
                {formatTacheDateTime(c.createdAt)}
              </Text>
              <Text style={styles.commentContenu}>{c.contenu}</Text>
              {c.pourcentageAvancement != null ? (
                <Text style={styles.commentPourcentage}>
                  Avancement : {c.pourcentageAvancement} %
                </Text>
              ) : null}
            </View>
          ))}

          <CommentForm tacheId={tache.id} onSuccess={onCommentAdded} />
        </View>
      ) : null}
    </Card>
  );
}

/* ── Formulaire commentaire ─────────────────────────────── */

function CommentForm({
  tacheId,
  onSuccess,
}: {
  tacheId: string;
  onSuccess: () => void;
}) {
  const [contenu, setContenu] = useState("");
  const [pourcentage, setPourcentage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = contenu.trim();
    if (!trimmed) {
      setFormError("Le commentaire ne peut pas être vide.");
      return;
    }

    let pct: number | undefined;
    if (pourcentage.trim()) {
      const n = Number(pourcentage.trim());
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        setFormError("Le pourcentage doit être un entier entre 0 et 100.");
        return;
      }
      pct = n;
    }

    setSending(true);
    setFormError(null);
    try {
      await createMyTacheCommentaire(tacheId, {
        contenu: trimmed,
        pourcentageAvancement: pct,
      });
      setContenu("");
      setPourcentage("");
      onSuccess();
    } catch (e) {
      setFormError(
        e instanceof ApiClientError
          ? tachesErrorMessage(e)
          : "Erreur lors de l'envoi du commentaire"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>Ajouter un commentaire</Text>
      <TextInput
        style={styles.textArea}
        value={contenu}
        onChangeText={setContenu}
        placeholder="Votre commentaire…"
        placeholderTextColor={AmakiColors.textMuted}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        accessibilityLabel="Commentaire"
      />
      <Text style={styles.formLabel}>Avancement (%) — optionnel</Text>
      <TextInput
        style={styles.input}
        value={pourcentage}
        onChangeText={setPourcentage}
        placeholder="0 à 100"
        placeholderTextColor={AmakiColors.textMuted}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel="Pourcentage d'avancement"
      />
      {formError ? <ErrorBanner message={formError} /> : null}
      <PrimaryButton
        label="Envoyer"
        onPress={() => void handleSubmit()}
        loading={sending}
        disabled={sending || !contenu.trim()}
        style={styles.submitBtn}
      />
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: AmakiSpacing.lg,
    gap: AmakiSpacing.md,
    backgroundColor: AmakiColors.background,
  },
  emptyText: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
  projetSection: {
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.md,
  },
  projetTitle: {
    ...AmakiTypography.title,
    color: AmakiColors.primary,
  },
  tacheHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tacheHeaderLeft: { flex: 1, marginRight: AmakiSpacing.sm },
  tacheTitre: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
  },
  badgeRow: {
    flexDirection: "row",
    gap: AmakiSpacing.xs,
    marginTop: AmakiSpacing.xs,
  },
  badge: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    backgroundColor: AmakiColors.primarySoft,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: 2,
    borderRadius: AmakiRadius.sm,
    overflow: "hidden",
  },
  badgeResp: {
    ...AmakiTypography.caption,
    color: AmakiColors.surface,
    backgroundColor: AmakiColors.primary,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: 2,
    borderRadius: AmakiRadius.sm,
    overflow: "hidden",
  },
  chevron: {
    fontSize: 14,
    color: AmakiColors.textMuted,
    marginTop: 2,
  },
  tacheBody: {
    marginTop: AmakiSpacing.md,
  },
  description: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: AmakiSpacing.md,
  },
  dateLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
  },
  dateValue: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    marginLeft: AmakiSpacing.xs,
  },
  dateGap: { marginLeft: AmakiSpacing.md },
  sectionLabel: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  commentaire: {
    backgroundColor: AmakiColors.primarySoft,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.sm,
  },
  commentAuteur: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.text,
  },
  commentDate: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 2,
  },
  commentContenu: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.xs,
  },
  commentPourcentage: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "600",
    marginTop: AmakiSpacing.xs,
  },
  form: {
    marginTop: AmakiSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    paddingTop: AmakiSpacing.md,
  },
  formLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
    marginBottom: AmakiSpacing.xs,
    textTransform: "uppercase",
  },
  textArea: {
    ...AmakiTypography.body,
    backgroundColor: AmakiColors.background,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    minHeight: 80,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  input: {
    ...AmakiTypography.body,
    backgroundColor: AmakiColors.background,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  submitBtn: {
    marginTop: AmakiSpacing.sm,
  },
});
