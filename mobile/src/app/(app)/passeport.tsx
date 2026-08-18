import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { generateMyPasseport, getMyPasseport } from "@/api/passeport";
import { openMyPasseportPdf } from "@/api/passeport-pdf";
import {
  formatPasseportDate,
  passeportErrorMessage,
} from "@/api/passeport-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type PasseportDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type ScreenMode = "loading" | "inactive" | "not_generated" | "generated" | "error";

/**
 * Écran Passeport — self-service adhérent (metadata + génération + PDF).
 */
export default function PasseportScreen() {
  const [data, setData] = useState<PasseportDto | null>(null);
  const [mode, setMode] = useState<ScreenMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const guardRef = useRef<LoadGuard>(createLoadGuard());

  const applyDto = useCallback((dto: PasseportDto) => {
    setData(dto);
    if (!dto.disponible) {
      setMode("inactive");
      return;
    }
    if (dto.numeroPasseport) {
      setMode("generated");
      return;
    }
    setMode("not_generated");
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setMode("loading");
      }
      setError(null);

      try {
        const dto = await getMyPasseport();
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        applyDto(dto);
      } catch (e) {
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        if (e instanceof ApiClientError && e.status === 403) {
          setMode("inactive");
          setData(null);
          setError(passeportErrorMessage(e));
          return;
        }
        setMode("error");
        if (e instanceof ApiClientError) {
          setError(passeportErrorMessage(e));
        } else {
          setError("Impossible de charger le passeport");
        }
      } finally {
        const ended = endLoad(guardRef.current);
        guardRef.current = ended.guard;
        if (ended.clearSpinners) {
          setRefreshing(false);
        }
      }
    },
    [applyDto]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const dto = await generateMyPasseport();
      applyDto(dto);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(passeportErrorMessage(e));
      } else {
        setError("Impossible de générer le passeport");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function onOpenPdf() {
    if (!data?.numeroPasseport) return;
    setOpeningPdf(true);
    setError(null);
    try {
      const result = await openMyPasseportPdf(data.numeroPasseport);
      if (!result.ok) {
        if (result.reason === "fetch_failed") {
          setError("Impossible de télécharger le passeport PDF");
        } else if (result.reason === "write_failed") {
          setError("Impossible d'enregistrer le fichier temporairement");
        } else {
          Alert.alert(
            "Ouverture impossible",
            "Le partage de fichiers n'est pas disponible sur cet appareil."
          );
        }
      }
    } finally {
      setOpeningPdf(false);
    }
  }

  if (mode === "loading") {
    return <LoadingState />;
  }

  return (
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
      {error ? <ErrorBanner message={error} /> : null}

      {mode === "inactive" ? (
        <Card muted>
          <Text style={styles.cardTitle}>Passeport indisponible</Text>
          <Text style={styles.cardBody}>
            Votre passeport sera disponible lorsque votre compte sera actif.
          </Text>
        </Card>
      ) : null}

      {mode === "not_generated" ? (
        <Card>
          <Text style={styles.cardTitle}>
            Votre passeport n&apos;a pas encore été généré.
          </Text>
          <PrimaryButton
            label="Générer mon passeport"
            onPress={() => void onGenerate()}
            loading={generating}
            style={styles.action}
          />
        </Card>
      ) : null}

      {mode === "generated" && data ? (
        <Card>
          <Text style={styles.label}>Numéro</Text>
          <Text style={styles.value}>{data.numeroPasseport}</Text>

          <Text style={[styles.label, styles.fieldGap]}>Date d&apos;émission</Text>
          <Text style={styles.value}>
            {formatPasseportDate(data.dateGenerationPasseport)}
          </Text>

          <PrimaryButton
            label="Ouvrir mon passeport PDF"
            onPress={() => void onOpenPdf()}
            loading={openingPdf}
            style={styles.action}
          />
          <Text style={styles.hint}>
            Le fichier est généré à la demande et n&apos;est pas conservé sur
            votre appareil.
          </Text>
        </Card>
      ) : null}

      {mode === "error" && !error ? (
        <Card muted>
          <Text style={styles.cardBody}>Impossible de charger le passeport.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: AmakiSpacing.lg,
    gap: AmakiSpacing.md,
    backgroundColor: AmakiColors.background,
  },
  cardTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  cardBody: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
  },
  label: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  value: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.xs,
  },
  fieldGap: {
    marginTop: AmakiSpacing.md,
  },
  action: {
    marginTop: AmakiSpacing.lg,
  },
  hint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.sm,
  },
});
