import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPublishedRapport } from "@/api/rapports-reunion";
import {
  formatRapportDate,
  formatRapportDateTime,
  rapportErrorMessage,
} from "@/api/rapports-reunion-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MeetingReportDetailDto } from "@/api/types";
import { SafeMeetingReportHtml } from "@/features/rapports-reunion/SafeMeetingReportHtml";
import { isMeetingReportHtmlOversize } from "@/features/rapports-reunion/sanitize-meeting-report-html";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Mode = "loading" | "data" | "empty" | "error" | "oversize";

/**
 * Lecteur mobile d’un compte rendu PUBLISHED.
 * Route : /reunions/rapport/[id] — seul l’ID est transmis.
 */
export default function ReunionRapportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);

  const [detail, setDetail] = useState<MeetingReportDetailDto | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // invalide toute réponse tardive
      guardRef.current = beginLoad(guardRef.current).guard;
    };
  }, []);

  // Reset immédiat au changement d’ID (pas de flash d’ancien contenu)
  useEffect(() => {
    setDetail(null);
    setMode("loading");
    setError(null);
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
  }, [id]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) {
        setMode("error");
        setError("Compte rendu indisponible");
        return;
      }
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;

      if (isRefresh) setRefreshing(true);
      else setMode("loading");
      setError(null);

      try {
        const data = await getPublishedRapport(id);
        if (!mountedRef.current) return;
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        // Borne avant sanitization / tokenisation — pas de log du contenu.
        if (isMeetingReportHtmlOversize(data.contenuHtml ?? "")) {
          setDetail(data);
          setMode("oversize");
          return;
        }
        setDetail(data);
        const hasBody = Boolean(
          data.contenuHtml && data.contenuHtml.trim().length > 0
        );
        setMode(hasBody || data.titre ? "data" : "empty");
      } catch (e) {
        if (!mountedRef.current) return;
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setDetail(null);
        const message =
          e instanceof ApiClientError
            ? rapportErrorMessage(e)
            : "Impossible de charger le compte rendu";
        setError(message);
        setMode("error");
      } finally {
        if (!mountedRef.current) return;
        const ended = endLoad(guardRef.current);
        guardRef.current = ended.guard;
        if (ended.clearSpinners) setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (mode === "loading") {
    return <LoadingState />;
  }

  return (
    <View style={styles.safe}>
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
        {error ? (
          <Card muted style={styles.errorCard}>
            <ErrorBanner message={error} />
            <SecondaryButton
              label="Réessayer"
              onPress={() => void load(false)}
              style={styles.retry}
            />
          </Card>
        ) : null}

        {mode === "empty" && !error ? (
          <Card muted>
            <Text style={styles.emptyText}>
              Ce compte rendu ne contient pas de texte affichable.
            </Text>
          </Card>
        ) : null}

        {mode === "oversize" ? (
          <Card muted style={styles.errorCard}>
            <Text
              style={styles.emptyText}
              accessibilityRole="text"
              accessibilityLabel="Compte rendu trop volumineux"
            >
              Compte rendu trop volumineux
            </Text>
            <SecondaryButton
              label="Retour"
              onPress={() => router.back()}
              style={styles.retry}
            />
          </Card>
        ) : null}

        {mode === "data" && detail ? (
          <>
            <Text
              style={styles.title}
              accessibilityRole="header"
              accessibilityLabel={detail.titre}
            >
              {detail.titre}
            </Text>
            <Text style={styles.meta}>
              Réunion : {formatRapportDate(detail.dateReunion)}
            </Text>
            {detail.authorDisplayName ? (
              <Text style={styles.meta}>
                Auteur : {detail.authorDisplayName}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              Publié le {formatRapportDateTime(detail.publishedAt)}
            </Text>

            <Card style={styles.contentCard}>
              <SafeMeetingReportHtml html={detail.contenuHtml ?? ""} />
            </Card>
          </>
        ) : null}
      </ScrollView>
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
    gap: AmakiSpacing.sm,
  },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
  },
  contentCard: {
    marginTop: AmakiSpacing.md,
  },
  errorCard: {
    gap: AmakiSpacing.md,
  },
  retry: {
    minHeight: 44,
    alignSelf: "stretch",
  },
  emptyText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    paddingVertical: AmakiSpacing.sm,
  },
});
